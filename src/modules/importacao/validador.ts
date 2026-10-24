import type { CentroCusto, Conta, FormatoImportacao, Natureza, Partida } from '../../db/types';
import { formatarData, interpretarData, serialExcelParaISO } from '../../lib/date';
import { formatarMoeda, interpretarMoeda, type Centavos } from '../../lib/money';
import type { Mascara } from '../../lib/mascara';
import { localizarConta, type IndiceContas } from '../planoContas/indiceContas';
import { mensagemSituacao, type SituacaoData } from '../empresa/periodoService';
import type { RascunhoLancamento } from '../lancamentos/partidas';
import { normalizarCabecalho, type Campo, type Mapeamento } from './colunas';

export interface ContextoImportacao {
  indice: IndiceContas;
  mascara: Mascara;
  centros: CentroCusto[];
  situacaoPeriodo: (dataISO: string) => SituacaoData;
}

export interface LinhaValidada {
  /** número da linha na planilha (1 = primeira linha) */
  linha: number;
  lote: string;
  data?: string;
  valor?: Centavos;
  historico: string;
  documento?: string;
  /** formato SIMPLES */
  contaDebito?: Conta;
  contaCredito?: Conta;
  /** formato PARTIDA */
  conta?: Conta;
  dc?: Natureza;
  centroCusto?: CentroCusto;
  brutos: Partial<Record<Campo, unknown>>;
  erros: string[];
}

export interface LoteValidado {
  chave: string;
  linhas: number[];
  erros: string[];
  valido: boolean;
  totalDebitos: Centavos;
  totalCreditos: Centavos;
  rascunho?: RascunhoLancamento;
}

export interface ResultadoValidacao {
  formato: FormatoImportacao;
  linhas: LinhaValidada[];
  lotes: LoteValidado[];
  resumo: {
    linhasLidas: number;
    linhasComErro: number;
    linhasImportaveis: number;
    lotesValidos: number;
    lotesInvalidos: number;
    valorImportavel: Centavos;
  };
}

