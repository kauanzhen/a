// Registro central dos tipos societários e documentos disponíveis.
// Para incluir um novo tipo, basta acrescentá-lo às listas abaixo.

import type { DefinicaoDocumento, DefinicaoTipoSocietario } from './definicoes';
import { DOC_ABERTURA, DOC_ALTERACAO, DOC_DISTRATO, LTDA } from './ltda';

export const TIPOS_SOCIETARIOS: DefinicaoTipoSocietario[] = [LTDA];

export const DOCUMENTOS: DefinicaoDocumento[] = [DOC_ABERTURA, DOC_ALTERACAO, DOC_DISTRATO];

/** Tipos de documento que aparecem nas cláusulas (inclui partes de documentos). */
export const TIPOS_DOCUMENTO_CLAUSULA: { id: string; nome: string }[] = [
  { id: 'abertura', nome: 'Abertura' },
  { id: 'alteracao', nome: 'Alteração' },
  { id: 'consolidacao', nome: 'Consolidação' },
  { id: 'distrato', nome: 'Distrato' },
  { id: 'transformacao', nome: 'Transformação' },
];

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
