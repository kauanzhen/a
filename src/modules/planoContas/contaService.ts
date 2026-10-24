import { db } from '../../db/db';
import { registrarAuditoria } from '../../db/auditoria';
import type { Conta, GrupoConta, Natureza, TipoConta } from '../../db/types';
import { codigoPai, compararCodigos, ehDescendente, interpretarMascara, nivelDoCodigo, type Mascara } from '../../lib/mascara';
import { grupoPorCodigo, naturezaDoGrupo, ehRedutora } from './planoPadrao';

export interface DadosConta {
  codigo: string;
  nome: string;
  tipo: TipoConta;
  natureza: Natureza;
  grupo?: GrupoConta;
  contaReferencial?: string;
  exigeCentroCusto: boolean;
  ativa: boolean;
  reduzido?: number;
}

export async function listarContas(empresaId: number): Promise<Conta[]> {
  const contas = await db.contas.where('empresaId').equals(empresaId).toArray();
  return contas.sort((a, b) => compararCodigos(a.codigo, b.codigo));
}

export async function quantidadeMovimentos(contaId: number): Promise<number> {
  return db.lancamentos.where('contaIds').equals(contaId).count();
}

export async function contaTemMovimento(contaId: number): Promise<boolean> {
  return (await quantidadeMovimentos(contaId)) > 0;
}

async function mascaraDaEmpresa(empresaId: number): Promise<Mascara> {
  const empresa = await db.empresas.get(empresaId);
  if (!empresa) throw new Error('Empresa não encontrada.');
  return interpretarMascara(empresa.mascaraPlano);
}

interface ContextoValidacao {
  mascara: Mascara;
  contas: Conta[];
  /** conta sendo editada (undefined = nova) */
  atual?: Conta;
  temMovimento: boolean;
}

/** Regras de consistência do cadastro de contas. Função pura (testável). */
export function validarDadosConta(dados: DadosConta, ctx: ContextoValidacao): string[] {
  const erros: string[] = [];
  const codigo = dados.codigo.trim();
  const nivel = nivelDoCodigo(codigo, ctx.mascara);
  if (!nivel) {
    erros.push(`O código "${codigo}" não segue a máscara ${ctx.mascara.texto}.`);
    return erros;
  }
  if (!dados.nome.trim()) erros.push('Informe o nome da conta.');
  const outras = ctx.atual ? ctx.contas.filter((c) => c.id !== ctx.atual!.id) : ctx.contas;
  if (outras.some((c) => c.codigo === codigo)) erros.push(`Já existe uma conta com o código ${codigo}.`);
  if (dados.reduzido !== undefined && outras.some((c) => c.reduzido === dados.reduzido)) {
    erros.push(`O código reduzido ${dados.reduzido} já está em uso.`);
  }
  if (nivel > 1) {
    const codPai = codigoPai(codigo, ctx.mascara)!;
    const pai = outras.find((c) => c.codigo === codPai);
    if (!pai) erros.push(`A conta-mãe ${codPai} não existe. Cadastre-a antes.`);
    else if (pai.tipo !== 'S') erros.push(`A conta-mãe ${codPai} é analítica; só contas sintéticas podem ter subcontas.`);
  }
  if (dados.tipo === 'S' && nivel === ctx.mascara.segmentos.length) {
    erros.push('Uma conta do último nível da máscara não pode ser sintética (não teria subcontas).');
  }
  if (ctx.atual) {
    const filhos = ctx.contas.filter((c) => ehDescendente(c.codigo, ctx.atual!.codigo));
    if (codigo !== ctx.atual.codigo && filhos.length > 0) {
      erros.push('Não é possível alterar o código de uma conta que tem subcontas.');
    }
    if (dados.tipo === 'A' && ctx.atual.tipo === 'S' && filhos.length > 0) {
      erros.push('A conta tem subcontas e por isso precisa continuar sintética.');
    }
    if (dados.tipo === 'S' && ctx.atual.tipo === 'A' && ctx.temMovimento) {
      erros.push('A conta já tem lançamentos e não pode virar sintética (contas sintéticas não recebem lançamentos).');
    }
  }
  return erros;
}