function texto(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

export function interpretarDataCelula(v: unknown): string | null {
  if (typeof v === 'number') return serialExcelParaISO(v);
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  return interpretarData(texto(v));
}

export function interpretarDC(v: unknown): Natureza | null {
  const t = normalizarCabecalho(v);
  if (['d', 'deb', 'debito', 'devedor', 'devedora'].includes(t)) return 'D';
  if (['c', 'cred', 'credito', 'credor', 'credora'].includes(t)) return 'C';
  return null;
}

function localizarCentro(v: unknown, centros: CentroCusto[]): CentroCusto | undefined {
  const t = texto(v);
  if (!t) return undefined;
  const n = normalizarCabecalho(t);
  return (
    centros.find((c) => c.codigo === t) ??
    centros.find((c) => /^\d+$/.test(t) && /^\d+$/.test(c.codigo) && Number(c.codigo) === Number(t)) ??
    centros.find((c) => normalizarCabecalho(c.nome) === n)
  );
}

function validarConta(ref: unknown, rotulo: string, ctx: ContextoImportacao, erros: string[]): Conta | undefined {
  const t = texto(ref);
  if (!t) {
    erros.push(`${rotulo}: não informada.`);
    return undefined;
  }
  const conta = localizarConta(t, ctx.indice, ctx.mascara);
  if (!conta) {
    erros.push(`${rotulo} "${t}" não existe no plano de contas.`);
    return undefined;
  }
  if (conta.tipo !== 'A') erros.push(`${rotulo} ${conta.codigo} (${conta.nome}) é sintética — use uma conta analítica.`);
  if (!conta.ativa) erros.push(`${rotulo} ${conta.codigo} (${conta.nome}) está inativa.`);
  return conta;
}

function ehResultado(c?: Conta) {
  return c && (c.grupo === 'RECEITA' || c.grupo === 'CUSTO' || c.grupo === 'DESPESA');
}

/**
 * Valida a planilha linha a linha e depois por lote (função pura).
 * Um lote só é importável se TODAS as suas linhas forem válidas e débitos = créditos.
 */
export function validarImportacao(
  linhas: unknown[][],
  linhaCabecalho: number,
  mapa: Mapeamento,
  formato: Exclude<FormatoImportacao, 'IA_JSON'>,
  ctx: ContextoImportacao,
): ResultadoValidacao {
  const pegar = (linha: unknown[], campo: Campo) => (mapa[campo] !== undefined && mapa[campo]! >= 0 ? linha[mapa[campo]!] : undefined);
  const validadas: LinhaValidada[] = [];

  for (let i = linhaCabecalho + 1; i < linhas.length; i++) {
    const bruta = linhas[i] ?? [];
    if (bruta.every((c) => texto(c) === '')) continue;
    const brutos: LinhaValidada['brutos'] = {};
    for (const campo of Object.keys(mapa) as Campo[]) brutos[campo] = pegar(bruta, campo);
    const erros: string[] = [];
    const lv: LinhaValidada = { linha: i + 1, lote: '', historico: texto(brutos.historico), documento: texto(brutos.documento) || undefined, brutos, erros };

    const data = interpretarDataCelula(brutos.data);
    if (!data) erros.push(`Data inválida: "${texto(brutos.data)}" (use dd/mm/aaaa).`);
    else {
      lv.data = data;
      const msg = mensagemSituacao(ctx.situacaoPeriodo(data), data);
      if (msg) erros.push(msg);
    }

    const valor = interpretarMoeda(brutos.valor as string | number | undefined);
    if (valor === null) erros.push(`Valor inválido: "${texto(brutos.valor)}".`);
    else if (valor <= 0) erros.push(`O valor deve ser maior que zero (recebido ${formatarMoeda(valor)}).`);
    else lv.valor = valor;

    if (!lv.historico) erros.push('Histórico não informado.');

    const cc = localizarCentro(brutos.centroCusto, ctx.centros);
    if (texto(brutos.centroCusto) && !cc) erros.push(`Centro de custo "${texto(brutos.centroCusto)}" não encontrado.`);
    else if (cc && !cc.ativo) erros.push(`Centro de custo ${cc.codigo} está inativo.`);
    lv.centroCusto = cc;

    if (formato === 'SIMPLES') {
      lv.lote = `linha-${i + 1}`;
      lv.contaDebito = validarConta(brutos.contaDebito, 'Conta débito', ctx, erros);
      lv.contaCredito = validarConta(brutos.contaCredito, 'Conta crédito', ctx, erros);
      if (lv.contaDebito && lv.contaDebito === lv.contaCredito) erros.push('Débito e crédito na mesma conta.');
      for (const c of [lv.contaDebito, lv.contaCredito]) {
        if (c?.exigeCentroCusto && !cc) erros.push(`A conta ${c.codigo} exige centro de custo.`);
      }
    } else {
      lv.lote = texto(brutos.lote);
      if (!lv.lote) erros.push('Lote não informado (linhas do mesmo lançamento devem ter o mesmo lote).');
      lv.conta = validarConta(brutos.conta, 'Conta', ctx, erros);
      const dc = interpretarDC(brutos.dc);
      if (!dc) erros.push(`D/C inválido: "${texto(brutos.dc)}" (use D ou C).`);
      else lv.dc = dc;
      if (lv.conta?.exigeCentroCusto && !cc) erros.push(`A conta ${lv.conta.codigo} exige centro de custo.`);
    }
    validadas.push(lv);
  }

  // ---- agrupamento por lote
  const grupos = new Map<string, LinhaValidada[]>();
  for (const lv of validadas) {
    const chave = lv.lote || `sem-lote-${lv.linha}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(lv);
  }

  const lotes: LoteValidado[] = [];
  for (const [chave, itens] of grupos) {
    const erros: string[] = [];
    const nums = itens.map((l) => l.linha);
    const comErro = itens.filter((l) => l.erros.length > 0);
    if (comErro.length) {
      erros.push(`Lote rejeitado: ${comErro.length === 1 ? 'a linha' : 'as linhas'} ${comErro.map((l) => l.linha).join(', ')} ${comErro.length === 1 ? 'tem' : 'têm'} erro.`);
    }
    let totalDebitos = 0;
    let totalCreditos = 0;
    const partidas: Partida[] = [];
    if (formato === 'SIMPLES') {
      const l = itens[0];
      totalDebitos = totalCreditos = l.valor ?? 0;
      if (l.contaDebito && l.contaCredito && l.valor) {
        partidas.push({ contaId: l.contaDebito.id!, tipo: 'D', valor: l.valor, centroCustoId: l.centroCusto && (ehResultado(l.contaDebito) || l.contaDebito.exigeCentroCusto) ? l.centroCusto.id : undefined });
        partidas.push({ contaId: l.contaCredito.id!, tipo: 'C', valor: l.valor, centroCustoId: l.centroCusto && (ehResultado(l.contaCredito) || l.contaCredito.exigeCentroCusto) ? l.centroCusto.id : undefined });
      }
    } else {
      const datas = new Set(itens.map((l) => l.data).filter(Boolean));
      if (datas.size > 1) erros.push(`Lote ${chave}: as linhas ${nums.join(', ')} têm datas diferentes (${[...datas].map((d) => formatarData(d!)).join(', ')}). Um lançamento tem uma única data.`);
      for (const l of itens) {
        if (l.dc === 'D') totalDebitos += l.valor ?? 0;
        if (l.dc === 'C') totalCreditos += l.valor ?? 0;
      }
      if (!itens.some((l) => l.dc === 'D') || !itens.some((l) => l.dc === 'C')) {
        erros.push(`Lote ${chave} (linha${nums.length > 1 ? 's' : ''} ${nums.join(', ')}): precisa de pelo menos um débito e um crédito.`);
      }
      if (!comErro.length && totalDebitos !== totalCreditos) {
        erros.push(
          `Lote ${chave} desbalanceado nas linhas ${nums.join(', ')}: débitos ${formatarMoeda(totalDebitos)} ≠ créditos ${formatarMoeda(totalCreditos)} (diferença ${formatarMoeda(Math.abs(totalDebitos - totalCreditos))}).`,
        );
      }
      const historicoLote = itens[0].historico;
      for (const l of itens) {
        if (l.conta && l.dc && l.valor) {
          partidas.push({
            contaId: l.conta.id!,
            tipo: l.dc,
            valor: l.valor,
            centroCustoId: l.centroCusto?.id,
            historico: l.historico && l.historico !== historicoLote ? l.historico : undefined,
          });
        }
      }
    }
    const valido = erros.length === 0;
    const primeiro = itens[0];
    lotes.push({
      chave,
      linhas: nums,
      erros,
      valido,
      totalDebitos,
      totalCreditos,
      rascunho: valido
        ? {
            data: primeiro.data!,
            lote: formato === 'PARTIDA' ? chave : undefined,
            documento: itens.find((l) => l.documento)?.documento,
            historico: primeiro.historico,
            partidas,
          }
        : undefined,
    });
  }

  const lotesValidos = lotes.filter((l) => l.valido);
  const linhasImportaveis = lotesValidos.reduce((s, l) => s + l.linhas.length, 0);
  return {
    formato,
    linhas: validadas,
    lotes,
    resumo: {
      linhasLidas: validadas.length,
      linhasComErro: validadas.filter((l) => l.erros.length).length,
      linhasImportaveis,
      lotesValidos: lotesValidos.length,
      lotesInvalidos: lotes.length - lotesValidos.length,
      valorImportavel: lotesValidos.reduce((s, l) => s + l.totalDebitos, 0),
    },
  };
}

/** Mapa linha -> erros do lote (para destacar na pré-visualização todas as linhas de um lote rejeitado). */
export function errosDeLotePorLinha(r: ResultadoValidacao): Map<number, string[]> {
  const mapa = new Map<number, string[]>();
  for (const lote of r.lotes) {
    if (lote.valido) continue;
    for (const n of lote.linhas) mapa.set(n, lote.erros);
  }
  return mapa;
}
