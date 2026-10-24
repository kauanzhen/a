import { db } from '../../db/db';
import { registrarAuditoria } from '../../db/auditoria';
import type { Empresa } from '../../db/types';
import { agoraTimestamp, montarISO } from '../../lib/date';
import { UFS, formatarCNPJ, somenteDigitos, validarCNAE, validarCNPJ } from '../../lib/documentos';
import { interpretarMascara, reformatarCodigo } from '../../lib/mascara';
import { gerarPlanoPadrao } from '../planoContas/planoPadrao';
import { centrosCustoPadrao, historicosPadrao } from '../lancamentos/cadastrosPadrao';
import { fimPadraoExercicio, gerarPeriodos } from './periodoService';

export type DadosEmpresa = Omit<Empresa, 'id' | 'criadaEm'>;

export interface OpcoesNovaEmpresa {
  carregarPlanoPadrao: boolean;
  /** cria o exercício social deste ano já com os 12 períodos abertos */
  anoExercicio?: number;
}

export function validarEmpresa(d: DadosEmpresa, opcoes?: { exigirCincoNiveis?: boolean }): string[] {
  const erros: string[] = [];
  if (!d.razaoSocial.trim()) erros.push('Informe a razão social.');
  if (!validarCNPJ(d.cnpj)) erros.push('CNPJ inválido (confira os dígitos verificadores). Use "Gerar CNPJ fictício" se precisar.');
  if (!validarCNAE(d.cnae)) erros.push('CNAE deve ter 7 dígitos (ex.: 4789-0/99).');
  if (!['SIMPLES', 'PRESUMIDO', 'REAL'].includes(d.regime)) erros.push('Regime tributário inválido.');
  if (d.endereco.uf && !UFS.includes(d.endereco.uf as (typeof UFS)[number])) erros.push('UF inválida.');
  if (d.endereco.cep && somenteDigitos(d.endereco.cep).length !== 8) erros.push('CEP deve ter 8 dígitos.');
  if (!(d.inicioExercicioMes >= 1 && d.inicioExercicioMes <= 12)) erros.push('Mês de início do exercício inválido.');
  try {
    const m = interpretarMascara(d.mascaraPlano);
    if (opcoes?.exigirCincoNiveis && m.segmentos.length < 5) {
      erros.push('Para carregar o plano padrão, a máscara precisa ter pelo menos 5 níveis (ex.: 9.9.9.99.9999).');
    }
  } catch (e) {
    erros.push((e as Error).message);
  }
  return erros;
}

function normalizar(d: DadosEmpresa): DadosEmpresa {
  return {
    ...d,
    razaoSocial: d.razaoSocial.trim(),
    nomeFantasia: d.nomeFantasia?.trim() || undefined,
    cnpj: formatarCNPJ(d.cnpj),
    mascaraPlano: d.mascaraPlano.trim(),
  };
}

export async function criarEmpresa(dados: DadosEmpresa, opcoes: OpcoesNovaEmpresa): Promise<number> {
  const erros = validarEmpresa(dados, { exigirCincoNiveis: opcoes.carregarPlanoPadrao });
  if (erros.length) throw new Error(erros.join('\n'));
  const d = normalizar(dados);
  return db.transaction(
    'rw',
    [db.empresas, db.contas, db.historicos, db.centrosCusto, db.exercicios, db.periodos, db.auditoria],
    async () => {
      const empresa: Empresa = { ...d, criadaEm: agoraTimestamp() };
      const empresaId = (await db.empresas.add(empresa)) as number;
      if (opcoes.carregarPlanoPadrao) {
        await db.contas.bulkAdd(gerarPlanoPadrao(empresaId, d.mascaraPlano));
      }
      await db.historicos.bulkAdd(historicosPadrao(empresaId));
      await db.centrosCusto.bulkAdd(centrosCustoPadrao(empresaId));
      if (opcoes.anoExercicio) {
        const inicio = montarISO(opcoes.anoExercicio, d.inicioExercicioMes, 1);
        const fim = fimPadraoExercicio(inicio);
        const descricao = inicio.slice(0, 4) === fim.slice(0, 4) ? `Exercício ${inicio.slice(0, 4)}` : `Exercício ${inicio.slice(0, 4)}/${fim.slice(0, 4)}`;
        const exercicioId = (await db.exercicios.add({ empresaId, descricao, inicio, fim, status: 'ABERTO' })) as number;
        await db.periodos.bulkAdd(gerarPeriodos(empresaId, exercicioId, inicio, fim));
      }
      await registrarAuditoria({ empresaId, entidade: 'Empresa', entidadeId: empresaId, acao: 'CRIAR', descricao: `Empresa ${d.razaoSocial} criada`, depois: empresa });
      return empresaId;
    },
  );
}

/** Atualiza a empresa. Se a máscara mudar, todos os códigos de conta são convertidos. */
export async function atualizarEmpresa(id: number, dados: DadosEmpresa): Promise<void> {
  const erros = validarEmpresa(dados);
  if (erros.length) throw new Error(erros.join('\n'));
  const d = normalizar(dados);
  await db.transaction('rw', db.empresas, db.contas, db.auditoria, async () => {
    const antes = await db.empresas.get(id);
    if (!antes) throw new Error('Empresa não encontrada.');
    if (antes.mascaraPlano !== d.mascaraPlano) {
      const de = interpretarMascara(antes.mascaraPlano);
      const para = interpretarMascara(d.mascaraPlano);
      const contas = await db.contas.where('empresaId').equals(id).toArray();
      const convertidas = contas.map((c) => ({ ...c, codigo: reformatarCodigo(c.codigo, de, para) }));
      await db.contas.bulkPut(convertidas);
    }
    const depois: Empresa = { ...antes, ...d };
    await db.empresas.put(depois);
    await registrarAuditoria({ empresaId: id, entidade: 'Empresa', entidadeId: id, acao: 'ALTERAR', descricao: `Empresa ${d.razaoSocial} alterada`, antes, depois });
  });
}

/** Exclui a empresa e TODOS os seus dados. */
export async function excluirEmpresa(id: number): Promise<void> {
  await db.transaction(
    'rw',
    [db.empresas, db.contas, db.historicos, db.centrosCusto, db.exercicios, db.periodos, db.lancamentos, db.modelos, db.importacoes, db.auditoria],
    async () => {
      const empresa = await db.empresas.get(id);
      if (!empresa) return;
      for (const tabela of [db.contas, db.historicos, db.centrosCusto, db.exercicios, db.periodos, db.lancamentos, db.modelos, db.importacoes]) {
        await tabela.where('empresaId').equals(id).delete();
      }
      await db.empresas.delete(id);
      await registrarAuditoria({ entidade: 'Empresa', entidadeId: id, acao: 'EXCLUIR', descricao: `Empresa ${empresa.razaoSocial} excluída com todos os dados`, antes: empresa });
    },
  );
}

export function empresaVazia(): DadosEmpresa {
  return {
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    inscricaoEstadual: '',
    cnae: '',
    descricaoCnae: '',
    endereco: { logradouro: '', numero: '', complemento: '', bairro: '', municipio: '', uf: 'SP', cep: '' },
    regime: 'PRESUMIDO',
    mascaraPlano: '9.9.9.99.9999',
    inicioExercicioMes: 1,
  };
}
