// Avaliação do texto das cláusulas com os dados de uma empresa.
// Resultado: linhas (com marcador § - * #), tabelas e linhas de assinatura,
// já com a concordância resolvida, mais a lista de lacunas (pendências).

import { escolherForma, type Referente } from '../gramatica/concordancia';
import {
  buscarDefItem,
  colecao,
  CONDICOES,
  converterItem,
  itemFixo,
  ITENS_FIXOS,
  referenteDaColecao,
  tipoItem,
  VARIAVEIS,
  type ContextoAvaliacao,
  type DefColecao,
  type DefVariavel,
  type Escopo,
  type Trecho,
  type Valor,
} from './catalogo';
import { avaliarExpressao, type Expr } from './expressao';
import { analisarCorpo, type Marcador, type No, type NoInline, type OpcoesRepeticao } from './sintaxe';
import type { DadosEmpresa, Pessoa } from '../dados/tipos';
import { ordinalPorExtenso } from '../gramatica/ordinais';
import { capitalizarPalavras } from '../lib/texto';

const ANTERIOR = 'anterior.';
const CLAUSULA_VIGENTE = 'clausula_vigente.';

/** "Cláusula Quinta" a partir do número. */
export function nomeDaClausula(n: number): string {
  return `Cláusula ${capitalizarPalavras(ordinalPorExtenso(n, 'f'))}`;
}

export type SaidaBloco =
  | { tipo: 'linha'; marcador: Marcador; trechos: Trecho[] }
  | { tipo: 'tabela'; linhas: Trecho[][][] }
  | { tipo: 'assinatura' };

export interface PendenciaTexto {
  mensagem: string;
  campos: string[];
}

export interface ErroAvaliacao {
  linha: number;
  mensagem: string;
}

export interface ResultadoAvaliacao {
  saida: SaidaBloco[];
  pendencias: PendenciaTexto[];
  erros: ErroAvaliacao[];
}

const PROFUNDIDADE_MAXIMA = 6;

// ---------------- Normalização de espaços e pontuação ----------------

/**
 * Junta espaços repetidos, tira espaço antes de pontuação e depois de "(",
 * remove ponto duplicado e apara as pontas. Evita erros de digitação
 * quando uma condição some do texto.
 */
export function normalizarTrechos(ts: Trecho[]): Trecho[] {
  type Ch = { c: string; n: boolean; p: boolean };
  const out: Ch[] = [];
  for (const t of ts) {
    for (const c of t.texto) {
      const ultimo = out[out.length - 1];
      if (/\s/.test(c)) {
        if (!ultimo || ultimo.c === ' ' || ultimo.c === '(') continue;
        out.push({ c: ' ', n: !!t.negrito, p: !!t.pendente });
        continue;
      }
      if (/[,.;:)]/.test(c) && ultimo?.c === ' ') out.pop();
      const anterior = out[out.length - 1];
      if (c === '.' && anterior?.c === '.' && out[out.length - 2]?.c !== '.') continue;
      if (c === ',' && anterior?.c === ',') continue;
      out.push({ c, n: !!t.negrito, p: !!t.pendente });
    }
  }
  while (out.length && out[out.length - 1].c === ' ') out.pop();
  const r: Trecho[] = [];
  for (const ch of out) {
    const u = r[r.length - 1];
    if (u && !!u.negrito === ch.n && !!u.pendente === ch.p) u.texto += ch.c;
    else r.push({ texto: ch.c, ...(ch.n ? { negrito: true } : {}), ...(ch.p ? { pendente: true } : {}) });
  }
  return r;
}

export function textoDosTrechos(ts: Trecho[]): string {
  return ts.map((t) => t.texto).join('');
}

function temTexto(ts: Trecho[]): boolean {
  return ts.some((t) => t.texto.trim() !== '');
}

function vazio(v: Valor): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  return !temTexto(v);
}

// ---------------- Avaliador ----------------

export class Avaliador {
  pendencias: PendenciaTexto[] = [];
  erros: ErroAvaliacao[] = [];
  private ctx: ContextoAvaliacao;

  constructor(ctx: ContextoAvaliacao) {
    this.ctx = { ...ctx, renderizarBloco: (id, esc) => this.renderizarBloco(id, esc) };
  }

  avaliarCorpo(corpo: string, escopo: Escopo = {}): ResultadoAvaliacao {
    const pendAntes = this.pendencias.length;
    const errAntes = this.erros.length;
    const { nos, erros } = analisarCorpo(corpo);
    for (const e of erros) this.erro(e.linha, e.mensagem);
    const saida = this.avaliarNos(nos, this.escopoInicial(escopo));
    return {
      saida,
      pendencias: this.pendencias.slice(pendAntes),
      erros: this.erros.slice(errAntes),
    };
  }

