// Leitura (análise) do texto das cláusulas.
//
// SINTAXE (pensada para ser inserida por botões no editor):
//
//   {{empresa.razao_social}}            variável (valor vindo dos dados)
//   {o sócio|a sócia|os sócios|as sócias : socios}
//                                       concordância: 4 formas (masc. sing., fem. sing.,
//                                       masc. pl., fem. pl.) ou 2 formas (masc.|fem.),
//                                       seguidas de ":" e de a quem se referem
//   {vocab.membro : socios}             palavra do vocabulário do tipo societário
//   **texto**                           negrito
//   [se unipessoal]...[senão]...[fim]   condição (na mesma linha ou em linhas próprias)
//   [senão se pluripessoal]             outra condição dentro do mesmo [se]
//   [para cada socio em socios separador=";" ultimo=" e" final="."]
//   ...
//   [fim]                               repetição (em linhas próprias ou na mesma linha)
//   [tabela]                            tabela: cada linha é uma linha da tabela, com as
//   Sócio | Quotas                      colunas separadas por "|"; a primeira é o cabeçalho.
//   [fim]                               Uma célula que começa com [para cada classe em classes]
//                                       vira uma coluna para cada item.
//   [assinatura]                        linha para assinatura
//
// No começo da linha:
//   § texto   parágrafo numerado (Parágrafo Primeiro, Segundo... ou Único)
//   - texto   alínea (a, b, c...)
//   * texto   item de lista
//   # texto   título de seção
// Linhas em branco são ignoradas (o espaçamento vem dos estilos do documento).

import { analisarExpressao, ErroExpressao, type Expr } from './expressao';

export type Marcador = '' | '§' | '-' | '*' | '#';

export interface OpcoesRepeticao {
  separador: string;
  ultimo?: string;
  final: string;
}

export interface RamoInline {
  condicao: Expr | null;
  corpo: NoInline[];
}

export type NoInline =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'negrito' }
  | { tipo: 'variavel'; nome: string }
  | { tipo: 'concordancia'; formas: string[]; referencia: string }
  | { tipo: 'se'; ramos: RamoInline[] }
  | { tipo: 'para'; item: string; colecao: string; opcoes: OpcoesRepeticao; corpo: NoInline[] };

export interface Celula {
  conteudo: NoInline[];
  repetir?: { item: string; colecao: string };
}

export interface RamoBloco {
  condicao: Expr | null;
  corpo: No[];
}

export type No =
  | { tipo: 'linha'; marcador: Marcador; conteudo: NoInline[]; linha: number }
  | { tipo: 'linhaTabela'; celulas: Celula[]; linha: number }
  | { tipo: 'se'; ramos: RamoBloco[]; linha: number }
  | { tipo: 'para'; item: string; colecao: string; opcoes: OpcoesRepeticao; corpo: No[]; linha: number }
  | { tipo: 'tabela'; corpo: No[]; linha: number }
  | { tipo: 'assinatura'; linha: number };

export interface ErroSintaxe {
  linha: number;
  mensagem: string;
}

export interface Analise {
  nos: No[];
  erros: ErroSintaxe[];
}

// ---------------- Tags ----------------

type Tag =
  | { tag: 'se'; condicao: string }
  | { tag: 'senao_se'; condicao: string }
  | { tag: 'senao' }
  | { tag: 'fim' }
  | { tag: 'para'; item: string; colecao: string; opcoes: OpcoesRepeticao }
  | { tag: 'tabela' }
  | { tag: 'assinatura' };

const RE_PARA = /^para\s+cada\s+([\p{L}_][\p{L}\p{N}_]*)\s+em\s+([\p{L}_][\p{L}\p{N}_.]*)\s*(.*)$/iu;

function lerOpcoes(resto: string): OpcoesRepeticao {
  const op: OpcoesRepeticao = { separador: '', final: '' };
  const re = /([\p{L}_]+)\s*=\s*"([^"]*)"/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(resto))) {
    const chave = m[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (chave === 'separador') op.separador = m[2];
    else if (chave === 'ultimo') op.ultimo = m[2];
    else if (chave === 'final') op.final = m[2];
  }
  return op;
}

