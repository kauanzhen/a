// Textos derivados dos dados (endereços, naturalidade etc.), sem regras de
// tipo societário.

import { formatarCEP } from './documentos';
import type { Endereco } from './tipos';
import { normalizar } from '../lib/texto';

/** "Rua das Flores, nº 100, Sala 2, bairro Centro, Barueri/SP, CEP 06400-000" */
export function enderecoCompleto(e: Endereco): string {
  if (!e.logradouro) return '';
  const partes = [e.logradouro.trim()];
  partes.push(e.numero.trim() ? `nº ${e.numero.trim()}` : 's/nº');
  if (e.complemento.trim()) partes.push(e.complemento.trim());
  if (e.bairro.trim()) partes.push(`bairro ${e.bairro.trim()}`);
  if (e.cidade.trim()) partes.push(`${e.cidade.trim()}/${e.uf.trim().toUpperCase()}`);
  if (e.cep.trim()) partes.push(`CEP ${formatarCEP(e.cep)}`);
  return partes.join(', ');
}

// Tipos de logradouro masculinos ("no Largo...", "no Parque..."). Os demais
// (Rua, Avenida, Alameda, Travessa, Praça, Estrada, Rodovia...) levam "na".
const LOGRADOUROS_MASCULINOS = [
  'largo', 'beco', 'parque', 'conjunto', 'condominio', 'jardim', 'sitio', 'caminho', 'viaduto',
  'loteamento', 'nucleo', 'residencial', 'setor', 'trecho', 'patio', 'morro', 'calcadao', 'acesso',
  'anel', 'contorno', 'elevado', 'complexo', 'distrito', 'bloco', 'ramal', 'retorno', 'canal', 'cais',
];

export function preposicaoLogradouro(logradouro: string): 'na' | 'no' {
  const primeira = normalizar(logradouro).split(/[\s.]+/)[0] ?? '';
  return LOGRADOUROS_MASCULINOS.includes(primeira) ? 'no' : 'na';
}

/** "na Rua das Flores, nº 100, ..." / "no Largo do Arouche, ..." */
export function noEndereco(e: Endereco): string {
  const completo = enderecoCompleto(e);
  return completo ? `${preposicaoLogradouro(e.logradouro)} ${completo}` : '';
}

/** "Barueri/SP" */
export function cidadeUF(cidade: string, uf: string): string {
  if (!cidade.trim()) return '';
  return uf.trim() ? `${cidade.trim()}/${uf.trim().toUpperCase()}` : cidade.trim();
}