function grupoPadrao(codigo: string, contas: Conta[], mascara: Mascara): GrupoConta {
  const codPai = codigoPai(codigo, mascara);
  const pai = codPai ? contas.find((c) => c.codigo === codPai) : undefined;
  if (pai && !(pai.nivel === 1 && pai.grupo === 'PASSIVO')) return pai.grupo;
  return grupoPorCodigo(codigo);
}

/** Natureza sugerida para uma nova conta: a do grupo, invertida se o nome começar com "(-)". */
export function naturezaSugerida(grupo: GrupoConta, nome: string): Natureza {
  const n = naturezaDoGrupo(grupo);
  return ehRedutora(nome) ? (n === 'D' ? 'C' : 'D') : n;
}

async function proximoReduzido(empresaId: number): Promise<number> {
  const contas = await db.contas.where('empresaId').equals(empresaId).toArray();
  return contas.reduce((max, c) => Math.max(max, c.reduzido ?? 0), 0) + 1;
}

export async function criarConta(empresaId: number, dados: DadosConta): Promise<number> {
  return db.transaction('rw', db.contas, db.empresas, db.auditoria, async () => {
    const mascara = await mascaraDaEmpresa(empresaId);
    const contas = await db.contas.where('empresaId').equals(empresaId).toArray();
    const erros = validarDadosConta(dados, { mascara, contas, temMovimento: false });
    if (erros.length) throw new Error(erros.join('\n'));
    const codigo = dados.codigo.trim();
    const conta: Conta = {
      empresaId,
      codigo,
      nome: dados.nome.trim(),
      tipo: dados.tipo,
      natureza: dados.natureza,
      nivel: nivelDoCodigo(codigo, mascara)!,
      grupo: dados.grupo ?? grupoPadrao(codigo, contas, mascara),
      contaReferencial: dados.contaReferencial?.trim() || undefined,
      exigeCentroCusto: dados.exigeCentroCusto,
      ativa: dados.ativa,
      reduzido: dados.tipo === 'A' ? (dados.reduzido ?? (await proximoReduzido(empresaId))) : undefined,
    };
    const id = await db.contas.add(conta);
    await registrarAuditoria({ empresaId, entidade: 'Conta', entidadeId: id, acao: 'CRIAR', descricao: `Conta ${codigo} - ${conta.nome} criada`, depois: conta });
    return id as number;
  });
}

export async function atualizarConta(id: number, dados: DadosConta): Promise<void> {
  await db.transaction('rw', [db.contas, db.empresas, db.auditoria, db.lancamentos], async () => {
    const atual = await db.contas.get(id);
    if (!atual) throw new Error('Conta não encontrada.');
    const mascara = await mascaraDaEmpresa(atual.empresaId);
    const contas = await db.contas.where('empresaId').equals(atual.empresaId).toArray();
    const temMovimento = await contaTemMovimento(id);
    const erros = validarDadosConta(dados, { mascara, contas, atual, temMovimento });
    if (erros.length) throw new Error(erros.join('\n'));
    const codigo = dados.codigo.trim();
    const nova: Conta = {
      ...atual,
      codigo,
      nome: dados.nome.trim(),
      tipo: dados.tipo,
      natureza: dados.natureza,
      nivel: nivelDoCodigo(codigo, mascara)!,
      grupo: dados.grupo ?? atual.grupo,
      contaReferencial: dados.contaReferencial?.trim() || undefined,
      exigeCentroCusto: dados.exigeCentroCusto,
      ativa: dados.ativa,
      reduzido: dados.tipo === 'A' ? (dados.reduzido ?? atual.reduzido ?? (await proximoReduzido(atual.empresaId))) : undefined,
    };
    await db.contas.put(nova);
    await registrarAuditoria({ empresaId: atual.empresaId, entidade: 'Conta', entidadeId: id, acao: 'ALTERAR', descricao: `Conta ${codigo} alterada`, antes: atual, depois: nova });
  });
}

export async function alterarAtivacaoConta(id: number, ativa: boolean): Promise<void> {
  await db.transaction('rw', db.contas, db.auditoria, async () => {
    const atual = await db.contas.get(id);
    if (!atual) throw new Error('Conta não encontrada.');
    await db.contas.update(id, { ativa });
    await registrarAuditoria({
      empresaId: atual.empresaId,
      entidade: 'Conta',
      entidadeId: id,
      acao: ativa ? 'ATIVAR' : 'INATIVAR',
      descricao: `Conta ${atual.codigo} - ${atual.nome} ${ativa ? 'ativada' : 'inativada'}`,
    });
  });
}

