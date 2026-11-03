// Catálogo do que pode ser usado nas cláusulas: variáveis, listas (para
// repetições), condições e tipos de item. Cada item diz de quais CAMPOS do
// formulário depende — é assim que o formulário da Etapa 2 é montado.
//
// O catálogo descreve dados de sociedades em geral (pessoas, participações,
// sede, objeto...). Palavras próprias de um tipo societário (sócio, quota)
// vêm do vocabulário da definição do tipo (src/tipos/).

import { dataPorExtenso, diaMesPorExtenso, formatarData } from '../lib/datas';
import { agruparMilhares, formatarMoeda, formatarPercentualCentesimos } from '../lib/dinheiro';
import { maiusculas } from '../lib/texto';
import { moedaComExtenso, percentualComExtenso, quantidadeComExtenso } from '../gramatica/extenso';
import { ordinalNumerico } from '../gramatica/ordinais';
import { referenteDoGrupo, textoEstadoCivil, type Referente } from '../gramatica/concordancia';
import { formatarCNAE, formatarCNPJ, formatarCPF } from '../dados/documentos';
import { cidadeUF, enderecoCompleto, noEndereco } from '../dados/formatacao';
import {
  buscarPessoa,
  classesEfetivas,
  eSocio,
  percentualDoSocio,
  quotasNaClasse,
  situacao,
  socios,
  totalQuotasDaClasse,
  totalQuotasDoSocio,
  totalQuotasSubscritas,
  valorDoSocio,
  valorQuotaDaClasse,
} from '../dados/quotas';
import type { ClasseQuota, Cnae, DadosEmpresa, OpcoesAto, Participacao, Pessoa } from '../dados/tipos';
import { nomeJunta } from '../dados/ufs';
import type { DefinicaoTipoSocietario } from '../tipos/definicoes';
import type { ConteudoClausula } from './clausula';

export interface Trecho {
  texto: string;
  negrito?: boolean;
  /** Lacuna: dado que falta preencher. */
  pendente?: boolean;
}

export type Valor = string | Trecho[] | undefined | null;

export interface ContextoAvaliacao {
  dados: DadosEmpresa;
  tipo: DefinicaoTipoSocietario;
  opcoes: OpcoesAto;
  buscarClausula: (id: string) => ConteudoClausula | undefined;
  /** Preenchido pelo avaliador: monta um bloco da biblioteca como texto corrido. */
  renderizarBloco?: (id: string, escopo: Escopo) => Trecho[];
  profundidade: number;
}

export interface ItemEscopo {
  tipo: string;
  valor: unknown;
  indice: number;
  total: number;
}
export type Escopo = Record<string, ItemEscopo>;

// ---------------- Tipos de item ----------------

export interface ItemSocio {
  pessoa: Pessoa;
  participacao: Participacao;
}
export interface ItemAdministrador {
  pessoa: Pessoa;
  e_socio: boolean;
}

export interface DefTipoItem {
  nome: string;
  rotulo: string;
  /** Tipo "pai": se a variável não existir aqui, procura no pai (ex.: socio -> pessoa). */
  pai?: string;
  paraPai?: (v: unknown) => unknown;
  referente?: (v: unknown) => Referente;
}

const refPessoa = (p: Pessoa): Referente => ({ genero: p.genero === 'F' ? 'F' : 'M', plural: false });

export const TIPOS_ITEM: DefTipoItem[] = [
  { nome: 'pessoa', rotulo: 'Pessoa', referente: (v) => refPessoa(v as Pessoa) },
  {
    nome: 'socio',
    rotulo: 'Sócio',
    pai: 'pessoa',
    paraPai: (v) => (v as ItemSocio).pessoa,
    referente: (v) => refPessoa((v as ItemSocio).pessoa),
  },
  {
    nome: 'administrador',
    rotulo: 'Administrador',
    pai: 'pessoa',
    paraPai: (v) => (v as ItemAdministrador).pessoa,
    referente: (v) => refPessoa((v as ItemAdministrador).pessoa),
  },
  { nome: 'cnae', rotulo: 'CNAE' },
  { nome: 'classe', rotulo: 'Classe de quotas' },
  { nome: 'item', rotulo: 'Item do objeto social' },
];

export function tipoItem(nome: string): DefTipoItem | undefined {
  return TIPOS_ITEM.find((t) => t.nome === nome);
}

// ---------------- Listas (coleções) ----------------

export interface DefColecao {
  nome: string;
  rotulo: string;
  tipoItem: string;
  /** Nome sugerido para o item em [para cada X em lista]. */
  itemSugerido: string;
  campos: string[];
  obter: (ctx: ContextoAvaliacao) => unknown[];
}

function itensSocios(d: DadosEmpresa): ItemSocio[] {
  return socios(d).map((s) => ({ pessoa: s.pessoa, participacao: s.participacao }));
}
function itensAdministradores(d: DadosEmpresa): ItemAdministrador[] {
  return d.administracao.administradores
    .map((id) => buscarPessoa(d, id))
    .filter((p): p is Pessoa => !!p)
    .map((p) => ({ pessoa: p, e_socio: eSocio(d, p.id) }));
}
function cnaesOrdenados(d: DadosEmpresa): Cnae[] {
  return [...d.cnaes].sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'principal' ? -1 : 1));
}

