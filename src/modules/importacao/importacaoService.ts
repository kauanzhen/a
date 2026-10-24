import { db } from '../../db/db';
import { registrarAuditoria } from '../../db/auditoria';
import { obterUsuarioAtual } from '../../db/sessao';
import type { FormatoImportacao, Importacao } from '../../db/types';
import { agoraTimestamp } from '../../lib/date';
import { interpretarMascara } from '../../lib/mascara';
import { formatarMoeda } from '../../lib/money';
import { criarIndiceContas } from '../planoContas/indiceContas';
import { mapaSituacaoPeriodos, situacaoDaData } from '../empresa/periodoService';
import { contextoValidacao, prepararLancamento, proximoNumeroLancamento } from '../lancamentos/lancamentoService';
import type { RascunhoLancamento } from '../lancamentos/partidas';
import type { ContextoImportacao } from './validador';

export async function carregarContextoImportacao(empresaId: number): Promise<ContextoImportacao> {
  const [empresa, contas, centros, mapa] = await Promise.all([
    db.empresas.get(empresaId),
    db.contas.where('empresaId').equals(empresaId).toArray(),
    db.centrosCusto.where('empresaId').equals(empresaId).toArray(),
    mapaSituacaoPeriodos(empresaId),
  ]);
  if (!empresa) throw new Error('Empresa não encontrada.');
  return {
    indice: criarIndiceContas(contas),
    mascara: interpretarMascara(empresa.mascaraPlano),
    centros,
    situacaoPeriodo: (data) => situacaoDaData(mapa, data),
  };
}

export interface MetaImportacao {
  arquivo: string;
  formato: FormatoImportacao;
  linhasLidas: number;
  linhasImportadas: number;
  linhasRejeitadas: number;
}

/**
 * Grava todos os lotes válidos numa ÚNICA transação: se qualquer um falhar
 * (ex.: período fechado entre a pré-visualização e a gravação), nada é gravado.
 */
export async function importarLotes(
  empresaId: number,
  rascunhos: RascunhoLancamento[],
  meta: MetaImportacao,
): Promise<Importacao> {
  if (!rascunhos.length) throw new Error('Não há lotes válidos para importar.');
  return db.transaction('rw', [db.lancamentos, db.contas, db.centrosCusto, db.periodos, db.importacoes, db.auditoria], async () => {
    const ctx = await contextoValidacao(empresaId);
    const importacao: Importacao = {
      empresaId,
      arquivo: meta.arquivo,
      formato: meta.formato,
      data: agoraTimestamp(),
      usuario: obterUsuarioAtual(),
      qtdLinhasLidas: meta.linhasLidas,
      qtdLinhasImportadas: meta.linhasImportadas,
      qtdLinhasRejeitadas: meta.linhasRejeitadas,
      lancamentoIds: [],
      valorTotal: 0,
      desfeita: false,
    };
    const importacaoId = (await db.importacoes.add(importacao)) as number;
    let numero = await proximoNumeroLancamento(empresaId);
    const ids: number[] = [];
    let total = 0;
    for (const r of rascunhos) {
      const l = await prepararLancamento(empresaId, r, numero, { origem: meta.formato === 'IA_JSON' ? 'IA' : 'IMPORTACAO', importacaoId }, ctx);
      ids.push((await db.lancamentos.add(l)) as number);
      total += l.valorTotal;
      numero++;
    }
    await db.importacoes.update(importacaoId, { lancamentoIds: ids, valorTotal: total });
    await registrarAuditoria({
      empresaId,
      entidade: 'Importação',
      entidadeId: importacaoId,
      acao: 'IMPORTAR',
      descricao: `Arquivo "${meta.arquivo}": ${ids.length} lançamento(s), ${formatarMoeda(total)}; ${meta.linhasRejeitadas} linha(s) rejeitada(s)`,
    });
    return { ...importacao, id: importacaoId, lancamentoIds: ids, valorTotal: total };
  });
}

/** Desfaz uma importação inteira (exclui todos os lançamentos do lote de importação). */
export async function desfazerImportacao(importacaoId: number): Promise<number> {
  return db.transaction('rw', [db.lancamentos, db.periodos, db.importacoes, db.auditoria], async () => {
    const imp = await db.importacoes.get(importacaoId);
    if (!imp) throw new Error('Importação não encontrada.');
    if (imp.desfeita) throw new Error('Esta importação já foi desfeita.');
    const lancamentos = await db.lancamentos.where('importacaoId').equals(importacaoId).toArray();
    const competencias = [...new Set(lancamentos.map((l) => l.competencia))];
    for (const comp of competencias) {
      const p = await db.periodos.where('[empresaId+competencia]').equals([imp.empresaId, comp]).first();
      if (p?.status === 'FECHADO') throw new Error(`Há lançamentos desta importação em período fechado (${comp.slice(5)}/${comp.slice(0, 4)}). Reabra o período para desfazer.`);
    }
    const estornados = lancamentos.filter((l) => l.estornadoPorId);
    if (estornados.length) {
      throw new Error(`Os lançamentos nº ${estornados.map((l) => l.numero).join(', ')} foram estornados. Exclua os estornos antes de desfazer a importação.`);
    }
    await db.lancamentos.bulkDelete(lancamentos.map((l) => l.id!));
    await db.importacoes.update(importacaoId, { desfeita: true, desfeitaEm: agoraTimestamp(), desfeitaPor: obterUsuarioAtual() });
    await registrarAuditoria({
      empresaId: imp.empresaId,
      entidade: 'Importação',
      entidadeId: importacaoId,
      acao: 'DESFAZER',
      descricao: `Importação "${imp.arquivo}" desfeita: ${lancamentos.length} lançamento(s) excluído(s)`,
    });
    return lancamentos.length;
  });
}
