// Definição da Sociedade Limitada e dos seus documentos.
// Tudo o que é específico de LTDA fica aqui e nas cláusulas da biblioteca.

import { QUOTA } from '../gramatica/extenso';
import type { DefinicaoDocumento, DefinicaoTipoSocietario } from './definicoes';

export const LTDA: DefinicaoTipoSocietario = {
  id: 'ltda',
  nome: 'Sociedade Limitada',
  sigla: 'LTDA',
  sufixos_nome: ['LTDA', 'LTDA.', 'LIMITADA'],
  participacao: QUOTA,
  vocabulario: {
    membro: ['sócio', 'sócia', 'sócios', 'sócias'],
    participacao: ['quota', 'quota', 'quotas', 'quotas'],
    ato_constitutivo: ['contrato social'],
    entidade: ['sociedade'],
    tipo: ['sociedade limitada'],
  },
  bloco_qualificacao_pessoa_fisica: 'qualificacao-pessoa-fisica',
  documentos: ['abertura', 'alteracao', 'distrato'],
};

export const DOC_ABERTURA: DefinicaoDocumento = {
  id: 'abertura',
  nome: 'Contrato social de abertura',
  nome_arquivo: 'Contrato social de abertura',
  descricao: 'Constituição de uma nova sociedade (com vários sócios ou unipessoal).',
  disponivel: true,
  empresa: 'nova',
  areas: [
    { id: 'titulo', nome: 'Título', numerada: false, estilo: 'titulo', editavel: true },
    {
      id: 'preambulo',
      nome: 'Preâmbulo',
      numerada: false,
      estilo: 'texto',
      editavel: true,
      ajuda: 'Qualificação dos sócios e frase de constituição.',
    },
    {
      id: 'corpo',
      nome: 'Corpo (cláusulas numeradas)',
      numerada: true,
      estilo: 'texto',
      editavel: true,
      ajuda: 'A numeração (PRIMEIRA, SEGUNDA...) é feita automaticamente.',
    },
    { id: 'fechamento', nome: 'Fechamento', numerada: false, estilo: 'fechamento', editavel: true },
    { id: 'assinaturas', nome: 'Assinaturas', numerada: false, estilo: 'assinatura', editavel: true },
    {
      id: 'anexo',
      nome: 'Anexo',
      numerada: false,
      estilo: 'texto',
      titulo: 'ANEXO',
      editavel: true,
      ajuda: 'Opcional. Só aparece no documento se tiver algum bloco.',
    },
  ],
  padrao: {
    titulo: ['titulo-abertura'],
    preambulo: ['preambulo-abertura'],
    corpo: [
      'denominacao',
      'sede',
      'duracao',
      'objeto-social',
      'capital-social',
      'paragrafo-responsabilidade-quotas',
      'paragrafo-quotas-indivisiveis',
      'paragrafo-aumento-capital',
      'enquadramento',
      'administracao',
      'paragrafo-administrador-nao-socio',
      'pro-labore',
      'exercicio-social',
      'paragrafo-balancos-intermediarios',
      'desimpedimento',
      'filiais',
      'falecimento',
      'foro',
    ],
    fechamento: ['fechamento-abertura'],
    assinaturas: ['assinaturas-socios'],
    anexo: [],
  },
};

export const DOC_ALTERACAO: DefinicaoDocumento = {
  id: 'alteracao',
  nome: 'Alteração contratual com consolidação',
  nome_arquivo: 'Alteração contratual',
  descricao: 'Alterações (endereço, capital, sócios...) com o contrato consolidado.',
  disponivel: false,
  fase: 'Fase 2',
  empresa: 'existente',
  areas: [],
  padrao: {},
};

export const DOC_DISTRATO: DefinicaoDocumento = {
  id: 'distrato',
  nome: 'Distrato',
  nome_arquivo: 'Distrato',
  descricao: 'Encerramento da sociedade.',
  disponivel: false,
  fase: 'Fase 3',
  empresa: 'existente',
  areas: [],
  padrao: {},
};
