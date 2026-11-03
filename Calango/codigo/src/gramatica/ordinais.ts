// Ordinais por extenso (até 999, e "milésimo"), com gênero.
// Cláusula é feminino: "CLÁUSULA VIGÉSIMA QUINTA". Parágrafo é masculino:
// "Parágrafo Primeiro".

import type { GeneroGramatical } from './extenso';
import { capitalizarPalavras, maiusculas } from '../lib/texto';

const UNIDADES = ['', 'primeir', 'segund', 'terceir', 'quart', 'quint', 'sext', 'sétim', 'oitav', 'non'];
const DEZENAS = ['', 'décim', 'vigésim', 'trigésim', 'quadragésim', 'quinquagésim', 'sexagésim', 'septuagésim', 'octogésim', 'nonagésim'];
const CENTENAS = ['', 'centésim', 'ducentésim', 'trecentésim', 'quadringentésim', 'quingentésim', 'sexcentésim', 'septingentésim', 'octingentésim', 'nongentésim'];

/** 25, 'f' -> "vigésima quinta" */
export function ordinalPorExtenso(n: number, genero: GeneroGramatical = 'm'): string {
  if (!Number.isInteger(n) || n < 1 || n > 1000) {
    throw new Error(`Ordinal fora do intervalo (1 a 1000): ${n}`);
  }
  const fim = genero === 'f' ? 'a' : 'o';
  if (n === 1000) return `milésim${fim}`;
  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c] + fim);
  if (d) partes.push(DEZENAS[d] + fim);
  if (u) partes.push(UNIDADES[u] + fim);
  return partes.join(' ');
}

/** 11 -> "DÉCIMA PRIMEIRA" (para "CLÁUSULA DÉCIMA PRIMEIRA") */
export function ordinalClausula(n: number): string {
  return maiusculas(ordinalPorExtenso(n, 'f'));
}

/** 2 -> "Segundo" (para "Parágrafo Segundo") */
export function ordinalParagrafo(n: number): string {
  return capitalizarPalavras(ordinalPorExtenso(n, 'm'));
}

/** 12, 'f' -> "12ª" */
export function ordinalNumerico(n: number, genero: GeneroGramatical = 'f'): string {
  return `${n}${genero === 'f' ? 'ª' : 'º'}`;
}

/** Letra da alínea: 0 -> "a", 25 -> "z", 26 -> "aa". */
export function letraAlinea(indice: number): string {
  let i = indice;
  let s = '';
  do {
    s = String.fromCharCode(97 + (i % 26)) + s;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return s;
}