  /** Avalia uma condição solta (ex.: condição de exibição). */
  condicao(texto: string, escopo: Escopo = {}): boolean {
    const { nos, erros } = analisarCorpo(`[se ${texto}]\nx\n[fim]`);
    if (erros.length) {
      for (const e of erros) this.erro(0, `Condição de exibição "${texto}": ${e.mensagem}`);
      return true;
    }
    const no = nos[0];
    if (no?.tipo !== 'se' || !no.ramos[0].condicao) return true;
    return this.avaliarCondicao(no.ramos[0].condicao, this.escopoInicial(escopo), 0);
  }

  /** Define o modo da área que está sendo montada (ex.: "consolidacao"). */
  definirModoArea(modo: string | undefined) {
    this.ctx.modoArea = modo;
  }

  /** Pessoas nomeadas (ex.: responsável pelos livros no distrato) ficam sempre disponíveis. */
  private escopoInicial(esc: Escopo): Escopo {
    const r: Escopo = {};
    for (const f of ITENS_FIXOS) {
      const v = f.obter(this.ctx);
      if (v) r[f.nome] = { tipo: f.tipoItem, valor: v, indice: 0, total: 1 };
    }
    return { ...r, ...esc };
  }

  /** Executa com os dados trocados (ex.: dados anteriores ao ato). */
  private comDados<T>(d: DadosEmpresa | undefined | null, fn: () => T): T {
    if (!d || d === this.ctx.dados) return fn();
    const salvo = this.ctx.dados;
    this.ctx.dados = d;
    try {
      return fn();
    } finally {
      this.ctx.dados = salvo;
    }
  }

  /** Nome sem o prefixo "anterior." (ou null, com erro, se o ato não tem dados anteriores). */
  private semAnterior(nome: string, linha: number): string | null {
    if (!this.ctx.dadosAntes) {
      this.erro(linha, `"${nome}": os dados anteriores só existem em documentos sobre empresa já registrada (alteração, distrato, transformação).`);
      return null;
    }
    return nome.slice(ANTERIOR.length);
  }

  private erro(linha: number, mensagem: string) {
    if (!this.erros.some((e) => e.linha === linha && e.mensagem === mensagem)) this.erros.push({ linha, mensagem });
  }

  private pendencia(mensagem: string, campos: string[]) {
    if (!this.pendencias.some((p) => p.mensagem === mensagem)) this.pendencias.push({ mensagem, campos });
  }

  private renderizarBloco(id: string, escopo: Escopo): Trecho[] {
    const c = this.ctx.buscarClausula(id);
    if (!c) {
      this.erro(0, `O bloco "${id}" não foi encontrado na biblioteca.`);
      return [{ texto: `[bloco "${id}" não encontrado]`, pendente: true }];
    }
    if (this.ctx.profundidade >= PROFUNDIDADE_MAXIMA) {
      this.erro(0, `O bloco "${id}" se repete dentro de si mesmo.`);
      return [];
    }
    this.ctx.profundidade++;
    try {
      const { nos, erros } = analisarCorpo(c.corpo);
      for (const e of erros) this.erro(e.linha, `No bloco "${c.titulo_interno}": ${e.mensagem}`);
      const saida = this.avaliarNos(nos, escopo);
      const r: Trecho[] = [];
      for (const s of saida) {
        if (s.tipo !== 'linha') continue;
        if (r.length) r.push({ texto: ' ' });
        r.push(...s.trechos);
      }
      return r;
    } finally {
      this.ctx.profundidade--;
    }
  }

  // ----- Resolução de nomes -----

