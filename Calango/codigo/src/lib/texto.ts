// Pequenas funções de texto usadas em vários módulos.

/** Remove acentos e deixa em minúsculas (para buscas e comparações). */
export function normalizar(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** "Padaria Bom Pão LTDA" -> "padaria-bom-pao-ltda" */
export function paraSlug(s: string, max = 40): string {
  const slug = normalizar(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return slug || 'sem-nome';
}

export function maiusculas(s: string): string {
  return (s ?? '').toLocaleUpperCase('pt-BR');
}

/** Primeira letra maiúscula. */
export function capitalizar(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1);
}

/** Cada palavra com inicial maiúscula ("décimo primeiro" -> "Décimo Primeiro"). */
export function capitalizarPalavras(s: string): string {
  return s.split(' ').map(capitalizar).join(' ');
}

/** Junta itens com vírgula e "e" antes do último: ["A","B","C"] -> "A, B e C". */
export function juntarComE(itens: string[]): string {
  const v = itens.filter((x) => x !== '');
  if (v.length <= 1) return v.join('');
  return `${v.slice(0, -1).join(', ')} e ${v[v.length - 1]}`;
}

/** Remove caracteres que o Windows não aceita em nome de arquivo. */
export function nomeArquivoSeguro(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

/** Identificador aleatório curto. */
export function novoId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && 'randomUUID' in c) return c.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function apenasDigitos(s: string): string {
  return (s ?? '').replace(/\D/g, '');
}
