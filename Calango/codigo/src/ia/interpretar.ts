// Conferência da resposta da IA: arruma formatos, valida CPF, CEP, UF e data,
// e aponta problemas (comprovante em nome de outra pessoa, documento ilegível).
// Nada aqui grava dados: o resultado vai para a tela de revisão.

import type { Pessoa } from '../dados/tipos';
import { cepValido, cpfValido, formatarCEP, formatarCPF } from '../dados/documentos';
import { buscarUF } from '../dados/ufs';
import { ESTADOS_CIVIS, type EstadoCivil } from '../gramatica/concordancia';
import { apenasDigitos, normalizar } from '../lib/texto';
import { NOMES_TIPO_DOCUMENTO, type RespostaIA, type TipoDocumentoLido } from './tipos';

export type ChaveCampo =
  | 'nome'
  | 'genero'
  | 'nacionalidade'
  | 'naturalidade_cidade'
  | 'naturalidade_uf'
  | 'data_nascimento'
  | 'estado_civil'
  | 'rg'
  | 'rg_orgao'
  | 'rg_uf'
  | 'cpf'
  | 'endereco.logradouro'
  | 'endereco.numero'
  | 'endereco.complemento'
  | 'endereco.bairro'
  | 'endereco.cidade'
  | 'endereco.uf'
  | 'endereco.cep';

export type TipoCampo = 'texto' | 'uf' | 'data' | 'genero' | 'estado_civil';

/** Campos que a IA pode preencher. `grupo` = campo do formulário que os mostra. */
export const CAMPOS_IA: { chave: ChaveCampo; rotulo: string; grupo: string; tipo: TipoCampo }[] = [
  { chave: 'nome', rotulo: 'Nome completo', grupo: 'pessoa.nome', tipo: 'texto' },
  { chave: 'genero', rotulo: 'Gênero', grupo: 'pessoa.genero', tipo: 'genero' },
  { chave: 'nacionalidade', rotulo: 'Nacionalidade', grupo: 'pessoa.nacionalidade', tipo: 'texto' },
  { chave: 'naturalidade_cidade', rotulo: 'Naturalidade — cidade', grupo: 'pessoa.naturalidade', tipo: 'texto' },
  { chave: 'naturalidade_uf', rotulo: 'Naturalidade — UF', grupo: 'pessoa.naturalidade', tipo: 'uf' },
  { chave: 'data_nascimento', rotulo: 'Data de nascimento', grupo: 'pessoa.data_nascimento', tipo: 'data' },
  { chave: 'estado_civil', rotulo: 'Estado civil', grupo: 'pessoa.estado_civil', tipo: 'estado_civil' },
  { chave: 'rg', rotulo: 'RG — número', grupo: 'pessoa.rg', tipo: 'texto' },
  { chave: 'rg_orgao', rotulo: 'RG — órgão emissor', grupo: 'pessoa.rg', tipo: 'texto' },
  { chave: 'rg_uf', rotulo: 'RG — UF', grupo: 'pessoa.rg', tipo: 'uf' },
  { chave: 'cpf', rotulo: 'CPF', grupo: 'pessoa.cpf', tipo: 'texto' },
  { chave: 'endereco.logradouro', rotulo: 'Endereço — logradouro', grupo: 'pessoa.endereco', tipo: 'texto' },
  { chave: 'endereco.numero', rotulo: 'Endereço — número', grupo: 'pessoa.endereco', tipo: 'texto' },
  { chave: 'endereco.complemento', rotulo: 'Endereço — complemento', grupo: 'pessoa.endereco', tipo: 'texto' },
  { chave: 'endereco.bairro', rotulo: 'Endereço — bairro', grupo: 'pessoa.endereco', tipo: 'texto' },
  { chave: 'endereco.cidade', rotulo: 'Endereço — cidade', grupo: 'pessoa.endereco', tipo: 'texto' },
  { chave: 'endereco.uf', rotulo: 'Endereço — UF', grupo: 'pessoa.endereco', tipo: 'uf' },
  { chave: 'endereco.cep', rotulo: 'Endereço — CEP', grupo: 'pessoa.endereco', tipo: 'texto' },
];

