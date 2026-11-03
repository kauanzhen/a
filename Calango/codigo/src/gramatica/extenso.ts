// Números, valores, quantidades e percentuais POR EXTENSO (português do Brasil).
//
// Regras usadas:
// - "mil" nunca leva "um" antes (1.000 = "mil").
// - O "e" entre grupos só aparece antes do ÚLTIMO grupo quando ele é menor que
//   100 ou é uma centena redonda: 1.100 = "mil e cem", 10.500 = "dez mil e
//   quinhentos", 1.250 = "mil duzentos e cinquenta", 1.001.000 = "um milhão e mil".
// - Depois de milhão/bilhão usa-se vírgula: 1.250.000 = "um milhão, duzentos e
//   cinquenta mil".
// - Milhões e bilhões são substantivos masculinos ("duzentos milhões de quotas");
//   o gênero pedido vale para as unidades, dezenas, centenas e milhares
//   ("duzentas mil quotas", "uma quota", "duas quotas").
// - Valores redondos em milhão pedem "de": "um milhão de reais".

import { agruparMilhares, formatarMoeda, formatarPercentualCentesimos } from '../lib/dinheiro';

export type GeneroGramatical = 'm' | 'f';

const UNIDADES: Record<GeneroGramatical, string[]> = {
  m: ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'],
  f: ['', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'],
};
const DEZ_A_DEZENOVE = [
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove',
];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS: Record<GeneroGramatical, string[]> = {
  m: ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'],
  f: ['', 'cento', 'duzentas', 'trezentas', 'quatrocentas', 'quinhentas', 'seiscentas', 'setecentas', 'oitocentas', 'novecentas'],
};
const ESCALAS = [
  { singular: '', plural: '' },
  { singular: 'mil', plural: 'mil' },
  { singular: 'milhão', plural: 'milhões' },
  { singular: 'bilhão', plural: 'bilhões' },
  { singular: 'trilhão', plural: 'trilhões' },
];

/** Escreve um grupo de 1 a 999. */
function grupoPorExtenso(n: number, g: GeneroGramatical): string {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[g][c]);
  if (r) {
    if (r < 10) partes.push(UNIDADES[g][r]);
    else if (r < 20) partes.push(DEZ_A_DEZENOVE[r - 10]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[g][u]}` : DEZENAS[d]);
    }
  }
  return partes.join(' e ');
}

/** Número inteiro (0 a 999 trilhões) por extenso. */
export function numeroPorExtenso(n: number, genero: GeneroGramatical = 'm'): string {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error(`Número inválido para escrever por extenso: ${n}`);
  }
  if (n === 0) return 'zero';
  const grupos: number[] = [];
  let x = n;
  while (x > 0) {
    grupos.push(x % 1000);
    x = Math.floor(x / 1000);
  }
  if (grupos.length > ESCALAS.length) throw new Error(`Número grande demais: ${n}`);

  const partes: { texto: string; valor: number; escala: number }[] = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    const v = grupos[i];
    if (!v) continue;
    let texto: string;
    if (i === 0) texto = grupoPorExtenso(v, genero);
    else if (i === 1) texto = v === 1 ? 'mil' : `${grupoPorExtenso(v, genero)} mil`;
    else texto = `${grupoPorExtenso(v, 'm')} ${v === 1 ? ESCALAS[i].singular : ESCALAS[i].plural}`;
    partes.push({ texto, valor: v, escala: i });
  }

  let resultado = partes[0].texto;
  for (let k = 1; k < partes.length; k++) {
    const p = partes[k];
    const ultimo = k === partes.length - 1;
    let separador: string;
    if (ultimo && (p.valor < 100 || p.valor % 100 === 0)) separador = ' e ';
    else if (partes[k - 1].escala >= 2) separador = ', ';
    else separador = ' ';
    resultado += separador + p.texto;
  }
  return resultado;
}

/** true quando o número termina em milhão/bilhão redondo (pede "de": "um milhão de reais"). */
function pedeDe(n: number): boolean {
  return n >= 1_000_000 && n % 1_000_000 === 0;
}

/** Centavos -> "dez mil e quinhentos reais e cinquenta centavos". */
export function valorPorExtenso(centavos: number): string {
  if (!Number.isSafeInteger(centavos) || centavos < 0) {
    throw new Error(`Valor inválido: ${centavos}`);
  }
  const reais = Math.floor(centavos / 100);
  const cent = centavos % 100;
  const partes: string[] = [];
  if (reais > 0) {
    partes.push(`${numeroPorExtenso(reais)}${pedeDe(reais) ? ' de' : ''} ${reais === 1 ? 'real' : 'reais'}`);
  }
  if (cent > 0) partes.push(`${numeroPorExtenso(cent)} ${cent === 1 ? 'centavo' : 'centavos'}`);
  if (partes.length === 0) return 'zero real';
  return partes.join(' e ');
}

/** Centavos -> "R$ 10.500,00 (dez mil e quinhentos reais)". */
export function moedaComExtenso(centavos: number): string {
  return `${formatarMoeda(centavos)} (${valorPorExtenso(centavos)})`;
}

export interface Substantivo {
  singular: string;
  plural: string;
  genero: GeneroGramatical;
}

export const QUOTA: Substantivo = { singular: 'quota', plural: 'quotas', genero: 'f' };

/** Só o extenso da quantidade, concordando com o substantivo: 10500 -> "dez mil e quinhentas". */
export function quantidadeSoExtenso(n: number, s: Substantivo): string {
  return numeroPorExtenso(n, s.genero);
}

/**
 * Quantidade com número, extenso e substantivo:
 * 10500 -> "10.500 (dez mil e quinhentas) quotas"; 1 -> "1 (uma) quota";
 * 1.000.000 -> "1.000.000 (um milhão) de quotas".
 */
export function quantidadeComExtenso(n: number, s: Substantivo): string {
  const nome = n === 1 ? s.singular : s.plural;
  const de = pedeDe(n) ? 'de ' : '';
  return `${agruparMilhares(n)} (${numeroPorExtenso(n, s.genero)}) ${de}${nome}`;
}

/**
 * Percentual em centésimos de ponto (5000 = 50%; 3333 = 33,33%) por extenso:
 * "cinquenta por cento", "trinta e três vírgula trinta e três por cento".
 */
export function percentualSoExtenso(centesimos: number): string {
  const inteiro = Math.floor(centesimos / 100);
  const dec = centesimos % 100;
  let texto = numeroPorExtenso(inteiro);
  if (dec > 0) {
    const casas = String(dec).padStart(2, '0').replace(/0$/, '');
    const parteDecimal = casas.length === 2 && casas.startsWith('0')
      ? `zero ${numeroPorExtenso(Number(casas))}`
      : numeroPorExtenso(Number(casas));
    texto += ` vírgula ${parteDecimal}`;
  }
  return `${texto} por cento`;
}

/** 5000 -> "50% (cinquenta por cento)". */
export function percentualComExtenso(centesimos: number): string {
  return `${formatarPercentualCentesimos(centesimos)}% (${percentualSoExtenso(centesimos)})`;
}
