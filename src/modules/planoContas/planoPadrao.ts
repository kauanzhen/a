import type { Conta, GrupoConta, Natureza } from '../../db/types';
import { MASCARA_PADRAO, interpretarMascara, nivelDoCodigo, reformatarCodigo, compararCodigos } from '../../lib/mascara';

/**
 * Plano de contas padrão para empresa comercial/serviços, estruturado conforme a Lei 6.404/76
 * (art. 178) e inspirado no Plano de Contas Referencial do SPED ECD.
 *
 * Convenções:
 *  - Escrito na máscara 9.9.9.99.9999 (5 níveis). Contas do 5º nível são analíticas.
 *  - Nomes iniciados por "(-)" são contas redutoras: a natureza é invertida em relação ao grupo.
 *  - A "conta referencial" é ILUSTRATIVA (derivada do próprio código); confira com a tabela
 *    oficial da RFB antes de usar em qualquer obrigação real. Ver PREMISSAS.md.
 */
type LinhaPlano = [codigo: string, nome: string, opcoes?: { exigeCC?: boolean }];

const CC = { exigeCC: true };

export const PLANO_PADRAO: LinhaPlano[] = [
  ['1', 'ATIVO'],
  ['1.1', 'ATIVO CIRCULANTE'],
  ['1.1.1', 'DISPONÍVEL'],
  ['1.1.1.01', 'Caixa'],
  ['1.1.1.01.0001', 'Caixa Geral'],
  ['1.1.1.02', 'Bancos Conta Movimento'],
  ['1.1.1.02.0001', 'Banco Exemplo S.A. - C/C'],
  ['1.1.1.02.0002', 'Banco Didático S.A. - C/C'],
  ['1.1.1.03', 'Aplicações Financeiras de Liquidez Imediata'],
  ['1.1.1.03.0001', 'Aplicação CDB Liquidez Diária'],
  ['1.1.2', 'CRÉDITOS'],
  ['1.1.2.01', 'Clientes'],
  ['1.1.2.01.0001', 'Clientes Nacionais'],
  ['1.1.2.01.0002', '(-) Perdas Estimadas com Créditos de Liquidação Duvidosa'],
  ['1.1.2.02', 'Outros Créditos'],
  ['1.1.2.02.0001', 'Adiantamentos a Fornecedores'],
  ['1.1.2.02.0002', 'Adiantamentos a Empregados'],
  ['1.1.2.02.0003', 'Adiantamento de Férias'],
  ['1.1.2.03', 'Tributos a Recuperar'],
  ['1.1.2.03.0001', 'ICMS a Recuperar'],
  ['1.1.2.03.0002', 'IPI a Recuperar'],
  ['1.1.2.03.0003', 'PIS a Recuperar'],
  ['1.1.2.03.0004', 'COFINS a Recuperar'],
  ['1.1.2.03.0005', 'IRRF a Compensar'],
  ['1.1.2.03.0006', 'IRPJ a Compensar'],
  ['1.1.2.03.0007', 'CSLL a Compensar'],
  ['1.1.3', 'ESTOQUES'],
  ['1.1.3.01', 'Estoques'],
  ['1.1.3.01.0001', 'Mercadorias para Revenda'],
  ['1.1.3.01.0002', 'Materiais de Consumo'],
  ['1.1.4', 'DESPESAS DO EXERCÍCIO SEGUINTE'],
  ['1.1.4.01', 'Despesas Antecipadas'],
  ['1.1.4.01.0001', 'Seguros a Apropriar'],
  ['1.1.4.01.0002', 'Assinaturas e Anuidades a Apropriar'],
  ['1.2', 'ATIVO NÃO CIRCULANTE'],
  ['1.2.1', 'REALIZÁVEL A LONGO PRAZO'],
  ['1.2.1.01', 'Créditos de Longo Prazo'],
  ['1.2.1.01.0001', 'Clientes - Longo Prazo'],
  ['1.2.1.01.0002', 'Depósitos Judiciais'],
  ['1.2.1.01.0003', 'Créditos com Sócios e Pessoas Ligadas'],
  ['1.2.2', 'INVESTIMENTOS'],
  ['1.2.2.01', 'Participações Societárias'],
  ['1.2.2.01.0001', 'Participações em Outras Empresas'],
  ['1.2.2.02', 'Outros Investimentos'],
  ['1.2.2.02.0001', 'Propriedades para Investimento'],
  ['1.2.3', 'IMOBILIZADO'],
  ['1.2.3.01', 'Bens em Operação'],
  ['1.2.3.01.0001', 'Terrenos'],
  ['1.2.3.01.0002', 'Edificações'],
  ['1.2.3.01.0003', 'Máquinas e Equipamentos'],
  ['1.2.3.01.0004', 'Móveis e Utensílios'],
  ['1.2.3.01.0005', 'Veículos'],
  ['1.2.3.01.0006', 'Computadores e Periféricos'],
  ['1.2.3.02', '(-) Depreciação Acumulada'],
  ['1.2.3.02.0001', '(-) Depreciação Acumulada - Edificações'],
  ['1.2.3.02.0002', '(-) Depreciação Acumulada - Máquinas e Equipamentos'],
  ['1.2.3.02.0003', '(-) Depreciação Acumulada - Móveis e Utensílios'],
  ['1.2.3.02.0004', '(-) Depreciação Acumulada - Veículos'],
  ['1.2.3.02.0005', '(-) Depreciação Acumulada - Computadores e Periféricos'],
  ['1.2.4', 'INTANGÍVEL'],
  ['1.2.4.01', 'Ativos Intangíveis'],
  ['1.2.4.01.0001', 'Softwares'],
  ['1.2.4.01.0002', 'Marcas e Patentes'],
  ['1.2.4.02', '(-) Amortização Acumulada'],
  ['1.2.4.02.0001', '(-) Amortização Acumulada - Softwares'],

  ['2', 'PASSIVO E PATRIMÔNIO LÍQUIDO'],
  ['2.1', 'PASSIVO CIRCULANTE'],
  ['2.1.1', 'FORNECEDORES'],
  ['2.1.1.01', 'Fornecedores'],
  ['2.1.1.01.0001', 'Fornecedores Nacionais'],
  ['2.1.2', 'OBRIGAÇÕES TRABALHISTAS E PREVIDENCIÁRIAS'],
  ['2.1.2.01', 'Obrigações com Pessoal'],
  ['2.1.2.01.0001', 'Salários e Ordenados a Pagar'],
  ['2.1.2.01.0002', 'Pró-Labore a Pagar'],
  ['2.1.2.01.0003', 'Rescisões a Pagar'],
  ['2.1.2.01.0004', 'Férias a Pagar'],
  ['2.1.2.02', 'Encargos Sociais a Recolher'],
  ['2.1.2.02.0001', 'INSS a Recolher'],
  ['2.1.2.02.0002', 'FGTS a Recolher'],
  ['2.1.2.03', 'Provisões Trabalhistas'],
  ['2.1.2.03.0001', 'Provisão de Férias'],
  ['2.1.2.03.0002', 'Provisão de 13º Salário'],
  ['2.1.2.03.0003', 'INSS sobre Provisões'],
  ['2.1.2.03.0004', 'FGTS sobre Provisões'],
  ['2.1.3', 'OBRIGAÇÕES TRIBUTÁRIAS'],
  ['2.1.3.01', 'Impostos e Contribuições a Recolher'],
  ['2.1.3.01.0001', 'ICMS a Recolher'],
  ['2.1.3.01.0002', 'IPI a Recolher'],
  ['2.1.3.01.0003', 'PIS a Recolher'],
  ['2.1.3.01.0004', 'COFINS a Recolher'],
  ['2.1.3.01.0005', 'IRPJ a Recolher'],
  ['2.1.3.01.0006', 'CSLL a Recolher'],
  ['2.1.3.01.0007', 'IRRF a Recolher'],
  ['2.1.3.01.0008', 'ISS a Recolher'],
  ['2.1.3.01.0009', 'Simples Nacional (DAS) a Recolher'],
  ['2.1.4', 'EMPRÉSTIMOS E FINANCIAMENTOS'],
  ['2.1.4.01', 'Empréstimos e Financiamentos'],
  ['2.1.4.01.0001', 'Empréstimos Bancários - Curto Prazo'],
  ['2.1.4.01.0002', '(-) Encargos Financeiros a Transcorrer - Curto Prazo'],
  ['2.1.5', 'OUTRAS OBRIGAÇÕES'],
  ['2.1.5.01', 'Outras Contas a Pagar'],
  ['2.1.5.01.0001', 'Aluguéis a Pagar'],
  ['2.1.5.01.0002', 'Contas de Consumo a Pagar (Energia, Água, Telefone)'],
  ['2.1.5.01.0003', 'Adiantamentos de Clientes'],
  ['2.1.5.01.0004', 'Lucros e Dividendos a Pagar'],
  ['2.2', 'PASSIVO NÃO CIRCULANTE'],
  ['2.2.1', 'EXIGÍVEL A LONGO PRAZO'],
  ['2.2.1.01', 'Empréstimos e Financiamentos - Longo Prazo'],
  ['2.2.1.01.0001', 'Empréstimos Bancários - Longo Prazo'],
  ['2.2.1.01.0002', '(-) Encargos Financeiros a Transcorrer - Longo Prazo'],
  ['2.2.1.02', 'Outras Obrigações de Longo Prazo'],
  ['2.2.1.02.0001', 'Empréstimos de Sócios'],
  ['2.3', 'PATRIMÔNIO LÍQUIDO'],
  ['2.3.1', 'CAPITAL SOCIAL'],
  ['2.3.1.01', 'Capital Social'],
  ['2.3.1.01.0001', 'Capital Subscrito'],
  ['2.3.1.01.0002', '(-) Capital a Integralizar'],
  ['2.3.2', 'RESERVAS'],
  ['2.3.2.01', 'Reservas de Capital'],
  ['2.3.2.01.0001', 'Reservas de Capital'],
  ['2.3.2.02', 'Reservas de Lucros'],
  ['2.3.2.02.0001', 'Reserva Legal'],
  ['2.3.2.02.0002', 'Reserva de Retenção de Lucros'],
  ['2.3.3', 'AJUSTES DE AVALIAÇÃO PATRIMONIAL'],
  ['2.3.3.01', 'Ajustes de Avaliação Patrimonial'],
  ['2.3.3.01.0001', 'Ajustes de Avaliação Patrimonial'],
  ['2.3.4', 'LUCROS OU PREJUÍZOS ACUMULADOS'],
  ['2.3.4.01', 'Lucros ou Prejuízos Acumulados'],
  ['2.3.4.01.0001', 'Lucros ou Prejuízos Acumulados'],

  ['3', 'RECEITAS'],
  ['3.1', 'RECEITA OPERACIONAL BRUTA'],
  ['3.1.1', 'RECEITA DE VENDAS E SERVIÇOS'],
  ['3.1.1.01', 'Vendas de Mercadorias'],
  ['3.1.1.01.0001', 'Vendas de Mercadorias - Mercado Interno'],
  ['3.1.1.02', 'Prestação de Serviços'],
  ['3.1.1.02.0001', 'Receita de Serviços Prestados'],
  ['3.2', '(-) DEDUÇÕES DA RECEITA BRUTA'],
  ['3.2.1', '(-) DEDUÇÕES DA RECEITA'],
  ['3.2.1.01', '(-) Devoluções e Abatimentos'],
  ['3.2.1.01.0001', '(-) Devoluções de Vendas'],
  ['3.2.1.01.0002', '(-) Descontos Incondicionais Concedidos'],
  ['3.2.1.02', '(-) Tributos sobre Vendas e Serviços'],
  ['3.2.1.02.0001', '(-) ICMS sobre Vendas'],
  ['3.2.1.02.0002', '(-) PIS sobre Faturamento'],
  ['3.2.1.02.0003', '(-) COFINS sobre Faturamento'],
  ['3.2.1.02.0004', '(-) ISS sobre Serviços'],
  ['3.2.1.02.0005', '(-) Simples Nacional sobre Receita'],
  ['3.3', 'RECEITAS FINANCEIRAS'],
  ['3.3.1', 'RECEITAS FINANCEIRAS'],
  ['3.3.1.01', 'Receitas Financeiras'],
  ['3.3.1.01.0001', 'Juros Ativos'],
  ['3.3.1.01.0002', 'Rendimentos de Aplicações Financeiras'],
  ['3.3.1.01.0003', 'Descontos Obtidos'],
  ['3.4', 'OUTRAS RECEITAS'],
  ['3.4.1', 'OUTRAS RECEITAS OPERACIONAIS'],
  ['3.4.1.01', 'Outras Receitas'],
  ['3.4.1.01.0001', 'Receita na Venda de Ativo Imobilizado'],
  ['3.4.1.01.0002', 'Recuperação de Despesas'],

  ['4', 'CUSTOS'],
  ['4.1', 'CUSTO DAS VENDAS'],
  ['4.1.1', 'CUSTO DAS MERCADORIAS E SERVIÇOS'],
  ['4.1.1.01', 'Custo das Mercadorias Vendidas'],
  ['4.1.1.01.0001', 'CMV - Custo das Mercadorias Vendidas'],
  ['4.1.1.02', 'Custo dos Serviços Prestados'],
  ['4.1.1.02.0001', 'CSP - Custo dos Serviços Prestados'],

  ['5', 'DESPESAS'],
  ['5.1', 'DESPESAS OPERACIONAIS'],
  ['5.1.1', 'DESPESAS COM PESSOAL'],
  ['5.1.1.01', 'Remunerações'],
  ['5.1.1.01.0001', 'Salários e Ordenados', CC],
  ['5.1.1.01.0002', 'Horas Extras e DSR', CC],
  ['5.1.1.01.0003', 'Adicionais (Noturno, Insalubridade, Periculosidade)', CC],
  ['5.1.1.01.0004', 'Férias', CC],
  ['5.1.1.01.0005', '13º Salário', CC],
  ['5.1.1.01.0006', 'Pró-Labore', CC],
  ['5.1.1.01.0007', 'Indenizações e Aviso Prévio', CC],
  ['5.1.1.02', 'Encargos Sociais'],
  ['5.1.1.02.0001', 'INSS Patronal', CC],
  ['5.1.1.02.0002', 'FGTS', CC],
  ['5.1.1.02.0003', 'RAT/GILRAT', CC],
  ['5.1.1.02.0004', 'Contribuições a Terceiros', CC],
  ['5.1.1.03', 'Benefícios'],
  ['5.1.1.03.0001', 'Vale-Transporte', CC],
  ['5.1.1.03.0002', 'Vale-Refeição e Alimentação', CC],
  ['5.1.2', 'DESPESAS ADMINISTRATIVAS'],
  ['5.1.2.01', 'Despesas Gerais e Administrativas'],
  ['5.1.2.01.0001', 'Aluguéis'],
  ['5.1.2.01.0002', 'Energia Elétrica'],
  ['5.1.2.01.0003', 'Água e Esgoto'],
  ['5.1.2.01.0004', 'Telefone e Internet'],
  ['5.1.2.01.0005', 'Material de Escritório'],
  ['5.1.2.01.0006', 'Honorários Contábeis'],
  ['5.1.2.01.0007', 'Seguros'],
  ['5.1.2.01.0008', 'Manutenção e Reparos'],
  ['5.1.2.01.0009', 'Depreciação'],
  ['5.1.2.01.0010', 'Amortização'],
  ['5.1.2.01.0011', 'Material de Limpeza e Consumo'],
  ['5.1.3', 'DESPESAS COM VENDAS'],
  ['5.1.3.01', 'Despesas Comerciais'],
  ['5.1.3.01.0001', 'Comissões sobre Vendas'],
  ['5.1.3.01.0002', 'Propaganda e Publicidade'],
  ['5.1.3.01.0003', 'Fretes sobre Vendas'],
  ['5.1.3.01.0004', 'Perdas Estimadas com Créditos (PECLD)'],
  ['5.1.4', 'DESPESAS TRIBUTÁRIAS'],
  ['5.1.4.01', 'Impostos, Taxas e Contribuições'],
  ['5.1.4.01.0001', 'IPTU, IPVA e Taxas'],
  ['5.1.4.01.0002', 'Taxas e Licenças de Funcionamento'],
  ['5.2', 'DESPESAS FINANCEIRAS'],
  ['5.2.1', 'DESPESAS FINANCEIRAS'],
  ['5.2.1.01', 'Despesas Financeiras'],
  ['5.2.1.01.0001', 'Juros Passivos'],
  ['5.2.1.01.0002', 'Tarifas Bancárias'],
  ['5.2.1.01.0003', 'Descontos Concedidos'],
  ['5.2.1.01.0004', 'IOF'],
  ['5.2.1.01.0005', 'Multas e Juros de Mora'],
  ['5.3', 'OUTRAS DESPESAS'],
  ['5.3.1', 'OUTRAS DESPESAS OPERACIONAIS'],
  ['5.3.1.01', 'Outras Despesas'],
  ['5.3.1.01.0001', 'Custo do Ativo Imobilizado Baixado'],
  ['5.3.1.01.0002', 'Perdas Diversas'],
  ['5.4', 'TRIBUTOS SOBRE O LUCRO'],
  ['5.4.1', 'IRPJ E CSLL'],
  ['5.4.1.01', 'Tributos sobre o Lucro'],
  ['5.4.1.01.0001', 'IRPJ'],
  ['5.4.1.01.0002', 'CSLL'],
];

