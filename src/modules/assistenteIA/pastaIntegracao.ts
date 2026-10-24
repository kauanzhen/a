/**
 * Integração com o Claude Cowork (ou qualquer agente que trabalhe com arquivos) por meio de
 * uma PASTA COMPARTILHADA no computador do usuário. Usa a File System Access API
 * (Chrome, Edge e derivados). Em outros navegadores, use baixar/enviar arquivo.
 *
 * Estrutura da pasta:
 *   LEIA-ME.txt                         explica a pasta (gravado pelo sistema)
 *   contexto/contexto-contabil.json     plano de contas, períodos... (gravado pelo sistema)
 *   fontes/                             PDFs, extratos e conversas exportadas para o Claude ler (do usuário)
 *   entrada/*.json                      lotes de lançamentos sugeridos (gravados pelo Claude)
 *   processados/                        lotes já importados (movidos pelo sistema)
 *   descartados/                        lotes recusados pelo usuário (movidos pelo sistema)
 */
import { db } from '../../db/db';
import type { ContextoContabil } from './contextoIA';

export const PASTAS = { contexto: 'contexto', fontes: 'fontes', entrada: 'entrada', processados: 'processados', descartados: 'descartados' } as const;
export const ARQUIVO_CONTEXTO = 'contexto-contabil.json';
const CHAVE_CONFIG = 'pastaIntegracao';

export function navegadorSuportaPastas(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

export async function obterPastaSalva(): Promise<FileSystemDirectoryHandle | undefined> {
  const item = await db.config.get(CHAVE_CONFIG);
  return item?.valor as FileSystemDirectoryHandle | undefined;
}

export async function esquecerPasta(): Promise<void> {
  await db.config.delete(CHAVE_CONFIG);
}

export async function escolherPasta(): Promise<FileSystemDirectoryHandle> {
  if (!navegadorSuportaPastas()) throw new Error('Este navegador não permite acessar pastas. Use Chrome ou Edge, ou o modo "baixar/enviar arquivo".');
  const pasta = await window.showDirectoryPicker!({ id: 'contabil-escola-integracao', mode: 'readwrite' });
  await prepararEstrutura(pasta);
  await db.config.put({ chave: CHAVE_CONFIG, valor: pasta });
  return pasta;
}

/** Verifica (e, se "pedir", solicita) permissão de leitura e escrita na pasta. */
export async function garantirPermissao(pasta: FileSystemDirectoryHandle, pedir: boolean): Promise<boolean> {
  const desc = { mode: 'readwrite' as const };
  if (!pasta.queryPermission) return true;
  if ((await pasta.queryPermission(desc)) === 'granted') return true;
  if (!pedir || !pasta.requestPermission) return false;
  return (await pasta.requestPermission(desc)) === 'granted';
}

async function gravarTexto(pasta: FileSystemDirectoryHandle, nome: string, conteudo: string) {
  const arquivo = await pasta.getFileHandle(nome, { create: true });
  const escritor = await arquivo.createWritable();
  await escritor.write(conteudo);
  await escritor.close();
}

const LEIA_ME = `PASTA DE INTEGRAÇÃO — CONTÁBIL ESCOLA (uso educacional, dados fictícios)

Esta pasta liga o sistema Contábil Escola ao Claude (Cowork, Claude Code ou outro agente).

  contexto/contexto-contabil.json  -> gravado pelo sistema: empresa, plano de contas, períodos abertos,
                                      centros de custo e o formato de resposta esperado.
  fontes/                          -> coloque aqui o que o Claude deve ler: PDFs de notas fiscais, extratos
                                      (CSV/OFX), conversas exportadas do WhatsApp (.txt), recibos.
  entrada/                         -> o Claude grava aqui os lotes de lançamentos sugeridos (*.json),
                                      no formato "contabil-escola/lote-lancamentos".
  processados/                     -> o sistema move para cá os lotes importados.
  descartados/                     -> o sistema move para cá os lotes que você recusou.

Nada é lançado automaticamente: no sistema, abra "Assistente IA", revise cada sugestão e aprove.
O manual completo está em docs/MANUAL-IA.md e a skill em .claude/skills/lancamentos-contabeis/.
`;

export async function prepararEstrutura(pasta: FileSystemDirectoryHandle): Promise<void> {
  for (const nome of Object.values(PASTAS)) await pasta.getDirectoryHandle(nome, { create: true });
  await gravarTexto(pasta, 'LEIA-ME.txt', LEIA_ME);
}

export async function gravarContextoNaPasta(pasta: FileSystemDirectoryHandle, contexto: ContextoContabil): Promise<void> {
  const dir = await pasta.getDirectoryHandle(PASTAS.contexto, { create: true });
  await gravarTexto(dir, ARQUIVO_CONTEXTO, JSON.stringify(contexto, null, 2));
}

export interface LotePendente {
  nome: string;
  conteudo: string;
  modificadoEm: number;
}

export async function listarLotesPendentes(pasta: FileSystemDirectoryHandle): Promise<LotePendente[]> {
  const entrada = await pasta.getDirectoryHandle(PASTAS.entrada, { create: true });
  const lotes: LotePendente[] = [];
  for await (const item of entrada.values()) {
    if (item.kind !== 'file' || !item.name.toLowerCase().endsWith('.json')) continue;
    const arquivo = await (item as FileSystemFileHandle).getFile();
    lotes.push({ nome: item.name, conteudo: await arquivo.text(), modificadoEm: arquivo.lastModified });
  }
  return lotes.sort((a, b) => a.modificadoEm - b.modificadoEm);
}

/** Move um lote de entrada/ para processados/ ou descartados/ (copia e apaga o original). */
export async function moverLote(pasta: FileSystemDirectoryHandle, nome: string, destino: 'processados' | 'descartados'): Promise<void> {
  const entrada = await pasta.getDirectoryHandle(PASTAS.entrada);
  const arquivo = await (await entrada.getFileHandle(nome)).getFile();
  const dirDestino = await pasta.getDirectoryHandle(PASTAS[destino], { create: true });
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  await gravarTexto(dirDestino, `${carimbo}_${nome}`, await arquivo.text());
  await entrada.removeEntry(nome);
}

/** Baixa um arquivo (modo alternativo para navegadores sem acesso a pastas). */
export function baixarArquivo(nome: string, conteudo: string, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
