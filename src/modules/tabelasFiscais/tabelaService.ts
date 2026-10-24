import { db } from '../../db/db';
import { registrarAuditoria } from '../../db/auditoria';
import type { DadosAliquotas, TabelaFiscal, TipoTabelaFiscal } from '../../db/types';
import { agoraTimestamp, ehISO } from '../../lib/date';
import { TABELAS_PADRAO } from './tabelasPadrao';

/** Carrega as tabelas padrão se ainda não houver nenhuma. */
export async function garantirTabelasPadrao(): Promise<void> {
  await db.transaction('rw', db.tabelasFiscais, async () => {
    if ((await db.tabelasFiscais.count()) === 0) {
      await db.tabelasFiscais.bulkAdd(TABELAS_PADRAO.map((t) => structuredClone(t)));
    }
  });
}

/** Escolhe, entre várias tabelas, a vigente numa data (maior início de vigência <= data). Pura. */
export function escolherVigente<T extends Pick<TabelaFiscal, 'vigenciaInicio'>>(tabelas: T[], data: string): T | undefined {
  return tabelas
    .filter((t) => t.vigenciaInicio <= data)
    .sort((a, b) => (a.vigenciaInicio < b.vigenciaInicio ? 1 : -1))[0];
}

export async function obterTabelaVigente(tipo: TipoTabelaFiscal, data: string, conjunto?: string): Promise<TabelaFiscal | undefined> {
  const tabelas = await db.tabelasFiscais.where('tipo').equals(tipo).toArray();
  return escolherVigente(conjunto ? tabelas.filter((t) => t.conjunto === conjunto) : tabelas, data);
}

export async function obterAliquota(conjunto: string, chave: string, data: string): Promise<number | undefined> {
  const tabela = await obterTabelaVigente('ALIQUOTAS', data, conjunto);
  return (tabela?.dados as DadosAliquotas | undefined)?.itens.find((i) => i.chave === chave)?.valor;
}

export function validarTabela(t: TabelaFiscal): string[] {
  const erros: string[] = [];
  if (!t.descricao.trim()) erros.push('Informe a descrição.');
  if (!ehISO(t.vigenciaInicio)) erros.push('Data de início de vigência inválida.');
  if (t.tipo === 'INSS') {
    const faixas = (t.dados as { faixas: { ate: number; aliquota: number }[] }).faixas;
    if (!faixas.length) erros.push('Informe ao menos uma faixa.');
    faixas.forEach((f, i) => {
      if (!(f.ate > 0)) erros.push(`Faixa ${i + 1}: limite inválido.`);
      if (i > 0 && f.ate <= faixas[i - 1].ate) erros.push(`Faixa ${i + 1}: o limite deve ser maior que o da faixa anterior.`);
      if (f.aliquota < 0 || f.aliquota > 100) erros.push(`Faixa ${i + 1}: alíquota inválida.`);
    });
  }
  if (t.tipo === 'IRRF') {
    const faixas = (t.dados as { faixas: { ate: number | null; aliquota: number }[] }).faixas;
    faixas.forEach((f, i) => {
      if (f.ate === null && i !== faixas.length - 1) erros.push(`Faixa ${i + 1}: só a última faixa pode ficar sem limite.`);
      if (f.aliquota < 0 || f.aliquota > 100) erros.push(`Faixa ${i + 1}: alíquota inválida.`);
    });
  }
  return erros;
}

export async function salvarTabela(t: TabelaFiscal): Promise<number> {
  const erros = validarTabela(t);
  if (erros.length) throw new Error(erros.join('\n'));
  return db.transaction('rw', db.tabelasFiscais, db.auditoria, async () => {
    const antes = t.id ? await db.tabelasFiscais.get(t.id) : undefined;
    const registro = { ...t, alteradaEm: agoraTimestamp() };
    const id = (await db.tabelasFiscais.put(registro)) as number;
    await registrarAuditoria({
      entidade: 'Tabela fiscal',
      entidadeId: id,
      acao: antes ? 'ALTERAR' : 'CRIAR',
      descricao: `${t.descricao} (vigência ${t.vigenciaInicio})`,
      antes,
      depois: registro,
    });
    return id;
  });
}

export async function excluirTabela(id: number): Promise<void> {
  await db.transaction('rw', db.tabelasFiscais, db.auditoria, async () => {
    const antes = await db.tabelasFiscais.get(id);
    if (!antes) return;
    await db.tabelasFiscais.delete(id);
    await registrarAuditoria({ entidade: 'Tabela fiscal', entidadeId: id, acao: 'EXCLUIR', descricao: antes.descricao, antes });
  });
}

/** Restaura as tabelas fiscais padrão (apaga as atuais). */
export async function restaurarTabelasPadrao(): Promise<void> {
  await db.transaction('rw', db.tabelasFiscais, db.auditoria, async () => {
    await db.tabelasFiscais.clear();
    await db.tabelasFiscais.bulkAdd(TABELAS_PADRAO.map((t) => structuredClone(t)));
    await registrarAuditoria({ entidade: 'Tabela fiscal', acao: 'RESTAURAR', descricao: 'Tabelas fiscais restauradas para o padrão' });
  });
}
