import { db } from '../../db/db';
import { registrarAuditoria } from '../../db/auditoria';
import { obterUsuarioAtual } from '../../db/sessao';
import type { Exercicio, Periodo, StatusPeriodo } from '../../db/types';
import {
  agoraTimestamp,
  competenciaDe,
  competenciasEntre,
  ehISO,
  fimDaCompetencia,
  formatarCompetencia,
  formatarData,
  inicioDaCompetencia,
  montarISO,
  somarMeses,
} from '../../lib/date';

export type SituacaoData = StatusPeriodo | 'INEXISTENTE';

/** Data final padrão de um exercício de 12 meses que começa em "inicio". */
export function fimPadraoExercicio(inicio: string): string {
  return fimDaCompetencia(somarMeses(competenciaDe(inicio), 11));
}

/** Gera os períodos mensais de um exercício (pura). */
export function gerarPeriodos(empresaId: number, exercicioId: number, inicio: string, fim: string): Periodo[] {
  return competenciasEntre(competenciaDe(inicio), competenciaDe(fim)).map((competencia) => ({
    empresaId,
    exercicioId,
    competencia,
    inicio: inicioDaCompetencia(competencia) < inicio ? inicio : inicioDaCompetencia(competencia),
    fim: fimDaCompetencia(competencia) > fim ? fim : fimDaCompetencia(competencia),
    status: 'ABERTO',
  }));
}

export async function listarExercicios(empresaId: number): Promise<Exercicio[]> {
  const lista = await db.exercicios.where('empresaId').equals(empresaId).toArray();
  return lista.sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
}

export async function listarPeriodos(empresaId: number): Promise<Periodo[]> {
  const lista = await db.periodos.where('empresaId').equals(empresaId).toArray();
  return lista.sort((a, b) => (a.competencia < b.competencia ? -1 : 1));
}

export async function criarExercicio(empresaId: number, inicio: string, fim?: string): Promise<number> {
  const fimFinal = fim ?? fimPadraoExercicio(inicio);
  if (!ehISO(inicio) || !ehISO(fimFinal)) throw new Error('Datas do exercício inválidas.');
  if (fimFinal < inicio) throw new Error('O fim do exercício deve ser posterior ao início.');
  if (competenciasEntre(competenciaDe(inicio), competenciaDe(fimFinal)).length > 12) {
    throw new Error('O exercício social não pode ter mais de 12 meses.');
  }
  return db.transaction('rw', db.exercicios, db.periodos, db.auditoria, async () => {
    const existentes = await db.exercicios.where('empresaId').equals(empresaId).toArray();
    const conflito = existentes.find((e) => !(fimFinal < e.inicio || inicio > e.fim));
    if (conflito) throw new Error(`Conflita com o exercício "${conflito.descricao}" (${formatarData(conflito.inicio)} a ${formatarData(conflito.fim)}).`);
    const descricao = competenciaDe(inicio).slice(0, 4) === competenciaDe(fimFinal).slice(0, 4)
      ? `Exercício ${inicio.slice(0, 4)}`
      : `Exercício ${inicio.slice(0, 4)}/${fimFinal.slice(0, 4)}`;
    const exercicioId = (await db.exercicios.add({ empresaId, descricao, inicio, fim: fimFinal, status: 'ABERTO' })) as number;
    await db.periodos.bulkAdd(gerarPeriodos(empresaId, exercicioId, inicio, fimFinal));
    await registrarAuditoria({ empresaId, entidade: 'Exercício', entidadeId: exercicioId, acao: 'CRIAR', descricao: `${descricao} criado (${formatarData(inicio)} a ${formatarData(fimFinal)})` });
    return exercicioId;
  });
}

/** Cria o exercício do ano informado começando no mês de início do exercício social da empresa. */
export async function criarExercicioDoAno(empresaId: number, ano: number, mesInicio = 1): Promise<number> {
  return criarExercicio(empresaId, montarISO(ano, mesInicio, 1));
}

