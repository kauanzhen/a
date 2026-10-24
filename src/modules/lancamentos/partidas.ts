import type { CentroCusto, Partida } from '../../db/types';
import { ehISO } from '../../lib/date';
import { formatarMoeda, type Centavos } from '../../lib/money';
import { descreverConta, type IndiceContas } from '../planoContas/indiceContas';

export interface RascunhoLancamento {
  data: string;
  lote?: string;
  documento?: string;
  historicoPadraoId?: number;
  historico: string;
  complemento?: string;
  observacao?: string;
  partidas: Partida[];
}

export interface Totais {
  debitos: Centavos;
  creditos: Centavos;
  diferenca: Centavos;
}

export function calcularTotais(partidas: Pick<Partida, 'tipo' | 'valor'>[]): Totais {
  let debitos = 0;
  let creditos = 0;
  for (const p of partidas) {
    if (p.tipo === 'D') debitos += p.valor || 0;
    else creditos += p.valor || 0;
  }
  return { debitos, creditos, diferenca: debitos - creditos };
}

export interface ContextoValidacaoLancamento {
  indice: IndiceContas;
  centros: Map<number, CentroCusto>;
}

/**
 * Regras das partidas dobradas (função pura):
 *  - pelo menos um débito e um crédito;
 *  - valores inteiros (centavos) e positivos;
 *  - só contas analíticas e ativas;
 *  - centro de custo obrigatório quando a conta exigir;
 *  - soma dos débitos = soma dos créditos.
 */
export function validarLancamento(r: RascunhoLancamento, ctx: ContextoValidacaoLancamento): string[] {
  const erros: string[] = [];
  if (!ehISO(r.data)) erros.push('Data inválida.');
  if (!`${r.historico ?? ''}${r.complemento ?? ''}`.trim()) erros.push('Informe o histórico.');
  const partidas = r.partidas.filter((p) => p.contaId || p.valor);
  if (!partidas.some((p) => p.tipo === 'D')) erros.push('Informe ao menos uma partida a DÉBITO.');
  if (!partidas.some((p) => p.tipo === 'C')) erros.push('Informe ao menos uma partida a CRÉDITO.');
  partidas.forEach((p, i) => {
    const n = i + 1;
    const conta = ctx.indice.porId.get(p.contaId);
    if (!conta) {
      erros.push(`Partida ${n}: selecione uma conta válida.`);
    } else {
      if (conta.tipo !== 'A') erros.push(`Partida ${n}: a conta ${conta.codigo} é sintética; só contas analíticas recebem lançamentos.`);
      if (!conta.ativa) erros.push(`Partida ${n}: a conta ${descreverConta(conta)} está inativa.`);
      if (conta.exigeCentroCusto && !p.centroCustoId) erros.push(`Partida ${n}: a conta ${conta.codigo} exige centro de custo.`);
    }
    if (p.centroCustoId) {
      const cc = ctx.centros.get(p.centroCustoId);
      if (!cc) erros.push(`Partida ${n}: centro de custo inexistente.`);
      else if (!cc.ativo) erros.push(`Partida ${n}: o centro de custo ${cc.codigo} está inativo.`);
    }
    if (p.tipo !== 'D' && p.tipo !== 'C') erros.push(`Partida ${n}: indique D (débito) ou C (crédito).`);
    if (!Number.isInteger(p.valor) || p.valor <= 0) erros.push(`Partida ${n}: o valor deve ser maior que zero.`);
  });
  const { debitos, creditos, diferenca } = calcularTotais(partidas);
  if (diferenca !== 0) {
    erros.push(
      `Lançamento desbalanceado: débitos ${formatarMoeda(debitos)} ≠ créditos ${formatarMoeda(creditos)} (diferença de ${formatarMoeda(Math.abs(diferenca))}).`,
    );
  }
  return erros;
}

/** Inverte débitos e créditos (base do estorno). */
export function inverterPartidas(partidas: Partida[]): Partida[] {
  return partidas.map((p) => ({ ...p, tipo: p.tipo === 'D' ? 'C' : 'D' }));
}

/** Junta histórico padrão e complemento num texto único. */
export function montarHistorico(historico: string, complemento?: string): string {
  return [historico.trim(), complemento?.trim()].filter(Boolean).join(' ');
}
