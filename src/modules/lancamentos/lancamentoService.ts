import { db } from '../../db/db';
import { registrarAuditoria } from '../../db/auditoria';
import { obterUsuarioAtual } from '../../db/sessao';
import type { CentroCusto, Lancamento, ModeloLancamento, OrigemLancamento, Partida } from '../../db/types';
import { agoraTimestamp, competenciaDe, dataNaCompetencia, formatarData } from '../../lib/date';
import { criarIndiceContas } from '../planoContas/indiceContas';
import { exigirPeriodoAberto } from '../empresa/periodoService';
import { calcularTotais, inverterPartidas, validarLancamento, type RascunhoLancamento } from './partidas';

export interface OpcoesSalvar {
  origem?: OrigemLancamento;
  importacaoId?: number;
  modeloId?: number;
  estornoDeId?: number;
}

export async function contextoValidacao(empresaId: number) {
  const [contas, centros] = await Promise.all([
    db.contas.where('empresaId').equals(empresaId).toArray(),
    db.centrosCusto.where('empresaId').equals(empresaId).toArray(),
  ]);
  return {
    indice: criarIndiceContas(contas),
    centros: new Map<number, CentroCusto>(centros.map((c) => [c.id!, c])),
  };
}

export async function proximoNumeroLancamento(empresaId: number): Promise<number> {
  const ultimo = await db.lancamentos.where('[empresaId+numero]').between([empresaId, 0], [empresaId, Number.MAX_SAFE_INTEGER]).last();
  return (ultimo?.numero ?? 0) + 1;
}

function limparPartidas(partidas: Partida[]): Partida[] {
  return partidas
    .filter((p) => p.contaId && p.valor)
    .map((p) => ({
      contaId: p.contaId,
      tipo: p.tipo,
      valor: p.valor,
      ...(p.centroCustoId ? { centroCustoId: p.centroCustoId } : {}),
      ...(p.historico?.trim() ? { historico: p.historico.trim() } : {}),
    }));
}

/**
 * Monta e valida um lançamento SEM gravar. Usado dentro das transações de gravação,
 * inclusive da importação em lote.
 */
export async function prepararLancamento(
  empresaId: number,
  r: RascunhoLancamento,
  numero: number,
  opcoes: OpcoesSalvar,
  ctx?: Awaited<ReturnType<typeof contextoValidacao>>,
): Promise<Lancamento> {
  const contexto = ctx ?? (await contextoValidacao(empresaId));
  const partidas = limparPartidas(r.partidas);
  const erros = validarLancamento({ ...r, partidas }, contexto);
  if (erros.length) throw new Error(erros.join('\n'));
  await exigirPeriodoAberto(empresaId, r.data);
  const agora = agoraTimestamp();
  return {
    empresaId,
    numero,
    lote: r.lote?.trim() || String(numero),
    data: r.data,
    competencia: competenciaDe(r.data),
    documento: r.documento?.trim() || undefined,
    historicoPadraoId: r.historicoPadraoId,
    historico: r.historico.trim(),
    complemento: r.complemento?.trim() || undefined,
    observacao: r.observacao?.trim() || undefined,
    partidas,
    contaIds: [...new Set(partidas.map((p) => p.contaId))],
    valorTotal: calcularTotais(partidas).debitos,
    origem: opcoes.origem ?? 'MANUAL',
    importacaoId: opcoes.importacaoId,
    modeloId: opcoes.modeloId,
    estornoDeId: opcoes.estornoDeId,
    criadoEm: agora,
    criadoPor: obterUsuarioAtual(),
  };
}

const TABELAS_LANCAMENTO = () => [db.lancamentos, db.contas, db.centrosCusto, db.periodos, db.auditoria];

