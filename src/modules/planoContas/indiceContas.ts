import type { Conta } from '../../db/types';
import { compararCodigos, ehDescendente, type Mascara, totalDigitos } from '../../lib/mascara';

/** Índice em memória para localizar contas por id, código, código reduzido ou só dígitos. */
export interface IndiceContas {
  todas: Conta[];
  porId: Map<number, Conta>;
  porCodigo: Map<string, Conta>;
  porReduzido: Map<number, Conta>;
  porDigitos: Map<string, Conta>;
}

export function criarIndiceContas(contas: Conta[]): IndiceContas {
  const todas = [...contas].sort((a, b) => compararCodigos(a.codigo, b.codigo));
  const indice: IndiceContas = {
    todas,
    porId: new Map(),
    porCodigo: new Map(),
    porReduzido: new Map(),
    porDigitos: new Map(),
  };
  for (const c of todas) {
    if (c.id !== undefined) indice.porId.set(c.id, c);
    indice.porCodigo.set(c.codigo, c);
    if (c.reduzido !== undefined) indice.porReduzido.set(c.reduzido, c);
    indice.porDigitos.set(c.codigo.replace(/\D/g, ''), c);
  }
  return indice;
}

/**
 * Localiza uma conta a partir do que o usuário digitou ou do que veio na planilha:
 *  - "1.1.1.01.0001" (classificação com separadores) => pelo código;
 *  - "111010001" (só dígitos, com o total de dígitos da máscara) => pelo código sem pontos;
 *  - "1", "25" (número curto) => pelo código reduzido.
 */
export function localizarConta(referencia: unknown, indice: IndiceContas, mascara: Mascara): Conta | undefined {
  if (referencia === null || referencia === undefined) return undefined;
  const ref = String(referencia).trim();
  if (!ref) return undefined;
  if (/[.\-/]/.test(ref)) return indice.porCodigo.get(ref);
  if (!/^\d+$/.test(ref)) return undefined;
  if (ref.length === totalDigitos(mascara)) return indice.porDigitos.get(ref);
  return indice.porReduzido.get(Number(ref)) ?? indice.porDigitos.get(ref);
}

export function descreverConta(c: Conta | undefined): string {
  if (!c) return '(conta não encontrada)';
  return `${c.codigo} ${c.reduzido !== undefined ? `[${c.reduzido}] ` : ''}${c.nome}`;
}

/** Filhas diretas de uma conta. */
export function filhasDiretas(conta: Conta, indice: IndiceContas): Conta[] {
  return indice.todas.filter((c) => c.nivel === conta.nivel + 1 && ehDescendente(c.codigo, conta.codigo));
}
