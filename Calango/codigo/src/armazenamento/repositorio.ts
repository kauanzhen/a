// Gravação e leitura dos dados na pasta de dados.
//
// Estrutura:
//   configuracoes.json
//   clausulas/<id>.json            (um arquivo por cláusula)
//   empresas/<nome>-<id>.json      (um arquivo por empresa)
//   backups/AAAA-MM-DD/            (cópia anterior de cada arquivo antes de sobrescrever)
//   imagens/                       (imagens de cabeçalho)
//
// Regras de segurança:
// - Nunca sobrescrever sem backup: antes de gravar, a versão anterior é copiada
//   para backups/<data de hoje>/. Backups com mais de 30 dias são apagados.
// - Antes de gravar, confere se o arquivo foi alterado por outra pessoa desde
//   que foi aberto (data de modificação). Se foi, avisa em vez de sobrescrever.

import { diasEntre, hojeISO } from '../lib/datas';
import { paraSlug } from '../lib/texto';
import { bibliotecaInicial } from '../biblioteca/inicial';
import type { Clausula } from '../motor/clausula';
import type { Empresa } from '../dados/tipos';
import { normalizarDados } from '../dados/fabricas';
import { normalizarConfiguracoes, type Configuracoes } from './configuracoes';
import type { SistemaArquivos } from './sistemaArquivos';

export const DIAS_BACKUP = 30;

export class ErroConflito extends Error {
  constructor(public caminho: string) {
    super(
      `O arquivo "${caminho}" foi alterado por outra pessoa (ou em outra janela) depois que você o abriu. ` +
        'Para não perder o trabalho de ninguém, nada foi gravado. Recarregue os dados e refaça a alteração.',
    );
    this.name = 'ErroConflito';
  }
}

export class ErroArquivo extends Error {
  constructor(public caminho: string, detalhe: string) {
    super(`Não foi possível ler "${caminho}": ${detalhe}`);
    this.name = 'ErroArquivo';
  }
}

export interface Lido<T> {
  dados: T;
  caminho: string;
  modificadoEm: number;
}

export interface OpcoesGravacao {
  /**
   * Data de modificação que o arquivo tinha quando foi aberto. null = o arquivo
   * não existia. undefined = não conferir (uso interno, ex.: importação confirmada).
   */
  modificadoEmEsperado?: number | null;
}

function doisDigitos(n: number) {
  return String(n).padStart(2, '0');
}

export class Repositorio {
  constructor(
    public fs: SistemaArquivos,
    private relogio: () => Date = () => new Date(),
  ) {}

  // ---------------- Genérico ----------------

  async lerJson<T>(caminho: string): Promise<Lido<T> | null> {
    const a = await this.fs.lerTexto(caminho);
    if (!a) return null;
    try {
      return { dados: JSON.parse(a.texto) as T, caminho, modificadoEm: a.modificadoEm };
    } catch {
      throw new ErroArquivo(caminho, 'o conteúdo não é um JSON válido (arquivo corrompido?). Use uma cópia da pasta backups/.');
    }
  }

  /** Grava com backup da versão anterior e conferência de conflito. Devolve a nova data de modificação. */
  async gravarJson(caminho: string, dados: unknown, op: OpcoesGravacao = {}): Promise<number> {
    const atual = await this.fs.modificadoEm(caminho);
    if (op.modificadoEmEsperado !== undefined && (atual ?? null) !== (op.modificadoEmEsperado ?? null)) {
      throw new ErroConflito(caminho);
    }
    if (atual !== null) await this.fazerBackup(caminho);
    return this.fs.gravar(caminho, JSON.stringify(dados, null, 2));
  }

  async gravarBinario(caminho: string, dados: Uint8Array): Promise<number> {
    if ((await this.fs.modificadoEm(caminho)) !== null) await this.fazerBackup(caminho);
    return this.fs.gravar(caminho, dados);
  }