  private resolverVariavel(nome: string, esc: Escopo, linha: number): { def?: DefVariavel; valor: Valor; dono?: string } {
    if (nome.startsWith(ANTERIOR)) {
      const resto = this.semAnterior(nome, linha);
      if (resto === null) return { valor: '' };
      return this.comDados(this.ctx.dadosAntes, () => this.resolverVariavel(resto, esc, linha));
    }
    if (nome.startsWith(CLAUSULA_VIGENTE)) {
      const id = nome.slice(CLAUSULA_VIGENTE.length);
      const base = this.ctx.dadosAntes ?? this.ctx.dados;
      const titulo = this.ctx.buscarClausula(id)?.titulo_interno ?? id;
      const def: DefVariavel = {
        nome,
        rotulo: `número da cláusula “${titulo}” no contrato vigente`,
        grupo: 'Contrato vigente',
        campos: ['alteracao.numeracao'],
        resolver: () => '',
      };
      const n = base.numeracao_clausulas?.[id];
      return { def, valor: n ? nomeDaClausula(n) : '' };
    }
    if (nome.startsWith('vocab.')) {
      const formas = this.ctx.tipo.vocabulario[nome.slice(6)];
      if (!formas) this.erro(linha, `Palavra do vocabulário desconhecida: "${nome}".`);
      return { valor: formas?.[0] ?? '' };
    }
    const ponto = nome.indexOf('.');
    if (ponto > 0) {
      const alias = nome.slice(0, ponto);
      const campo = nome.slice(ponto + 1);
      const it = esc[alias];
      if (it) {
        const achado = buscarDefItem(VARIAVEIS, it.tipo, campo);
        if (!achado) {
          this.erro(linha, `Variável desconhecida: {{${nome}}}.`);
          return { valor: `[?${nome}]` };
        }
        const valorItem = converterItem(it.valor, achado.cadeia);
        const dono = (valorItem as Pessoa)?.nome ?? undefined;
        return { def: achado.def, valor: this.comDados(it.dados, () => achado.def.resolver(this.ctx, valorItem, esc)), dono };
      }
      const fixo = itemFixo(alias);
      if (fixo) {
        const achado = buscarDefItem(VARIAVEIS, fixo.tipoItem, campo);
        if (!achado) {
          this.erro(linha, `Variável desconhecida: {{${nome}}}.`);
          return { valor: `[?${nome}]` };
        }
        // Pessoa ainda não escolhida: vira pendência.
        return { def: { ...achado.def, rotulo: fixo.rotulo, campos: fixo.campos, opcional: false }, valor: '' };
      }
    }
    const def = VARIAVEIS.find((v) => v.nome === nome && !v.tipoItem);
    if (!def) {
      const deItem = pareceVariavelDeItem(nome);
      this.erro(
        linha,
        deItem
          ? `A variável {{${nome}}} só pode ser usada dentro de uma repetição [para cada ...].`
          : `Variável desconhecida: {{${nome}}}.`,
      );
      return { valor: `[?${nome}]` };
    }
    return { def, valor: def.resolver(this.ctx, undefined, esc) };
  }

  private valorCondicao(nome: string, esc: Escopo, linha: number): boolean | string {
    if (nome.startsWith(ANTERIOR)) {
      const resto = this.semAnterior(nome, linha);
      if (resto === null) return false;
      return this.comDados(this.ctx.dadosAntes, () => this.valorCondicao(resto, esc, linha));
    }
    const ponto = nome.indexOf('.');
    if (ponto > 0) {
      const alias = nome.slice(0, ponto);
      const it = esc[alias];
      if (it) {
        const campo = nome.slice(ponto + 1);
        const achado = buscarDefItem(CONDICOES, it.tipo, campo);
        if (achado) return this.comDados(it.dados, () => achado.def.avaliar(this.ctx, converterItem(it.valor, achado.cadeia), esc));
        const v = buscarDefItem(VARIAVEIS, it.tipo, campo);
        if (v) {
          const val = this.comDados(it.dados, () => v.def.resolver(this.ctx, converterItem(it.valor, v.cadeia), esc));
          return !vazio(val) ? 'sim' : '';
        }
        this.erro(linha, `Condição desconhecida: "${nome}".`);
        return false;
      }
    }
    const c = CONDICOES.find((x) => x.nome === nome && !x.tipoItem);
    if (c) return c.avaliar(this.ctx, undefined, esc);
    const v = VARIAVEIS.find((x) => x.nome === nome && !x.tipoItem);
    if (v) return !vazio(v.resolver(this.ctx, undefined, esc)) ? 'sim' : '';
    this.erro(linha, `Condição desconhecida: "${nome}".`);
    return false;
  }

  private avaliarCondicao(x: Expr, esc: Escopo, linha: number): boolean {
    return avaliarExpressao(x, (nome) => this.valorCondicao(nome, esc, linha));
  }

