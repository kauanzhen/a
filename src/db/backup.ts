import { db, NOME_BANCO, VERSAO_ESQUEMA } from './db';
import { registrarAuditoria } from './auditoria';
import { agoraTimestamp } from '../lib/date';

export const IDENTIFICADOR_BACKUP = 'contabil-escola/backup';

/** Itens de configuração que ficam só neste navegador e nunca vão para o backup. */
export const CHAVES_CONFIG_LOCAIS = new Set(['pastaIntegracao', 'anthropicApiKey']);

export interface ArquivoBackup {
  formato: typeof IDENTIFICADOR_BACKUP;
  versaoEsquema: number;
  banco: string;
  geradoEm: string;
  tabelas: Record<string, unknown[]>;
}

export async function gerarBackup(): Promise<ArquivoBackup> {
  const tabelas: Record<string, unknown[]> = {};
  await db.transaction('r', db.tables, async () => {
    for (const t of db.tables) {
      let linhas = await t.toArray();
      if (t.name === 'config') linhas = linhas.filter((c) => !CHAVES_CONFIG_LOCAIS.has((c as { chave: string }).chave));
      tabelas[t.name] = linhas;
    }
  });
  return { formato: IDENTIFICADOR_BACKUP, versaoEsquema: VERSAO_ESQUEMA, banco: NOME_BANCO, geradoEm: agoraTimestamp(), tabelas };
}

export function validarBackup(obj: unknown): string[] {
  const erros: string[] = [];
  if (!obj || typeof obj !== 'object') return ['O arquivo não é um JSON de backup válido.'];
  const b = obj as Partial<ArquivoBackup>;
  if (b.formato !== IDENTIFICADOR_BACKUP) erros.push('O arquivo não é um backup do Contábil Escola.');
  if (typeof b.versaoEsquema !== 'number') erros.push('Versão do backup ausente.');
  else if (b.versaoEsquema > VERSAO_ESQUEMA) erros.push(`O backup é de uma versão mais nova do sistema (esquema ${b.versaoEsquema}). Atualize o sistema.`);
  if (!b.tabelas || typeof b.tabelas !== 'object') erros.push('O backup não contém tabelas.');
  else {
    const nomes = new Set(db.tables.map((t) => t.name));
    for (const [nome, linhas] of Object.entries(b.tabelas)) {
      if (!nomes.has(nome)) erros.push(`Tabela desconhecida no backup: ${nome}.`);
      else if (!Array.isArray(linhas)) erros.push(`Tabela ${nome} inválida.`);
    }
  }
  return erros;
}

/**
 * Restaura um backup: APAGA todos os dados atuais e grava os do arquivo, numa única transação
 * (se algo falhar, nada muda). As configurações locais (pasta de integração, chave de API) são mantidas.
 */
export async function restaurarBackup(obj: unknown): Promise<void> {
  const erros = validarBackup(obj);
  if (erros.length) throw new Error(erros.join('\n'));
  const b = obj as ArquivoBackup;
  await db.transaction('rw', db.tables, async () => {
    const locais = (await db.config.toArray()).filter((c) => CHAVES_CONFIG_LOCAIS.has(c.chave));
    for (const t of db.tables) {
      await t.clear();
      const linhas = b.tabelas[t.name];
      if (linhas?.length) await t.bulkAdd(linhas);
    }
    if (locais.length) await db.config.bulkPut(locais);
    await registrarAuditoria({ entidade: 'Backup', acao: 'RESTAURAR', descricao: `Backup de ${b.geradoEm} restaurado` });
  });
}

/** Apaga TODOS os dados do navegador (todas as empresas). */
export async function apagarTudo(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
}
