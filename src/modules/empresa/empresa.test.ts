import { beforeEach, describe, expect, it } from 'vitest';
import { criarEmpresaTeste, limparBanco } from '../../test/ambiente';
import { db } from '../../db/db';
import { atualizarEmpresa, criarEmpresa, empresaVazia, validarEmpresa } from './empresaService';
import { criarExercicio, gerarPeriodos, situacaoDaData, mapaSituacaoPeriodos } from './periodoService';

beforeEach(limparBanco);

describe('empresas', () => {
  it('valida CNPJ (inclusive alfanumérico), CNAE e máscara', () => {
    const base = { ...empresaVazia(), razaoSocial: 'X', cnae: '4789099' };
    expect(validarEmpresa({ ...base, cnpj: '11.222.333/0001-80' })[0]).toMatch(/CNPJ inválido/);
    expect(validarEmpresa({ ...base, cnpj: '12.ABC.345/01DE-35' })).toEqual([]);
    expect(validarEmpresa({ ...base, cnpj: '12.ABC.345/01DE-35', cnae: '123' })[0]).toMatch(/CNAE/);
    expect(validarEmpresa({ ...base, cnpj: '12.ABC.345/01DE-35', mascaraPlano: '9.9.9' }, { exigirCincoNiveis: true })[0]).toMatch(/5 níveis/);
  });

  it('cria plano padrão, históricos, centros de custo e o exercício com 12 períodos abertos', async () => {
    const id = await criarEmpresaTeste();
    expect(await db.contas.where('empresaId').equals(id).count()).toBe(225);
    expect(await db.historicos.where('empresaId').equals(id).count()).toBeGreaterThan(10);
    expect(await db.centrosCusto.where('empresaId').equals(id).count()).toBe(3);
    const periodos = await db.periodos.where('empresaId').equals(id).toArray();
    expect(periodos.map((p) => p.competencia)).toEqual(Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`));
    expect(periodos.every((p) => p.status === 'ABERTO')).toBe(true);
  });

  it('não aceita CNPJ repetido', async () => {
    const id = await criarEmpresaTeste();
    await expect(criarEmpresaTeste(2027)).rejects.toThrow(/Já existe a empresa/);
    const outra = await criarEmpresa({ ...empresaVazia(), razaoSocial: 'Outra', cnpj: '12.ABC.345/01DE-35', cnae: '4789099' }, { carregarPlanoPadrao: false });
    const dados = (await db.empresas.get(outra))!;
    await expect(atualizarEmpresa(outra, { ...dados, cnpj: '11.222.333/0001-81' })).rejects.toThrow(/Já existe/);
    expect(id).toBeGreaterThan(0);
  });
});

describe('exercícios e períodos', () => {
  it('exercício social fora do ano civil', () => {
    const p = gerarPeriodos(1, 1, '2026-07-01', '2027-06-30');
    expect(p).toHaveLength(12);
    expect(p[0].competencia).toBe('2026-07');
    expect(p[11]).toMatchObject({ competencia: '2027-06', fim: '2027-06-30' });
  });

  it('não permite exercícios sobrepostos e informa a situação de cada data', async () => {
    const id = await criarEmpresaTeste();
    await expect(criarExercicio(id, '2026-06-01')).rejects.toThrow(/Conflita/);
    await criarExercicio(id, '2027-01-01');
    const mapa = await mapaSituacaoPeriodos(id);
    expect(situacaoDaData(mapa, '2027-12-31')).toBe('ABERTO');
    expect(situacaoDaData(mapa, '2028-01-01')).toBe('INEXISTENTE');
  });
});
