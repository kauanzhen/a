// Regras de edição da biblioteca: nova cláusula, nova versão, duplicar,
// arquivar. Funções puras (não gravam nada).

import { paraSlug } from '../lib/texto';
import { extrairConteudo, regrasPadrao, type Clausula, type ConteudoClausula } from '../motor/clausula';
import { camposDaClausula } from '../motor/campos';
import type { DefinicaoTipoSocietario } from '../tipos/definicoes';

export function conteudoVazio(): ConteudoClausula {
  return {
    titulo_interno: '',
    titulo_secao: '',
    tipo_bloco: 'clausula',
    tags: [],
    documentos: ['abertura'],
    tipo_societario: ['ltda'],
    natureza: 'normal',
    regras: regrasPadrao(),
    corpo: '',
    observacoes: '',
  };
}

/** Gera um id único a partir do título ("Cláusula de foro" -> "clausula-de-foro-2"). */
export function idUnico(titulo: string, existentes: Set<string>): string {
  const base = paraSlug(titulo || 'clausula', 50);
  let id = base;
  let n = 2;
  while (existentes.has(id)) id = `${base}-${n++}`;
  return id;
}

/** O conteúdo mudou em relação à versão atual? */
export function conteudoMudou(a: ConteudoClausula, b: ConteudoClausula): boolean {
  return JSON.stringify(extrairConteudo(a)) !== JSON.stringify(extrairConteudo(b));
}

/**
 * Aplica uma edição: a versão atual vai para o histórico e o número da versão
 * sobe. Os campos exigidos são recalculados a partir do texto.
 */
export function aplicarEdicao(
  original: Clausula,
  novo: ConteudoClausula,
  tipo: DefinicaoTipoSocietario,
  buscar: (id: string) => ConteudoClausula | undefined,
  agora = new Date().toISOString(),
): Clausula {
  if (!conteudoMudou(original, novo)) return original;
  const anterior = { ...extrairConteudo(original), versao: original.versao, salvo_em: original.atualizada_em };
  return {
    ...original,
    ...extrairConteudo(novo),
    campos_exigidos: camposDaClausula({ ...novo, id: original.id }, tipo, buscar).campos,
    versao: original.versao + 1,
    historico: [...original.historico, anterior],
    atualizada_em: agora,
  };
}

export function criarClausula(
  conteudo: ConteudoClausula,
  existentes: Set<string>,
  tipo: DefinicaoTipoSocietario,
  buscar: (id: string) => ConteudoClausula | undefined,
  agora = new Date().toISOString(),
): Clausula {
  const id = idUnico(conteudo.titulo_interno, existentes);
  return {
    formato: 'calango/clausula',
    versao_formato: 1,
    id,
    ...extrairConteudo(conteudo),
    campos_exigidos: camposDaClausula({ ...conteudo, id }, tipo, buscar).campos,
    versao: 1,
    historico: [],
    arquivada: false,
    origem: 'usuario',
    criada_em: agora,
    atualizada_em: agora,
  };
}

export function duplicarClausula(
  c: Clausula,
  existentes: Set<string>,
  tipo: DefinicaoTipoSocietario,
  buscar: (id: string) => ConteudoClausula | undefined,
  agora = new Date().toISOString(),
): Clausula {
  return criarClausula({ ...extrairConteudo(c), titulo_interno: `${c.titulo_interno} (cópia)` }, existentes, tipo, buscar, agora);
}

export function arquivarClausula(c: Clausula, arquivar: boolean, agora = new Date().toISOString()): Clausula {
  return { ...c, arquivada: arquivar, atualizada_em: agora };
}