export interface CampoLido {
  chave: ChaveCampo;
  valor: string;
  /** Problema encontrado na conferência (ex.: CPF com dígito errado). */
  problema?: string;
}

export interface DocumentoConferido {
  arquivo: string;
  tipo: TipoDocumentoLido;
  nome_titular: string;
  legivel: boolean;
  observacao: string;
}

export interface LeituraConferida {
  documentos: DocumentoConferido[];
  /** Só os campos que vieram preenchidos. */
  campos: CampoLido[];
  avisos: string[];
  /** Nada de útil foi lido. */
  ilegivel: boolean;
}

// ---------------- Formatação ----------------

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'a', 'o']);

function espacos(s: unknown): string {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
}

/** "SÃO JOSÉ DOS CAMPOS" → "São José dos Campos" (só mexe em texto todo em maiúsculas). */
export function ajustarMaiusculas(s: string): string {
  if (!s || s !== s.toLocaleUpperCase('pt-BR') || !/\p{L}/u.test(s)) return s;
  return s
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((p, i) => {
      if (i > 0 && PARTICULAS.has(p)) return p;
      if (/^[ivx]+$/.test(p) && p.length <= 4 && i > 0) return p.toUpperCase(); // números romanos
      return p.replace(/(^|[-'’])(\p{L})/gu, (_m, sep: string, l: string) => sep + l.toLocaleUpperCase('pt-BR'));
    })
    .join(' ');
}

function uf(s: unknown): string {
  const v = espacos(s).toUpperCase();
  return buscarUF(v) ? v : '';
}

/** Aceita AAAA-MM-DD, DD/MM/AAAA ou DD.MM.AAAA; devolve AAAA-MM-DD ou "". */
export function dataISO(s: unknown): string {
  const v = espacos(s);
  let a: number, m: number, d: number;
  let r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (r) [a, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v))) [d, m, a] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else return '';
  const data = new Date(Date.UTC(a, m - 1, d));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) return '';
  if (a < 1900 || data.getTime() > Date.now()) return '';
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function estadoCivil(s: unknown): EstadoCivil | '' {
  const v = normalizar(espacos(s)).replace(/[()]/g, '');
  if (!v) return '';
  if (ESTADOS_CIVIS.some((e) => e.valor === v)) return v as EstadoCivil;
  if (/^solteir/.test(v)) return 'solteiro';
  if (/^casad/.test(v)) return 'casado';
  if (/uniao estavel|convivente/.test(v)) return 'uniao_estavel';
  if (/^divorciad/.test(v)) return 'divorciado';
  if (/^separad/.test(v)) return 'separado_judicialmente';
  if (/^viuv/.test(v)) return 'viuvo';
  return '';
}

function nacionalidade(s: unknown, genero: string): string {
  const v = normalizar(espacos(s)).replace(/[()]/g, '');
  if (!v) return '';
  if (/^(bra|brasil|brasileir[oa]?|brasileiroa)$/.test(v)) return genero === 'F' ? 'brasileira' : 'brasileiro';
  return espacos(s).toLocaleLowerCase('pt-BR');
}

// ---------------- Comparação de nomes ----------------

function palavrasDoNome(s: string): string[] {
  return normalizar(s)
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p && !PARTICULAS.has(p));
}

/** Mesmo nome, ignorando acentos, maiúsculas e "de/da/dos". */
export function mesmoNome(a: string, b: string): boolean {
  const x = palavrasDoNome(a);
  const y = palavrasDoNome(b);
  return x.length > 0 && x.join(' ') === y.join(' ');
}

// ---------------- Conferência ----------------

const TIPOS_DOC = new Set<TipoDocumentoLido>(['rg', 'cnh', 'cin', 'comprovante_residencia', 'outro']);
const IDENTIDADE = new Set<TipoDocumentoLido>(['rg', 'cnh', 'cin']);

/**
 * Confere a resposta da IA. `nomeAtual` é o nome já digitado no formulário
 * (para avisar quando os documentos são de outra pessoa).
 */
