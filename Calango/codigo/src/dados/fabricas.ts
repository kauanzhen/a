// Criação de registros vazios com valores padrão.

import { novoId } from '../lib/texto';
import { hojeISO } from '../lib/datas';
import type { Ato, ClasseQuota, DadosEmpresa, Empresa, Endereco, OpcoesAto, Pessoa } from './tipos';

export function enderecoVazio(): Endereco {
  return { logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '' };
}

export function novaPessoa(parcial: Partial<Pessoa> = {}): Pessoa {
  return {
    id: novoId(),
    tipo_pessoa: 'fisica',
    nome: '',
    genero: '',
    nacionalidade: '',
    maioridade: 'maior',
    naturalidade_cidade: '',
    naturalidade_uf: '',
    data_nascimento: '',
    estado_civil: '',
    regime_bens: '',
    profissao: '',
    registro_conselho: '',
    rg: '',
    rg_orgao: 'SSP',
    rg_uf: '',
    cpf: '',
    endereco: enderecoVazio(),
    representante: null,
    estrangeiro: null,
    juridica: null,
    ...parcial,
  };
}

export function novaClasse(nome: string): ClasseQuota {
  return {
    id: novoId(),
    nome,
    voto: 'pleno',
    voto_materias: '',
    preferencia_lucros: false,
    preferencia_tipo: 'prioritaria',
    preferencia_descricao: '',
    prioridade_reembolso: false,
    elege_administrador: false,
    valor_quota_centavos: null,
  };
}

export function dadosVazios(): DadosEmpresa {
  return {
    razao_social: '',
    cnpj: '',
    nire: '',
    data_registro: '',
    junta_uf: '',
    numero_ultima_alteracao: 0,
    sede: enderecoVazio(),
    data_inicio_atividades: '',
    prazo: { tipo: 'indeterminado', data: '' },
    objeto_social: { forma: 'texto', texto: '', itens: [] },
    cnaes: [],
    enquadramento: '',
    capital: {
      valor_centavos: 0,
      valor_quota_centavos: 100,
      integralizacao: 'a_vista',
      integralizacao_data: '',
      bens_descricao: '',
    },
    quotas: { modo: '', classes: [] },
    pessoas: [],
    participacoes: [],
    administracao: { administradores: [], forma: 'isolada' },
    pro_labore: [],
    foro: { cidade: '', uf: '' },
    exercicio: { inicio: '01-01', fim: '12-31' },
  };
}

export function opcoesAtoPadrao(cidade = '', uf = ''): OpcoesAto {
  return {
    data_ato: hojeISO(),
    local_cidade: cidade,
    local_uf: uf,
    situacao_escolhida: 'pluripessoal',
    usar_cabecalho: true,
  };
}

export function novoAto(tipoDocumento: string, dadosAntes: DadosEmpresa | null, opcoes: OpcoesAto): Ato {
  const agora = new Date().toISOString();
  return {
    id: novoId(),
    tipo_documento: tipoDocumento,
    status: 'rascunho',
    criado_em: agora,
    atualizado_em: agora,
    gerado_em: '',
    dados_antes: dadosAntes ? structuredClone(dadosAntes) : null,
    dados_depois: dadosAntes ? structuredClone(dadosAntes) : dadosVazios(),
    selecao: {},
    opcoes,
    registro: null,
    arquivo_gerado: '',
  };
}

export function novaEmpresa(tipoSocietario: string): Empresa {
  const agora = new Date().toISOString();
  return {
    formato: 'calango/empresa',
    versao_formato: 1,
    id: novoId(),
    tipo_societario: tipoSocietario,
    criada_em: agora,
    atualizada_em: agora,
    vigente: null,
    atos: [],
  };
}

/** Completa campos ausentes (arquivos antigos ou importados) com os padrões. */
export function normalizarDados(d: Partial<DadosEmpresa>): DadosEmpresa {
  const base = dadosVazios();
  const r: DadosEmpresa = { ...base, ...d } as DadosEmpresa;
  r.sede = { ...base.sede, ...(d.sede ?? {}) };
  r.prazo = { ...base.prazo, ...(d.prazo ?? {}) };
  r.objeto_social = { ...base.objeto_social, ...(d.objeto_social ?? {}) };
  r.capital = { ...base.capital, ...(d.capital ?? {}) };
  r.quotas = { ...base.quotas, ...(d.quotas ?? {}) };
  r.administracao = { ...base.administracao, ...(d.administracao ?? {}) };
  r.foro = { ...base.foro, ...(d.foro ?? {}) };
  r.exercicio = { ...base.exercicio, ...(d.exercicio ?? {}) };
  r.pessoas = (d.pessoas ?? []).map((p) => novaPessoa({ ...p, endereco: { ...enderecoVazio(), ...(p.endereco ?? {}) } }));
  r.participacoes = d.participacoes ?? [];
  r.cnaes = d.cnaes ?? [];
  r.pro_labore = d.pro_labore ?? [];
  return r;
}