/** Interpreta o conteúdo entre colchetes. null = não é uma tag (texto comum). */
function lerTag(dentro: string): Tag | null {
  const s = dentro.trim();
  const baixo = s.toLowerCase();
  let m: RegExpExecArray | null;
  if ((m = /^se\s+(.+)$/iu.exec(s))) return { tag: 'se', condicao: m[1] };
  if ((m = /^sen[ãa]o\s+se\s+(.+)$/iu.exec(s))) return { tag: 'senao_se', condicao: m[1] };
  if (baixo === 'senão' || baixo === 'senao') return { tag: 'senao' };
  if (baixo === 'fim') return { tag: 'fim' };
  if (baixo === 'tabela') return { tag: 'tabela' };
  if (baixo === 'assinatura') return { tag: 'assinatura' };
  if ((m = RE_PARA.exec(s))) return { tag: 'para', item: m[1], colecao: m[2], opcoes: lerOpcoes(m[3] ?? '') };
  return null;
}

// ---------------- Inline ----------------

type TokenInline =
  | { t: 'no'; no: NoInline }
  | { t: 'tag'; tag: Tag };

function tokenizarInline(texto: string, linha: number, erros: ErroSintaxe[]): TokenInline[] {
  const r: TokenInline[] = [];
  let buf = '';
  const soltar = () => {
    if (buf) r.push({ t: 'no', no: { tipo: 'texto', texto: buf } });
    buf = '';
  };
  let i = 0;
  while (i < texto.length) {
    if (texto.startsWith('{{', i)) {
      const fim = texto.indexOf('}}', i + 2);
      if (fim === -1) {
        erros.push({ linha, mensagem: 'Variável sem fechamento: falta "}}".' });
        buf += texto.slice(i);
        break;
      }
      soltar();
      const nome = texto.slice(i + 2, fim).trim();
      r.push({ t: 'no', no: { tipo: 'variavel', nome } });
      i = fim + 2;
      continue;
    }
    if (texto[i] === '{') {
      const fim = texto.indexOf('}', i + 1);
      const dentro = fim === -1 ? '' : texto.slice(i + 1, fim);
      const doisPontos = dentro.lastIndexOf(':');
      if (fim !== -1 && doisPontos !== -1 && !dentro.includes('{')) {
        soltar();
        const formas = dentro.slice(0, doisPontos).split('|').map((f) => f.trim());
        const referencia = dentro.slice(doisPontos + 1).trim();
        if (!referencia) erros.push({ linha, mensagem: `Concordância sem referência: "{${dentro}}". Indique depois de ":" a quem se refere (ex.: socios).` });
        if (formas.length !== 1 && formas.length !== 2 && formas.length !== 4)
          erros.push({ linha, mensagem: `Concordância "{${dentro}}" deve ter 2 formas (masc.|fem.) ou 4 formas (masc. sing.|fem. sing.|masc. pl.|fem. pl.).` });
        r.push({ t: 'no', no: { tipo: 'concordancia', formas, referencia } });
        i = fim + 1;
        continue;
      }
      buf += texto[i];
      i++;
      continue;
    }
    if (texto.startsWith('**', i)) {
      soltar();
      r.push({ t: 'no', no: { tipo: 'negrito' } });
      i += 2;
      continue;
    }
    if (texto[i] === '[') {
      const fim = texto.indexOf(']', i + 1);
      if (fim !== -1) {
        const tag = lerTag(texto.slice(i + 1, fim));
        if (tag && tag.tag !== 'tabela' && tag.tag !== 'assinatura') {
          soltar();
          r.push({ t: 'tag', tag });
          i = fim + 1;
          continue;
        }
      }
    }
    buf += texto[i];
    i++;
  }
  soltar();
  return r;
}