export const COLECOES: DefColecao[] = [
  { nome: 'socios', rotulo: 'Sócios', tipoItem: 'socio', itemSugerido: 'socio', campos: ['socios'], obter: (c) => itensSocios(c.dados) },
  {
    nome: 'administradores',
    rotulo: 'Administradores',
    tipoItem: 'administrador',
    itemSugerido: 'administrador',
    campos: ['administracao.administradores'],
    obter: (c) => itensAdministradores(c.dados),
  },
  {
    nome: 'administradores_nao_socios',
    rotulo: 'Administradores que não são sócios',
    tipoItem: 'administrador',
    itemSugerido: 'administrador',
    campos: ['administracao.administradores', 'socios'],
    obter: (c) => itensAdministradores(c.dados).filter((a) => !a.e_socio),
  },
  {
    nome: 'pro_labore',
    rotulo: 'Sócios com pró-labore',
    tipoItem: 'socio',
    itemSugerido: 'socio',
    campos: ['administracao.pro_labore', 'socios'],
    obter: (c) => itensSocios(c.dados).filter((s) => c.dados.pro_labore.includes(s.pessoa.id)),
  },
  { nome: 'cnaes', rotulo: 'CNAEs (principal primeiro)', tipoItem: 'cnae', itemSugerido: 'cnae', campos: ['empresa.cnaes'], obter: (c) => cnaesOrdenados(c.dados) },
  {
    nome: 'cnaes_secundarios',
    rotulo: 'CNAEs secundários',
    tipoItem: 'cnae',
    itemSugerido: 'cnae',
    campos: ['empresa.cnaes'],
    obter: (c) => c.dados.cnaes.filter((x) => x.tipo === 'secundario'),
  },
  { nome: 'classes', rotulo: 'Classes de quotas', tipoItem: 'classe', itemSugerido: 'classe', campos: ['capital.quotas'], obter: (c) => classesEfetivas(c.dados) },
  {
    nome: 'objeto_itens',
    rotulo: 'Itens do objeto social (quando em lista)',
    tipoItem: 'item',
    itemSugerido: 'item',
    campos: ['empresa.objeto_social'],
    obter: (c) => c.dados.objeto_social.itens.filter((t) => t.trim()).map((texto) => ({ texto })),
  },
];

export function colecao(nome: string): DefColecao | undefined {
  return COLECOES.find((c) => c.nome === nome);
}

/** Referente (gênero/número) de uma lista de pessoas, para a concordância. */
export function referenteDaColecao(c: DefColecao, ctx: ContextoAvaliacao): Referente {
  const t = tipoItem(c.tipoItem);
  const itens = c.obter(ctx);
  const generos = itens.map((v) => (t?.referente ? t.referente(v).genero : 'M'));
  return referenteDoGrupo(generos);
}

// ---------------- Variáveis ----------------

export interface DefVariavel {
  nome: string;
  rotulo: string;
  grupo: string;
  exemplo?: string;
  /** Se definido, só vale dentro de [para cada] de um item deste tipo. */
  tipoItem?: string;
  campos: string[];
  /** Valor vazio não é lacuna (ex.: complemento). */
  opcional?: boolean;
  /** Id do bloco que esta variável monta (para derivar os campos exigidos). */
  bloco?: (tipo: DefinicaoTipoSocietario) => string;
  resolver: (ctx: ContextoAvaliacao, item: unknown, esc: Escopo) => Valor;
}

const negrito = (t: string): Trecho[] => (t ? [{ texto: t, negrito: true }] : []);

function nomesEmNegrito(nomes: string[]): Trecho[] {
  const v = nomes.filter((n) => n.trim());
  if (v.length === 0) return [];
  const r: Trecho[] = [];
  v.forEach((n, i) => {
    if (i > 0) r.push({ texto: i === v.length - 1 ? ' e ' : ', ' });
    r.push({ texto: n, negrito: true });
  });
  return r;
}

const P = (fn: (p: Pessoa, ctx: ContextoAvaliacao, esc: Escopo) => Valor) =>
  (ctx: ContextoAvaliacao, item: unknown, esc: Escopo) => fn(item as Pessoa, ctx, esc);
const S = (fn: (s: ItemSocio, ctx: ContextoAvaliacao, esc: Escopo) => Valor) =>
  (ctx: ContextoAvaliacao, item: unknown, esc: Escopo) => fn(item as ItemSocio, ctx, esc);
const K = (fn: (k: ClasseQuota, ctx: ContextoAvaliacao) => Valor) =>
  (ctx: ContextoAvaliacao, item: unknown) => fn(item as ClasseQuota, ctx);

/** Classe em uso no escopo (para "quotas do sócio na classe"). */
function classeNoEscopo(esc: Escopo): ClasseQuota | undefined {
  const it = Object.values(esc).find((e) => e.tipo === 'classe');
  return it?.valor as ClasseQuota | undefined;
}

