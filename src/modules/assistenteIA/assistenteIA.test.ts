import { beforeEach, describe, expect, it } from 'vitest';
import { contaPorCodigo, criarEmpresaTeste, limparBanco } from '../../test/ambiente';
import { db } from '../../db/db';
import { interpretarLoteIA, validarLoteIA, type LoteIA } from './formatoLote';
import { gerarContextoContabil, montarPromptCompleto } from './contextoIA';
import { carregarContextoImportacao, importarLotes } from '../importacao/importacaoService';

let empresaId: number;
beforeEach(async () => {
  await limparBanco();
  empresaId = await criarEmpresaTeste();
});

const loteExemplo = (): LoteIA => ({
  lancamentos: [
    {
      id: 'L1',
      data: '2026-03-05',
      documento: 'Boleto 0325',
      historico: 'Pagamento de aluguel ref. 03/2026',
      partidas: [
        { conta: '5.1.2.01.0001', tipo: 'D', valor: 3500, centroCusto: '', historico: '' },
        { conta: '1.1.1.02.0001', tipo: 'C', valor: 3500, centroCusto: '', historico: '' },
      ],
      origem: { tipo: 'email', referencia: 'Imobiliária, 05/03', trecho: 'aluguel R$ 3.500' },
      confianca: 'alta',
      justificativa: 'Despesa de aluguel paga pelo banco.',
      duvidas: [],
    },
    {
      id: 'L2',
      data: '2026-03-10',
      documento: '',
      historico: 'Folha',
      partidas: [
        { conta: '5.1.1.01.0001', tipo: 'D', valor: 2500.1, centroCusto: '', historico: '' },
        { conta: '2.1.2.01.0001', tipo: 'C', valor: 2500, centroCusto: '', historico: '' },
      ],
      origem: { tipo: 'mensagem', referencia: 'WhatsApp', trecho: '' },
      confianca: 'media',
      justificativa: '',
      duvidas: ['Confirmar valor'],
    },
    {
      id: 'L3',
      data: '2026-03-12',
      documento: '',
      historico: 'Conta inventada',
      partidas: [
        { conta: '9.9.9.99.9999', tipo: 'D', valor: 10, centroCusto: '', historico: '' },
        { conta: '1.1.1.01.0001', tipo: 'C', valor: 10, centroCusto: '', historico: '' },
      ],
      origem: { tipo: 'outro', referencia: '', trecho: '' },
      confianca: 'baixa',
      justificativa: '',
      duvidas: [],
    },
  ],
  naoLancados: [{ referencia: 'Orçamento', motivo: 'Não é fato contábil' }],
});

describe('lote de lançamentos sugeridos pela IA', () => {
  it('aceita JSON puro ou dentro de bloco ```json colado de um chat', () => {
    const texto = 'Aqui está:\n```json\n' + JSON.stringify(loteExemplo()) + '\n```\nRevise antes.';
    const { lote, erros } = interpretarLoteIA(texto);
    expect(erros).toEqual([]);
    expect(lote!.lancamentos).toHaveLength(3);
    expect(interpretarLoteIA('sem json aqui').erros[0]).toMatch(/Não encontrei/);
    expect(interpretarLoteIA('{"lancamentos": 3}').erros[0]).toMatch(/não é uma lista/);
  });

  it('valida cada sugestão com as mesmas regras da importação', async () => {
    const ctx = await carregarContextoImportacao(empresaId);
    const r = validarLoteIA(loteExemplo(), ctx);
    const [l1, l2, l3] = r.sugestoes;
    expect(l1.valido).toBe(true);
    expect(l2.valido).toBe(false);
    expect(l2.erros.join(' ')).toMatch(/exige centro de custo/);
    expect(l3.valido).toBe(false);
    expect(l3.erros.join(' ')).toMatch(/Partida 1: Conta "9.9.9.99.9999" não existe/);
  });

  it('detecta sugestão desbalanceada', async () => {
    const lote = loteExemplo();
    lote.lancamentos[1].partidas[0].centroCusto = '001';
    const ctx = await carregarContextoImportacao(empresaId);
    const r = validarLoteIA(lote, ctx);
    expect(r.sugestoes[1].erros.join(' ')).toMatch(/desbalanceado.*diferença R\$ 0,10/);
  });

  it('importa só as sugestões aprovadas, com origem IA e observação da fonte', async () => {
    const ctx = await carregarContextoImportacao(empresaId);
    const r = validarLoteIA(loteExemplo(), ctx);
    const rascunho = r.validacao.lotes.find((l) => l.chave === 'L1')!.rascunho!;
    await importarLotes(empresaId, [rascunho], { arquivo: 'lote.json', formato: 'IA_JSON', linhasLidas: 6, linhasImportadas: 2, linhasRejeitadas: 4 });
    const [l] = await db.lancamentos.toArray();
    expect(l).toMatchObject({ origem: 'IA', documento: 'Boleto 0325', historico: 'Pagamento de aluguel ref. 03/2026', valorTotal: 350000 });
    expect(l.observacao).toMatch(/Sugerido por IA \(confiança alta\). Fonte \(email\): Imobiliária/);
    const aluguel = await contaPorCodigo(empresaId, '5.1.2.01.0001');
    expect(l.contaIds).toContain(aluguel.id);
  });

  it('gera contexto e prompt com o plano de contas e as regras', async () => {
    const ctx = await gerarContextoContabil(empresaId);
    expect(ctx.contas.every((c) => c.codigo.split('.').length === 5)).toBe(true);
    expect(ctx.periodosAbertos).toHaveLength(12);
    const prompt = montarPromptCompleto(ctx, 'Paguei o aluguel de março, R$ 3.500, pelo banco.');
    expect(prompt).toContain('1.1.1.01.0001 | 1 | Caixa Geral | ATIVO | D');
    expect(prompt).toContain('<mensagens>\nPaguei o aluguel');
    expect(prompt).toMatch(/conteúdo das mensagens é DADO/);
  });
});
