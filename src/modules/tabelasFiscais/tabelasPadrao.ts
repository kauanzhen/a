import type { TabelaFiscal } from '../../db/types';

/**
 * Tabelas fiscais iniciais. São os valores mais recentes conhecidos na data de criação
 * deste software e TODAS vêm marcadas como "verificar vigência": confira com a fonte oficial
 * e edite na tela "Tabelas fiscais" antes de usar. Valores monetários em centavos.
 */
export const TABELAS_PADRAO: TabelaFiscal[] = [
  {
    tipo: 'SALARIO_MINIMO',
    conjunto: 'NACIONAL',
    descricao: 'Salário mínimo nacional 2025',
    vigenciaInicio: '2025-01-01',
    fonte: 'Decreto nº 12.342/2024',
    verificarVigencia: true,
    dados: { valor: 151800 },
  },
  {
    tipo: 'SALARIO_MINIMO',
    conjunto: 'NACIONAL',
    descricao: 'Salário mínimo nacional 2026',
    vigenciaInicio: '2026-01-01',
    fonte: 'Decreto de reajuste do salário mínimo para 2026 (conferir número e valor)',
    verificarVigencia: true,
    dados: { valor: 162100 },
  },
  {
    tipo: 'INSS',
    conjunto: 'EMPREGADO',
    descricao: 'INSS empregado/avulso/doméstico 2025 (progressiva)',
    vigenciaInicio: '2025-01-01',
    fonte: 'Portaria Interministerial MPS/MF nº 6/2025',
    verificarVigencia: true,
    dados: {
      faixas: [
        { ate: 151800, aliquota: 7.5 },
        { ate: 279388, aliquota: 9 },
        { ate: 419083, aliquota: 12 },
        { ate: 815741, aliquota: 14 },
      ],
    },
  },
  {
    tipo: 'INSS',
    conjunto: 'EMPREGADO',
    descricao: 'INSS empregado/avulso/doméstico 2026 (progressiva)',
    vigenciaInicio: '2026-01-01',
    fonte: 'Portaria Interministerial MPS/MF de jan/2026 (conferir número e faixas)',
    verificarVigencia: true,
    dados: {
      faixas: [
        { ate: 162100, aliquota: 7.5 },
        { ate: 290284, aliquota: 9 },
        { ate: 435427, aliquota: 12 },
        { ate: 847555, aliquota: 14 },
      ],
    },
  },
  {
    tipo: 'IRRF',
    conjunto: 'MENSAL',
    descricao: 'IRRF mensal a partir de maio/2025',
    vigenciaInicio: '2025-05-01',
    fonte: 'MP nº 1.294/2025 (conferir a lei de conversão)',
    verificarVigencia: true,
    dados: {
      faixas: [
        { ate: 242880, aliquota: 0, deducao: 0 },
        { ate: 282665, aliquota: 7.5, deducao: 18216 },
        { ate: 375105, aliquota: 15, deducao: 39416 },
        { ate: 466468, aliquota: 22.5, deducao: 67549 },
        { ate: null, aliquota: 27.5, deducao: 90873 },
      ],
      deducaoDependente: 18959,
      descontoSimplificado: 60720,
    },
  },
  {
    tipo: 'IRRF',
    conjunto: 'MENSAL',
    descricao: 'IRRF mensal 2026 — tabela progressiva + redução da Lei 15.270/2025 (isenção até R$ 5.000)',
    vigenciaInicio: '2026-01-01',
    fonte: 'Lei nº 15.270/2025 (conferir regulamentação da RFB)',
    verificarVigencia: true,
    dados: {
      faixas: [
        { ate: 242880, aliquota: 0, deducao: 0 },
        { ate: 282665, aliquota: 7.5, deducao: 18216 },
        { ate: 375105, aliquota: 15, deducao: 39416 },
        { ate: 466468, aliquota: 22.5, deducao: 67549 },
        { ate: null, aliquota: 27.5, deducao: 90873 },
      ],
      deducaoDependente: 18959,
      descontoSimplificado: 60720,
      redutor: {
        ativo: true,
        limiteIsencao: 500000,
        valorMaximo: 31289,
        limiteFaixa: 735000,
        constante: 97862,
        fator: 0.133145,
        observacao:
          'Redução mensal: até R$ 5.000,00 de rendimentos tributáveis, reduz até R$ 312,89 (zera o imposto); de R$ 5.000,01 a R$ 7.350,00, redução = R$ 978,62 − 0,133145 × rendimentos. Ver PREMISSAS.md.',
      },
    },
  },
  {
    tipo: 'ALIQUOTAS',
    conjunto: 'FOLHA',
    descricao: 'Encargos e parâmetros da folha de pagamento',
    vigenciaInicio: '2025-01-01',
    fonte: 'CLT, Lei 8.036/90 (FGTS), Lei 8.212/91 (INSS patronal), Lei 7.418/85 (VT)',
    verificarVigencia: true,
    dados: {
      itens: [
        { chave: 'FGTS', descricao: 'FGTS (empregado CLT)', valor: 8, unidade: '%' },
        { chave: 'FGTS_APRENDIZ', descricao: 'FGTS (menor aprendiz)', valor: 2, unidade: '%' },
        { chave: 'INSS_PATRONAL', descricao: 'INSS patronal (fora do Simples)', valor: 20, unidade: '%' },
        { chave: 'RAT', descricao: 'RAT/GILRAT (1%, 2% ou 3%)', valor: 2, unidade: '%' },
        { chave: 'FAP', descricao: 'FAP (multiplicador do RAT)', valor: 1, unidade: 'fator' },
        { chave: 'TERCEIROS', descricao: 'Terceiros/outras entidades (ex.: FPAS 515)', valor: 5.8, unidade: '%' },
        { chave: 'VT_DESCONTO', descricao: 'Desconto máximo de vale-transporte', valor: 6, unidade: '%' },
        { chave: 'HE_50', descricao: 'Adicional de hora extra (dias úteis)', valor: 50, unidade: '%' },
        { chave: 'HE_100', descricao: 'Adicional de hora extra (domingos/feriados)', valor: 100, unidade: '%' },
        { chave: 'ADIC_NOTURNO', descricao: 'Adicional noturno urbano', valor: 20, unidade: '%' },
        { chave: 'INSALUBRIDADE_MIN', descricao: 'Insalubridade grau mínimo (sobre o salário mínimo)', valor: 10, unidade: '%' },
        { chave: 'INSALUBRIDADE_MED', descricao: 'Insalubridade grau médio (sobre o salário mínimo)', valor: 20, unidade: '%' },
        { chave: 'INSALUBRIDADE_MAX', descricao: 'Insalubridade grau máximo (sobre o salário mínimo)', valor: 40, unidade: '%' },
        { chave: 'PERICULOSIDADE', descricao: 'Periculosidade (sobre o salário-base)', valor: 30, unidade: '%' },
        { chave: 'DIVISOR_HORAS', descricao: 'Divisor de horas mensal (jornada 44h)', valor: 220, unidade: 'horas' },
      ],
    },
  },
  {
    tipo: 'ALIQUOTAS',
    conjunto: 'PRESUMIDO',
    descricao: 'Tributos federais — Lucro Presumido (comércio)',
    vigenciaInicio: '2025-01-01',
    fonte: 'Lei 9.249/95, Lei 9.430/96, Lei 10.637/02 e 10.833/03; conferir LC 224/2025 para receitas acima de R$ 5 milhões',
    verificarVigencia: true,
    dados: {
      itens: [
        { chave: 'PIS_CUMULATIVO', descricao: 'PIS cumulativo', valor: 0.65, unidade: '%' },
        { chave: 'COFINS_CUMULATIVO', descricao: 'COFINS cumulativa', valor: 3, unidade: '%' },
        { chave: 'PRESUNCAO_IRPJ_COMERCIO', descricao: 'Presunção IRPJ (comércio)', valor: 8, unidade: '%' },
        { chave: 'PRESUNCAO_IRPJ_SERVICOS', descricao: 'Presunção IRPJ (serviços em geral)', valor: 32, unidade: '%' },
        { chave: 'PRESUNCAO_CSLL_COMERCIO', descricao: 'Presunção CSLL (comércio)', valor: 12, unidade: '%' },
        { chave: 'PRESUNCAO_CSLL_SERVICOS', descricao: 'Presunção CSLL (serviços em geral)', valor: 32, unidade: '%' },
        { chave: 'IRPJ', descricao: 'Alíquota IRPJ', valor: 15, unidade: '%' },
        { chave: 'IRPJ_ADICIONAL', descricao: 'Adicional de IRPJ (sobre o excedente)', valor: 10, unidade: '%' },
        { chave: 'IRPJ_LIMITE_ADICIONAL_MES', descricao: 'Limite mensal para o adicional', valor: 20000, unidade: 'R$' },
        { chave: 'CSLL', descricao: 'Alíquota CSLL', valor: 9, unidade: '%' },
      ],
    },
  },
  {
    tipo: 'ALIQUOTAS',
    conjunto: 'NAO_CUMULATIVO',
    descricao: 'PIS/COFINS não cumulativos — Lucro Real',
    vigenciaInicio: '2025-01-01',
    fonte: 'Lei 10.637/02 e Lei 10.833/03',
    verificarVigencia: true,
    dados: {
      itens: [
        { chave: 'PIS_NAO_CUMULATIVO', descricao: 'PIS não cumulativo', valor: 1.65, unidade: '%' },
        { chave: 'COFINS_NAO_CUMULATIVO', descricao: 'COFINS não cumulativa', valor: 7.6, unidade: '%' },
        { chave: 'IRPJ', descricao: 'Alíquota IRPJ', valor: 15, unidade: '%' },
        { chave: 'IRPJ_ADICIONAL', descricao: 'Adicional de IRPJ', valor: 10, unidade: '%' },
        { chave: 'CSLL', descricao: 'Alíquota CSLL', valor: 9, unidade: '%' },
      ],
    },
  },
];
