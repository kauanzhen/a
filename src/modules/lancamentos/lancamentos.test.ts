import { beforeEach, describe, expect, it } from 'vitest';
import { contaPorCodigo, criarEmpresaTeste, limparBanco } from '../../test/ambiente';
import { db } from '../../db/db';
import type { Conta } from '../../db/types';
import { criarIndiceContas } from '../planoContas/indiceContas';
import { calcularTotais, validarLancamento } from './partidas';
import { explicarLancamento } from './didatico';
import { estornarLancamento, excluirLancamento, salvarLancamento } from './lancamentoService';
import { fecharPeriodo } from '../empresa/periodoService';

let empresaId: number;
let c: Record<string, Conta>;

beforeEach(async () => {
  await limparBanco();
  empresaId = await criarEmpresaTeste();
  c = {};
  for (const [nome, cod] of Object.entries({
    caixa: '1.1.1.01.0001', banco: '1.1.1.02.0001', clientes: '1.1.2.01.0001', estoque: '1.1.3.01.0001',
    fornecedores: '2.1.1.01.0001', capital: '2.3.1.01.0001', vendas: '3.1.1.01.0001', juros: '3.3.1.01.0001',
    aluguel: '5.1.2.01.0001', salarios: '5.1.1.01.0001', sintetica: '1.1.1.01', depAcum: '1.2.3.02.0003', depreciacao: '5.1.2.01.0009',
  })) c[nome] = await contaPorCodigo(empresaId, cod);
});

async function ctx() {
  const contas = await db.contas.where('empresaId').equals(empresaId).toArray();
  const centros = await db.centrosCusto.where('empresaId').equals(empresaId).toArray();
  return { indice: criarIndiceContas(contas), centros: new Map(centros.map((x) => [x.id!, x])) };
}

describe('partidas dobradas', () => {
  it('aceita lançamento composto balanceado', async () => {
    const erros = validarLancamento(
      {
        data: '2026-03-10',
        historico: 'Venda à vista e a prazo',
        partidas: [
          { contaId: c.caixa.id!, tipo: 'D', valor: 30000 },
          { contaId: c.clientes.id!, tipo: 'D', valor: 70000 },
          { contaId: c.vendas.id!, tipo: 'C', valor: 100000 },
        ],
      },
      await ctx(),
    );
    expect(erros).toEqual([]);
  });

  it('rejeita desbalanceado, conta sintética, valor zero e falta de centro de custo', async () => {
    const erros = validarLancamento(
      {
        data: '2026-03-10',
        historico: 'Teste',
        partidas: [
          { contaId: c.sintetica.id!, tipo: 'D', valor: 100 },
          { contaId: c.salarios.id!, tipo: 'D', valor: 0 },
          { contaId: c.caixa.id!, tipo: 'C', valor: 90 },
        ],
      },
      await ctx(),
    );
    expect(erros.join('\n')).toMatch(/sintética/);
    expect(erros.join('\n')).toMatch(/exige centro de custo/);
    expect(erros.join('\n')).toMatch(/maior que zero/);
    expect(erros.join('\n')).toMatch(/desbalanceado: débitos R\$ 1,00 ≠ créditos R\$ 0,90/);
  });

  it('calcula totais', () => {
    expect(calcularTotais([{ tipo: 'D', valor: 150 }, { tipo: 'C', valor: 100 }, { tipo: 'C', valor: 50 }])).toEqual({ debitos: 150, creditos: 150, diferenca: 0 });
  });
});

