// Descobre automaticamente quais CAMPOS do formulário uma cláusula exige,
// a partir das variáveis, condições, concordâncias e repetições usadas no
// texto. Também aponta nomes desconhecidos (para o editor avisar).

import type { DefinicaoTipoSocietario } from '../tipos/definicoes';
import { buscarDefItem, colecao, CONDICOES, tipoItem, VARIAVEIS } from './catalogo';
import type { ConteudoClausula } from './clausula';
import { nomesDaExpressao, type Expr } from './expressao';
import { analisarCorpo, type ErroSintaxe, type No, type NoInline } from './sintaxe';
import { pareceVariavelDeItem } from './avaliador';

export interface AnaliseCampos {
  campos: string[];
  erros: ErroSintaxe[];
}

type Aliases = Record<string, string>; // alias -> tipo do item

export function camposDoCorpo(
  corpo: string,
  tipo: DefinicaoTipoSocietario,
  buscarClausula: (id: string) => ConteudoClausula | undefined,
  aliasesIniciais: Aliases = {},
  visitados: Set<string> = new Set(),
): AnaliseCampos {
  const campos = new Set<string>();
  const { nos, erros } = analisarCorpo(corpo);
  const errosOut: ErroSintaxe[] = [...erros];
  const erro = (linha: number, mensagem: string) => {
    if (!errosOut.some((e) => e.linha === linha && e.mensagem === mensagem)) errosOut.push({ linha, mensagem });
  };
  const add = (lista: string[]) => lista.forEach((c) => campos.add(c));

  const comAlias = (al: Aliases, item: string, nomeColecao: string, linha: number): Aliases => {
    const col = colecao(nomeColecao);
    if (!col) {
      erro(linha, `Lista desconhecida em [para cada]: "${nomeColecao}".`);
      return al;
    }
    add(col.campos);
    const novo = { ...al, [item]: col.tipoItem };
    if (item !== 'pessoa' && tipoItem(col.tipoItem)?.pai === 'pessoa') novo.pessoa = 'pessoa';
    return novo;
  };

  const variavel = (nome: string, al: Aliases, linha: number) => {
    if (nome.startsWith('vocab.')) {
      if (!tipo.vocabulario[nome.slice(6)]) erro(linha, `Palavra do vocabulário desconhecida: "${nome}".`);
      return;
    }
    const ponto = nome.indexOf('.');
    const alias = ponto > 0 ? nome.slice(0, ponto) : '';
    let def = undefined as (typeof VARIAVEIS)[number] | undefined;
    if (alias && al[alias]) {
      def = buscarDefItem(VARIAVEIS, al[alias], nome.slice(ponto + 1))?.def;
    } else {
      def = VARIAVEIS.find((v) => v.nome === nome && !v.tipoItem);
      if (!def && pareceVariavelDeItem(nome)) {
        erro(linha, `A variável {{${nome}}} só pode ser usada dentro de uma repetição [para cada ...].`);
        return;
      }
    }
    if (!def) {
      erro(linha, `Variável desconhecida: {{${nome}}}.`);
      return;
    }
    add(def.campos);
    if (def.bloco) {
      const id = def.bloco(tipo);
      if (!visitados.has(id)) {
        const bloco = buscarClausula(id);
        if (bloco) {
          const sub = camposDoCorpo(bloco.corpo, tipo, buscarClausula, { pessoa: 'pessoa' }, new Set([...visitados, id]));
          add(sub.campos);
        } else erro(linha, `O bloco "${id}" usado por {{${nome}}} não existe na biblioteca.`);
      }
    }
  };

  const condicao = (x: Expr | null, al: Aliases, linha: number) => {
    if (!x) return;
    for (const nome of nomesDaExpressao(x)) {
      const ponto = nome.indexOf('.');
      const alias = ponto > 0 ? nome.slice(0, ponto) : '';
      if (alias && al[alias]) {
        const campo = nome.slice(ponto + 1);
        const c = buscarDefItem(CONDICOES, al[alias], campo)?.def ?? buscarDefItem(VARIAVEIS, al[alias], campo)?.def;
        if (c) add(c.campos);
        else erro(linha, `Condição desconhecida: "${nome}".`);
        continue;
      }
      const c = CONDICOES.find((k) => k.nome === nome && !k.tipoItem) ?? VARIAVEIS.find((v) => v.nome === nome && !v.tipoItem);
      if (c) add(c.campos);
      else erro(linha, `Condição desconhecida: "${nome}".`);
    }
  };

  const referencia = (nome: string, al: Aliases, linha: number) => {
    if (al[nome]) {
      const t = tipoItem(al[nome]);
      if (t?.referente) campos.add('pessoa.genero');
      return;
    }
    const col = colecao(nome);
    if (col) {
      add(col.campos);
      if (tipoItem(col.tipoItem)?.referente) campos.add('pessoa.genero');
      return;
    }
    erro(linha, `Concordância com referência desconhecida: "${nome}".`);
  };

  const inline = (lista: NoInline[], al: Aliases, linha: number) => {
    for (const no of lista) {
      if (no.tipo === 'variavel') variavel(no.nome, al, linha);
      else if (no.tipo === 'concordancia') {
        if (no.formas.length === 1 && no.formas[0].startsWith('vocab.') && !tipo.vocabulario[no.formas[0].slice(6)])
          erro(linha, `Palavra do vocabulário desconhecida: "${no.formas[0]}".`);
        referencia(no.referencia, al, linha);
      } else if (no.tipo === 'se') {
        for (const r of no.ramos) {
          condicao(r.condicao, al, linha);
          inline(r.corpo, al, linha);
        }
      } else if (no.tipo === 'para') {
        inline(no.corpo, comAlias(al, no.item, no.colecao, linha), linha);
      }
    }
  };

  const blocos = (lista: No[], al: Aliases) => {
    for (const no of lista) {
      switch (no.tipo) {
        case 'linha':
          inline(no.conteudo, al, no.linha);
          break;
        case 'linhaTabela':
          for (const cel of no.celulas) {
            const a2 = cel.repetir ? comAlias(al, cel.repetir.item, cel.repetir.colecao, no.linha) : al;
            inline(cel.conteudo, a2, no.linha);
          }
          break;
        case 'se':
          for (const r of no.ramos) {
            condicao(r.condicao, al, no.linha);
            blocos(r.corpo, al);
          }
          break;
        case 'para':
          blocos(no.corpo, comAlias(al, no.item, no.colecao, no.linha));
          break;
        case 'tabela':
          blocos(no.corpo, al);
          break;
        case 'assinatura':
          break;
      }
    }
  };

  blocos(nos, aliasesIniciais);
  return { campos: [...campos].sort(), erros: errosOut.sort((a, b) => a.linha - b.linha) };
}

