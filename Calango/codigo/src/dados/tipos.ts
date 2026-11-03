// Modelo de dados do Calango. Os nomes dos campos gravados em arquivo usam
// snake_case (como na especificação); o código usa camelCase.
//
// Princípio central: os DADOS da empresa são a fonte da verdade; os documentos
// são saídas geradas a partir deles.

import type { EstadoCivil, Genero, RegimeBens } from '../gramatica/concordancia';

export interface Endereco {
  logradouro: string; // ex.: "Rua das Flores"
  numero: string; // ex.: "100" (vazio = sem número)
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string; // só dígitos ou com hífen
}

/** Preparado para o futuro: pessoa jurídica sócia, menor/incapaz, estrangeiro. */
export type TipoPessoa = 'fisica' | 'juridica';

export interface Pessoa {
  id: string;
  tipo_pessoa: TipoPessoa;
  nome: string;
  genero: Genero | '';
  nacionalidade: string; // já no gênero da pessoa ("brasileira")
  maioridade: 'maior' | 'menor';
  naturalidade_cidade: string;
  naturalidade_uf: string;
  data_nascimento: string; // AAAA-MM-DD
  estado_civil: EstadoCivil | '';
  regime_bens: RegimeBens | '';
  profissao: string; // já no gênero da pessoa ("empresária")
  registro_conselho: string; // opcional (ex.: "CRC 1SP123456/O-0")
  rg: string;
  rg_orgao: string; // ex.: "SSP"
  rg_uf: string;
  cpf: string;
  endereco: Endereco;
  // ---- Futuro (sem telas nesta fase) ----
  /** Representante ou assistente (menor/incapaz) ou representante de pessoa jurídica. */
  representante: { pessoa_id: string; tipo: 'representante' | 'assistente' } | null;
  estrangeiro?: { documento: string; rne: string } | null;
  juridica?: { razao_social: string; cnpj: string } | null;
}

// ---------------- Quotas ----------------

export type ModoQuotas = '' | 'unica' | 'classes';
export type DireitoVoto = 'pleno' | 'restrito' | 'sem_voto';
export type TipoPreferencia = 'prioritaria' | 'fixa' | 'minima';

export interface ClasseQuota {
  id: string;
  nome: string; // "Classe A", "Preferenciais"
  voto: DireitoVoto;
  voto_materias: string; // quando voto restrito
  preferencia_lucros: boolean;
  preferencia_tipo: TipoPreferencia;
  preferencia_descricao: string;
  prioridade_reembolso: boolean;
  elege_administrador: boolean;
  /** Valor unitário da quota desta classe. null = igual ao valor padrão. */
  valor_quota_centavos: number | null;
}

/** Id da classe implícita quando há classe única (quotas ordinárias). */
export const CLASSE_UNICA = 'ordinarias';

export type FormaIntegralizacao = 'a_vista' | 'a_prazo' | 'bens';

export interface Capital {
  valor_centavos: number; // capital social total
  valor_quota_centavos: number; // valor unitário padrão da quota
  integralizacao: FormaIntegralizacao;
  integralizacao_data: string; // a prazo: até quando
  bens_descricao: string; // em bens: descrição
}

export interface Participacao {
  pessoa_id: string;
  /** Número de quotas por classe (chave = id da classe; classe única = CLASSE_UNICA). */
  quotas: Record<string, number>;
}

export type FormaAdministracao = 'isolada' | 'conjunta' | 'indistinta';

export interface Administracao {
  administradores: string[]; // ids de pessoas (sócias ou não)
  forma: FormaAdministracao;
}

export interface Cnae {
  codigo: string;
  descricao: string;
  tipo: 'principal' | 'secundario';
}

export type Enquadramento = 'ME' | 'EPP' | 'nenhum';

export interface DadosEmpresa {
  razao_social: string;
  cnpj: string;
  nire: string;
  data_registro: string;
  junta_uf: string;
  numero_ultima_alteracao: number;
  sede: Endereco;
  data_inicio_atividades: string;
  prazo: { tipo: 'indeterminado' | 'determinado'; data: string };
  objeto_social: { forma: 'texto' | 'lista'; texto: string; itens: string[] };
  cnaes: Cnae[];
  enquadramento: Enquadramento | '';
  capital: Capital;
  quotas: { modo: ModoQuotas; classes: ClasseQuota[] };
  pessoas: Pessoa[];
  participacoes: Participacao[];
  administracao: Administracao;
  pro_labore: string[]; // ids de pessoas
  foro: { cidade: string; uf: string };
  exercicio: { inicio: string; fim: string }; // "MM-DD"
}

// ---------------- Atos (documentos gerados) ----------------

export type StatusAto = 'rascunho' | 'gerado' | 'registrado';

export interface ItemSelecao {
  clausula_id: string;
  versao: number;
  ativa: boolean;
}

export interface OpcoesAto {
  data_ato: string; // data do fechamento
  local_cidade: string;
  local_uf: string;
  /** Situação escolhida na Etapa 1 para carregar o conjunto padrão. */
  situacao_escolhida: 'unipessoal' | 'pluripessoal';
  usar_cabecalho: boolean;
}

export interface Ato {
  id: string;
  tipo_documento: string; // id da definição de documento ("abertura")
  status: StatusAto;
  criado_em: string;
  atualizado_em: string;
  gerado_em: string;
  dados_antes: DadosEmpresa | null;
  dados_depois: DadosEmpresa;
  /** Cláusulas escolhidas por área do documento, na ordem. */
  selecao: Record<string, ItemSelecao[]>;
  opcoes: OpcoesAto;
  registro: { data: string; numero: string } | null;
  arquivo_gerado: string;
}

export interface Empresa {
  formato: 'calango/empresa';
  versao_formato: 1;
  id: string;
  tipo_societario: string; // "ltda"
  criada_em: string;
  atualizada_em: string;
  /** Cadastro vigente. null enquanto a empresa está em abertura (nada registrado). */
  vigente: DadosEmpresa | null;
  atos: Ato[];
}
