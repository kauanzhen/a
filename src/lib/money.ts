/**
 * Valores monetários são sempre guardados em CENTAVOS (inteiros).
 * Ex.: R$ 1.234,56 => 123456. Assim evitamos os erros de ponto flutuante
 * (0,1 + 0,2 !== 0,3) em somas de débitos e créditos.
 */
export type Centavos = number;

/** Arredonda um número possivelmente fracionário para o inteiro mais próximo (meio para cima, simétrico). */
export function arredondar(valor: number): number {
  // toPrecision(15) elimina o "ruído" binário (ex.: 100.49999999999999 -> 100.5)
  const limpo = Number(valor.toPrecision(15));
  const sinal = limpo < 0 ? -1 : 1;
  return sinal * Math.round(Math.abs(limpo)) || 0;
}

/** Converte reais (número) para centavos. Ex.: 1234.56 -> 123456 */
export function reaisParaCentavos(reais: number): Centavos {
  return arredondar(reais * 100);
}

/** Converte centavos para reais (apenas para exibição/exportação). */
export function centavosParaReais(c: Centavos): number {
  return c / 100;
}

/** Aplica um percentual (ex.: 7.5 = 7,5%) sobre um valor em centavos, arredondando ao centavo. */
export function aplicarPercentual(c: Centavos, percentual: number): Centavos {
  return arredondar((c * percentual) / 100);
}

export function somar(valores: Centavos[]): Centavos {
  return valores.reduce((a, b) => a + b, 0);
}

function agruparMilhar(inteiro: string): string {
  return inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Formata centavos como número pt-BR sem símbolo: 123456 -> "1.234,56" */
export function formatarNumero(c: Centavos): string {
  if (!Number.isFinite(c)) return '';
  const negativo = c < 0;
  const abs = Math.abs(Math.trunc(c));
  const inteiro = Math.floor(abs / 100).toString();
  const centavos = (abs % 100).toString().padStart(2, '0');
  return `${negativo ? '-' : ''}${agruparMilhar(inteiro)},${centavos}`;
}

/** Formata centavos como moeda: 123456 -> "R$ 1.234,56"; -500 -> "-R$ 5,00" */
export function formatarMoeda(c: Centavos): string {
  if (!Number.isFinite(c)) return '';
  const negativo = c < 0;
  return `${negativo ? '-' : ''}R$ ${formatarNumero(Math.abs(c))}`;
}

/**
 * Interpreta um texto digitado pelo usuário ou vindo de planilha e devolve centavos.
 * Aceita: "1.234,56", "1234,56", "R$ 1.234,56", "1234.56", "1,234.56", "1234".
 * Regras para ambiguidades (registradas no PREMISSAS.md):
 *  - Com "," e "." juntos, o separador que aparece por último é o decimal.
 *  - Só com ",", a vírgula é decimal (padrão brasileiro).
 *  - Só com ".", um único ponto seguido de exatamente 3 dígitos é milhar ("1.234" = mil duzentos
 *    e trinta e quatro); nos demais casos o ponto é decimal ("1234.5").
 * Retorna null se o texto não for um número válido.
 */
export function interpretarMoeda(entrada: string | number | null | undefined): Centavos | null {
  if (entrada === null || entrada === undefined) return null;
  if (typeof entrada === 'number') {
    return Number.isFinite(entrada) ? reaisParaCentavos(entrada) : null;
  }
  let s = String(entrada).trim();
  if (!s) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/R\$/gi, '').replace(/\s| /g, '');
  if (s.startsWith('-')) {
    negativo = !negativo;
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s)) return null;

  const ultimaVirgula = s.lastIndexOf(',');
  const ultimoPonto = s.lastIndexOf('.');
  let normalizado: string;
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    if (ultimaVirgula > ultimoPonto) {
      normalizado = s.replace(/\./g, '').replace(',', '.');
    } else {
      normalizado = s.replace(/,/g, '');
    }
  } else if (ultimaVirgula >= 0) {
    if (s.split(',').length > 2) return null;
    normalizado = s.replace(',', '.');
  } else if (ultimoPonto >= 0) {
    const partes = s.split('.');
    if (partes.length > 2) {
      // vários pontos => separador de milhar
      if (partes.slice(1).some((p) => p.length !== 3)) return null;
      normalizado = partes.join('');
    } else if (partes[1].length === 3) {
      normalizado = partes.join('');
    } else {
      normalizado = s;
    }
  } else {
    normalizado = s;
  }
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null;
  const numero = Number(normalizado);
  if (!Number.isFinite(numero)) return null;
  const c = reaisParaCentavos(numero);
  return negativo ? -c : c;
}
