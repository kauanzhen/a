// Formato de uma cláusula (bloco) da biblioteca. Cada cláusula é um arquivo
// .json na pasta clausulas/ da pasta de dados.

export type TipoBloco = 'clausula' | 'paragrafo' | 'texto';
export type Natureza = 'normal' | 'alteracao' | 'fixa';

export interface RegrasClausula {
  obrigatoria: boolean;
  /** Ids de outras cláusulas que precisam estar no documento junto com esta. */
  requer: string[];
  /** Ids de cláusulas que não podem estar junto com esta. */
  conflita_com: string[];
  /** Condição para aparecer no documento (ex.: "unipessoal"). Vazio = sempre. */
  condicao_de_exibicao: string;
}

export interface ConteudoClausula {
  titulo_interno: string;
  titulo_secao: string;
  tipo_bloco: TipoBloco;
  tags: string[];
  documentos: string[];
  tipo_societario: string[];
  natureza: Natureza;
  regras: RegrasClausula;
  corpo: string;
  observacoes: string;
}

export interface VersaoClausula extends ConteudoClausula {
  versao: number;
  salvo_em: string;
}

export interface Clausula extends ConteudoClausula {
  formato: 'calango/clausula';
  versao_formato: 1;
  id: string;
  /** Derivado automaticamente das variáveis usadas no corpo (não é digitado). */
  campos_exigidos: string[];
  versao: number;
  /** Versões anteriores (a atual fica nos campos principais). */
  historico: VersaoClausula[];
  arquivada: boolean;
  origem: 'biblioteca-inicial' | 'usuario' | 'importada';
  criada_em: string;
  atualizada_em: string;
}

export function regrasPadrao(): RegrasClausula {
  return { obrigatoria: false, requer: [], conflita_com: [], condicao_de_exibicao: '' };
}

/** Conteúdo da cláusula na versão pedida (ou a atual, se não existir no histórico). */
export function conteudoNaVersao(c: Clausula, versao?: number): ConteudoClausula & { versao: number } {
  if (versao === undefined || versao === c.versao) return { ...c, versao: c.versao };
  const h = c.historico.find((v) => v.versao === versao);
  return h ? { ...h } : { ...c, versao: c.versao };
}

/** Extrai só o conteúdo editável (para guardar no histórico). */
export function extrairConteudo(c: ConteudoClausula): ConteudoClausula {
  return {
    titulo_interno: c.titulo_interno,
    titulo_secao: c.titulo_secao,
    tipo_bloco: c.tipo_bloco,
    tags: [...c.tags],
    documentos: [...c.documentos],
    tipo_societario: [...c.tipo_societario],
    natureza: c.natureza,
    regras: { ...c.regras, requer: [...c.regras.requer], conflita_com: [...c.regras.conflita_com] },
    corpo: c.corpo,
    observacoes: c.observacoes,
  };
}
