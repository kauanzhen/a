// Montagem do documento completo: percorre as áreas da definição do
// documento, avalia cada bloco escolhido e aplica a numeração automática
// (CLÁUSULA PRIMEIRA..., Parágrafo Único / Primeiro..., alíneas a, b, c).
// A numeração é sempre TEXTO gerado aqui — nunca lista automática do Word.

import { ordinalClausula, ordinalParagrafo, letraAlinea } from '../gramatica/ordinais';
import type { ItemSelecao } from '../dados/tipos';
import type { DefinicaoDocumento, EstiloParagrafo } from '../tipos/definicoes';
import { Avaliador, textoDosTrechos } from './avaliador';
import type { ContextoAvaliacao, Trecho } from './catalogo';
import { conteudoNaVersao, type Clausula, type ConteudoClausula } from './clausula';

export interface ParagrafoDoc {
  tipo: 'paragrafo';
  estilo: EstiloParagrafo;
  trechos: Trecho[];
  origem?: string;
}
export interface TabelaDoc {
  tipo: 'tabela';
  linhas: Trecho[][][];
  origem?: string;
}
export interface LinhaAssinaturaDoc {
  tipo: 'linha_assinatura';
  origem?: string;
}
export type ElementoDoc = ParagrafoDoc | TabelaDoc | LinhaAssinaturaDoc;

export interface PendenciaDoc {
  nivel: 'erro' | 'aviso';
  mensagem: string;
  clausula?: string;
  campos?: string[];
}

export interface DocumentoMontado {
  elementos: ElementoDoc[];
  pendencias: PendenciaDoc[];
  /** Cláusulas que entraram no documento, com a versão usada. */
  usadas: { clausula_id: string; versao: number }[];
  /** Texto do título (para rodapé e nome do arquivo). */
  titulo: string;
}

export interface ParametrosMontagem {
  definicao: DefinicaoDocumento;
  selecao: Record<string, ItemSelecao[]>;
  contexto: Omit<ContextoAvaliacao, 'renderizarBloco' | 'profundidade' | 'buscarClausula'>;
  buscarClausula: (id: string) => Clausula | undefined;
  /** true = usar exatamente a versão gravada na seleção (para reabrir um ato já gerado). */
  fixarVersoes?: boolean;
}

export function montarDocumento(p: ParametrosMontagem): DocumentoMontado {
  const buscarConteudo = (id: string): ConteudoClausula | undefined => {
    const c = p.buscarClausula(id);
    return c ? conteudoNaVersao(c) : undefined;
  };
  const av = new Avaliador({ ...p.contexto, buscarClausula: buscarConteudo, profundidade: 0 });
  const elementos: ElementoDoc[] = [];
  const pendencias: PendenciaDoc[] = [];
  const usadas: { clausula_id: string; versao: number }[] = [];
  let titulo = '';

  let numeroClausula = 0;
  let paragrafosDaClausula: ParagrafoDoc[] | null = null;

  const fecharClausula = () => {
    if (paragrafosDaClausula) rotularParagrafos(paragrafosDaClausula);
    paragrafosDaClausula = null;
  };

  for (const area of p.definicao.areas) {
    const itens = (p.selecao[area.id] ?? []).filter((i) => i.ativa);
    const daArea: ElementoDoc[] = [];
    for (const item of itens) {
      const completa = p.buscarClausula(item.clausula_id);
      if (!completa) {
        pendencias.push({
          nivel: 'erro',
          mensagem: `A cláusula "${item.clausula_id}" não foi encontrada na biblioteca (pode ter sido apagada). Remova-a na Etapa 1.`,
        });
        continue;
      }
      const c = conteudoNaVersao(completa, p.fixarVersoes ? item.versao : undefined);
      const nomeClausula = c.titulo_interno || completa.id;

      if (c.regras.condicao_de_exibicao.trim() && !av.condicao(c.regras.condicao_de_exibicao.trim())) continue;

      const res = av.avaliarCorpo(c.corpo);
      for (const e of res.erros) {
        pendencias.push({
          nivel: 'erro',
          clausula: nomeClausula,
          mensagem: `Erro no texto da cláusula "${nomeClausula}"${e.linha ? ` (linha ${e.linha})` : ''}: ${e.mensagem}`,
        });
      }
      for (const pe of res.pendencias) pendencias.push({ nivel: 'erro', clausula: nomeClausula, mensagem: pe.mensagem, campos: pe.campos });
      if (res.saida.length === 0) continue;
      usadas.push({ clausula_id: completa.id, versao: c.versao });

      const numerada = area.numerada && c.tipo_bloco === 'clausula';
      let prefixo: Trecho[] | null = null;
      if (numerada) {
        fecharClausula();
        numeroClausula++;
        paragrafosDaClausula = [];
        prefixo = [{ texto: `CLÁUSULA ${ordinalClausula(numeroClausula)}: `, negrito: true }];
      } else if (c.tipo_bloco === 'clausula' && !area.numerada) {
        fecharClausula();
      }
      if (c.titulo_secao.trim() && c.tipo_bloco !== 'paragrafo') {
        daArea.push({ tipo: 'paragrafo', estilo: 'titulo_secao', trechos: [{ texto: c.titulo_secao.trim(), negrito: true }], origem: completa.id });
      }
      if (c.tipo_bloco === 'paragrafo' && !paragrafosDaClausula) {
        pendencias.push({
          nivel: 'aviso',
          clausula: nomeClausula,
          mensagem: `O parágrafo "${nomeClausula}" não está logo depois de uma cláusula. Reordene na Etapa 1.`,
        });
        paragrafosDaClausula = [];
      }

      let alinea = 0;
      let primeiraLinha = true;
      res.saida.forEach((s) => {
        if (s.tipo === 'tabela') {
          if (prefixo) {
            daArea.push({ tipo: 'paragrafo', estilo: 'clausula', trechos: prefixo, origem: completa.id });
            prefixo = null;
          }
          daArea.push({ tipo: 'tabela', linhas: s.linhas, origem: completa.id });
          alinea = 0;
          return;
        }
        if (s.tipo === 'assinatura') {
          daArea.push({ tipo: 'linha_assinatura', origem: completa.id });
          return;
        }
        let marcador = s.marcador;
        if (c.tipo_bloco === 'paragrafo' && primeiraLinha) marcador = '§';
        primeiraLinha = false;
        let estilo: EstiloParagrafo = area.estilo;
        let trechos = s.trechos;
        if (marcador === '-') {
          estilo = 'alinea';
          trechos = [{ texto: `${letraAlinea(alinea)}) ` }, ...trechos];
          alinea++;
        } else {
          alinea = 0;
          if (marcador === '§') estilo = 'paragrafo';
          else if (marcador === '*') estilo = 'item';
          else if (marcador === '#') {
            estilo = 'titulo_secao';
            trechos = trechos.map((t) => ({ ...t, negrito: true }));
          } else if (numerada) estilo = 'clausula';
        }
        if (prefixo) {
          trechos = [...prefixo, ...trechos];
          prefixo = null;
        }
        const par: ParagrafoDoc = { tipo: 'paragrafo', estilo, trechos, origem: completa.id };
        if (marcador === '§') (paragrafosDaClausula ??= []).push(par);
        daArea.push(par);
      });
      if (prefixo) daArea.push({ tipo: 'paragrafo', estilo: 'clausula', trechos: prefixo, origem: completa.id });
    }
    if (daArea.length && area.titulo) {
      elementos.push({ tipo: 'paragrafo', estilo: 'titulo_secao', trechos: [{ texto: area.titulo, negrito: true }] });
    }
    if (area.id === 'titulo' && !titulo) {
      const primeiro = daArea.find((e): e is ParagrafoDoc => e.tipo === 'paragrafo');
      if (primeiro) titulo = textoDosTrechos(primeiro.trechos);
    }
    elementos.push(...daArea);
    if (area.numerada) fecharClausula();
  }
  fecharClausula();

  return { elementos, pendencias: semRepetir(pendencias), usadas, titulo: titulo || p.definicao.nome };
}

