// Acesso aos arquivos da pasta de dados. Há duas implementações:
// - SistemaArquivosPasta: pasta real escolhida pelo usuário (File System Access API);
// - SistemaArquivosMemoria: usada nos testes automáticos.

export interface InfoEntrada {
  nome: string;
  tipo: 'arquivo' | 'pasta';
}

export interface SistemaArquivos {
  /** Nome da pasta (para mostrar na tela). */
  readonly nome: string;
  lerTexto(caminho: string): Promise<{ texto: string; modificadoEm: number } | null>;
  lerBinario(caminho: string): Promise<{ dados: Uint8Array; modificadoEm: number } | null>;
  /** Grava (criando as pastas) e devolve a nova data de modificação. */
  gravar(caminho: string, conteudo: string | Uint8Array): Promise<number>;
  modificadoEm(caminho: string): Promise<number | null>;
  listar(pasta: string): Promise<InfoEntrada[]>;
  /** Apaga arquivo ou pasta (com tudo dentro). */
  excluir(caminho: string): Promise<void>;
}

function partes(caminho: string): string[] {
  return caminho.split('/').filter((p) => p && p !== '.');
}

// ---------------- Pasta real ----------------

export class SistemaArquivosPasta implements SistemaArquivos {
  constructor(private raiz: FileSystemDirectoryHandle) {}

  get nome(): string {
    return this.raiz.name;
  }

  private async pasta(segmentos: string[], criar: boolean): Promise<FileSystemDirectoryHandle | null> {
    let atual = this.raiz;
    for (const s of segmentos) {
      try {
        atual = await atual.getDirectoryHandle(s, { create: criar });
      } catch (e) {
        if (!criar && (e as DOMException)?.name === 'NotFoundError') return null;
        if (!criar && (e as DOMException)?.name === 'TypeMismatchError') return null;
        throw e;
      }
    }
    return atual;
  }

  private async arquivo(caminho: string, criar: boolean): Promise<FileSystemFileHandle | null> {
    const ps = partes(caminho);
    const nome = ps.pop();
    if (!nome) return null;
    const dir = await this.pasta(ps, criar);
    if (!dir) return null;
    try {
      return await dir.getFileHandle(nome, { create: criar });
    } catch (e) {
      const n = (e as DOMException)?.name;
      if (!criar && (n === 'NotFoundError' || n === 'TypeMismatchError')) return null;
      throw e;
    }
  }

  async lerTexto(caminho: string) {
    const fh = await this.arquivo(caminho, false);
    if (!fh) return null;
    const f = await fh.getFile();
    return { texto: await f.text(), modificadoEm: f.lastModified };
  }

  async lerBinario(caminho: string) {
    const fh = await this.arquivo(caminho, false);
    if (!fh) return null;
    const f = await fh.getFile();
    return { dados: new Uint8Array(await f.arrayBuffer()), modificadoEm: f.lastModified };
  }

  async gravar(caminho: string, conteudo: string | Uint8Array): Promise<number> {
    const fh = await this.arquivo(caminho, true);
    if (!fh) throw new Error(`Caminho inválido: ${caminho}`);
    const w = await fh.createWritable();
    await w.write(typeof conteudo === 'string' ? conteudo : new Blob([conteudo as BlobPart]));
    await w.close();
    return (await fh.getFile()).lastModified;
  }

  async modificadoEm(caminho: string): Promise<number | null> {
    const fh = await this.arquivo(caminho, false);
    if (!fh) return null;
    return (await fh.getFile()).lastModified;
  }

  async listar(pasta: string): Promise<InfoEntrada[]> {
    const dir = await this.pasta(partes(pasta), false);
    if (!dir) return [];
    const r: InfoEntrada[] = [];
    for await (const [nome, h] of dir.entries()) r.push({ nome, tipo: h.kind === 'directory' ? 'pasta' : 'arquivo' });
    return r.sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async excluir(caminho: string): Promise<void> {
    const ps = partes(caminho);
    const nome = ps.pop();
    if (!nome) return;
    const dir = await this.pasta(ps, false);
    if (!dir) return;
    try {
      await dir.removeEntry(nome, { recursive: true });
    } catch (e) {
      if ((e as DOMException)?.name !== 'NotFoundError') throw e;
    }
  }
}

// ---------------- Memória (testes) ----------------

export class SistemaArquivosMemoria implements SistemaArquivos {
  readonly nome = 'memória';
  arquivos = new Map<string, { dados: Uint8Array; modificadoEm: number }>();
  private relogio: () => number;
  private ultimo = 0;

  constructor(relogio?: () => number) {
    this.relogio = relogio ?? (() => Date.now());
  }

  private agora(): number {
    // Garante datas sempre crescentes (como num disco real a cada gravação).
    this.ultimo = Math.max(this.relogio(), this.ultimo + 1);
    return this.ultimo;
  }

  private norm(c: string) {
    return partes(c).join('/');
  }

  async lerTexto(caminho: string) {
    const a = this.arquivos.get(this.norm(caminho));
    return a ? { texto: new TextDecoder().decode(a.dados), modificadoEm: a.modificadoEm } : null;
  }

  async lerBinario(caminho: string) {
    const a = this.arquivos.get(this.norm(caminho));
    return a ? { dados: a.dados, modificadoEm: a.modificadoEm } : null;
  }

  async gravar(caminho: string, conteudo: string | Uint8Array): Promise<number> {
    const dados = typeof conteudo === 'string' ? new TextEncoder().encode(conteudo) : conteudo;
    const m = this.agora();
    this.arquivos.set(this.norm(caminho), { dados, modificadoEm: m });
    return m;
  }

  /** Simula outra pessoa alterando o arquivo (para testar conflitos). */
  async alterarPorFora(caminho: string, texto: string) {
    await this.gravar(caminho, texto);
  }

  async modificadoEm(caminho: string) {
    return this.arquivos.get(this.norm(caminho))?.modificadoEm ?? null;
  }

  async listar(pasta: string): Promise<InfoEntrada[]> {
    const p = this.norm(pasta);
    const prefixo = p ? `${p}/` : '';
    const vistos = new Map<string, InfoEntrada>();
    for (const k of this.arquivos.keys()) {
      if (!k.startsWith(prefixo)) continue;
      const resto = k.slice(prefixo.length).split('/');
      const nome = resto[0];
      vistos.set(nome, { nome, tipo: resto.length > 1 ? 'pasta' : 'arquivo' });
    }
    return [...vistos.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async excluir(caminho: string) {
    const p = this.norm(caminho);
    for (const k of [...this.arquivos.keys()]) if (k === p || k.startsWith(`${p}/`)) this.arquivos.delete(k);
  }
}