export function conferirLeitura(bruto: unknown, nomeAtual = ''): LeituraConferida {
  const r = (bruto && typeof bruto === 'object' ? bruto : {}) as Partial<RespostaIA>;
  const p = (r.pessoa && typeof r.pessoa === 'object' ? r.pessoa : {}) as Partial<RespostaIA['pessoa']>;
  const e = (p.endereco && typeof p.endereco === 'object' ? p.endereco : {}) as Partial<RespostaIA['pessoa']['endereco']>;
  const avisos: string[] = Array.isArray(r.avisos) ? r.avisos.map(espacos).filter(Boolean) : [];

  const documentos: DocumentoConferido[] = (Array.isArray(r.documentos) ? r.documentos : []).map((d) => ({
    arquivo: espacos(d?.arquivo),
    tipo: TIPOS_DOC.has(d?.tipo as TipoDocumentoLido) ? (d!.tipo as TipoDocumentoLido) : 'outro',
    nome_titular: espacos(d?.nome_titular).toLocaleUpperCase('pt-BR'),
    legivel: d?.legivel !== false,
    observacao: espacos(d?.observacao),
  }));

  const genero = p.genero === 'M' || p.genero === 'F' ? p.genero : '';
  let rgOrgao = espacos(p.rg_orgao).toUpperCase();
  let rgUf = uf(p.rg_uf);
  // "SSP/SP" ou "SSP-SP" no órgão: separa a UF.
  const comUf = /^([A-Z]+)\s*[/-]\s*([A-Z]{2})$/.exec(rgOrgao);
  if (comUf && buscarUF(comUf[2])) {
    rgOrgao = comUf[1];
    if (!rgUf) rgUf = comUf[2];
  }

  const valores: Record<ChaveCampo, string> = {
    nome: espacos(p.nome).toLocaleUpperCase('pt-BR'),
    genero,
    nacionalidade: nacionalidade(p.nacionalidade, genero),
    naturalidade_cidade: ajustarMaiusculas(espacos(p.naturalidade_cidade)),
    naturalidade_uf: uf(p.naturalidade_uf),
    data_nascimento: dataISO(p.data_nascimento),
    estado_civil: estadoCivil(p.estado_civil),
    rg: espacos(p.rg),
    rg_orgao: rgOrgao,
    rg_uf: rgUf,
    cpf: formatarCPF(espacos(p.cpf)),
    'endereco.logradouro': ajustarMaiusculas(espacos(e.logradouro)),
    'endereco.numero': espacos(e.numero),
    'endereco.complemento': ajustarMaiusculas(espacos(e.complemento)),
    'endereco.bairro': ajustarMaiusculas(espacos(e.bairro)),
    'endereco.cidade': ajustarMaiusculas(espacos(e.cidade)),
    'endereco.uf': uf(e.uf),
    'endereco.cep': formatarCEP(espacos(e.cep)),
  };
  if (espacos(p.data_nascimento) && !valores.data_nascimento) {
    avisos.push(`A data de nascimento lida (“${espacos(p.data_nascimento)}”) não é uma data válida; ela ficou de fora.`);
  }

  const campos: CampoLido[] = [];
  for (const c of CAMPOS_IA) {
    const valor = valores[c.chave];
    if (!valor) continue;
    const campo: CampoLido = { chave: c.chave, valor };
    if (c.chave === 'cpf' && !cpfValido(valor)) {
      campo.problema = apenasDigitos(valor).length !== 11 ? 'O CPF lido não tem 11 dígitos. Confira no documento.' : 'O CPF lido não confere (dígito verificador errado). Confira no documento.';
    }
    if (c.chave === 'endereco.cep' && !cepValido(valor)) campo.problema = 'O CEP lido não tem 8 dígitos. Confira no comprovante.';
    campos.push(campo);
  }

  // Documentos ilegíveis
  for (const d of documentos) {
    if (!d.legivel) avisos.push(`Não foi possível ler “${d.arquivo || 'um dos arquivos'}”${d.observacao ? ` (${d.observacao})` : ''}. Se precisar desses dados, envie uma foto mais nítida, sem reflexo e com o documento inteiro.`);
  }

  // Documentos de identidade de pessoas diferentes
  const ids = documentos.filter((d) => IDENTIDADE.has(d.tipo) && d.nome_titular);
  for (let i = 1; i < ids.length; i++) {
    if (!mesmoNome(ids[0].nome_titular, ids[i].nome_titular)) {
      avisos.push(`Os documentos de identidade parecem ser de pessoas diferentes: “${ids[0].nome_titular}” e “${ids[i].nome_titular}”. Envie os documentos de uma pessoa por vez.`);
      break;
    }
  }

  // Comprovante de residência em nome de outra pessoa
  const referencia = valores.nome || ids[0]?.nome_titular || nomeAtual.trim();
  for (const d of documentos.filter((x) => x.tipo === 'comprovante_residencia')) {
    if (!d.nome_titular) {
      avisos.push(`Não foi possível ler em nome de quem está o comprovante de residência “${d.arquivo}”. Confira.`);
    } else if (referencia && !mesmoNome(d.nome_titular, referencia)) {
      avisos.push(
        `O comprovante de residência está em nome de “${d.nome_titular}”, e não de “${referencia.toLocaleUpperCase('pt-BR')}”. Confirme se a pessoa mora mesmo nesse endereço; nesse caso, confira se o registro vai pedir uma declaração de residência.`,
      );
    }
  }

  // Nome lido diferente do nome já digitado
  if (valores.nome && nomeAtual.trim() && !mesmoNome(valores.nome, nomeAtual)) {
    avisos.push(`O nome lido (“${valores.nome}”) é diferente do nome que já estava no cadastro (“${nomeAtual.trim().toLocaleUpperCase('pt-BR')}”). Confira se são os documentos da pessoa certa.`);
  }

  if (!documentos.some((d) => d.tipo === 'comprovante_residencia') && documentos.length && !valores['endereco.logradouro']) {
    avisos.push('Nenhum comprovante de residência foi reconhecido: o endereço não foi preenchido.');
  }

  const ilegivel = campos.length === 0 || (documentos.length > 0 && documentos.every((d) => !d.legivel) && campos.length < 2);
  return { documentos, campos, avisos: [...new Set(avisos)], ilegivel };
}

