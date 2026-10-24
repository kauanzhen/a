import { describe, expect, it } from 'vitest';
import { escolherVigente, validarTabela } from './tabelaService';
import { TABELAS_PADRAO } from './tabelasPadrao';

describe('tabelas fiscais', () => {
  it('escolhe a tabela vigente pela data', () => {
    const inss = TABELAS_PADRAO.filter((t) => t.tipo === 'INSS');
    expect(escolherVigente(inss, '2025-06-30')!.descricao).toMatch(/2025/);
    expect(escolherVigente(inss, '2026-01-01')!.descricao).toMatch(/2026/);
    expect(escolherVigente(inss, '2024-12-31')).toBeUndefined();
  });
  it('todas as tabelas padrão são válidas e marcadas para verificar vigência', () => {
    for (const t of TABELAS_PADRAO) {
      expect(validarTabela(t), t.descricao).toEqual([]);
      expect(t.verificarVigencia).toBe(true);
    }
  });
});
