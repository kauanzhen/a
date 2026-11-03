// Exportar e importar dados em um arquivo .json (para levar entre computadores
// fora da rede). A importação mostra o que será feito e grava com backup.

import type { Clausula } from '../motor/clausula';
import type { Empresa } from '../dados/tipos';
import type { Configuracoes } from './configuracoes';
import { normalizarConfiguracoes } from './configuracoes';
import { normalizarEmpresa, type Repositorio } from './repositorio';

export type ConteudoExportacao = 'tudo' | 'empresa' | 'clausulas';

export interface PacoteExportacao {
  formato: 'calango/exportacao';
  versao_formato: 1;
  exportado_em: string;
  conteudo: ConteudoExportacao;
  configuracoes?: Configuracoes;
  clausulas?: Clausula[];
  empresas?: Empresa[];
  imagens?: { nome: string; base64: string }[];
}

function paraBase64(dados: Uint8Array): string {
  let s = '';
  for (let i = 0; i < dados.length; i += 0x8000) s += String.fromCharCode(...dados.subarray(i, i + 0x8000));
  return btoa(s);
}

function deBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const r = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) r[i] = s.charCodeAt(i);
  return r;
}

export async function exportar(
  repo: Repositorio,
  conteudo: ConteudoExportacao,
  empresaId?: string,
  agora = new Date(),
): Promise<PacoteExportacao> {
  const p: PacoteExportacao = {
    formato: 'calango/exportacao',
    versao_formato: 1,
    exportado_em: agora.toISOString(),
    conteudo,
  };
  if (conteudo === 'tudo' || conteudo === 'clausulas') {
    p.clausulas = (await repo.listarClausulas()).lidas.map((l) => l.dados);
  }
  if (conteudo === 'tudo' || conteudo === 'empresa') {
    const todas = (await repo.listarEmpresas()).lidas.map((l) => l.dados);
    p.empresas = conteudo === 'empresa' ? todas.filter((e) => e.id === empresaId) : todas;
    if (conteudo === 'empresa' && p.empresas.length === 0) throw new Error('Empresa não encontrada para exportar.');
  }
  if (conteudo === 'tudo') {
    p.configuracoes = (await repo.carregarConfiguracoes()).dados;
    p.imagens = [];
    for (const nome of await repo.listarImagens()) {
      const dados = await repo.lerImagem(nome);
      if (dados) p.imagens.push({ nome, base64: paraBase64(dados) });
    }
  }
  return p;
}

export function nomeArquivoExportacao(p: PacoteExportacao, rotulo = ''): string {
  const data = p.exportado_em.slice(0, 10);
  const tipo = { tudo: 'tudo', empresa: 'empresa', clausulas: 'clausulas' }[p.conteudo];
  return `calango-${tipo}${rotulo ? `-${rotulo}` : ''}-${data}.json`;
}

/** Lê e confere um arquivo de exportação. Lança erro com mensagem clara. */
export function lerPacote(texto: string): PacoteExportacao {
  let p: PacoteExportacao;
  try {
    p = JSON.parse(texto);
  } catch {
    throw new Error('O arquivo escolhido não é um JSON válido. Escolha um arquivo exportado pelo Calango.');
  }
  if (p?.formato !== 'calango/exportacao') {
    throw new Error('Este arquivo não é uma exportação do Calango (formato desconhecido).');
  }
  if (p.versao_formato !== 1) {
    throw new Error(`Versão de arquivo não suportada (${p.versao_formato}). Atualize o Calango.`);
  }
  return p;
}

export interface ItemImportacao {
  chave: string;
  tipo: 'configuracoes' | 'clausula' | 'empresa' | 'imagem';
  nome: string;
  /** Já existe na pasta de dados (será substituído, com backup). */
  existe: boolean;
}

export async function analisarImportacao(repo: Repositorio, p: PacoteExportacao): Promise<ItemImportacao[]> {
  const r: ItemImportacao[] = [];
  if (p.configuracoes) r.push({ chave: 'configuracoes', tipo: 'configuracoes', nome: 'Configurações do escritório', existe: true });
  for (const c of p.clausulas ?? []) {
    r.push({ chave: `clausula:${c.id}`, tipo: 'clausula', nome: c.titulo_interno || c.id, existe: await repo.clausulaExiste(c.id) });
  }
  const empresas = (await repo.listarEmpresas()).lidas;
  for (const e of p.empresas ?? []) {
    const nome = e.vigente?.razao_social || e.atos[e.atos.length - 1]?.dados_depois.razao_social || '(sem razão social)';
    r.push({ chave: `empresa:${e.id}`, tipo: 'empresa', nome, existe: empresas.some((l) => l.dados.id === e.id) });
  }
  const imagens = await repo.listarImagens();
  for (const i of p.imagens ?? []) r.push({ chave: `imagem:${i.nome}`, tipo: 'imagem', nome: i.nome, existe: imagens.includes(i.nome) });
  return r;
}

/** Grava os itens escolhidos (substituindo existentes, sempre com backup). */
export async function importar(
  repo: Repositorio,
  p: PacoteExportacao,
  escolhidos: Set<string>,
): Promise<{ importados: number; erros: string[] }> {
  let importados = 0;
  const erros: string[] = [];
  const tentar = async (nome: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      importados++;
    } catch (e) {
      erros.push(`${nome}: ${(e as Error).message}`);
    }
  };
  if (p.configuracoes && escolhidos.has('configuracoes')) {
    await tentar('Configurações', () => repo.gravarJson('configuracoes.json', normalizarConfiguracoes(p.configuracoes)));
  }
  for (const c of p.clausulas ?? []) {
    if (!escolhidos.has(`clausula:${c.id}`)) continue;
    if (!/^[a-zA-Z0-9_-]+$/.test(c.id)) {
      erros.push(`Cláusula "${c.titulo_interno}": identificador inválido.`);
      continue;
    }
    await tentar(c.titulo_interno || c.id, () => repo.gravarJson(repo.caminhoClausula(c.id), c));
  }
  if (p.empresas?.length) {
    const existentes = (await repo.listarEmpresas()).lidas;
    for (const e of p.empresas) {
      if (!escolhidos.has(`empresa:${e.id}`)) continue;
      const atual = existentes.find((l) => l.dados.id === e.id);
      const razao = e.vigente?.razao_social || e.atos[e.atos.length - 1]?.dados_depois.razao_social || '';
      const caminho = atual?.caminho ?? repo.novoCaminhoEmpresa(e, razao);
      await tentar(razao || 'Empresa', () => repo.gravarJson(caminho, normalizarEmpresa(e)));
    }
  }
  for (const i of p.imagens ?? []) {
    if (!escolhidos.has(`imagem:${i.nome}`)) continue;
    if (!/^[\w.\- ]+$/.test(i.nome)) {
      erros.push(`Imagem "${i.nome}": nome inválido.`);
      continue;
    }
    await tentar(i.nome, () => repo.gravarImagem(i.nome, deBase64(i.base64)));
  }
  return { importados, erros };
}
