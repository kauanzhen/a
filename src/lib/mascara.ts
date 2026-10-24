/**
 * Máscara do plano de contas. Cada "9" é um dígito; qualquer outro caractere é separador.
 * Ex.: "9.9.9.99.9999" => 5 níveis com 1, 1, 1, 2 e 4 dígitos.
 *   1             nível 1 (Ativo)
 *   1.1           nível 2 (Ativo Circulante)
 *   1.1.1         nível 3 (Disponível)
 *   1.1.1.01      nível 4 (Caixa)
 *   1.1.1.01.0001 nível 5 (Caixa Geral) — normalmente a conta analítica
 */
export interface Mascara {
  texto: string;
  segmentos: number[];
  separadores: string[];
}

export const MASCARA_PADRAO = '9.9.9.99.9999';

export function interpretarMascara(texto: string): Mascara {
  const t = (texto ?? '').trim();
  if (!/^9+([.\-/]9+)+$/.test(t)) {
    throw new Error('Máscara inválida. Use "9" para dígitos e ".", "-" ou "/" como separador (ex.: 9.9.9.99.9999).');
  }
  const segmentos: number[] = [];
  const separadores: string[] = [];
  let atual = 0;
  for (const ch of t) {
    if (ch === '9') atual++;
    else {
      segmentos.push(atual);
      separadores.push(ch);
      atual = 0;
    }
  }
  segmentos.push(atual);
  if (segmentos.length > 10) throw new Error('A máscara pode ter no máximo 10 níveis.');
  return { texto: t, segmentos, separadores };
}

export function totalDigitos(m: Mascara): number {
  return m.segmentos.reduce((a, b) => a + b, 0);
}

/** Divide um código formatado nos seus segmentos, sem validar. */
export function segmentosDoCodigo(codigo: string): string[] {
  return codigo.split(/[.\-/]/);
}

/**
 * Retorna o nível (1..n) de um código formatado conforme a máscara,
 * ou null se o código não respeitar a máscara.
 */
export function nivelDoCodigo(codigo: string, m: Mascara): number | null {
  if (!codigo) return null;
  const partes = segmentosDoCodigo(codigo);
  if (partes.length > m.segmentos.length) return null;
  for (let i = 0; i < partes.length; i++) {
    if (!/^\d+$/.test(partes[i]) || partes[i].length !== m.segmentos[i]) return null;
  }
  // confere se os separadores usados são os da máscara
  if (formatarCodigo(partes.join(''), m) !== codigo) return null;
  return partes.length;
}

export function codigoValido(codigo: string, m: Mascara): boolean {
  return nivelDoCodigo(codigo, m) !== null;
}

/** Código da conta-mãe (remove o último segmento) ou null para o nível 1. */
export function codigoPai(codigo: string, m: Mascara): string | null {
  const nivel = nivelDoCodigo(codigo, m);
  if (!nivel || nivel === 1) return null;
  const digitos = codigo.replace(/\D/g, '');
  const tamanho = m.segmentos.slice(0, nivel - 1).reduce((a, b) => a + b, 0);
  return formatarCodigo(digitos.slice(0, tamanho), m);
}

/**
 * Aplica a máscara a uma sequência de dígitos (enquanto o usuário digita).
 * "111010001" => "1.1.1.01.0001"; "11101" => "1.1.1.01"; "1110" => "1.1.1.0" (incompleto).
 */
export function formatarCodigo(digitos: string, m: Mascara): string {
  const d = digitos.replace(/\D/g, '').slice(0, totalDigitos(m));
  let saida = '';
  let pos = 0;
  for (let i = 0; i < m.segmentos.length && pos < d.length; i++) {
    if (i > 0) saida += m.separadores[i - 1];
    saida += d.slice(pos, pos + m.segmentos[i]);
    pos += m.segmentos[i];
  }
  return saida;
}

/**
 * Converte um código de uma máscara para outra, preservando o valor numérico de cada segmento.
 * Ex.: "1.1.1.01.0001" de 9.9.9.99.9999 para 9.9.99.99.99999 => "1.1.01.01.00001".
 * Lança erro se o código tiver mais níveis que a nova máscara ou se um segmento não couber.
 */
export function reformatarCodigo(codigo: string, de: Mascara, para: Mascara): string {
  const nivel = nivelDoCodigo(codigo, de);
  if (!nivel) throw new Error(`Código "${codigo}" não segue a máscara ${de.texto}.`);
  if (nivel > para.segmentos.length) {
    throw new Error(`Código "${codigo}" tem ${nivel} níveis; a nova máscara ${para.texto} tem só ${para.segmentos.length}.`);
  }
  const partes = segmentosDoCodigo(codigo);
  const novos = partes.map((p, i) => {
    const valor = String(Number(p));
    if (valor.length > para.segmentos[i]) {
      throw new Error(`O segmento "${p}" do código "${codigo}" não cabe em ${para.segmentos[i]} dígito(s) na nova máscara.`);
    }
    return valor.padStart(para.segmentos[i], '0');
  });
  return formatarCodigo(novos.join(''), para);
}

/** Sugere o próximo código filho livre de uma conta sintética. */
export function proximoCodigoFilho(codigoMae: string | null, codigosExistentes: string[], m: Mascara): string | null {
  const nivelMae = codigoMae ? nivelDoCodigo(codigoMae, m) : 0;
  if (nivelMae === null || nivelMae >= m.segmentos.length) return null;
  const largura = m.segmentos[nivelMae];
  const prefixo = codigoMae ? codigoMae + m.separadores[nivelMae - 1] : '';
  let maior = 0;
  for (const c of codigosExistentes) {
    if (codigoMae ? !c.startsWith(prefixo) : false) continue;
    if (nivelDoCodigo(c, m) !== nivelMae + 1) continue;
    const ultimo = Number(segmentosDoCodigo(c)[nivelMae]);
    if (ultimo > maior) maior = ultimo;
  }
  const proximo = maior + 1;
  if (String(proximo).length > largura) return null;
  return prefixo + String(proximo).padStart(largura, '0');
}

/** Compara códigos de conta respeitando a hierarquia (1.1.2 vem antes de 1.1.10, 1 antes de 1.1). */
export function compararCodigos(a: string, b: string): number {
  const pa = segmentosDoCodigo(a);
  const pb = segmentosDoCodigo(b);
  const n = Math.min(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const diff = Number(pa[i]) - Number(pb[i]);
    if (diff !== 0) return diff;
  }
  return pa.length - pb.length;
}

/** true se "codigo" for descendente (filho, neto...) de "ancestral". */
export function ehDescendente(codigo: string, ancestral: string): boolean {
  if (codigo === ancestral || !codigo.startsWith(ancestral)) return false;
  return /^[.\-/]/.test(codigo.slice(ancestral.length));
}
