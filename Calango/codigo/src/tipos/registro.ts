// Registro central dos tipos societários e documentos disponíveis.
// Para incluir um novo tipo, basta acrescentá-lo às listas abaixo.

import type { DefinicaoDocumento, DefinicaoTipoSocietario } from './definicoes';
import { DOC_ABERTURA, DOC_ALTERACAO, DOC_DISTRATO, DOC_TRANSF_EI_LTDA, DOC_TRANSF_LTDA_EI, LTDA } from './ltda';
import { EI } from './ei';

export const TIPOS_SOCIETARIOS: DefinicaoTipoSocietario[] = [LTDA, EI];

export const DOCUMENTOS: DefinicaoDocumento[] = [DOC_ABERTURA, DOC_ALTERACAO, DOC_DISTRATO, DOC_TRANSF_LTDA_EI, DOC_TRANSF_EI_LTDA];

/** Tipos de documento que aparecem nas cláusulas (inclui partes de documentos). */
export const TIPOS_DOCUMENTO_CLAUSULA: { id: string; nome: string }[] = [
  { id: 'abertura', nome: 'Abertura' },
  { id: 'alteracao', nome: 'Alteração' },
  { id: 'consolidacao', nome: 'Consolidação' },
  { id: 'distrato', nome: 'Distrato' },
  { id: 'transformacao', nome: 'Transformação' },
];

/** Em quais tipos de documento da biblioteca uma área de um documento busca cláusulas. */
export function documentosDaArea(def: DefinicaoDocumento, areaId: string): string[] {
  const area = def.areas.find((a) => a.id === areaId);
  if (area?.modo === 'consolidacao') return def.tipo_depois === 'ei' ? ['transformacao'] : ['consolidacao', 'abertura'];
  if (def.efeito_registro === 'transformacao') return ['transformacao', 'alteracao'];
  return [def.id];
}

export function tipoSocietario(id: string): DefinicaoTipoSocietario {
  const t = TIPOS_SOCIETARIOS.find((x) => x.id === id);
  if (!t) throw new Error(`Tipo societário desconhecido: "${id}".`);
  return t;
}

export function documento(id: string): DefinicaoDocumento {
  const d = DOCUMENTOS.find((x) => x.id === id);
  if (!d) throw new Error(`Tipo de documento desconhecido: "${id}".`);
  return d;
}

/** Tipo societário usado para escrever o ato (o novo tipo, numa transformação). */
export function tipoDoAto(tipoEmpresa: string, def: DefinicaoDocumento): DefinicaoTipoSocietario {
  return tipoSocietario(def.tipo_depois ?? tipoEmpresa);
}