export async function fecharPeriodo(periodoId: number): Promise<void> {
  await alterarStatusPeriodo(periodoId, 'FECHADO');
}

export async function reabrirPeriodo(periodoId: number): Promise<void> {
  await alterarStatusPeriodo(periodoId, 'ABERTO');
}

async function alterarStatusPeriodo(periodoId: number, status: StatusPeriodo): Promise<void> {
  await db.transaction('rw', db.periodos, db.exercicios, db.auditoria, async () => {
    const periodo = await db.periodos.get(periodoId);
    if (!periodo) throw new Error('Período não encontrado.');
    if (periodo.status === status) return;
    const exercicio = await db.exercicios.get(periodo.exercicioId);
    if (status === 'ABERTO' && exercicio?.status === 'ENCERRADO') {
      throw new Error('O exercício está encerrado. Reabra o exercício antes de reabrir o período.');
    }
    await db.periodos.update(periodoId, {
      status,
      fechadoEm: status === 'FECHADO' ? agoraTimestamp() : undefined,
      fechadoPor: status === 'FECHADO' ? obterUsuarioAtual() : undefined,
    });
    await registrarAuditoria({
      empresaId: periodo.empresaId,
      entidade: 'Período',
      entidadeId: periodoId,
      acao: status === 'FECHADO' ? 'FECHAR' : 'REABRIR',
      descricao: `Período ${formatarCompetencia(periodo.competencia)} ${status === 'FECHADO' ? 'fechado' : 'reaberto'}`,
    });
  });
}

export async function excluirExercicio(exercicioId: number): Promise<void> {
  await db.transaction('rw', [db.exercicios, db.periodos, db.lancamentos, db.auditoria], async () => {
    const ex = await db.exercicios.get(exercicioId);
    if (!ex) return;
    const qtd = await db.lancamentos
      .where('[empresaId+data]')
      .between([ex.empresaId, ex.inicio], [ex.empresaId, ex.fim], true, true)
      .count();
    if (qtd > 0) throw new Error(`O exercício tem ${qtd} lançamento(s) e não pode ser excluído.`);
    await db.periodos.where('exercicioId').equals(exercicioId).delete();
    await db.exercicios.delete(exercicioId);
    await registrarAuditoria({ empresaId: ex.empresaId, entidade: 'Exercício', entidadeId: exercicioId, acao: 'EXCLUIR', descricao: `${ex.descricao} excluído` });
  });
}

/** Mapa competência -> situação, para validar muitas datas de uma vez (ex.: importação). */
export async function mapaSituacaoPeriodos(empresaId: number): Promise<Map<string, StatusPeriodo>> {
  const periodos = await db.periodos.where('empresaId').equals(empresaId).toArray();
  return new Map(periodos.map((p) => [p.competencia, p.status]));
}

export function situacaoDaData(mapa: Map<string, StatusPeriodo>, data: string): SituacaoData {
  return mapa.get(competenciaDe(data)) ?? 'INEXISTENTE';
}

export function mensagemSituacao(situacao: SituacaoData, data: string): string | null {
  if (situacao === 'FECHADO') return `A data ${formatarData(data)} está em período fechado (${formatarCompetencia(competenciaDe(data))}).`;
  if (situacao === 'INEXISTENTE') return `Não há exercício/período cadastrado para ${formatarCompetencia(competenciaDe(data))}. Crie o exercício em "Exercícios e períodos".`;
  return null;
}

/** Lança erro se não for possível lançar (ou alterar lançamento) na data. */
export async function exigirPeriodoAberto(empresaId: number, data: string): Promise<void> {
  const periodo = await db.periodos.where('[empresaId+competencia]').equals([empresaId, competenciaDe(data)]).first();
  const msg = mensagemSituacao(periodo ? periodo.status : 'INEXISTENTE', data);
  if (msg) throw new Error(msg);
}