describe('modo didático', () => {
  const mapa = () => new Map(Object.values(c).map((x) => [x.id!, x]));

  it('compra a prazo = fato permutativo', () => {
    const e = explicarLancamento([{ contaId: c.estoque.id!, tipo: 'D', valor: 5000 }, { contaId: c.fornecedores.id!, tipo: 'C', valor: 5000 }], mapa());
    expect(e.classificacao).toBe('PERMUTATIVO');
    expect(e.variacaoAtivo).toBe(5000);
    expect(e.variacaoPassivo).toBe(5000);
    expect(e.equacaoFecha).toBe(true);
  });

  it('pagamento de aluguel = modificativo diminutivo', () => {
    const e = explicarLancamento([{ contaId: c.aluguel.id!, tipo: 'D', valor: 3500 }, { contaId: c.banco.id!, tipo: 'C', valor: 3500 }], mapa());
    expect(e.classificacao).toBe('MODIFICATIVO_DIMINUTIVO');
    expect(e.variacaoPL).toBe(-3500);
    expect(e.efeitos[1].texto).toMatch(/o Ativo diminuiu/);
  });

  it('recebimento com juros = misto aumentativo', () => {
    const e = explicarLancamento(
      [
        { contaId: c.banco.id!, tipo: 'D', valor: 11000 },
        { contaId: c.clientes.id!, tipo: 'C', valor: 10000 },
        { contaId: c.juros.id!, tipo: 'C', valor: 1000 },
      ],
      mapa(),
    );
    expect(e.classificacao).toBe('MISTO_AUMENTATIVO');
    expect(e.variacaoAtivo).toBe(1000);
  });

  it('integralização de capital = variação direta do PL', () => {
    const e = explicarLancamento([{ contaId: c.banco.id!, tipo: 'D', valor: 100 }, { contaId: c.capital.id!, tipo: 'C', valor: 100 }], mapa());
    expect(e.classificacao).toBe('PL_DIRETO');
    expect(e.resumo.join(' ')).toMatch(/Ativo: \+R\$ 1,00/);
  });

  it('depreciação: crédito na redutora diminui o Ativo', () => {
    const e = explicarLancamento([{ contaId: c.depreciacao.id!, tipo: 'D', valor: 100 }, { contaId: c.depAcum.id!, tipo: 'C', valor: 100 }], mapa());
    expect(e.variacaoAtivo).toBe(-100);
    expect(e.efeitos[1].texto).toMatch(/conta redutora/);
    expect(e.equacaoFecha).toBe(true);
  });
});

describe('serviço de lançamentos', () => {
  const capital = () => ({
    data: '2026-01-02',
    historico: 'Integralização de capital',
    partidas: [
      { contaId: c.banco.id!, tipo: 'D' as const, valor: 5000000 },
      { contaId: c.capital.id!, tipo: 'C' as const, valor: 5000000 },
    ],
  });

  it('numera em sequência e registra auditoria', async () => {
    const a = await salvarLancamento(empresaId, capital());
    const b = await salvarLancamento(empresaId, { ...capital(), data: '2026-01-03' });
    expect([a.numero, b.numero]).toEqual([1, 2]);
    expect(a.contaIds).toEqual([c.banco.id, c.capital.id]);
    const audit = await db.auditoria.where('entidade').equals('Lançamento').toArray();
    expect(audit.length).toBe(2);
    expect(audit[0].usuario).toBe('Estudante');
  });

  it('período fechado bloqueia criar, alterar e excluir', async () => {
    const l = await salvarLancamento(empresaId, capital());
    const jan = await db.periodos.where('[empresaId+competencia]').equals([empresaId, '2026-01']).first();
    await fecharPeriodo(jan!.id!);
    await expect(salvarLancamento(empresaId, capital())).rejects.toThrow(/período fechado/);
    await expect(salvarLancamento(empresaId, { ...capital(), data: '2026-02-01' }, l.id)).rejects.toThrow(/período fechado/);
    await expect(excluirLancamento(l.id!)).rejects.toThrow(/período fechado/);
  });

  it('data sem exercício é rejeitada', async () => {
    await expect(salvarLancamento(empresaId, { ...capital(), data: '2027-01-05' })).rejects.toThrow(/Não há exercício/);
  });

  it('estorno inverte as partidas e liga os dois lançamentos', async () => {
    const l = await salvarLancamento(empresaId, capital());
    const e = await estornarLancamento(l.id!, '2026-01-05', 'valor errado');
    expect(e.partidas.map((p) => p.tipo)).toEqual(['C', 'D']);
    expect(e.estornoDeId).toBe(l.id);
    expect((await db.lancamentos.get(l.id!))!.estornadoPorId).toBe(e.id);
    await expect(estornarLancamento(l.id!, '2026-01-06')).rejects.toThrow(/já foi estornado/);
    await expect(excluirLancamento(l.id!)).rejects.toThrow(/Exclua primeiro o estorno/);
    await excluirLancamento(e.id!);
    expect((await db.lancamentos.get(l.id!))!.estornadoPorId).toBeUndefined();
  });
});