  private referente(nome: string, esc: Escopo, linha: number): Referente {
    if (nome.startsWith(ANTERIOR)) {
      const resto = this.semAnterior(nome, linha);
      if (resto === null) return { genero: 'M', plural: false };
      return this.comDados(this.ctx.dadosAntes, () => this.referente(resto, esc, linha));
    }
    const it = esc[nome];
    if (it) {
      const t = tipoItem(it.tipo);
      if (t?.referente) return t.referente(it.valor);
      return { genero: 'M', plural: false };
    }
    const ponto = nome.indexOf('.');
    if (ponto > 0) {
      const dono = esc[nome.slice(0, ponto)];
      const f = dono ? tipoItem(dono.tipo)?.pessoas?.[nome.slice(ponto + 1)] : undefined;
      if (f) {
        const p = f(dono!.valor);
        return { genero: p?.genero === 'F' ? 'F' : 'M', plural: false };
      }
    }
    if (itemFixo(nome)) return { genero: 'M', plural: false };
    const c = colecao(nome);
    if (c) return referenteDaColecao(c, this.ctx);
    this.erro(linha, `Concordância com referência desconhecida: "${nome}". Use, por exemplo, socios, administradores ou o item da repetição.`);
    return { genero: 'M', plural: false };
  }

  private vincular(esc: Escopo, alias: string, col: DefColecao, valor: unknown, indice: number, total: number, dados?: DadosEmpresa): Escopo {
    const novo: Escopo = { ...esc };
    const t = tipoItem(col.tipoItem);
    if (alias !== 'pessoa' && t?.pai === 'pessoa' && t.paraPai) {
      novo.pessoa = { tipo: 'pessoa', valor: t.paraPai(valor), indice, total, dados };
    }
    delete novo[alias];
    novo[alias] = { tipo: col.tipoItem, valor, indice, total, dados };
    return novo;
  }

  private itensDaColecao(nome: string, linha: number): { col?: DefColecao; itens: unknown[]; dados?: DadosEmpresa } {
    if (nome.startsWith(ANTERIOR)) {
      const resto = this.semAnterior(nome, linha);
      if (resto === null) return { itens: [] };
      const r = this.comDados(this.ctx.dadosAntes, () => this.itensDaColecao(resto, linha));
      return { ...r, dados: this.ctx.dadosAntes ?? undefined };
    }
    const col = colecao(nome);
    if (!col) {
      this.erro(linha, `Lista desconhecida em [para cada]: "${nome}".`);
      return { itens: [] };
    }
    return { col, itens: col.obter(this.ctx), dados: col.dadosAnteriores ? (this.ctx.dadosAntes ?? undefined) : undefined };
  }

  // ----- Inline -----

  private avaliarInline(nos: NoInline[], esc: Escopo, estado: { negrito: boolean }, linha: number): Trecho[] {
    const r: Trecho[] = [];
    for (const no of nos) {
      switch (no.tipo) {
        case 'texto':
          r.push({ texto: no.texto, negrito: estado.negrito });
          break;
        case 'negrito':
          estado.negrito = !estado.negrito;
          break;
        case 'variavel': {
          const { def, valor, dono } = this.resolverVariavel(no.nome, esc, linha);
          if (vazio(valor)) {
            if (def && !def.opcional) {
              const quem = dono && dono.trim() ? ` (${dono.trim()})` : '';
              this.pendencia(`Falta preencher: ${def.rotulo}${quem}.`, def.campos);
              r.push({ texto: `[${def.rotulo.split(' (')[0].split(' —')[0]}]`, pendente: true });
            }
            break;
          }
          if (typeof valor === 'string') r.push({ texto: valor, negrito: estado.negrito });
          else for (const t of valor!) r.push({ ...t, negrito: estado.negrito || !!t.negrito });
          break;
        }
        case 'concordancia': {
          let formas = no.formas;
          if (formas.length === 1 && formas[0].startsWith('vocab.')) {
            const v = this.ctx.tipo.vocabulario[formas[0].slice(6)];
            if (!v) this.erro(linha, `Palavra do vocabulário desconhecida: "${formas[0]}".`);
            formas = v ?? [''];
          }
          const ref = this.referente(no.referencia, esc, linha);
          r.push({ texto: escolherForma(formas, ref), negrito: estado.negrito });
          break;
        }
        case 'se': {
          const ramo = no.ramos.find((rm) => rm.condicao === null || this.avaliarCondicao(rm.condicao, esc, linha));
          if (ramo) r.push(...this.avaliarInline(ramo.corpo, esc, estado, linha));
          break;
        }
        case 'para': {
          const { col, itens, dados } = this.itensDaColecao(no.colecao, linha);
          if (!col) break;
          itens.forEach((v, i) => {
            const e2 = this.vincular(esc, no.item, col, v, i, itens.length, dados);
            r.push(...this.avaliarInline(no.corpo, e2, estado, linha));
            const suf = sufixo(no.opcoes, i, itens.length);
            if (suf) r.push({ texto: suf, negrito: estado.negrito });
          });
          break;
        }
      }
    }
    return r;
  }