/** Exclui uma conta. Bloqueia se houver lançamentos, subcontas ou uso em lançamentos-modelo. */
export async function excluirConta(id: number): Promise<void> {
  await db.transaction('rw', [db.contas, db.lancamentos, db.modelos, db.auditoria], async () => {
    const conta = await db.contas.get(id);
    if (!conta) throw new Error('Conta não encontrada.');
    const movimentos = await quantidadeMovimentos(id);
    if (movimentos > 0) {
      throw new Error(`A conta ${conta.codigo} tem ${movimentos} lançamento(s) e não pode ser excluída. Você pode inativá-la.`);
    }
    const contas = await db.contas.where('empresaId').equals(conta.empresaId).toArray();
    if (contas.some((c) => ehDescendente(c.codigo, conta.codigo))) {
      throw new Error(`A conta ${conta.codigo} tem subcontas. Exclua ou mova as subcontas antes.`);
    }
    const modelos = await db.modelos.where('empresaId').equals(conta.empresaId).toArray();
    if (modelos.some((m) => m.partidas.some((p) => p.contaId === id))) {
      throw new Error(`A conta ${conta.codigo} é usada em lançamento-modelo. Ajuste o modelo antes.`);
    }
    await db.contas.delete(id);
    await registrarAuditoria({ empresaId: conta.empresaId, entidade: 'Conta', entidadeId: id, acao: 'EXCLUIR', descricao: `Conta ${conta.codigo} - ${conta.nome} excluída`, antes: conta });
  });
}

// ------------------------------------------------------------------ Importação de contas via Excel

export interface LinhaContaImportada {
  linha: number;
  codigo: string;
  nome: string;
  tipo?: string;
  natureza?: string;
  grupo?: string;
  contaReferencial?: string;
  exigeCentroCusto?: string;
  reduzido?: string;
  ativa?: string;
}

export interface ResultadoPreparoContas {
  novas: Conta[];
  atualizacoes: Conta[];
  erros: { linha: number; mensagem: string }[];
  ignoradas: number;
}

function simNao(v: string | undefined, padrao: boolean): boolean {
  if (v === undefined || String(v).trim() === '') return padrao;
  return /^(s|sim|y|yes|true|1|x)$/i.test(String(v).trim());
}

function lerTipo(v: string | undefined): TipoConta | null {
  const t = String(v ?? '').trim().toUpperCase();
  if (!t) return null;
  if (t.startsWith('S')) return 'S';
  if (t.startsWith('A')) return 'A';
  return null;
}

function lerNatureza(v: string | undefined): Natureza | null {
  const t = String(v ?? '').trim().toUpperCase();
  if (!t) return null;
  if (t.startsWith('D')) return 'D';
  if (t.startsWith('C')) return 'C';
  return null;
}

const GRUPOS_TEXTO: Record<string, GrupoConta> = {
  ATIVO: 'ATIVO',
  PASSIVO: 'PASSIVO',
  PL: 'PL',
  'PATRIMONIO LIQUIDO': 'PL',
  RECEITA: 'RECEITA',
  RECEITAS: 'RECEITA',
  CUSTO: 'CUSTO',
  CUSTOS: 'CUSTO',
  DESPESA: 'DESPESA',
  DESPESAS: 'DESPESA',
};

function lerGrupo(v: string | undefined): GrupoConta | null {
  const t = String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();
  return GRUPOS_TEXTO[t] ?? null;
}

/**
 * Prepara a importação do plano de contas (função pura): valida cada linha e decide o que
 * é conta nova e o que é atualização. As linhas são processadas em ordem hierárquica, então
 * a planilha pode trazer as contas-mãe e as filhas em qualquer ordem.
 */