/** Campos de uma cláusula inteira (corpo + condição de exibição). */
export function camposDaClausula(
  c: ConteudoClausula & { id?: string },
  tipo: DefinicaoTipoSocietario,
  buscarClausula: (id: string) => ConteudoClausula | undefined,
): AnaliseCampos {
  const aliases = aliasesDoBloco(c.id, tipo);
  const cond = c.regras.condicao_de_exibicao.trim();
  if (!cond) return camposDoCorpo(c.corpo, tipo, buscarClausula, aliases);
  const r = camposDoCorpo(`[se ${cond}]\n[fim]\n${c.corpo}`, tipo, buscarClausula, aliases);
  // As duas primeiras linhas são a condição de exibição: linha 0 = "condição".
  r.erros = r.erros.map((e) => ({
    linha: e.linha <= 2 ? 0 : e.linha - 2,
    mensagem: e.linha <= 2 ? `Condição de exibição: ${e.mensagem}` : e.mensagem,
  }));
  return r;
}

/**
 * Blocos-componente usados para uma pessoa (ex.: qualificação) são lidos como
 * se estivessem dentro de uma repetição, com o item "pessoa" disponível.
 */
export function aliasesDoBloco(id: string | undefined, tipo: DefinicaoTipoSocietario): Record<string, string> {
  return id && id === tipo.bloco_qualificacao_pessoa_fisica ? { pessoa: 'pessoa' } : {};
}