/** Monta a árvore inline a partir dos tokens (condições e repetições na mesma linha). */
function montarInline(tokens: TokenInline[], linha: number, erros: ErroSintaxe[]): NoInline[] {
  type Quadro =
    | { tipo: 'raiz'; corpo: NoInline[] }
    | { tipo: 'se'; no: Extract<NoInline, { tipo: 'se' }> }
    | { tipo: 'para'; no: Extract<NoInline, { tipo: 'para' }> };
  const raiz: Quadro = { tipo: 'raiz', corpo: [] };
  const pilha: Quadro[] = [raiz];
  const corpoAtual = (): NoInline[] => {
    const q = pilha[pilha.length - 1];
    if (q.tipo === 'raiz') return q.corpo;
    if (q.tipo === 'para') return q.no.corpo;
    return q.no.ramos[q.no.ramos.length - 1].corpo;
  };
  const cond = (c: string): Expr | null => {
    try {
      return analisarExpressao(c);
    } catch (e) {
      erros.push({ linha, mensagem: e instanceof ErroExpressao ? e.message : String(e) });
      return null;
    }
  };
  for (const tk of tokens) {
    if (tk.t === 'no') {
      corpoAtual().push(tk.no);
      continue;
    }
    const tag = tk.tag;
    if (tag.tag === 'se') {
      const no: Extract<NoInline, { tipo: 'se' }> = { tipo: 'se', ramos: [{ condicao: cond(tag.condicao), corpo: [] }] };
      corpoAtual().push(no);
      pilha.push({ tipo: 'se', no });
    } else if (tag.tag === 'senao_se' || tag.tag === 'senao') {
      const q = pilha[pilha.length - 1];
      if (q.tipo !== 'se') {
        erros.push({ linha, mensagem: '[senão] sem um [se] aberto na mesma linha.' });
        continue;
      }
      q.no.ramos.push({ condicao: tag.tag === 'senao_se' ? cond(tag.condicao) : null, corpo: [] });
    } else if (tag.tag === 'para') {
      const no: Extract<NoInline, { tipo: 'para' }> = {
        tipo: 'para',
        item: tag.item,
        colecao: tag.colecao,
        opcoes: tag.opcoes,
        corpo: [],
      };
      corpoAtual().push(no);
      pilha.push({ tipo: 'para', no });
    } else if (tag.tag === 'fim') {
      if (pilha.length === 1) {
        erros.push({ linha, mensagem: '[fim] sem um [se] ou [para cada] aberto.' });
        continue;
      }
      pilha.pop();
    }
  }
  if (pilha.length > 1) {
    erros.push({ linha, mensagem: 'Há [se] ou [para cada] aberto nesta linha sem o [fim] correspondente.' });
  }
  return raiz.corpo;
}

export function analisarInline(texto: string, linha = 1, erros: ErroSintaxe[] = []): NoInline[] {
  return montarInline(tokenizarInline(texto, linha, erros), linha, erros);
}

/** Divide uma linha de tabela em células pelo "|" que está fora de {...} e [...]. */
export function dividirCelulas(texto: string): string[] {
  const r: string[] = [];
  let atual = '';
  let chaves = 0;
  let colchetes = 0;
  for (const ch of texto) {
    if (ch === '{') chaves++;
    else if (ch === '}') chaves = Math.max(0, chaves - 1);
    else if (ch === '[') colchetes++;
    else if (ch === ']') colchetes = Math.max(0, colchetes - 1);
    if (ch === '|' && chaves === 0 && colchetes === 0) {
      r.push(atual.trim());
      atual = '';
    } else atual += ch;
  }
  r.push(atual.trim());
  return r;
}

function lerCelula(texto: string, linha: number, erros: ErroSintaxe[]): Celula {
  const m = /^\[para\s+cada\s+([\p{L}_][\p{L}\p{N}_]*)\s+em\s+([\p{L}_][\p{L}\p{N}_.]*)\s*\](.*)$/iu.exec(texto);
  if (m && !/\[fim\]/i.test(m[3])) {
    return { conteudo: analisarInline(m[3].trim(), linha, erros), repetir: { item: m[1], colecao: m[2] } };
  }
  return { conteudo: analisarInline(texto, linha, erros) };
}

// ---------------- Blocos (linhas) ----------------