export function prepararImportacaoContas(
  empresaId: number,
  linhas: LinhaContaImportada[],
  existentes: Conta[],
  mascara: Mascara,
  opcoes: { atualizarExistentes: boolean; contasComMovimento: Set<number> },
): ResultadoPreparoContas {
  const resultado: ResultadoPreparoContas = { novas: [], atualizacoes: [], erros: [], ignoradas: 0 };
  const universo = [...existentes];
  let proximo = existentes.reduce((m, c) => Math.max(m, c.reduzido ?? 0), 0) + 1;
  const validas = linhas.filter((l) => {
    if (!String(l.codigo ?? '').trim() && !String(l.nome ?? '').trim()) return false;
    if (!nivelDoCodigo(String(l.codigo).trim(), mascara)) {
      resultado.erros.push({ linha: l.linha, mensagem: `Código "${l.codigo}" não segue a máscara ${mascara.texto}.` });
      return false;
    }
    return true;
  });
  const vistos = new Set<string>();
  validas.sort((a, b) => compararCodigos(String(a.codigo).trim(), String(b.codigo).trim()));
  for (const l of validas) {
    const codigo = String(l.codigo).trim();
    if (vistos.has(codigo)) {
      resultado.erros.push({ linha: l.linha, mensagem: `Código ${codigo} repetido na planilha.` });
      continue;
    }
    vistos.add(codigo);
    const existente = universo.find((c) => c.codigo === codigo);
    if (existente && !opcoes.atualizarExistentes) {
      resultado.ignoradas++;
      continue;
    }
    const temFilhoNaPlanilha = validas.some((o) => ehDescendente(String(o.codigo).trim(), codigo));
    const tipo = lerTipo(l.tipo) ?? (temFilhoNaPlanilha ? 'S' : 'A');
    const grupo = lerGrupo(l.grupo) ?? grupoPadrao(codigo, universo, mascara);
    const natureza = lerNatureza(l.natureza) ?? naturezaSugerida(grupo, String(l.nome ?? ''));
    const reduzidoInformado = l.reduzido && /^\d+$/.test(String(l.reduzido).trim()) ? Number(String(l.reduzido).trim()) : undefined;
    const dados: DadosConta = {
      codigo,
      nome: String(l.nome ?? '').trim(),
      tipo,
      natureza,
      grupo,
      contaReferencial: l.contaReferencial ? String(l.contaReferencial).trim() : undefined,
      exigeCentroCusto: simNao(l.exigeCentroCusto, false),
      ativa: simNao(l.ativa, true),
      reduzido: reduzidoInformado,
    };
    const erros = validarDadosConta(dados, {
      mascara,
      contas: universo,
      atual: existente,
      temMovimento: existente?.id !== undefined && opcoes.contasComMovimento.has(existente.id),
    });
    if (erros.length) {
      resultado.erros.push(...erros.map((mensagem) => ({ linha: l.linha, mensagem })));
      continue;
    }
    const reduzido = tipo === 'A' ? (reduzidoInformado ?? existente?.reduzido ?? proximo++) : undefined;
    const conta: Conta = {
      ...(existente ?? {}),
      empresaId,
      codigo,
      nome: dados.nome,
      tipo,
      natureza,
      nivel: nivelDoCodigo(codigo, mascara)!,
      grupo,
      contaReferencial: dados.contaReferencial,
      exigeCentroCusto: dados.exigeCentroCusto,
      ativa: dados.ativa,
      reduzido,
    };
    if (existente) {
      resultado.atualizacoes.push(conta);
      universo[universo.indexOf(existente)] = conta;
    } else {
      resultado.novas.push(conta);
      universo.push(conta);
    }
  }
  return resultado;
}

export async function aplicarImportacaoContas(empresaId: number, preparo: ResultadoPreparoContas, arquivo: string): Promise<void> {
  await db.transaction('rw', db.contas, db.auditoria, async () => {
    if (preparo.novas.length) await db.contas.bulkAdd(preparo.novas);
    if (preparo.atualizacoes.length) await db.contas.bulkPut(preparo.atualizacoes);
    await registrarAuditoria({
      empresaId,
      entidade: 'Conta',
      acao: 'IMPORTAR',
      descricao: `Importação do plano de contas (${arquivo}): ${preparo.novas.length} nova(s), ${preparo.atualizacoes.length} atualizada(s)`,
    });
  });
}

/** Ids das contas da empresa que têm pelo menos um lançamento. */
export async function contasComMovimento(empresaId: number): Promise<Set<number>> {
  const ids = new Set<number>();
  await db.lancamentos
    .where('empresaId')
    .equals(empresaId)
    .each((l) => l.contaIds.forEach((id) => ids.add(id)));
  return ids;
}
