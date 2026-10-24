import { beforeEach, describe, expect, it } from 'vitest';
import { contaPorCodigo, criarEmpresaTeste, limparBanco } from '../../test/ambiente';
import { db } from '../../db/db';
import { interpretarMascara, codigoPai } from '../../lib/mascara';
import { gerarPlanoPadrao, PLANO_PADRAO } from './planoPadrao';
import { alterarAtivacaoConta, criarConta, excluirConta, prepararImportacaoContas, validarDadosConta } from './contaService';
import { salvarLancamento } from '../lancamentos/lancamentoService';
import { atualizarEmpresa } from '../empresa/empresaService';

describe('plano de contas padrão', () => {
  const contas = gerarPlanoPadrao(1, '9.9.9.99.9999');
  const m = interpretarMascara('9.9.9.99.9999');

  it('toda conta (exceto as raízes) tem conta-mãe sintética', () => {
    const porCodigo = new Map(contas.map((c) => [c.codigo, c]));
    for (const c of contas) {
      const pai = codigoPai(c.codigo, m);
      if (!pai) continue;
      expect(porCodigo.get(pai), `mãe de ${c.codigo}`).toBeDefined();
      expect(porCodigo.get(pai)!.tipo).toBe('S');
    }
  });

  it('tem as 5 raízes exigidas e analíticas só no último nível', () => {
    expect(contas.filter((c) => c.nivel === 1).map((c) => c.codigo)).toEqual(['1', '2', '3', '4', '5']);
    expect(contas.filter((c) => c.tipo === 'A').every((c) => c.nivel === 5)).toBe(true);
    expect(new Set(contas.map((c) => c.codigo)).size).toBe(PLANO_PADRAO.length);
  });

  it('define grupo e natureza (inclusive redutoras)', () => {
    const acha = (cod: string) => contas.find((c) => c.codigo === cod)!;
    expect(acha('1.1.1.01.0001')).toMatchObject({ grupo: 'ATIVO', natureza: 'D', tipo: 'A', reduzido: 1 });
    expect(acha('1.2.3.02.0003')).toMatchObject({ grupo: 'ATIVO', natureza: 'C' }); // depreciação acumulada
    expect(acha('2.1.1.01.0001')).toMatchObject({ grupo: 'PASSIVO', natureza: 'C' });
    expect(acha('2.3.1.01.0001')).toMatchObject({ grupo: 'PL', natureza: 'C' });
    expect(acha('2.3.1.01.0002')).toMatchObject({ grupo: 'PL', natureza: 'D' }); // capital a integralizar
    expect(acha('3.2.1.02.0001')).toMatchObject({ grupo: 'RECEITA', natureza: 'D' }); // ICMS s/ vendas
    expect(acha('4.1.1.01.0001')).toMatchObject({ grupo: 'CUSTO', natureza: 'D' });
    expect(acha('5.1.1.01.0001')).toMatchObject({ grupo: 'DESPESA', natureza: 'D', exigeCentroCusto: true });
  });

  it('adapta o plano a outra máscara', () => {
    const outra = gerarPlanoPadrao(1, '9.9.99.99.99999');
    expect(outra.find((c) => c.nome === 'Caixa Geral')!.codigo).toBe('1.1.01.01.00001');
    expect(() => gerarPlanoPadrao(1, '9.9.9.99')).toThrow();
  });
});