  // ----- Blocos -----

  private avaliarNos(nos: No[], esc: Escopo): SaidaBloco[] {
    const r: SaidaBloco[] = [];
    for (const no of nos) {
      switch (no.tipo) {
        case 'linha': {
          const trechos = normalizarTrechos(this.avaliarInline(no.conteudo, esc, { negrito: false }, no.linha));
          if (temTexto(trechos)) r.push({ tipo: 'linha', marcador: no.marcador, trechos });
          break;
        }
        case 'se': {
          const ramo = no.ramos.find((rm) => rm.condicao === null || this.avaliarCondicao(rm.condicao, esc, no.linha));
          if (ramo) r.push(...this.avaliarNos(ramo.corpo, esc));
          break;
        }
        case 'para': {
          const { col, itens, dados } = this.itensDaColecao(no.colecao, no.linha);
          if (!col) break;
          itens.forEach((v, i) => {
            const sub = this.avaliarNos(no.corpo, this.vincular(esc, no.item, col, v, i, itens.length, dados));
            const suf = sufixo(no.opcoes, i, itens.length);
            if (suf) acrescentarAoFim(sub, suf);
            r.push(...sub);
          });
          break;
        }
        case 'tabela': {
          const linhas = this.avaliarLinhasTabela(no.corpo, esc);
          if (linhas.length) r.push({ tipo: 'tabela', linhas });
          break;
        }
        case 'assinatura':
          r.push({ tipo: 'assinatura' });
          break;
        case 'linhaTabela':
          break;
      }
    }
    return r;
  }

  private avaliarLinhasTabela(nos: No[], esc: Escopo): Trecho[][][] {
    const r: Trecho[][][] = [];
    for (const no of nos) {
      if (no.tipo === 'linhaTabela') {
        const celulas: Trecho[][] = [];
        for (const cel of no.celulas) {
          if (cel.repetir) {
            const { col, itens, dados } = this.itensDaColecao(cel.repetir.colecao, no.linha);
            if (!col) continue;
            itens.forEach((v, i) => {
              const e2 = this.vincular(esc, cel.repetir!.item, col, v, i, itens.length, dados);
              celulas.push(normalizarTrechos(this.avaliarInline(cel.conteudo, e2, { negrito: false }, no.linha)));
            });
          } else {
            celulas.push(normalizarTrechos(this.avaliarInline(cel.conteudo, esc, { negrito: false }, no.linha)));
          }
        }
        r.push(celulas);
      } else if (no.tipo === 'se') {
        const ramo = no.ramos.find((rm) => rm.condicao === null || this.avaliarCondicao(rm.condicao, esc, no.linha));
        if (ramo) r.push(...this.avaliarLinhasTabela(ramo.corpo, esc));
      } else if (no.tipo === 'para') {
        const { col, itens, dados } = this.itensDaColecao(no.colecao, no.linha);
        if (!col) continue;
        itens.forEach((v, i) => {
          r.push(...this.avaliarLinhasTabela(no.corpo, this.vincular(esc, no.item, col, v, i, itens.length, dados)));
        });
      }
    }
    return r;
  }
}

/** "socio.nome" fora de repetição: o prefixo é um tipo de item conhecido. */
export function pareceVariavelDeItem(nome: string): boolean {
  const prefixo = nome.split('.')[0];
  return !!tipoItem(prefixo) || VARIAVEIS.some((v) => v.nome === nome && !!v.tipoItem);
}

function sufixo(op: OpcoesRepeticao, i: number, total: number): string {
  if (i < total - 1) return i === total - 2 && op.ultimo !== undefined ? op.ultimo : op.separador;
  return op.final;
}

function acrescentarAoFim(saida: SaidaBloco[], texto: string) {
  for (let i = saida.length - 1; i >= 0; i--) {
    const s = saida[i];
    if (s.tipo === 'linha') {
      s.trechos = normalizarTrechos([...s.trechos, { texto }]);
      return;
    }
  }
}

/** Atalho: avalia um corpo com um contexto. */
export function avaliarCorpo(corpo: string, ctx: ContextoAvaliacao, escopo: Escopo = {}): ResultadoAvaliacao {
  return new Avaliador(ctx).avaliarCorpo(corpo, escopo);
}