/** Nome legível do tipo de documento. */
export function nomeTipoDocumento(t: TipoDocumentoLido): string {
  return NOMES_TIPO_DOCUMENTO[t];
}

/** Valor atual do campo na pessoa (para mostrar "antes" na revisão). */
export function valorNaPessoa(p: Pessoa, chave: ChaveCampo): string {
  if (chave.startsWith('endereco.')) return (p.endereco as unknown as Record<string, string>)[chave.slice(9)] ?? '';
  return String((p as unknown as Record<string, unknown>)[chave] ?? '');
}

/**
 * Aplica os valores revisados à pessoa. Ajusta a nacionalidade ao gênero e
 * apaga o regime de bens quando o estado civil não o usa.
 */
export function aplicarNaPessoa(p: Pessoa, valores: Partial<Record<ChaveCampo, string>>): Pessoa {
  const nova: Pessoa = { ...p, endereco: { ...p.endereco } };
  const alvo = nova as unknown as Record<string, unknown>;
  const end = nova.endereco as unknown as Record<string, string>;
  for (const [chave, valor] of Object.entries(valores) as [ChaveCampo, string][]) {
    if (valor === undefined) continue;
    if (chave.startsWith('endereco.')) end[chave.slice(9)] = valor;
    else alvo[chave] = valor;
  }
  nova.nome = nova.nome.toLocaleUpperCase('pt-BR');
  const nac = normalizar(nova.nacionalidade);
  if ((nac === 'brasileiro' || nac === 'brasileira') && nova.genero) nova.nacionalidade = nova.genero === 'F' ? 'brasileira' : 'brasileiro';
  if (valores.estado_civil !== undefined && nova.estado_civil !== 'casado' && nova.estado_civil !== 'uniao_estavel') nova.regime_bens = '';
  return nova;
}
