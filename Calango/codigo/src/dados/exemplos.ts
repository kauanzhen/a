// Dados de EXEMPLO (fictícios) para a pré-visualização do editor de cláusulas
// e para os testes automáticos. Os CPFs são válidos apenas matematicamente.

import { dadosVazios, novaClasse, novaPessoa } from './fabricas';
import { CLASSE_UNICA, type DadosEmpresa, type Pessoa } from './tipos';

function joao(): Pessoa {
  return novaPessoa({
    id: 'ex-joao',
    nome: 'JOÃO DA SILVA PEREIRA',
    genero: 'M',
    nacionalidade: 'brasileiro',
    naturalidade_cidade: 'São Paulo',
    naturalidade_uf: 'SP',
    data_nascimento: '1980-02-15',
    estado_civil: 'casado',
    regime_bens: 'comunhao_parcial',
    profissao: 'empresário',
    rg: '12.345.678-9',
    rg_orgao: 'SSP',
    rg_uf: 'SP',
    cpf: '529.982.247-25',
    endereco: {
      logradouro: 'Rua das Palmeiras',
      numero: '120',
      complemento: 'apto 32',
      bairro: 'Centro',
      cidade: 'Barueri',
      uf: 'SP',
      cep: '06401-000',
    },
  });
}

function maria(): Pessoa {
  return novaPessoa({
    id: 'ex-maria',
    nome: 'MARIA APARECIDA SOUZA',
    genero: 'F',
    nacionalidade: 'brasileira',
    naturalidade_cidade: 'Osasco',
    naturalidade_uf: 'SP',
    data_nascimento: '1985-07-01',
    estado_civil: 'solteiro',
    regime_bens: '',
    profissao: 'administradora',
    registro_conselho: 'CRA-SP 123456',
    rg: '23.456.789-0',
    rg_orgao: 'SSP',
    rg_uf: 'SP',
    cpf: '111.444.777-35',
    endereco: {
      logradouro: 'Avenida Brasil',
      numero: '2000',
      complemento: '',
      bairro: 'Jardim América',
      cidade: 'Osasco',
      uf: 'SP',
      cep: '06010-000',
    },
  });
}

function ana(): Pessoa {
  return novaPessoa({
    id: 'ex-ana',
    nome: 'ANA BEATRIZ LIMA',
    genero: 'F',
    nacionalidade: 'brasileira',
    naturalidade_cidade: 'Campinas',
    naturalidade_uf: 'SP',
    data_nascimento: '1990-11-20',
    estado_civil: 'uniao_estavel',
    regime_bens: 'separacao_total',
    profissao: 'engenheira',
    rg: '34.567.890-1',
    rg_orgao: 'SSP',
    rg_uf: 'SP',
    cpf: '123.456.789-09',
    endereco: {
      logradouro: 'Largo do Rosário',
      numero: '15',
      complemento: '',
      bairro: 'Centro',
      cidade: 'Campinas',
      uf: 'SP',
      cep: '13010-000',
    },
  });
}

function carlos(): Pessoa {
  return novaPessoa({
    id: 'ex-carlos',
    nome: 'CARLOS EDUARDO MENDES',
    genero: 'M',
    nacionalidade: 'brasileiro',
    naturalidade_cidade: 'Santos',
    naturalidade_uf: 'SP',
    data_nascimento: '1975-03-10',
    estado_civil: 'divorciado',
    profissao: 'contador',
    rg: '45.678.901-2',
    rg_orgao: 'SSP',
    rg_uf: 'SP',
    cpf: '935.411.347-80',
    endereco: {
      logradouro: 'Alameda Rio Negro',
      numero: '500',
      complemento: 'sala 10',
      bairro: 'Alphaville',
      cidade: 'Barueri',
      uf: 'SP',
      cep: '06454-000',
    },
  });
}

