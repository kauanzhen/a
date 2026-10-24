import type { CentroCusto, HistoricoPadrao } from '../../db/types';

/** Históricos padrão sugeridos para uma empresa nova (o usuário pode editar). */
export const HISTORICOS_PADRAO: string[] = [
  'Integralização de capital social em moeda corrente',
  'Compra de mercadorias conforme NF nº',
  'Venda de mercadorias conforme NF nº',
  'Pagamento a fornecedor ref. NF nº',
  'Recebimento de cliente ref. NF nº',
  'Pagamento de salários ref.',
  'Pagamento de aluguel ref.',
  'Tarifa bancária ref.',
  'Depósito bancário',
  'Saque bancário para o caixa',
  'Provisão de férias ref.',
  'Provisão de 13º salário ref.',
  'Depreciação mensal ref.',
  'Pagamento de energia elétrica ref.',
  'Captação de empréstimo bancário',
  'Pagamento de tributos ref.',
  'Estorno do lançamento nº',
  'Apropriação de juros ref.',
  'Compra de bem do ativo imobilizado conforme NF nº',
  'Pagamento de honorários contábeis ref.',
];

export function historicosPadrao(empresaId: number): HistoricoPadrao[] {
  return HISTORICOS_PADRAO.map((texto, i) => ({ empresaId, codigo: i + 1, texto, ativo: true }));
}

export function centrosCustoPadrao(empresaId: number): CentroCusto[] {
  return [
    { empresaId, codigo: '001', nome: 'Administrativo', ativo: true },
    { empresaId, codigo: '002', nome: 'Comercial', ativo: true },
    { empresaId, codigo: '003', nome: 'Logística', ativo: true },
  ];
}
