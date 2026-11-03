// Tipos societários e tipos de documento são DADOS, não código.
// Para incluir um novo tipo societário (ex.: Sociedade Simples) ou um novo
// documento, cria-se uma nova definição — o motor de cláusulas, a gramática,
// o formulário automático e a geração de .docx são genéricos.

import type { Substantivo } from '../gramatica/extenso';

export interface DefinicaoTipoSocietario {
  id: string; // "ltda"
  nome: string; // "Sociedade Limitada"
  sigla: string; // "LTDA"
  /** Terminações aceitas na razão social (aviso se faltar). */
  sufixos_nome: string[];
  /** Substantivo da participação (quota, ação...), para os textos por extenso. */
  participacao: Substantivo;
  /**
   * Vocabulário próprio do tipo, usado nas cláusulas como {vocab.membro : socios}
   * (4 formas: masc. sing., fem. sing., masc. pl., fem. pl.) ou {{vocab.ato_constitutivo}}.
   */
  vocabulario: Record<string, string[]>;
  /** Id do bloco da biblioteca que monta a qualificação de pessoa física. */
  bloco_qualificacao_pessoa_fisica: string;
  /** Documentos que este tipo aceita (ids de DefinicaoDocumento). */
  documentos: string[];
}

export type EstiloParagrafo =
  | 'titulo'
  | 'titulo_secao'
  | 'clausula'
  | 'paragrafo'
  | 'alinea'
  | 'item'
  | 'texto'
  | 'fechamento'
  | 'assinatura';

export interface DefinicaoArea {
  id: string; // "corpo"
  nome: string; // "Corpo (cláusulas numeradas)"
  /** Cláusulas desta área recebem "CLÁUSULA PRIMEIRA:" etc. */
  numerada: boolean;
  /** Estilo dos parágrafos comuns desta área. */
  estilo: EstiloParagrafo;
  /** Título impresso antes da área quando ela tem conteúdo (ex.: "ANEXO"). */
  titulo?: string;
  /** Pode o usuário adicionar/remover blocos aqui? */
  editavel: boolean;
  /** Explicação mostrada na Etapa 1. */
  ajuda?: string;
}

export interface DefinicaoDocumento {
  id: string; // "abertura"
  nome: string; // "Contrato social de abertura"
  /** Usado no nome do arquivo: "AAAA-MM-DD - <nome_arquivo> - Razão social.docx" */
  nome_arquivo: string;
  descricao: string;
  /** false = aparece como "em breve" (fase futura). */
  disponivel: boolean;
  fase?: string;
  empresa: 'nova' | 'existente';
  areas: DefinicaoArea[];
  /** Blocos carregados por padrão em cada área, na ordem. */
  padrao: Record<string, string[]>;
}