export const VARIAVEIS: DefVariavel[] = [
  // ----- Empresa -----
  { nome: 'empresa.razao_social', rotulo: 'Razão social', grupo: 'Empresa', exemplo: 'PADARIA BOM PÃO LTDA', campos: ['empresa.razao_social'], resolver: (c) => c.dados.razao_social.trim() },
  { nome: 'empresa.cnpj', rotulo: 'CNPJ', grupo: 'Empresa', exemplo: '11.222.333/0001-81', campos: ['empresa.cnpj'], resolver: (c) => formatarCNPJ(c.dados.cnpj.trim()) },
  { nome: 'empresa.nire', rotulo: 'NIRE', grupo: 'Empresa', campos: ['empresa.nire'], resolver: (c) => c.dados.nire.trim() },
  { nome: 'empresa.data_registro', rotulo: 'Data do registro na Junta (dd/mm/aaaa)', grupo: 'Empresa', campos: ['empresa.data_registro'], resolver: (c) => formatarData(c.dados.data_registro) },
  {
    nome: 'empresa.junta_comercial',
    rotulo: 'Nome da Junta Comercial (ex.: Junta Comercial do Estado de São Paulo)',
    grupo: 'Empresa',
    exemplo: 'Junta Comercial do Estado de São Paulo',
    campos: ['empresa.junta_uf'],
    resolver: (c) => nomeJunta(c.dados.junta_uf || c.dados.sede.uf),
  },
  {
    nome: 'empresa.numero_alteracao',
    rotulo: 'Número desta alteração (ex.: 3ª)',
    grupo: 'Empresa',
    campos: ['empresa.numero_ultima_alteracao'],
    resolver: (c) => ordinalNumerico((c.dados.numero_ultima_alteracao || 0) + 1, 'f'),
  },
  { nome: 'empresa.data_inicio_atividades', rotulo: 'Data de início das atividades (dd/mm/aaaa)', grupo: 'Empresa', campos: ['empresa.data_inicio_atividades'], resolver: (c) => formatarData(c.dados.data_inicio_atividades) },
  { nome: 'empresa.prazo_data', rotulo: 'Data de término (prazo determinado)', grupo: 'Empresa', campos: ['empresa.prazo'], resolver: (c) => formatarData(c.dados.prazo.data) },
  { nome: 'empresa.objeto_social', rotulo: 'Objeto social (texto)', grupo: 'Empresa', campos: ['empresa.objeto_social'], resolver: (c) => c.dados.objeto_social.texto.trim().replace(/[.;]\s*$/, '') },
  {
    nome: 'empresa.enquadramento',
    rotulo: 'Enquadramento por extenso (Microempresa – ME / Empresa de Pequeno Porte – EPP)',
    grupo: 'Empresa',
    campos: ['empresa.enquadramento'],
    resolver: (c) =>
      c.dados.enquadramento === 'ME' ? 'Microempresa – ME' : c.dados.enquadramento === 'EPP' ? 'Empresa de Pequeno Porte – EPP' : '',
  },
  {
    nome: 'cnae_principal.codigo',
    rotulo: 'Código do CNAE principal',
    grupo: 'Empresa',
    campos: ['empresa.cnaes'],
    resolver: (c) => formatarCNAE(c.dados.cnaes.find((x) => x.tipo === 'principal')?.codigo ?? ''),
  },
  {
    nome: 'cnae_principal.descricao',
    rotulo: 'Descrição do CNAE principal',
    grupo: 'Empresa',
    campos: ['empresa.cnaes'],
    resolver: (c) => c.dados.cnaes.find((x) => x.tipo === 'principal')?.descricao.trim() ?? '',
  },
  // ----- Sede -----
  { nome: 'sede.endereco_completo', rotulo: 'Endereço completo da sede', grupo: 'Sede', exemplo: 'Rua X, nº 10, bairro Centro, Barueri/SP, CEP 06401-000', campos: ['empresa.sede'], resolver: (c) => enderecoCompleto(c.dados.sede) },
  { nome: 'sede.no_endereco', rotulo: 'Endereço da sede com "na/no" (ex.: na Rua X...)', grupo: 'Sede', campos: ['empresa.sede'], resolver: (c) => noEndereco(c.dados.sede) },
  { nome: 'sede.cidade_uf', rotulo: 'Cidade/UF da sede', grupo: 'Sede', exemplo: 'Barueri/SP', campos: ['empresa.sede'], resolver: (c) => cidadeUF(c.dados.sede.cidade, c.dados.sede.uf) },
  // ----- Capital -----
  { nome: 'capital.valor', rotulo: 'Capital social (R$ 10.000,00)', grupo: 'Capital e quotas', campos: ['capital.quotas'], resolver: (c) => (c.dados.capital.valor_centavos > 0 ? formatarMoeda(c.dados.capital.valor_centavos) : '') },
  {
    nome: 'capital.valor_por_extenso',
    rotulo: 'Capital social com extenso — R$ 10.000,00 (dez mil reais)',
    grupo: 'Capital e quotas',
    campos: ['capital.quotas'],
    resolver: (c) => (c.dados.capital.valor_centavos > 0 ? moedaComExtenso(c.dados.capital.valor_centavos) : ''),
  },
  {
    nome: 'capital.quotas',
    rotulo: 'Total de quotas (10.000)',
    grupo: 'Capital e quotas',
    campos: ['capital.quotas'],
    resolver: (c) => {
      const n = totalQuotasSubscritas(c.dados);
      return n > 0 ? agruparMilhares(n) : '';
    },
  },
  {
    nome: 'capital.quotas_por_extenso',
    rotulo: 'Total de quotas com extenso — 10.000 (dez mil) quotas',
    grupo: 'Capital e quotas',
    campos: ['capital.quotas'],
    resolver: (c) => {
      const n = totalQuotasSubscritas(c.dados);
      return n > 0 ? quantidadeComExtenso(n, c.tipo.participacao) : '';
    },
  },
  { nome: 'capital.valor_quota', rotulo: 'Valor unitário da quota (R$ 1,00)', grupo: 'Capital e quotas', campos: ['capital.quotas'], resolver: (c) => (c.dados.capital.valor_quota_centavos > 0 ? formatarMoeda(c.dados.capital.valor_quota_centavos) : '') },
  {
    nome: 'capital.valor_quota_por_extenso',
    rotulo: 'Valor unitário da quota com extenso — R$ 1,00 (um real)',
    grupo: 'Capital e quotas',
    campos: ['capital.quotas'],
    resolver: (c) => (c.dados.capital.valor_quota_centavos > 0 ? moedaComExtenso(c.dados.capital.valor_quota_centavos) : ''),
  },
  { nome: 'capital.integralizacao_data', rotulo: 'Data limite da integralização (a prazo)', grupo: 'Capital e quotas', campos: ['capital.integralizacao'], resolver: (c) => formatarData(c.dados.capital.integralizacao_data) },
  { nome: 'capital.bens_descricao', rotulo: 'Descrição dos bens (integralização em bens)', grupo: 'Capital e quotas', campos: ['capital.integralizacao'], resolver: (c) => c.dados.capital.bens_descricao.trim() },
  // ----- Listas de nomes -----
  { nome: 'socios.nomes', rotulo: 'Nomes de todos os sócios (A, B e C), em negrito', grupo: 'Sócios', campos: ['socios'], resolver: (c) => nomesEmNegrito(socios(c.dados).map((s) => s.pessoa.nome)) },
  {
    nome: 'administradores.nomes',
    rotulo: 'Nomes dos administradores (A e B), em negrito',
    grupo: 'Administração',
    campos: ['administracao.administradores'],
    resolver: (c) => nomesEmNegrito(itensAdministradores(c.dados).map((a) => a.pessoa.nome)),
  },
  {
    nome: 'administradores_nao_socios.nomes',
    rotulo: 'Nomes dos administradores não sócios, em negrito',
    grupo: 'Administração',
    campos: ['administracao.administradores'],
    resolver: (c) => nomesEmNegrito(itensAdministradores(c.dados).filter((a) => !a.e_socio).map((a) => a.pessoa.nome)),
  },
  {
    nome: 'pro_labore.nomes',
    rotulo: 'Nomes dos sócios com pró-labore, em negrito',
    grupo: 'Administração',
    campos: ['administracao.pro_labore'],
    resolver: (c) => nomesEmNegrito(itensSocios(c.dados).filter((s) => c.dados.pro_labore.includes(s.pessoa.id)).map((s) => s.pessoa.nome)),
  },
  // ----- Fechamento -----
  { nome: 'foro.cidade_uf', rotulo: 'Foro (Cidade/UF)', grupo: 'Fechamento', exemplo: 'Barueri/SP', campos: ['fechamento.foro'], resolver: (c) => cidadeUF(c.dados.foro.cidade, c.dados.foro.uf) },
  { nome: 'exercicio.inicio', rotulo: 'Início do exercício social (1º de janeiro)', grupo: 'Fechamento', campos: ['fechamento.exercicio'], resolver: (c) => diaMesPorExtenso(c.dados.exercicio.inicio) },
  { nome: 'exercicio.fim', rotulo: 'Fim do exercício social (31 de dezembro)', grupo: 'Fechamento', campos: ['fechamento.exercicio'], resolver: (c) => diaMesPorExtenso(c.dados.exercicio.fim) },
  { nome: 'ato.local', rotulo: 'Local do documento (Cidade/UF)', grupo: 'Fechamento', campos: ['fechamento.local_data'], resolver: (c) => cidadeUF(c.opcoes.local_cidade, c.opcoes.local_uf) },
  { nome: 'ato.data_por_extenso', rotulo: 'Data do documento (3 de novembro de 2026)', grupo: 'Fechamento', campos: ['fechamento.local_data'], resolver: (c) => dataPorExtenso(c.opcoes.data_ato) },
  {
    nome: 'ato.local_e_data',
    rotulo: 'Local e data (Barueri/SP, 3 de novembro de 2026)',
    grupo: 'Fechamento',
    campos: ['fechamento.local_data'],
    resolver: (c) => {
      const l = cidadeUF(c.opcoes.local_cidade, c.opcoes.local_uf);
      const d = dataPorExtenso(c.opcoes.data_ato);
      return l && d ? `${l}, ${d}` : '';
    },
  },
  // ----- Tipo societário -----
  { nome: 'tipo.nome', rotulo: 'Nome do tipo societário (sociedade limitada)', grupo: 'Tipo societário', campos: [], resolver: (c) => c.tipo.nome.toLowerCase() },
  { nome: 'tipo.nome_maiusculo', rotulo: 'Nome do tipo em maiúsculas (SOCIEDADE LIMITADA)', grupo: 'Tipo societário', campos: [], resolver: (c) => maiusculas(c.tipo.nome) },
  { nome: 'tipo.sigla', rotulo: 'Sigla do tipo (LTDA)', grupo: 'Tipo societário', campos: [], resolver: (c) => c.tipo.sigla },

  // ----- Pessoa (dentro de [para cada]) -----
  { nome: 'pessoa.nome', rotulo: 'Nome (em negrito)', grupo: 'Pessoa', tipoItem: 'pessoa', campos: ['pessoa.nome'], resolver: P((p) => negrito(p.nome.trim())) },
  { nome: 'pessoa.nome_simples', rotulo: 'Nome (sem negrito)', grupo: 'Pessoa', tipoItem: 'pessoa', campos: ['pessoa.nome'], resolver: P((p) => p.nome.trim()) },
  {
    nome: 'pessoa.qualificacao',
    rotulo: 'Qualificação completa (texto do bloco "Qualificação de pessoa física")',
    grupo: 'Pessoa',
    tipoItem: 'pessoa',
    campos: ['pessoa.nome', 'pessoa.genero'],
    bloco: (t) => t.bloco_qualificacao_pessoa_fisica,
    resolver: P((p, ctx) => ctx.renderizarBloco?.(ctx.tipo.bloco_qualificacao_pessoa_fisica, { pessoa: { tipo: 'pessoa', valor: p, indice: 0, total: 1 } }) ?? []),
  },
  { nome: 'pessoa.nacionalidade', rotulo: 'Nacionalidade', grupo: 'Pessoa', tipoItem: 'pessoa', campos: ['pessoa.nacionalidade'], resolver: P((p) => p.nacionalidade.trim().toLowerCase()) },
  { nome: 'pessoa.maioridade', rotulo: 'Maioridade (maior/menor)', grupo: 'Pessoa', tipoItem: 'pessoa', campos: ['pessoa.maioridade'], resolver: P((p) => p.maioridade) },
  { nome: 'pessoa.naturalidade', rotulo: 'Naturalidade (Cidade/UF)', grupo: 'Pessoa', tipoItem: 'pessoa', campos: ['pessoa.naturalidade'], resolver: P((p) => cidadeUF(p.naturalidade_cidade, p.naturalidade_uf)) },
  { nome: 'pessoa.data_nascimento', rotulo: 'Data de nascimento (dd/mm/aaaa)', grupo: 'Pessoa', tipoItem: 'pessoa', campos: ['pessoa.data_nascimento'], resolver: P((p) => formatarData(p.data_nascimento)) },
  {
    nome: 'pessoa.estado_civil',
    rotulo: 'Estado civil com regime de bens e concordância (casada sob o regime de...)',
    grupo: 'Pessoa',
    tipoItem: 'pessoa',
    campos: ['pessoa.estado_civil'],
    resolver: P((p) => textoEstadoCivil(p.estado_civil, p.regime_bens, p.genero)),
  },
  { nome: 'pessoa.profissao', rotulo: 'Profissão', grupo: 'Pessoa', tipoItem: 'pessoa', campos: ['pessoa.profissao'], resolver: P((p) => p.profissao.trim()) },
  { nome: 'pessoa.registro_conselho', rotulo: 'Registro em conselho de classe (opcional)', grupo: 'Pessoa', tipoItem: 'pessoa', campos: ['pessoa.registro_conselho'], opcional: true, resolver: P((p) => p.registro_conselho.trim()) },
  { nome: 'pessoa.rg', rotulo: 'Número do RG', grupo: 'Pessoa', tipoItem: 'pessoa', campos: ['pessoa.rg'], resolver: P((p) => p.rg.trim()) },
  {
    nome: 'pessoa.rg_orgao_uf',
    rotulo: 'Órgão emissor/UF do RG (SSP/SP)',
    grupo: 'Pessoa',
    tipoItem: 'pessoa',
    campos: ['pessoa.rg'],
    resolver: P((p) => (p.rg_orgao.trim() && p.rg_uf.trim() ? `${p.rg_orgao.trim().toUpperCase()}/${p.rg_uf.trim().toUpperCase()}` : '')),
  },
  { nome: 'pessoa.cpf', rotulo: 'CPF', grupo: 'Pessoa', tipoItem: 'pessoa', campos: ['pessoa.cpf'], resolver: P((p) => formatarCPF(p.cpf.trim())) },
  { nome: 'pessoa.endereco_completo', rotulo: 'Endereço residencial completo', grupo: 'Pessoa', tipoItem: 'pessoa', campos: ['pessoa.endereco'], resolver: P((p) => enderecoCompleto(p.endereco)) },
  { nome: 'pessoa.no_endereco', rotulo: 'Endereço residencial com "na/no" (na Rua X...)', grupo: 'Pessoa', tipoItem: 'pessoa', campos: ['pessoa.endereco'], resolver: P((p) => noEndereco(p.endereco)) },

  // ----- Sócio (além dos dados de pessoa) -----
  { nome: 'socio.quotas', rotulo: 'Quotas do sócio (5.000)', grupo: 'Sócio', tipoItem: 'socio', campos: ['capital.quotas'], resolver: S((s, c) => agruparMilhares(totalQuotasDoSocio(c.dados, s.participacao))) },
  {
    nome: 'socio.quotas_por_extenso',
    rotulo: 'Quotas do sócio com extenso — 5.000 (cinco mil) quotas',
    grupo: 'Sócio',
    tipoItem: 'socio',
    campos: ['capital.quotas'],
    resolver: S((s, c) => quantidadeComExtenso(totalQuotasDoSocio(c.dados, s.participacao), c.tipo.participacao)),
  },
  { nome: 'socio.valor', rotulo: 'Valor das quotas do sócio (R$ 5.000,00)', grupo: 'Sócio', tipoItem: 'socio', campos: ['capital.quotas'], resolver: S((s, c) => formatarMoeda(valorDoSocio(c.dados, s.participacao))) },
  { nome: 'socio.valor_por_extenso', rotulo: 'Valor das quotas do sócio com extenso', grupo: 'Sócio', tipoItem: 'socio', campos: ['capital.quotas'], resolver: S((s, c) => moedaComExtenso(valorDoSocio(c.dados, s.participacao))) },
  { nome: 'socio.percentual', rotulo: 'Percentual do sócio (50%)', grupo: 'Sócio', tipoItem: 'socio', campos: ['capital.quotas'], resolver: S((s, c) => `${formatarPercentualCentesimos(percentualDoSocio(c.dados, s.participacao))}%`) },
  { nome: 'socio.percentual_por_extenso', rotulo: 'Percentual do sócio com extenso', grupo: 'Sócio', tipoItem: 'socio', campos: ['capital.quotas'], resolver: S((s, c) => percentualComExtenso(percentualDoSocio(c.dados, s.participacao))) },
  {
    nome: 'socio.quotas_na_classe',
    rotulo: 'Quotas do sócio na classe (dentro de [para cada classe em classes])',
    grupo: 'Sócio',
    tipoItem: 'socio',
    campos: ['capital.quotas'],
    resolver: S((s, _c, esc) => {
      const k = classeNoEscopo(esc);
      return k ? agruparMilhares(quotasNaClasse(s.participacao, k.id)) : '';
    }),
  },

  // ----- CNAE -----
  { nome: 'cnae.codigo', rotulo: 'Código do CNAE (74.90-1-04)', grupo: 'CNAE', tipoItem: 'cnae', campos: ['empresa.cnaes'], resolver: (_c, it) => formatarCNAE((it as Cnae).codigo) },
  { nome: 'cnae.descricao', rotulo: 'Descrição do CNAE', grupo: 'CNAE', tipoItem: 'cnae', campos: ['empresa.cnaes'], resolver: (_c, it) => (it as Cnae).descricao.trim() },
  { nome: 'cnae.tipo', rotulo: 'Tipo do CNAE (Principal/Secundário)', grupo: 'CNAE', tipoItem: 'cnae', campos: ['empresa.cnaes'], resolver: (_c, it) => ((it as Cnae).tipo === 'principal' ? 'Principal' : 'Secundário') },

  // ----- Classe de quotas -----
  { nome: 'classe.nome', rotulo: 'Nome da classe', grupo: 'Classe de quotas', tipoItem: 'classe', campos: ['capital.quotas'], resolver: K((k) => k.nome.trim()) },
  { nome: 'classe.quotas', rotulo: 'Total de quotas da classe', grupo: 'Classe de quotas', tipoItem: 'classe', campos: ['capital.quotas'], resolver: K((k, c) => agruparMilhares(totalQuotasDaClasse(c.dados, k.id))) },
  {
    nome: 'classe.quotas_por_extenso',
    rotulo: 'Total de quotas da classe com extenso',
    grupo: 'Classe de quotas',
    tipoItem: 'classe',
    campos: ['capital.quotas'],
    resolver: K((k, c) => quantidadeComExtenso(totalQuotasDaClasse(c.dados, k.id), c.tipo.participacao)),
  },
  { nome: 'classe.valor_quota_por_extenso', rotulo: 'Valor unitário da quota da classe com extenso', grupo: 'Classe de quotas', tipoItem: 'classe', campos: ['capital.quotas'], resolver: K((k, c) => moedaComExtenso(valorQuotaDaClasse(c.dados, k))) },
  { nome: 'classe.voto_materias', rotulo: 'Matérias com voto (voto restrito)', grupo: 'Classe de quotas', tipoItem: 'classe', campos: ['capital.quotas'], resolver: K((k) => k.voto_materias.trim()) },
  {
    nome: 'classe.preferencia',
    rotulo: 'Tipo e descrição da preferência nos lucros',
    grupo: 'Classe de quotas',
    tipoItem: 'classe',
    campos: ['capital.quotas'],
    resolver: K((k) => {
      const tipo = { prioritaria: 'prioritária', fixa: 'fixa', minima: 'mínima' }[k.preferencia_tipo];
      return k.preferencia_descricao.trim() ? `${tipo}: ${k.preferencia_descricao.trim()}` : tipo;
    }),
  },

  // ----- Item do objeto social -----
  { nome: 'item.texto', rotulo: 'Texto do item do objeto social', grupo: 'Objeto social', tipoItem: 'item', campos: ['empresa.objeto_social'], resolver: (_c, it) => (it as { texto: string }).texto.trim().replace(/[.;]\s*$/, '') },
];