function base(): DadosEmpresa {
  const d = dadosVazios();
  d.razao_social = 'EXEMPLO COMÉRCIO E SERVIÇOS LTDA';
  d.sede = {
    logradouro: 'Rua Campos Sales',
    numero: '300',
    complemento: 'sala 5',
    bairro: 'Centro',
    cidade: 'Barueri',
    uf: 'SP',
    cep: '06401-000',
  };
  d.junta_uf = 'SP';
  d.data_inicio_atividades = '2026-12-01';
  d.objeto_social = {
    forma: 'texto',
    texto: 'comércio varejista de artigos de papelaria e prestação de serviços de cópias e impressão',
    itens: [],
  };
  d.cnaes = [
    { codigo: '47.61-0-03', descricao: 'Comércio varejista de artigos de papelaria', tipo: 'principal' },
    { codigo: '82.19-9-01', descricao: 'Fotocópias', tipo: 'secundario' },
  ];
  d.enquadramento = 'ME';
  d.capital = {
    valor_centavos: 1050000,
    valor_quota_centavos: 100,
    integralizacao: 'a_vista',
    integralizacao_data: '',
    bens_descricao: '',
  };
  d.quotas = { modo: 'unica', classes: [] };
  d.foro = { cidade: 'Barueri', uf: 'SP' };
  return d;
}

function comSocios(pessoas: Pessoa[], quotas: number[], admins: number[], proLabore: number[]): DadosEmpresa {
  const d = base();
  d.pessoas = pessoas;
  d.participacoes = pessoas.map((p, i) => ({ pessoa_id: p.id, quotas: { [CLASSE_UNICA]: quotas[i] } }));
  d.administracao = { administradores: admins.map((i) => pessoas[i].id), forma: 'isolada' };
  d.pro_labore = proLabore.map((i) => pessoas[i].id);
  return d;
}

export interface Exemplo {
  id: string;
  nome: string;
  dados: () => DadosEmpresa;
}

export const EXEMPLOS: Exemplo[] = [
  { id: 'um-socio', nome: 'Um sócio (homem)', dados: () => comSocios([joao()], [10500], [0], [0]) },
  { id: 'uma-socia', nome: 'Uma sócia (mulher)', dados: () => comSocios([maria()], [10500], [0], [0]) },
  {
    id: 'dois-socios',
    nome: 'Dois sócios (homem e mulher)',
    dados: () => comSocios([joao(), maria()], [5250, 5250], [0, 1], [0, 1]),
  },
  { id: 'duas-socias', nome: 'Duas sócias', dados: () => comSocios([maria(), ana()], [7000, 3500], [1], [1]) },
  {
    id: 'tres-socios-adm-externo',
    nome: 'Três sócios + administrador não sócio',
    dados: () => {
      const d = comSocios([joao(), maria(), ana()], [3500, 3500, 3500], [], [0]);
      const c = carlos();
      d.pessoas.push(c);
      d.administracao = { administradores: [c.id, 'ex-joao'], forma: 'conjunta' };
      return d;
    },
  },
  {
    id: 'classes',
    nome: 'Classes distintas de quotas',
    dados: () => {
      const d = comSocios([joao(), maria()], [0, 0], [0], []);
      const a = { ...novaClasse('Classe A'), id: 'classe-a' };
      const b = {
        ...novaClasse('Classe B'),
        id: 'classe-b',
        voto: 'sem_voto' as const,
        preferencia_lucros: true,
        preferencia_tipo: 'prioritaria' as const,
        preferencia_descricao: 'prioridade no recebimento de dividendos',
        prioridade_reembolso: true,
      };
      d.quotas = { modo: 'classes', classes: [a, b] };
      d.participacoes = [
        { pessoa_id: 'ex-joao', quotas: { 'classe-a': 6000, 'classe-b': 0 } },
        { pessoa_id: 'ex-maria', quotas: { 'classe-a': 1500, 'classe-b': 3000 } },
      ];
      return d;
    },
  },
];

export function exemplo(id: string): DadosEmpresa {
  return (EXEMPLOS.find((e) => e.id === id) ?? EXEMPLOS[2]).dados();
}
