import { beforeEach, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { contaPorCodigo, criarEmpresaTeste, limparBanco } from '../../test/ambiente';
import { db } from '../../db/db';
import { detectarFormato, localizarLinhaCabecalho, sugerirMapeamento } from './colunas';
import { validarImportacao } from './validador';
import { carregarContextoImportacao, desfazerImportacao, importarLotes } from './importacaoService';
import { lerPlanilha, montarPlanilhaLancamentos, montarPlanilhaModelo } from './planilhas';
import { fecharPeriodo } from '../empresa/periodoService';
import { criarIndiceContas } from '../planoContas/indiceContas';

let empresaId: number;
beforeEach(async () => {
  await limparBanco();
  empresaId = await criarEmpresaTeste();
});

async function validar(linhas: unknown[][]) {
  const ctx = await carregarContextoImportacao(empresaId);
  const cab = localizarLinhaCabecalho(linhas);
  const formato = detectarFormato(linhas[cab]);
  return validarImportacao(linhas, cab, sugerirMapeamento(linhas[cab], formato), formato, ctx);
}

describe('importação — formato uma linha por lançamento', () => {
  it('reconhece colunas com outros nomes e valida linha a linha', async () => {
    const r = await validar([
      ['Relatório qualquer'],
      ['Dt', 'Cta Débito', 'Cta Crédito', 'Vlr', 'Descrição', 'Doc', 'CC'],
      ['02/01/2026', '1.1.1.02.0001', '2.3.1.01.0001', '50.000,00', 'Capital', 'Contrato', ''],
      [46031, '1', '3', 'R$ 200,00', 'Saque', '', ''], // reduzidos 1 (caixa) e 3; data como número de série
      ['10/01/2026', '1.1.1.01', '1.1.1.02.0001', '10', 'Conta sintética', '', ''],
      ['10/01/2026', '9.9.9.99.9999', '1.1.1.02.0001', '-5', '', '', ''],
      ['10/01/2026', '5.1.1.01.0001', '1.1.1.02.0001', '100', 'Salário sem CC', '', ''],
      ['10/01/2026', '5.1.1.01.0001', '1.1.1.02.0001', '100', 'Salário com CC', '', 'Administrativo'],
    ]);
    expect(r.formato).toBe('SIMPLES');
    expect(r.resumo.linhasLidas).toBe(6);
    expect(r.lotes.filter((l) => l.valido).map((l) => l.linhas[0])).toEqual([3, 4, 8]);
    const erro = (linha: number) => r.linhas.find((l) => l.linha === linha)!.erros.join(' | ');
    expect(erro(5)).toMatch(/sintética/);
    expect(erro(6)).toMatch(/não existe/);
    expect(erro(6)).toMatch(/maior que zero/);
    expect(erro(6)).toMatch(/Histórico não informado/);
    expect(erro(7)).toMatch(/exige centro de custo/);
    expect(r.linhas.find((l) => l.linha === 4)!.data).toBe('2026-01-09');
    expect(r.resumo.valorImportavel).toBe(5000000 + 20000 + 10000);
  });

  it('rejeita data em período fechado', async () => {
    const jan = await db.periodos.where('[empresaId+competencia]').equals([empresaId, '2026-01']).first();
    await fecharPeriodo(jan!.id!);
    const r = await validar([
      ['Data', 'Conta Débito', 'Conta Crédito', 'Valor', 'Histórico'],
      ['15/01/2026', '1', '3', '10', 'x'],
      ['15/02/2026', '1', '3', '10', 'x'],
    ]);
    expect(r.linhas[0].erros[0]).toMatch(/período fechado/);
    expect(r.lotes.map((l) => l.valido)).toEqual([false, true]);
  });
});

describe('importação — formato uma linha por partida', () => {
  it('REJEITA lote desbalanceado e indica as linhas', async () => {
    const r = await validar([
      ['Lote', 'Data', 'Conta', 'D/C', 'Valor', 'Histórico'],
      ['A', '31/01/2026', '5.1.2.01.0001', 'D', '1.000,00', 'Aluguel'],
      ['A', '31/01/2026', '1.1.1.02.0001', 'C', '1.000,00', 'Aluguel'],
      ['B', '31/01/2026', '1.1.3.01.0001', 'D', '500,00', 'Compra'],
      ['B', '31/01/2026', '2.1.1.01.0001', 'C', '450,00', 'Compra'],
      ['C', '31/01/2026', '1.1.1.01.0001', 'D', '10', 'Datas diferentes'],
      ['C', '01/02/2026', '1.1.1.02.0001', 'C', '10', 'Datas diferentes'],
      ['D', '31/01/2026', '1.1.1.01.0001', 'D', '10', 'Linha boa'],
      ['D', '31/01/2026', '1.1.1.02.0001', 'X', '10', 'D/C inválido'],
    ]);
    expect(r.formato).toBe('PARTIDA');
    const porChave = Object.fromEntries(r.lotes.map((l) => [l.chave, l]));
    expect(porChave.A.valido).toBe(true);
    expect(porChave.B.valido).toBe(false);
    expect(porChave.B.erros[0]).toBe('Lote B desbalanceado nas linhas 4, 5: débitos R$ 500,00 ≠ créditos R$ 450,00 (diferença R$ 50,00).');
    expect(porChave.C.erros[0]).toMatch(/linhas 6, 7 têm datas diferentes/);
    expect(porChave.D.erros[0]).toMatch(/a linha 9 tem erro/);
    expect(r.resumo).toMatchObject({ lotesValidos: 1, lotesInvalidos: 3, linhasImportaveis: 2 });
  });

  it('importa numa transação, gera lançamentos compostos e permite desfazer o lote inteiro', async () => {
    const r = await validar([
      ['Lote', 'Data', 'Conta', 'D/C', 'Valor', 'Histórico', 'Documento', 'Centro de Custo'],
      ['1', '31/01/2026', '5.1.1.01.0001', 'D', '2500', 'Folha 01/2026', 'Folha', '001'],
      ['1', '31/01/2026', '2.1.2.01.0001', 'C', '2300', 'Folha 01/2026', 'Folha', ''],
      ['1', '31/01/2026', '2.1.2.02.0001', 'C', '200', 'INSS retido', 'Folha', ''],
      ['2', '05/02/2026', '1.1.1.01.0001', 'D', '100', 'Saque', '', ''],
      ['2', '05/02/2026', '1.1.1.02.0001', 'C', '100', 'Saque', '', ''],
    ]);
    const validos = r.lotes.filter((l) => l.valido).map((l) => l.rascunho!);
    const imp = await importarLotes(empresaId, validos, { arquivo: 'teste.xlsx', formato: 'PARTIDA', linhasLidas: 5, linhasImportadas: 5, linhasRejeitadas: 0 });
    const lancs = await db.lancamentos.where('importacaoId').equals(imp.id!).toArray();
    expect(lancs).toHaveLength(2);
    expect(lancs[0].partidas).toHaveLength(3);
    expect(lancs[0].partidas[2].historico).toBe('INSS retido');
    expect(lancs[0].origem).toBe('IMPORTACAO');
    expect(imp.valorTotal).toBe(250000 + 10000);

    const fev = await db.periodos.where('[empresaId+competencia]').equals([empresaId, '2026-02']).first();
    await fecharPeriodo(fev!.id!);
    await expect(desfazerImportacao(imp.id!)).rejects.toThrow(/período fechado/);
    await db.periodos.update(fev!.id!, { status: 'ABERTO' });
    expect(await desfazerImportacao(imp.id!)).toBe(2);
    expect(await db.lancamentos.count()).toBe(0);
    expect((await db.importacoes.get(imp.id!))!.desfeita).toBe(true);
  });

  it('transação única: se um lote falhar na gravação, nada é gravado', async () => {
    const r = await validar([
      ['Lote', 'Data', 'Conta', 'D/C', 'Valor', 'Histórico'],
      ['1', '10/01/2026', '1', 'D', '10', 'ok'],
      ['1', '10/01/2026', '3', 'C', '10', 'ok'],
      ['2', '10/03/2026', '1', 'D', '10', 'ok'],
      ['2', '10/03/2026', '3', 'C', '10', 'ok'],
    ]);
    const mar = await db.periodos.where('[empresaId+competencia]').equals([empresaId, '2026-03']).first();
    await fecharPeriodo(mar!.id!); // fecha depois da pré-visualização
    await expect(importarLotes(empresaId, r.lotes.map((l) => l.rascunho!), { arquivo: 'x', formato: 'PARTIDA', linhasLidas: 4, linhasImportadas: 4, linhasRejeitadas: 0 })).rejects.toThrow();
    expect(await db.lancamentos.count()).toBe(0);
    expect(await db.importacoes.count()).toBe(0);
  });
});

describe('planilhas', () => {
  it('a planilha-modelo gerada é lida e validada sem erros', async () => {
    const contas = await db.contas.where('empresaId').equals(empresaId).toArray();
    const centros = await db.centrosCusto.where('empresaId').equals(empresaId).toArray();
    const wb = montarPlanilhaModelo(contas, centros);
    expect(wb.SheetNames).toEqual(['Lançamentos', 'Por partida', 'Instruções', 'Plano de contas', 'Centros de custo']);
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const abas = lerPlanilha(buf, 'modelo.xlsx');
    for (const nome of ['Lançamentos', 'Por partida']) {
      const r = await validar(abas.find((a) => a.nome === nome)!.linhas);
      expect(r.lotes.every((l) => l.valido), JSON.stringify(r.linhas.map((l) => l.erros))).toBe(true);
    }
  });

  it('lê CSV brasileiro com ponto e vírgula sem trocar dia e mês', async () => {
    const csv = 'Data;Conta Débito;Conta Crédito;Valor;Histórico\n05/01/2026;1;3;1.234,56;Saque';
    const abas = lerPlanilha(new TextEncoder().encode(csv).buffer as ArrayBuffer, 'extrato.csv');
    const r = await validar(abas[0].linhas);
    expect(r.linhas[0]).toMatchObject({ data: '2026-01-05', valor: 123456, erros: [] });
  });

  it('exportação de lançamentos pode ser reimportada', async () => {
    const r = await validar([
      ['Lote', 'Data', 'Conta', 'D/C', 'Valor', 'Histórico'],
      ['7', '10/01/2026', '1', 'D', '10,50', 'ok'],
      ['7', '10/01/2026', '3', 'C', '10,50', 'ok'],
    ]);
    await importarLotes(empresaId, [r.lotes[0].rascunho!], { arquivo: 'x', formato: 'PARTIDA', linhasLidas: 2, linhasImportadas: 2, linhasRejeitadas: 0 });
    const lancs = await db.lancamentos.toArray();
    const contas = await db.contas.where('empresaId').equals(empresaId).toArray();
    const wb = montarPlanilhaLancamentos(lancs, criarIndiceContas(contas).porId, new Map());
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const r2 = await validar(lerPlanilha(buf, 'export.xlsx')[0].linhas);
    expect(r2.lotes[0].valido).toBe(true);
    expect(r2.lotes[0].totalDebitos).toBe(1050);
    const caixa = await contaPorCodigo(empresaId, '1.1.1.01.0001');
    expect(r2.lotes[0].rascunho!.partidas[0].contaId).toBe(caixa.id);
  });
});