describe('cadastro de contas', () => {
  let empresaId: number;
  beforeEach(async () => {
    await limparBanco();
    empresaId = await criarEmpresaTeste();
  });

  it('cria subconta analítica com código reduzido automático', async () => {
    const id = await criarConta(empresaId, { codigo: '1.1.1.02.0003', nome: 'Banco Fictício S.A.', tipo: 'A', natureza: 'D', exigeCentroCusto: false, ativa: true });
    const c = await db.contas.get(id);
    expect(c).toMatchObject({ grupo: 'ATIVO', nivel: 5 });
    expect(c!.reduzido).toBeGreaterThan(100);
  });

  it('não aceita conta sem mãe, código duplicado ou mãe analítica', async () => {
    const base = { nome: 'X', tipo: 'A' as const, natureza: 'D' as const, exigeCentroCusto: false, ativa: true };
    await expect(criarConta(empresaId, { ...base, codigo: '1.1.9.01.0001' })).rejects.toThrow(/conta-mãe/);
    await expect(criarConta(empresaId, { ...base, codigo: '1.1.1.01.0001' })).rejects.toThrow(/Já existe/);
    const contas = await db.contas.where('empresaId').equals(empresaId).toArray();
    const erros = validarDadosConta({ ...base, codigo: '1.1.1.01.0001' }, { mascara: interpretarMascara('9.9.9.99.9999'), contas: contas.filter((c) => c.codigo !== '1.1.1.01.0001'), temMovimento: false });
    expect(erros).toEqual([]);
  });

  it('NÃO deixa excluir conta com movimento (mas permite inativar)', async () => {
    const caixa = await contaPorCodigo(empresaId, '1.1.1.01.0001');
    const capital = await contaPorCodigo(empresaId, '2.3.1.01.0001');
    await salvarLancamento(empresaId, {
      data: '2026-01-02',
      historico: 'Integralização de capital',
      partidas: [
        { contaId: caixa.id!, tipo: 'D', valor: 100000 },
        { contaId: capital.id!, tipo: 'C', valor: 100000 },
      ],
    });
    await expect(excluirConta(caixa.id!)).rejects.toThrow(/não pode ser excluída/);
    await alterarAtivacaoConta(caixa.id!, false);
    expect((await db.contas.get(caixa.id!))!.ativa).toBe(false);
    const semMovimento = await contaPorCodigo(empresaId, '1.1.1.03.0001');
    await excluirConta(semMovimento.id!);
    expect(await db.contas.get(semMovimento.id!)).toBeUndefined();
  });

  it('não deixa excluir conta sintética com subcontas', async () => {
    const sintetica = await contaPorCodigo(empresaId, '1.1.1.01');
    await expect(excluirConta(sintetica.id!)).rejects.toThrow(/subcontas/);
  });

  it('converte todos os códigos ao trocar a máscara da empresa', async () => {
    const empresa = (await db.empresas.get(empresaId))!;
    const caixa = await contaPorCodigo(empresaId, '1.1.1.01.0001');
    await atualizarEmpresa(empresaId, { ...empresa, mascaraPlano: '9.9.99.99.99999' });
    expect((await db.contas.get(caixa.id!))!.codigo).toBe('1.1.01.01.00001');
  });

  it('prepara importação de contas via planilha (mãe e filha em qualquer ordem)', async () => {
    const existentes = await db.contas.where('empresaId').equals(empresaId).toArray();
    const r = prepararImportacaoContas(
      empresaId,
      [
        { linha: 2, codigo: '1.1.5.01.0001', nome: 'Conta filha' },
        { linha: 3, codigo: '1.1.5', nome: 'NOVO GRUPO', tipo: 'S' },
        { linha: 4, codigo: '1.1.5.01', nome: 'Subgrupo', tipo: 'Sintética' },
        { linha: 5, codigo: '9.9', nome: 'Sem mãe' },
        { linha: 6, codigo: '1.1.1.01.0001', nome: 'Caixa renomeado' },
      ],
      existentes,
      interpretarMascara('9.9.9.99.9999'),
      { atualizarExistentes: false, contasComMovimento: new Set() },
    );
    expect(r.novas.map((c) => c.codigo)).toEqual(['1.1.5', '1.1.5.01', '1.1.5.01.0001']);
    expect(r.novas[2]).toMatchObject({ tipo: 'A', grupo: 'ATIVO', natureza: 'D' });
    expect(r.erros).toEqual([{ linha: 5, mensagem: expect.stringMatching(/conta-mãe 9 não existe/) }]);
    expect(r.ignoradas).toBe(1);
  });
});