/** Cria (sem id) ou altera (com id) um lançamento. */
export async function salvarLancamento(empresaId: number, r: RascunhoLancamento, id?: number, opcoes: OpcoesSalvar = {}): Promise<Lancamento> {
  return db.transaction('rw', TABELAS_LANCAMENTO(), async () => {
    if (id) {
      const antes = await db.lancamentos.get(id);
      if (!antes) throw new Error('Lançamento não encontrado.');
      await exigirPeriodoAberto(empresaId, antes.data);
      if (antes.estornadoPorId) throw new Error('Este lançamento já foi estornado e não pode ser alterado.');
      const novo = await prepararLancamento(empresaId, r, antes.numero, { origem: antes.origem, importacaoId: antes.importacaoId, modeloId: antes.modeloId, estornoDeId: antes.estornoDeId });
      const depois: Lancamento = {
        ...novo,
        id,
        criadoEm: antes.criadoEm,
        criadoPor: antes.criadoPor,
        estornadoPorId: antes.estornadoPorId,
        alteradoEm: agoraTimestamp(),
        alteradoPor: obterUsuarioAtual(),
      };
      await db.lancamentos.put(depois);
      await registrarAuditoria({ empresaId, entidade: 'Lançamento', entidadeId: id, acao: 'ALTERAR', descricao: `Lançamento nº ${antes.numero} alterado`, antes, depois });
      return depois;
    }
    const numero = await proximoNumeroLancamento(empresaId);
    const novo = await prepararLancamento(empresaId, r, numero, opcoes);
    const novoId = (await db.lancamentos.add(novo)) as number;
    const salvo = { ...novo, id: novoId };
    await registrarAuditoria({
      empresaId,
      entidade: 'Lançamento',
      entidadeId: novoId,
      acao: 'CRIAR',
      descricao: `Lançamento nº ${numero} (${formatarData(novo.data)}) criado — ${novo.historico}`,
      depois: salvo,
    });
    return salvo;
  });
}

export async function excluirLancamento(id: number): Promise<void> {
  await db.transaction('rw', TABELAS_LANCAMENTO(), async () => {
    const l = await db.lancamentos.get(id);
    if (!l) return;
    await exigirPeriodoAberto(l.empresaId, l.data);
    if (l.estornadoPorId) throw new Error(`O lançamento nº ${l.numero} foi estornado. Exclua primeiro o estorno.`);
    if (l.estornoDeId) {
      await db.lancamentos.update(l.estornoDeId, { estornadoPorId: undefined });
    }
    await db.lancamentos.delete(id);
    await registrarAuditoria({ empresaId: l.empresaId, entidade: 'Lançamento', entidadeId: id, acao: 'EXCLUIR', descricao: `Lançamento nº ${l.numero} excluído`, antes: l });
  });
}

/** Estorno: cria um lançamento com débitos e créditos invertidos, ligado ao original. */
export async function estornarLancamento(id: number, data: string, motivo?: string): Promise<Lancamento> {
  return db.transaction('rw', TABELAS_LANCAMENTO(), async () => {
    const original = await db.lancamentos.get(id);
    if (!original) throw new Error('Lançamento não encontrado.');
    if (original.estornadoPorId) throw new Error(`O lançamento nº ${original.numero} já foi estornado.`);
    if (original.estornoDeId) throw new Error('Não é possível estornar um estorno. Se necessário, exclua o estorno.');
    const numero = await proximoNumeroLancamento(original.empresaId);
    const historico = `Estorno do lançamento nº ${original.numero} de ${formatarData(original.data)} — ${original.historico}`;
    const estorno = await prepararLancamento(
      original.empresaId,
      {
        data,
        documento: original.documento,
        historico,
        complemento: motivo?.trim() ? `Motivo: ${motivo.trim()}` : undefined,
        partidas: inverterPartidas(original.partidas),
      },
      numero,
      { origem: 'ESTORNO', estornoDeId: id },
    );
    const estornoId = (await db.lancamentos.add(estorno)) as number;
    await db.lancamentos.update(id, { estornadoPorId: estornoId });
    await registrarAuditoria({
      empresaId: original.empresaId,
      entidade: 'Lançamento',
      entidadeId: id,
      acao: 'ESTORNAR',
      descricao: `Lançamento nº ${original.numero} estornado pelo lançamento nº ${numero}`,
    });
    return { ...estorno, id: estornoId };
  });
}

