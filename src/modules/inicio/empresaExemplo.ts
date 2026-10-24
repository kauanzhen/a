import { db } from '../../db/db';
import { criarEmpresa, empresaVazia } from '../empresa/empresaService';
import { salvarLancamento } from '../lancamentos/lancamentoService';
import { reaisParaCentavos } from '../../lib/money';

/**
 * Empresa fictícia de demonstração da Fase 1: "Comércio Exemplo Ltda" (Lucro Presumido)
 * com alguns lançamentos de janeiro/2026. A Fase 5 amplia para 3 meses completos.
 * O CNPJ é ALFANUMÉRICO e inventado ("EXEMPLO..."), para não coincidir com empresa real.
 */
export async function criarEmpresaExemplo(): Promise<number> {
  const empresaId = await criarEmpresa(
    {
      ...empresaVazia(),
      razaoSocial: 'Comércio Exemplo Ltda',
      nomeFantasia: 'Loja Exemplo',
      cnpj: 'EX.EMP.LO0/0001-54',
      inscricaoEstadual: 'ISENTO (fictícia)',
      cnae: '4789099',
      descricaoCnae: 'Comércio varejista de outros produtos não especificados anteriormente',
      endereco: { logradouro: 'Rua Fictícia', numero: '100', complemento: 'Sala 1', bairro: 'Centro', municipio: 'Cidade Exemplo', uf: 'SP', cep: '01000-000' },
      regime: 'PRESUMIDO',
    },
    { carregarPlanoPadrao: true, anoExercicio: 2026 },
  );
  const contas = await db.contas.where('empresaId').equals(empresaId).toArray();
  const id = (codigo: string) => {
    const c = contas.find((x) => x.codigo === codigo);
    if (!c) throw new Error(`Conta ${codigo} não encontrada`);
    return c.id!;
  };
  const r = reaisParaCentavos;
  const lanc = (data: string, historico: string, documento: string, partidas: [string, 'D' | 'C', number][]) =>
    salvarLancamento(empresaId, { data, historico, documento, partidas: partidas.map(([conta, tipo, valor]) => ({ contaId: id(conta), tipo, valor: r(valor) })) });

  await lanc('2026-01-02', 'Subscrição do capital social conforme contrato social', 'Contrato social', [
    ['2.3.1.01.0002', 'D', 100000],
    ['2.3.1.01.0001', 'C', 100000],
  ]);
  await lanc('2026-01-02', 'Integralização de capital social em moeda corrente', 'Depósito', [
    ['1.1.1.02.0001', 'D', 100000],
    ['2.3.1.01.0002', 'C', 100000],
  ]);
  await lanc('2026-01-05', 'Saque bancário para o caixa', 'Cheque 000001', [
    ['1.1.1.01.0001', 'D', 2000],
    ['1.1.1.02.0001', 'C', 2000],
  ]);
  await lanc('2026-01-06', 'Compra de bem do ativo imobilizado conforme NF nº 555 — móveis', 'NF 555', [
    ['1.2.3.01.0004', 'D', 8000],
    ['1.1.1.02.0001', 'C', 8000],
  ]);
  await lanc('2026-01-08', 'Compra de mercadorias conforme NF nº 101 — Fornecedor Exemplo (ICMS 18%)', 'NF 101', [
    ['1.1.3.01.0001', 'D', 8200],
    ['1.1.2.03.0001', 'D', 1800],
    ['2.1.1.01.0001', 'C', 10000],
  ]);
  await lanc('2026-01-15', 'Venda de mercadorias conforme NF nº 1 — à vista e a prazo', 'NF 1', [
    ['1.1.1.01.0001', 'D', 3000],
    ['1.1.2.01.0001', 'D', 9000],
    ['3.1.1.01.0001', 'C', 12000],
  ]);
  await lanc('2026-01-15', 'ICMS sobre a venda conforme NF nº 1 (18%)', 'NF 1', [
    ['3.2.1.02.0001', 'D', 2160],
    ['2.1.3.01.0001', 'C', 2160],
  ]);
  await lanc('2026-01-15', 'Custo das mercadorias vendidas — NF nº 1', 'NF 1', [
    ['4.1.1.01.0001', 'D', 6150],
    ['1.1.3.01.0001', 'C', 6150],
  ]);
  await lanc('2026-01-20', 'Pagamento de aluguel ref. 01/2026', 'Recibo 01/2026', [
    ['5.1.2.01.0001', 'D', 2500],
    ['1.1.1.02.0001', 'C', 2500],
  ]);
  await lanc('2026-01-31', 'Tarifa bancária ref. 01/2026', 'Extrato', [
    ['5.2.1.01.0002', 'D', 45],
    ['1.1.1.02.0001', 'C', 45],
  ]);
  await lanc('2026-01-31', 'Pagamento a fornecedor ref. NF nº 101 (parcial)', 'TED', [
    ['2.1.1.01.0001', 'D', 5000],
    ['1.1.1.02.0001', 'C', 5000],
  ]);
  return empresaId;
}