function lerMarcador(s: string): { marcador: Marcador; resto: string } {
  if (/^§\s/.test(s) || s === '§') return { marcador: '§', resto: s.slice(1).trim() };
  if (/^-\s/.test(s)) return { marcador: '-', resto: s.slice(1).trim() };
  if (/^\*\s/.test(s)) return { marcador: '*', resto: s.slice(1).trim() };
  if (/^#\s/.test(s)) return { marcador: '#', resto: s.slice(1).trim() };
  return { marcador: '', resto: s };
}

export function analisarCorpo(texto: string): Analise {
  const erros: ErroSintaxe[] = [];
  type Quadro =
    | { tipo: 'raiz'; corpo: No[]; emTabela: false }
    | { tipo: 'se'; no: Extract<No, { tipo: 'se' }>; emTabela: boolean }
    | { tipo: 'para'; no: Extract<No, { tipo: 'para' }>; emTabela: boolean }
    | { tipo: 'tabela'; no: Extract<No, { tipo: 'tabela' }>; emTabela: true };
  const raiz: Quadro = { tipo: 'raiz', corpo: [], emTabela: false };
  const pilha: Quadro[] = [raiz];
  const topo = () => pilha[pilha.length - 1];
  const corpoAtual = (): No[] => {
    const q = topo();
    if (q.tipo === 'raiz') return q.corpo;
    if (q.tipo === 'se') return q.no.ramos[q.no.ramos.length - 1].corpo;
    return q.no.corpo;
  };

  const linhas = (texto ?? '').replace(/\r\n?/g, '\n').split('\n');
  linhas.forEach((original, idx) => {
    const n = idx + 1;
    const s = original.trim();
    if (!s) return;
    const mTag = /^\[([^\]]+)\]$/.exec(s);
    const tag = mTag ? lerTag(mTag[1]) : null;
    const cond = (c: string): Expr | null => {
      try {
        return analisarExpressao(c);
      } catch (e) {
        erros.push({ linha: n, mensagem: e instanceof ErroExpressao ? e.message : String(e) });
        return null;
      }
    };
    if (tag) {
      switch (tag.tag) {
        case 'se': {
          const no: Extract<No, { tipo: 'se' }> = { tipo: 'se', ramos: [{ condicao: cond(tag.condicao), corpo: [] }], linha: n };
          corpoAtual().push(no);
          pilha.push({ tipo: 'se', no, emTabela: topo().emTabela });
          return;
        }
        case 'senao_se':
        case 'senao': {
          const q = topo();
          if (q.tipo !== 'se') {
            erros.push({ linha: n, mensagem: '[senão] sem um [se] aberto.' });
            return;
          }
          q.no.ramos.push({ condicao: tag.tag === 'senao_se' ? cond(tag.condicao) : null, corpo: [] });
          return;
        }
        case 'para': {
          const no: Extract<No, { tipo: 'para' }> = {
            tipo: 'para',
            item: tag.item,
            colecao: tag.colecao,
            opcoes: tag.opcoes,
            corpo: [],
            linha: n,
          };
          corpoAtual().push(no);
          pilha.push({ tipo: 'para', no, emTabela: topo().emTabela });
          return;
        }
        case 'tabela': {
          if (topo().emTabela) {
            erros.push({ linha: n, mensagem: 'Não é possível colocar uma tabela dentro de outra.' });
            return;
          }
          const no: Extract<No, { tipo: 'tabela' }> = { tipo: 'tabela', corpo: [], linha: n };
          corpoAtual().push(no);
          pilha.push({ tipo: 'tabela', no, emTabela: true });
          return;
        }
        case 'assinatura':
          corpoAtual().push({ tipo: 'assinatura', linha: n });
          return;
        case 'fim':
          if (pilha.length === 1) {
            erros.push({ linha: n, mensagem: '[fim] sem um [se], [para cada] ou [tabela] aberto.' });
            return;
          }
          pilha.pop();
          return;
      }
    }
    if (topo().emTabela) {
      const celulas = dividirCelulas(s).map((c) => lerCelula(c, n, erros));
      corpoAtual().push({ tipo: 'linhaTabela', celulas, linha: n });
      return;
    }
    const { marcador, resto } = lerMarcador(s);
    corpoAtual().push({ tipo: 'linha', marcador, conteudo: analisarInline(resto, n, erros), linha: n });
  });
  while (pilha.length > 1) {
    const q = pilha.pop()!;
    const nome = q.tipo === 'se' ? '[se]' : q.tipo === 'para' ? '[para cada]' : '[tabela]';
    const linha = q.tipo === 'raiz' ? 0 : q.no.linha;
    erros.push({ linha, mensagem: `${nome} aberto na linha ${linha} sem o [fim] correspondente.` });
  }
  return { nos: raiz.corpo, erros };
}