/** Rascunho para "copiar lançamento" (o usuário revisa antes de salvar). */
export function rascunhoDeCopia(l: Lancamento, novaData: string): RascunhoLancamento {
  return {
    data: novaData,
    documento: l.documento,
    historicoPadraoId: l.historicoPadraoId,
    historico: l.historico,
    complemento: l.complemento,
    partidas: l.partidas.map((p) => ({ ...p })),
  };
}

// ------------------------------------------------------------------ Lançamentos-modelo

export async function salvarModelo(m: ModeloLancamento): Promise<number> {
  if (!m.nome.trim()) throw new Error('Informe o nome do modelo.');
  if (m.partidas.filter((p) => p.contaId).length < 2) throw new Error('O modelo precisa de pelo menos duas partidas com conta.');
  return db.transaction('rw', db.modelos, db.auditoria, async () => {
    const antes = m.id ? await db.modelos.get(m.id) : undefined;
    const id = (await db.modelos.put({ ...m, partidas: m.partidas.filter((p) => p.contaId) })) as number;
    await registrarAuditoria({ empresaId: m.empresaId, entidade: 'Lançamento-modelo', entidadeId: id, acao: antes ? 'ALTERAR' : 'CRIAR', descricao: `Modelo "${m.nome}"`, antes, depois: m });
    return id;
  });
}

export async function excluirModelo(id: number): Promise<void> {
  await db.transaction('rw', db.modelos, db.auditoria, async () => {
    const m = await db.modelos.get(id);
    if (!m) return;
    await db.modelos.delete(id);
    await registrarAuditoria({ empresaId: m.empresaId, entidade: 'Lançamento-modelo', entidadeId: id, acao: 'EXCLUIR', descricao: `Modelo "${m.nome}" excluído`, antes: m });
  });
}

export function rascunhoDeModelo(m: ModeloLancamento, data: string): RascunhoLancamento {
  return {
    data,
    documento: m.documento,
    historicoPadraoId: m.historicoPadraoId,
    historico: m.historico,
    complemento: m.complemento,
    partidas: m.partidas.map((p) => ({ ...p })),
  };
}

/**
 * Gera lançamentos a partir de um modelo recorrente, um por competência, todos numa transação.
 * O modelo precisa ter todos os valores preenchidos e balanceados.
 */
export async function gerarLancamentosDoModelo(modeloId: number, competencias: string[], dia: number): Promise<Lancamento[]> {
  return db.transaction('rw', [...TABELAS_LANCAMENTO(), db.modelos], async () => {
    const m = await db.modelos.get(modeloId);
    if (!m) throw new Error('Modelo não encontrado.');
    const ctx = await contextoValidacao(m.empresaId);
    let numero = await proximoNumeroLancamento(m.empresaId);
    const gerados: Lancamento[] = [];
    for (const comp of competencias) {
      const data = dataNaCompetencia(comp, dia);
      const l = await prepararLancamento(m.empresaId, rascunhoDeModelo(m, data), numero, { origem: 'MODELO', modeloId }, ctx);
      const id = (await db.lancamentos.add(l)) as number;
      gerados.push({ ...l, id });
      numero++;
    }
    await registrarAuditoria({
      empresaId: m.empresaId,
      entidade: 'Lançamento-modelo',
      entidadeId: modeloId,
      acao: 'CRIAR',
      descricao: `${gerados.length} lançamento(s) gerado(s) pelo modelo "${m.nome}" (nº ${gerados[0]?.numero ?? '-'} a ${gerados.at(-1)?.numero ?? '-'})`,
    });
    return gerados;
  });
}

