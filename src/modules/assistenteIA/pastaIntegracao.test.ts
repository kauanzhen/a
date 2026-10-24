import { beforeEach, describe, expect, it } from 'vitest';
import { criarEmpresaTeste, limparBanco } from '../../test/ambiente';
import { gerarContextoContabil } from './contextoIA';
import { gravarContextoNaPasta, listarLotesPendentes, moverLote, prepararEstrutura } from './pastaIntegracao';

/** Pasta em memória com a mesma interface usada da File System Access API. */
class PastaFalsa {
  kind = 'directory' as const;
  filhos = new Map<string, PastaFalsa | ArquivoFalso>();
  constructor(public name: string) {}
  async getDirectoryHandle(nome: string, op?: { create?: boolean }) {
    let d = this.filhos.get(nome);
    if (!d) {
      if (!op?.create) throw new DOMException('não existe', 'NotFoundError');
      d = new PastaFalsa(nome);
      this.filhos.set(nome, d);
    }
    return d as PastaFalsa;
  }
  async getFileHandle(nome: string, op?: { create?: boolean }) {
    let f = this.filhos.get(nome);
    if (!f) {
      if (!op?.create) throw new DOMException('não existe', 'NotFoundError');
      f = new ArquivoFalso(nome);
      this.filhos.set(nome, f);
    }
    return f as ArquivoFalso;
  }
  async removeEntry(nome: string) {
    this.filhos.delete(nome);
  }
  async *values() {
    yield* this.filhos.values();
  }
}

class ArquivoFalso {
  kind = 'file' as const;
  conteudo = '';
  modificado = Date.now();
  constructor(public name: string) {}
  async createWritable() {
    let buffer = '';
    return {
      write: async (t: string) => {
        buffer += t;
      },
      close: async () => {
        this.conteudo = buffer;
        this.modificado = Date.now();
      },
    };
  }
  async getFile() {
    return { text: async () => this.conteudo, lastModified: this.modificado };
  }
}

let empresaId: number;
beforeEach(async () => {
  await limparBanco();
  empresaId = await criarEmpresaTeste();
});

describe('pasta de integração com o Cowork', () => {
  it('prepara a estrutura, grava o contexto, lista e move lotes', async () => {
    const raiz = new PastaFalsa('contabil-escola');
    const pasta = raiz as unknown as FileSystemDirectoryHandle;
    await prepararEstrutura(pasta);
    expect([...raiz.filhos.keys()].sort()).toEqual(['LEIA-ME.txt', 'contexto', 'descartados', 'entrada', 'fontes', 'processados']);

    await gravarContextoNaPasta(pasta, await gerarContextoContabil(empresaId));
    const ctx = JSON.parse(((await raiz.getDirectoryHandle('contexto')).filhos.get('contexto-contabil.json') as ArquivoFalso).conteudo);
    expect(ctx.formato).toBe('contabil-escola/contexto-contabil');
    expect(ctx.contas.length).toBeGreaterThan(100);

    const entrada = await raiz.getDirectoryHandle('entrada');
    const lote = await entrada.getFileHandle('lote-1.json', { create: true });
    const w = await lote.createWritable();
    await w.write('{"lancamentos": [], "naoLancados": []}');
    await w.close();
    await (await entrada.getFileHandle('anotacao.txt', { create: true })).createWritable();

    const pendentes = await listarLotesPendentes(pasta);
    expect(pendentes.map((p) => p.nome)).toEqual(['lote-1.json']);

    await moverLote(pasta, 'lote-1.json', 'processados');
    expect(await listarLotesPendentes(pasta)).toEqual([]);
    const processados = [...(await raiz.getDirectoryHandle('processados')).filhos.values()] as ArquivoFalso[];
    expect(processados).toHaveLength(1);
    expect(processados[0].name).toMatch(/_lote-1\.json$/);
    expect(processados[0].conteudo).toContain('lancamentos');
  });
});