/** Grupo da conta pelo código (raiz do plano). Na raiz 2, o subgrupo 2.3 é o Patrimônio Líquido. */
export function grupoPorCodigo(codigo: string): GrupoConta {
  const [primeiro, segundo] = codigo.split(/[.\-/]/);
  switch (Number(primeiro)) {
    case 1:
      return 'ATIVO';
    case 2:
      return Number(segundo) === 3 ? 'PL' : 'PASSIVO';
    case 3:
      return 'RECEITA';
    case 4:
      return 'CUSTO';
    default:
      return 'DESPESA';
  }
}

export function naturezaDoGrupo(grupo: GrupoConta): Natureza {
  return grupo === 'ATIVO' || grupo === 'CUSTO' || grupo === 'DESPESA' ? 'D' : 'C';
}

export function ehRedutora(nome: string): boolean {
  return nome.trim().startsWith('(-)');
}

/** Conta referencial ILUSTRATIVA no formato X.XX.XX.XX.XX derivada do código padrão. */
export function referencialIlustrativa(codigoPadrao: string): string | undefined {
  const p = codigoPadrao.split('.');
  if (p.length !== 5) return undefined;
  return [p[0], p[1].padStart(2, '0'), p[2].padStart(2, '0'), p[3], String(Number(p[4])).padStart(2, '0')].join('.');
}

