import { beforeEach, describe, expect, it } from 'vitest';
import { contaPorCodigo, criarEmpresaTeste, limparBanco } from '../test/ambiente';
import { db } from './db';
import { gerarBackup, restaurarBackup, validarBackup } from './backup';
import { salvarLancamento, estornarLancamento } from '../modules/lancamentos/lancamentoService';
import { garantirTabelasPadrao } from '../modules/tabelasFiscais/tabelaService';

async function fotografia() {
  const r: Record<string, unknown[]> = {};
  for (const t of db.tables) r[t.name] = await t.toArray();
  return r;
}

describe('backup JSON', () => {
  beforeEach(limparBanco);

  it('restaura 100% dos dados', async () => {
    await garantirTabelasPadrao();
    const empresaId = await criarEmpresaTeste();
    await criarEmpresaTeste(2025);
    const banco = await contaPorCodigo(empresaId, '1.1.1.02.0001');
    const capital = await contaPorCodigo(empresaId, '2.3.1.01.0001');
    const l = await salvarLancamento(empresaId, {
      data: '2026-01-02',
      historico: 'Capital — acentuação ç ã é',
      partidas: [
        { contaId: banco.id!, tipo: 'D', valor: 123456 },
        { contaId: capital.id!, tipo: 'C', valor: 123456 },
      ],
    });
    await estornarLancamento(l.id!, '2026-01-03');
    await db.config.bulkPut([
      { chave: 'usuario', valor: 'Ana' },
      { chave: 'anthropicApiKey', valor: 'segredo-local' },
    ]);
    const antes = await fotografia();
    const json = JSON.stringify(await gerarBackup());
    expect(json).not.toContain('segredo-local');

    for (const t of db.tables) await t.clear();
    await db.config.put({ chave: 'anthropicApiKey', valor: 'segredo-local' });
    await restaurarBackup(JSON.parse(json));
    const depois = await fotografia();
    // tudo igual, exceto a entrada de auditoria da própria restauração
    expect(depois.auditoria.slice(0, -1)).toEqual(antes.auditoria);
    for (const nome of Object.keys(antes).filter((n) => n !== 'auditoria')) {
      expect(depois[nome], nome).toEqual(antes[nome]);
    }
  });

  it('rejeita arquivo que não é backup', () => {
    expect(validarBackup({ foo: 1 }).length).toBeGreaterThan(0);
    expect(validarBackup({ formato: 'contabil-escola/backup', versaoEsquema: 99, tabelas: {} })[0]).toMatch(/versão mais nova/);
  });
});