  /** Copia o arquivo atual para backups/AAAA-MM-DD/ (nome com a hora). */
  async fazerBackup(caminho: string): Promise<string | null> {
    const bin = await this.fs.lerBinario(caminho);
    if (!bin) return null;
    const agora = this.relogio();
    const dia = hojeISO(agora);
    const hora = `${doisDigitos(agora.getHours())}${doisDigitos(agora.getMinutes())}${doisDigitos(agora.getSeconds())}-${String(agora.getMilliseconds()).padStart(3, '0')}`;
    const plano = caminho.replace(/\//g, '__');
    const ponto = plano.lastIndexOf('.');
    const base = ponto > 0 ? plano.slice(0, ponto) : plano;
    const ext = ponto > 0 ? plano.slice(ponto) : '';
    let destino = `backups/${dia}/${base}__${hora}${ext}`;
    let n = 1;
    while ((await this.fs.modificadoEm(destino)) !== null) destino = `backups/${dia}/${base}__${hora}-${n++}${ext}`;
    await this.fs.gravar(destino, bin.dados);
    return destino;
  }

  /** Apaga um arquivo guardando uma cópia em backups/. */
  async excluirComBackup(caminho: string): Promise<void> {
    await this.fazerBackup(caminho);
    await this.fs.excluir(caminho);
  }

  /** Remove as pastas de backup com mais de 30 dias. Devolve quantas foram apagadas. */
  async limparBackupsAntigos(dias = DIAS_BACKUP): Promise<number> {
    const hoje = hojeISO(this.relogio());
    let apagadas = 0;
    for (const e of await this.fs.listar('backups')) {
      if (e.tipo !== 'pasta' || !/^\d{4}-\d{2}-\d{2}$/.test(e.nome)) continue;
      if (diasEntre(e.nome, hoje) > dias) {
        await this.fs.excluir(`backups/${e.nome}`);
        apagadas++;
      }
    }
    return apagadas;
  }

  // ---------------- Inicialização ----------------

  /** Confere se a pasta parece ser de outro programa (tem arquivos, mas não os do Calango). */
  async pastaPareceEstranha(): Promise<boolean> {
    const itens = await this.fs.listar('');
    if (itens.length === 0) return false;
    const nossos = ['configuracoes.json', 'clausulas', 'empresas', 'backups', 'imagens'];
    return !itens.some((i) => nossos.includes(i.nome));
  }

  /**
   * Prepara a pasta: cria configuracoes.json e grava a biblioteca inicial se a
   * pasta clausulas/ estiver vazia. Também limpa backups antigos.
   */
  async inicializar(): Promise<{ nova: boolean; clausulasCriadas: number; backupsApagados: number }> {
    let nova = false;
    if ((await this.fs.modificadoEm('configuracoes.json')) === null) {
      nova = true;
      await this.gravarJson('configuracoes.json', normalizarConfiguracoes(null));
    }
    let clausulasCriadas = 0;
    const existentes = (await this.fs.listar('clausulas')).filter((e) => e.nome.endsWith('.json'));
    if (existentes.length === 0) {
      for (const c of bibliotecaInicial(this.relogio().toISOString())) {
        await this.fs.gravar(`clausulas/${c.id}.json`, JSON.stringify(c, null, 2));
        clausulasCriadas++;
      }
    }
    const backupsApagados = await this.limparBackupsAntigos();
    return { nova, clausulasCriadas, backupsApagados };
  }

  // ---------------- Configurações ----------------

  async carregarConfiguracoes(): Promise<Lido<Configuracoes>> {
    const l = await this.lerJson<Partial<Configuracoes>>('configuracoes.json');
    if (!l) return { dados: normalizarConfiguracoes(null), caminho: 'configuracoes.json', modificadoEm: 0 };
    return { ...l, dados: normalizarConfiguracoes(l.dados) };
  }

  async salvarConfiguracoes(c: Configuracoes, modificadoEmEsperado: number | null): Promise<number> {
    return this.gravarJson('configuracoes.json', c, { modificadoEmEsperado: modificadoEmEsperado || null });
  }

  // ---------------- Cláusulas ----------------

  caminhoClausula(id: string) {
    return `clausulas/${id}.json`;
  }

  async listarClausulas(): Promise<{ lidas: Lido<Clausula>[]; erros: string[] }> {
    const lidas: Lido<Clausula>[] = [];
    const erros: string[] = [];
    for (const e of await this.fs.listar('clausulas')) {
      if (e.tipo !== 'arquivo' || !e.nome.endsWith('.json')) continue;
      try {
        const l = await this.lerJson<Clausula>(`clausulas/${e.nome}`);
        if (l && l.dados?.formato === 'calango/clausula') lidas.push(l);
        else if (l) erros.push(`clausulas/${e.nome}: não é uma cláusula do Calango.`);
      } catch (err) {
        erros.push((err as Error).message);
      }
    }
    return { lidas, erros };
  }

  async salvarClausula(c: Clausula, modificadoEmEsperado: number | null): Promise<number> {
    return this.gravarJson(this.caminhoClausula(c.id), c, { modificadoEmEsperado });
  }

  async clausulaExiste(id: string): Promise<boolean> {
    return (await this.fs.modificadoEm(this.caminhoClausula(id))) !== null;
  }

  // ---------------- Empresas ----------------

  novoCaminhoEmpresa(e: Empresa, razaoSocial: string): string {
    return `empresas/${paraSlug(razaoSocial || 'nova-empresa')}-${e.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}.json`;
  }

  async listarEmpresas(): Promise<{ lidas: Lido<Empresa>[]; erros: string[] }> {
    const lidas: Lido<Empresa>[] = [];
    const erros: string[] = [];
    for (const e of await this.fs.listar('empresas')) {
      if (e.tipo !== 'arquivo' || !e.nome.endsWith('.json')) continue;
      try {
        const l = await this.lerJson<Empresa>(`empresas/${e.nome}`);
        if (l && l.dados?.formato === 'calango/empresa') lidas.push({ ...l, dados: normalizarEmpresa(l.dados) });
        else if (l) erros.push(`empresas/${e.nome}: não é uma empresa do Calango.`);
      } catch (err) {
        erros.push((err as Error).message);
      }
    }
    return { lidas, erros };
  }

  async lerEmpresa(caminho: string): Promise<Lido<Empresa> | null> {
    const l = await this.lerJson<Empresa>(caminho);
    return l ? { ...l, dados: normalizarEmpresa(l.dados) } : null;
  }

  async salvarEmpresa(e: Empresa, caminho: string, modificadoEmEsperado: number | null): Promise<number> {
    const dados: Empresa = { ...e, atualizada_em: this.relogio().toISOString() };
    return this.gravarJson(caminho, dados, { modificadoEmEsperado });
  }

  async excluirEmpresa(caminho: string): Promise<void> {
    await this.excluirComBackup(caminho);
  }

  // ---------------- Imagens ----------------

  async gravarImagem(nome: string, dados: Uint8Array): Promise<void> {
    await this.gravarBinario(`imagens/${nome}`, dados);
  }

  async lerImagem(nome: string): Promise<Uint8Array | null> {
    if (!nome) return null;
    return (await this.fs.lerBinario(`imagens/${nome}`))?.dados ?? null;
  }

  async listarImagens(): Promise<string[]> {
    return (await this.fs.listar('imagens')).filter((e) => e.tipo === 'arquivo').map((e) => e.nome);
  }
}

export function normalizarEmpresa(e: Empresa): Empresa {
  return {
    ...e,
    vigente: e.vigente ? normalizarDados(e.vigente) : null,
    atos: (e.atos ?? []).map((a) => ({
      ...a,
      dados_antes: a.dados_antes ? normalizarDados(a.dados_antes) : null,
      dados_depois: normalizarDados(a.dados_depois ?? {}),
      selecao: a.selecao ?? {},
    })),
  };
}
