// Dinheiro sempre em CENTAVOS inteiros. Nunca some valores com ponto flutuante.

/** Formata centavos como "10.500,00" (sem o símbolo). */
export function formatarNumeroMoeda(centavos: number): string {
  const negativo = centavos < 0;
  const abs = Math.abs(Math.round(centavos));
  const reais = Math.floor(abs / 100);
  const cent = abs % 100;
  return `${negativo ? '-' : ''}${agruparMilhares(reais)},${String(cent).padStart(2, '0')}`;
}

/** Formata centavos como "R$ 10.500,00". */
export function formatarMoeda(centavos: number): string {
  return `R$ ${formatarNumeroMoeda(centavos)}`;
}

/** 1234567 -> "1.234.567" */
export function agruparMilhares(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  let r = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) r += '.';
    r += s[i];
  }
  return (n < 0 ? '-' : '') + r;
}

/**
 * Lê um valor digitado ("10.500,00", "10500", "R$ 1.234,5") e devolve centavos.
 * Devolve null se o texto não for um valor válido.
 */
export function lerMoeda(texto: string): number | null {
  const limpo = texto.replace(/R\$/gi, '').replace(/\s/g, '');
  if (limpo === '') return null;
  if (!/^-?[\d.]*(,\d{0,2})?$/.test(limpo)) return null;
  const [inteiro, decimal = ''] = limpo.replace(/\./g, '').split(',');
  if (inteiro === '' || inteiro === '-') {
    if (decimal === '') return null;
  }
  const reais = inteiro === '' || inteiro === '-' ? 0 : Number(inteiro);
  const cent = Number((decimal + '00').slice(0, 2));
  if (!Number.isFinite(reais)) return null;
  const sinal = limpo.startsWith('-') ? -1 : 1;
  return sinal * (Math.abs(reais) * 100 + cent);
}

/**
 * Lê um percentual digitado ("50", "33,33", "12,5%") e devolve em centésimos de
 * ponto percentual (50% -> 5000; 33,33% -> 3333). Aceita até 2 casas decimais.
 */
export function lerPercentual(texto: string): number | null {
  const limpo = texto.replace(/%/g, '').replace(/\s/g, '');
  if (!/^\d+(,\d{1,2})?$/.test(limpo)) return null;
  const [inteiro, decimal = ''] = limpo.split(',');
  return Number(inteiro) * 100 + Number((decimal + '00').slice(0, 2));
}

/** Formata centésimos de ponto percentual: 5000 -> "50", 3333 -> "33,33", 1250 -> "12,5". */
export function formatarPercentualCentesimos(c: number): string {
  const inteiro = Math.floor(c / 100);
  const dec = c % 100;
  if (dec === 0) return String(inteiro);
  const d = String(dec).padStart(2, '0').replace(/0$/, '');
  return `${inteiro},${d}`;
}

/**
 * Percentual de uma parte sobre o total, em centésimos de ponto percentual,
 * arredondado para a casa mais próxima (somente para EXIBIÇÃO; a verdade são as quotas).
 */
export function percentualCentesimos(parte: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((parte * 10000) / total);
}
