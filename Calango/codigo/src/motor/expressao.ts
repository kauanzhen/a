// Condições usadas em [se ...] e em "condição de exibição".
//
// Exemplos:
//   unipessoal
//   não unipessoal
//   enquadramento = ME
//   capital.integralizacao != a_vista
//   pluripessoal e tem_pro_labore
//   enquadramento = ME ou enquadramento = EPP
//   (a ou b) e c

export type Expr =
  | { tipo: 'nome'; nome: string }
  | { tipo: 'comparacao'; nome: string; op: '=' | '!='; valor: string }
  | { tipo: 'nao'; expr: Expr }
  | { tipo: 'e'; esq: Expr; dir: Expr }
  | { tipo: 'ou'; esq: Expr; dir: Expr };

export class ErroExpressao extends Error {}

type Token = { t: 'palavra'; v: string } | { t: 'op'; v: '=' | '!=' } | { t: 'abre' } | { t: 'fecha' };

function tokenizar(texto: string): Token[] {
  const r: Token[] = [];
  let i = 0;
  while (i < texto.length) {
    const ch = texto[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(') {
      r.push({ t: 'abre' });
      i++;
      continue;
    }
    if (ch === ')') {
      r.push({ t: 'fecha' });
      i++;
      continue;
    }
    if (texto.startsWith('!=', i) || texto.startsWith('≠', i)) {
      r.push({ t: 'op', v: '!=' });
      i += texto[i] === '≠' ? 1 : 2;
      continue;
    }
    if (ch === '=') {
      r.push({ t: 'op', v: '=' });
      i += texto.startsWith('==', i) ? 2 : 1;
      continue;
    }
    const m = /^[\p{L}\p{N}_.\-]+/u.exec(texto.slice(i));
    if (!m) throw new ErroExpressao(`Caractere inesperado na condição: "${ch}"`);
    r.push({ t: 'palavra', v: m[0] });
    i += m[0].length;
  }
  return r;
}

const NAO = new Set(['não', 'nao']);

export function analisarExpressao(texto: string): Expr {
  const tokens = tokenizar(texto);
  let pos = 0;
  const atual = () => tokens[pos];
  const ePalavra = (v: string) => {
    const t = atual();
    return t?.t === 'palavra' && t.v.toLowerCase() === v;
  };

  function ou(): Expr {
    let esq = e();
    while (ePalavra('ou')) {
      pos++;
      esq = { tipo: 'ou', esq, dir: e() };
    }
    return esq;
  }
  function e(): Expr {
    let esq = nao();
    while (ePalavra('e')) {
      pos++;
      esq = { tipo: 'e', esq, dir: nao() };
    }
    return esq;
  }
  function nao(): Expr {
    const t = atual();
    if (t?.t === 'palavra' && NAO.has(t.v.toLowerCase())) {
      pos++;
      return { tipo: 'nao', expr: nao() };
    }
    return primario();
  }
  function primario(): Expr {
    const t = atual();
    if (!t) throw new ErroExpressao('Condição incompleta.');
    if (t.t === 'abre') {
      pos++;
      const x = ou();
      if (atual()?.t !== 'fecha') throw new ErroExpressao('Falta fechar o parêntese na condição.');
      pos++;
      return x;
    }
    if (t.t !== 'palavra') throw new ErroExpressao('Condição mal escrita.');
    pos++;
    const prox = atual();
    if (prox?.t === 'op') {
      pos++;
      const v = atual();
      if (v?.t !== 'palavra') throw new ErroExpressao(`Falta o valor depois de "${t.v} ${prox.v}".`);
      pos++;
      return { tipo: 'comparacao', nome: t.v, op: prox.v, valor: v.v };
    }
    return { tipo: 'nome', nome: t.v };
  }

  if (tokens.length === 0) throw new ErroExpressao('Condição vazia.');
  const r = ou();
  if (pos < tokens.length) throw new ErroExpressao('Sobrou texto na condição. Use "e" / "ou" para juntar condições.');
  return r;
}

/** Nomes usados numa expressão (para descobrir os campos exigidos). */
export function nomesDaExpressao(x: Expr): string[] {
  switch (x.tipo) {
    case 'nome':
    case 'comparacao':
      return [x.nome];
    case 'nao':
      return nomesDaExpressao(x.expr);
    case 'e':
    case 'ou':
      return [...nomesDaExpressao(x.esq), ...nomesDaExpressao(x.dir)];
  }
}

/**
 * Avalia a expressão. `valor(nome)` devolve true/false para condições simples
 * ou o texto do valor para comparações (ex.: "ME").
 */
export function avaliarExpressao(x: Expr, valor: (nome: string) => boolean | string): boolean {
  switch (x.tipo) {
    case 'nome': {
      const v = valor(x.nome);
      return typeof v === 'string' ? v.trim() !== '' : v;
    }
    case 'comparacao': {
      const v = valor(x.nome);
      const igual = String(v).toLowerCase() === x.valor.toLowerCase();
      return x.op === '=' ? igual : !igual;
    }
    case 'nao':
      return !avaliarExpressao(x.expr, valor);
    case 'e':
      return avaliarExpressao(x.esq, valor) && avaliarExpressao(x.dir, valor);
    case 'ou':
      return avaliarExpressao(x.esq, valor) || avaliarExpressao(x.dir, valor);
  }
}