/**
 * Gera as contas do plano padrão já convertidas para a máscara da empresa.
 * Lança erro se a máscara não comportar o plano (precisa de 5 níveis).
 */
export function gerarPlanoPadrao(empresaId: number, mascaraEmpresa: string): Conta[] {
  const padrao = interpretarMascara(MASCARA_PADRAO);
  const destino = interpretarMascara(mascaraEmpresa);
  const codigos = new Set(PLANO_PADRAO.map(([c]) => c));
  const contas: Conta[] = [];
  let reduzido = 1;
  const ordenado = [...PLANO_PADRAO].sort((a, b) => compararCodigos(a[0], b[0]));
  for (const [codigo, nome, opcoes] of ordenado) {
    const temFilho = [...codigos].some((c) => c.startsWith(codigo + '.'));
    const tipo = temFilho ? 'S' : 'A';
    const grupo = grupoPorCodigo(codigo);
    let natureza = naturezaDoGrupo(grupo);
    if (ehRedutora(nome)) natureza = natureza === 'D' ? 'C' : 'D';
    const codigoEmpresa = reformatarCodigo(codigo, padrao, destino);
    contas.push({
      empresaId,
      codigo: codigoEmpresa,
      reduzido: tipo === 'A' ? reduzido++ : undefined,
      nome,
      tipo,
      natureza,
      nivel: nivelDoCodigo(codigoEmpresa, destino) ?? 0,
      grupo,
      contaReferencial: tipo === 'A' ? referencialIlustrativa(codigo) : undefined,
      exigeCentroCusto: Boolean(opcoes?.exigeCC),
      ativa: true,
    });
  }
  return contas;
}

/** Códigos (na máscara padrão) de contas usadas por funções automáticas do sistema. */
export const CONTAS_CHAVE = {
  caixa: '1.1.1.01.0001',
  banco: '1.1.1.02.0001',
  clientes: '1.1.2.01.0001',
  estoque: '1.1.3.01.0001',
  fornecedores: '2.1.1.01.0001',
  capitalSubscrito: '2.3.1.01.0001',
  capitalAIntegralizar: '2.3.1.01.0002',
  lucrosAcumulados: '2.3.4.01.0001',
  vendas: '3.1.1.01.0001',
  cmv: '4.1.1.01.0001',
  aluguel: '5.1.2.01.0001',
  energia: '5.1.2.01.0002',
  tarifas: '5.2.1.01.0002',
} as const;