// ---------------- Condições ----------------

export interface DefCondicao {
  nome: string;
  rotulo: string;
  grupo: string;
  tipoItem?: string;
  /** Valores possíveis, para comparações (nome = valor). */
  valores?: { valor: string; rotulo: string }[];
  campos: string[];
  avaliar: (ctx: ContextoAvaliacao, item: unknown, esc: Escopo) => boolean | string;
}

function posicaoMaisInterna(esc: Escopo): ItemEscopo | undefined {
  const v = Object.values(esc);
  return v[v.length - 1];
}

export const CONDICOES: DefCondicao[] = [
  { nome: 'unipessoal', rotulo: 'Há um único sócio', grupo: 'Situação', campos: ['socios'], avaliar: (c) => situacao(c.dados) === 'unipessoal' },
  { nome: 'pluripessoal', rotulo: 'Há dois ou mais sócios', grupo: 'Situação', campos: ['socios'], avaliar: (c) => situacao(c.dados) === 'pluripessoal' },
  { nome: 'classe_unica', rotulo: 'Quotas de classe única (ordinárias)', grupo: 'Capital e quotas', campos: ['capital.quotas'], avaliar: (c) => c.dados.quotas.modo === 'unica' },
  { nome: 'classes_distintas', rotulo: 'Quotas em classes distintas', grupo: 'Capital e quotas', campos: ['capital.quotas'], avaliar: (c) => c.dados.quotas.modo === 'classes' },
  {
    nome: 'capital.integralizacao',
    rotulo: 'Forma de integralização',
    grupo: 'Capital e quotas',
    valores: [
      { valor: 'a_vista', rotulo: 'à vista' },
      { valor: 'a_prazo', rotulo: 'a prazo' },
      { valor: 'bens', rotulo: 'em bens' },
    ],
    campos: ['capital.integralizacao'],
    avaliar: (c) => c.dados.capital.integralizacao,
  },
  {
    nome: 'enquadramento',
    rotulo: 'Enquadramento',
    grupo: 'Empresa',
    valores: [
      { valor: 'ME', rotulo: 'Microempresa' },
      { valor: 'EPP', rotulo: 'Empresa de Pequeno Porte' },
      { valor: 'nenhum', rotulo: 'Nenhum' },
    ],
    campos: ['empresa.enquadramento'],
    avaliar: (c) => c.dados.enquadramento,
  },
  {
    nome: 'prazo',
    rotulo: 'Prazo de duração',
    grupo: 'Empresa',
    valores: [
      { valor: 'indeterminado', rotulo: 'indeterminado' },
      { valor: 'determinado', rotulo: 'determinado' },
    ],
    campos: ['empresa.prazo'],
    avaliar: (c) => c.dados.prazo.tipo,
  },
  {
    nome: 'objeto.forma',
    rotulo: 'Forma do objeto social',
    grupo: 'Empresa',
    valores: [
      { valor: 'texto', rotulo: 'texto corrido' },
      { valor: 'lista', rotulo: 'lista de itens' },
    ],
    campos: ['empresa.objeto_social'],
    avaliar: (c) => c.dados.objeto_social.forma,
  },
  { nome: 'tem_cnaes_secundarios', rotulo: 'Há CNAEs secundários', grupo: 'Empresa', campos: ['empresa.cnaes'], avaliar: (c) => c.dados.cnaes.some((x) => x.tipo === 'secundario') },
  {
    nome: 'administracao.forma',
    rotulo: 'Forma de administração',
    grupo: 'Administração',
    valores: [
      { valor: 'isolada', rotulo: 'isoladamente' },
      { valor: 'conjunta', rotulo: 'em conjunto' },
      { valor: 'indistinta', rotulo: 'indistintamente' },
    ],
    campos: ['administracao.administradores'],
    avaliar: (c) => c.dados.administracao.forma,
  },
  { nome: 'varios_administradores', rotulo: 'Há mais de um administrador', grupo: 'Administração', campos: ['administracao.administradores'], avaliar: (c) => itensAdministradores(c.dados).length > 1 },
  {
    nome: 'tem_administrador_nao_socio',
    rotulo: 'Há administrador que não é sócio',
    grupo: 'Administração',
    campos: ['administracao.administradores', 'socios'],
    avaliar: (c) => itensAdministradores(c.dados).some((a) => !a.e_socio),
  },
  {
    nome: 'administradores_todos_socios',
    rotulo: 'Todos os administradores são sócios',
    grupo: 'Administração',
    campos: ['administracao.administradores', 'socios'],
    avaliar: (c) => itensAdministradores(c.dados).every((a) => a.e_socio),
  },
  { nome: 'tem_pro_labore', rotulo: 'Algum sócio recebe pró-labore', grupo: 'Administração', campos: ['administracao.pro_labore'], avaliar: (c) => c.dados.pro_labore.some((id) => eSocio(c.dados, id)) },
  { nome: 'primeiro', rotulo: 'É o primeiro item da repetição', grupo: 'Repetição', campos: [], avaliar: (_c, _i, esc) => posicaoMaisInterna(esc)?.indice === 0 },
  {
    nome: 'ultimo',
    rotulo: 'É o último item da repetição',
    grupo: 'Repetição',
    campos: [],
    avaliar: (_c, _i, esc) => {
      const p = posicaoMaisInterna(esc);
      return !!p && p.indice === p.total - 1;
    },
  },
  // ----- de itens -----
  {
    nome: 'pessoa.genero',
    rotulo: 'Gênero da pessoa',
    grupo: 'Pessoa',
    tipoItem: 'pessoa',
    valores: [
      { valor: 'masculino', rotulo: 'masculino' },
      { valor: 'feminino', rotulo: 'feminino' },
    ],
    campos: ['pessoa.genero'],
    avaliar: (_c, it) => ((it as Pessoa).genero === 'F' ? 'feminino' : 'masculino'),
  },
  { nome: 'pessoa.e_socio', rotulo: 'A pessoa é sócia', grupo: 'Pessoa', tipoItem: 'pessoa', campos: ['socios'], avaliar: (c, it) => eSocio(c.dados, (it as Pessoa).id) },
  {
    nome: 'pessoa.e_administrador',
    rotulo: 'A pessoa é administradora',
    grupo: 'Pessoa',
    tipoItem: 'pessoa',
    campos: ['administracao.administradores'],
    avaliar: (c, it) => c.dados.administracao.administradores.includes((it as Pessoa).id),
  },
  {
    nome: 'pessoa.recebe_pro_labore',
    rotulo: 'A pessoa recebe pró-labore',
    grupo: 'Pessoa',
    tipoItem: 'pessoa',
    campos: ['administracao.pro_labore'],
    avaliar: (c, it) => c.dados.pro_labore.includes((it as Pessoa).id),
  },
  {
    nome: 'classe.voto',
    rotulo: 'Direito a voto da classe',
    grupo: 'Classe de quotas',
    tipoItem: 'classe',
    valores: [
      { valor: 'pleno', rotulo: 'pleno' },
      { valor: 'restrito', rotulo: 'restrito' },
      { valor: 'sem_voto', rotulo: 'sem voto' },
    ],
    campos: ['capital.quotas'],
    avaliar: (_c, it) => (it as ClasseQuota).voto,
  },
  { nome: 'classe.preferencia_lucros', rotulo: 'A classe tem preferência nos lucros', grupo: 'Classe de quotas', tipoItem: 'classe', campos: ['capital.quotas'], avaliar: (_c, it) => (it as ClasseQuota).preferencia_lucros },
  { nome: 'classe.prioridade_reembolso', rotulo: 'A classe tem prioridade no reembolso', grupo: 'Classe de quotas', tipoItem: 'classe', campos: ['capital.quotas'], avaliar: (_c, it) => (it as ClasseQuota).prioridade_reembolso },
  { nome: 'classe.elege_administrador', rotulo: 'A classe elege administrador em separado', grupo: 'Classe de quotas', tipoItem: 'classe', campos: ['capital.quotas'], avaliar: (_c, it) => (it as ClasseQuota).elege_administrador },
];