// ------------------------------------------------------------------ Históricos padrão e centros de custo

export async function salvarHistorico(h: { id?: number; empresaId: number; codigo: number; texto: string; ativo: boolean }): Promise<number> {
  if (!h.texto.trim()) throw new Error('Informe o texto do histórico.');
  if (!Number.isInteger(h.codigo) || h.codigo <= 0) throw new Error('Código do histórico deve ser um número inteiro positivo.');
  return db.transaction('rw', db.historicos, db.auditoria, async () => {
    const repetido = await db.historicos.where('[empresaId+codigo]').equals([h.empresaId, h.codigo]).first();
    if (repetido && repetido.id !== h.id) throw new Error(`Já existe histórico com o código ${h.codigo}.`);
    const antes = h.id ? await db.historicos.get(h.id) : undefined;
    const id = (await db.historicos.put({ ...h, texto: h.texto.trim() })) as number;
    await registrarAuditoria({ empresaId: h.empresaId, entidade: 'Histórico padrão', entidadeId: id, acao: antes ? 'ALTERAR' : 'CRIAR', descricao: `Histórico ${h.codigo}: ${h.texto}`, antes, depois: h });
    return id;
  });
}

export async function excluirHistorico(id: number): Promise<void> {
  await db.transaction('rw', db.historicos, db.lancamentos, db.auditoria, async () => {
    const h = await db.historicos.get(id);
    if (!h) return;
    const usado = await db.lancamentos.where('empresaId').equals(h.empresaId).filter((l) => l.historicoPadraoId === id).count();
    if (usado) throw new Error(`O histórico é usado em ${usado} lançamento(s). Inative-o em vez de excluir.`);
    await db.historicos.delete(id);
    await registrarAuditoria({ empresaId: h.empresaId, entidade: 'Histórico padrão', entidadeId: id, acao: 'EXCLUIR', descricao: `Histórico ${h.codigo} excluído`, antes: h });
  });
}

export async function salvarCentroCusto(c: CentroCusto): Promise<number> {
  if (!c.codigo.trim() || !c.nome.trim()) throw new Error('Informe código e nome do centro de custo.');
  return db.transaction('rw', db.centrosCusto, db.auditoria, async () => {
    const repetido = await db.centrosCusto.where('[empresaId+codigo]').equals([c.empresaId, c.codigo.trim()]).first();
    if (repetido && repetido.id !== c.id) throw new Error(`Já existe centro de custo com o código ${c.codigo}.`);
    const antes = c.id ? await db.centrosCusto.get(c.id) : undefined;
    const registro = { ...c, codigo: c.codigo.trim(), nome: c.nome.trim() };
    const id = (await db.centrosCusto.put(registro)) as number;
    await registrarAuditoria({ empresaId: c.empresaId, entidade: 'Centro de custo', entidadeId: id, acao: antes ? 'ALTERAR' : 'CRIAR', descricao: `Centro de custo ${registro.codigo} - ${registro.nome}`, antes, depois: registro });
    return id;
  });
}

export async function excluirCentroCusto(id: number): Promise<void> {
  await db.transaction('rw', db.centrosCusto, db.lancamentos, db.auditoria, async () => {
    const c = await db.centrosCusto.get(id);
    if (!c) return;
    const usado = await db.lancamentos.where('empresaId').equals(c.empresaId).filter((l) => l.partidas.some((p) => p.centroCustoId === id)).count();
    if (usado) throw new Error(`O centro de custo é usado em ${usado} lançamento(s). Inative-o em vez de excluir.`);
    await db.centrosCusto.delete(id);
    await registrarAuditoria({ empresaId: c.empresaId, entidade: 'Centro de custo', entidadeId: id, acao: 'EXCLUIR', descricao: `Centro de custo ${c.codigo} excluído`, antes: c });
  });
}