/** "Parágrafo Único:" quando há só um; senão "Parágrafo Primeiro:", "Segundo:"... */
function rotularParagrafos(lista: ParagrafoDoc[]) {
  const unico = lista.length === 1;
  lista.forEach((par, i) => {
    const rotulo = unico ? 'Parágrafo Único: ' : `Parágrafo ${ordinalParagrafo(i + 1)}: `;
    par.trechos = [{ texto: rotulo, negrito: true }, ...par.trechos];
  });
}

function semRepetir(lista: PendenciaDoc[]): PendenciaDoc[] {
  const vistos = new Set<string>();
  return lista.filter((p) => {
    const k = `${p.nivel}|${p.mensagem}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/** Texto corrido do documento (para testes e conferência). */
export function textoDoDocumento(doc: DocumentoMontado): string {
  return doc.elementos
    .map((e) => {
      if (e.tipo === 'paragrafo') return textoDosTrechos(e.trechos);
      if (e.tipo === 'tabela') return e.linhas.map((l) => l.map((c) => textoDosTrechos(c)).join(' | ')).join('\n');
      return '______________________________';
    })
    .join('\n');
}

// ---------------- Regras entre cláusulas (Etapa 1) ----------------

export interface AvisoRegra {
  nivel: 'erro' | 'aviso';
  mensagem: string;
}

export function verificarRegras(
  selecao: Record<string, ItemSelecao[]>,
  buscarClausula: (id: string) => Clausula | undefined,
): AvisoRegra[] {
  const r: AvisoRegra[] = [];
  const ativos = new Set<string>();
  for (const itens of Object.values(selecao)) for (const i of itens) if (i.ativa) ativos.add(i.clausula_id);
  const nome = (id: string) => buscarClausula(id)?.titulo_interno ?? id;
  for (const itens of Object.values(selecao)) {
    for (const i of itens) {
      const c = buscarClausula(i.clausula_id);
      if (!c) {
        r.push({ nivel: 'erro', mensagem: `A cláusula "${i.clausula_id}" não existe mais na biblioteca.` });
        continue;
      }
      if (c.arquivada) r.push({ nivel: 'aviso', mensagem: `"${c.titulo_interno}" está arquivada na biblioteca.` });
      if (c.regras.obrigatoria && !i.ativa) r.push({ nivel: 'erro', mensagem: `"${c.titulo_interno}" é obrigatória e está desligada.` });
      if (!i.ativa) continue;
      for (const req of c.regras.requer) {
        if (!ativos.has(req)) r.push({ nivel: 'aviso', mensagem: `"${c.titulo_interno}" requer "${nome(req)}", que não está no documento.` });
      }
      for (const conf of c.regras.conflita_com) {
        if (ativos.has(conf) && conf > c.id)
          r.push({ nivel: 'aviso', mensagem: `"${c.titulo_interno}" conflita com "${nome(conf)}". Mantenha só uma delas.` });
        else if (ativos.has(conf) && !buscarClausula(conf)?.regras.conflita_com.includes(c.id))
          r.push({ nivel: 'aviso', mensagem: `"${c.titulo_interno}" conflita com "${nome(conf)}". Mantenha só uma delas.` });
      }
    }
  }
  return r.filter((x, i) => r.findIndex((y) => y.mensagem === x.mensagem) === i);
}