// ---------------- Busca por nome, considerando o escopo ----------------

/** Procura a definição de "alias.campo" subindo pelos tipos-pai (socio -> pessoa). */
export function buscarDefItem<T extends { nome: string; tipoItem?: string }>(
  lista: T[],
  tipoInicial: string,
  campo: string,
): { def: T; cadeia: string[] } | undefined {
  let t: string | undefined = tipoInicial;
  const cadeia: string[] = [];
  while (t) {
    cadeia.push(t);
    const nome = `${t}.${campo}`;
    const def = lista.find((v) => v.nome === nome && v.tipoItem === t);
    if (def) return { def, cadeia };
    t = tipoItem(t)?.pai;
  }
  return undefined;
}

/** Converte o valor do item ao longo da cadeia de tipos (socio -> pessoa). */
export function converterItem(valor: unknown, cadeia: string[]): unknown {
  let v = valor;
  for (let i = 0; i < cadeia.length - 1; i++) {
    const t = tipoItem(cadeia[i]);
    v = t?.paraPai ? t.paraPai(v) : v;
  }
  return v;
}

/** Referentes "fixos" que não são listas nem itens. */
export function referenteNomeado(nome: string, ctx: ContextoAvaliacao): Referente | undefined {
  const c = colecao(nome);
  if (c) return referenteDaColecao(c, ctx);
  return undefined;
}
