import type { Conta, GrupoConta, Partida } from '../../db/types';
import { NOMES_GRUPO } from '../../db/types';
import { formatarMoeda, type Centavos } from '../../lib/money';

/**
 * "Modo didático": explica em linguagem simples o efeito de um lançamento no patrimônio,
 * usando a equação fundamental  ATIVO = PASSIVO + PATRIMÔNIO LÍQUIDO.
 *
 * Regras de sinal (pelo GRUPO da conta, não pela natureza — assim as redutoras funcionam):
 *   Ativo ............. débito aumenta, crédito diminui
 *   Passivo e PL ...... crédito aumenta, débito diminui
 *   Receita ........... crédito aumenta a receita  => aumenta o resultado => aumenta o PL
 *   Custo/Despesa ..... débito aumenta o gasto     => diminui o resultado => diminui o PL
 */

export interface EfeitoPartida {
  conta: Conta;
  tipo: 'D' | 'C';
  valor: Centavos;
  /** variação no próprio grupo da conta (+ aumenta, - diminui) */
  variacaoGrupo: Centavos;
  texto: string;
}

export type ClassificacaoFato =
  | 'PERMUTATIVO'
  | 'MODIFICATIVO_AUMENTATIVO'
  | 'MODIFICATIVO_DIMINUTIVO'
  | 'MISTO_AUMENTATIVO'
  | 'MISTO_DIMINUTIVO'
  | 'PL_DIRETO';

export interface ExplicacaoLancamento {
  efeitos: EfeitoPartida[];
  variacaoAtivo: Centavos;
  variacaoPassivo: Centavos;
  /** variação do PL por contas do próprio PL (capital, reservas...) */
  variacaoPLDireto: Centavos;
  /** resultado do lançamento: receitas - custos - despesas */
  variacaoResultado: Centavos;
  variacaoPL: Centavos;
  equacaoFecha: boolean;
  classificacao: ClassificacaoFato;
  tituloClassificacao: string;
  explicacaoClassificacao: string;
  resumo: string[];
}

function sinalNoGrupo(grupo: GrupoConta, tipo: 'D' | 'C'): 1 | -1 {
  const aumentaNoDebito = grupo === 'ATIVO' || grupo === 'CUSTO' || grupo === 'DESPESA';
  return (tipo === 'D') === aumentaNoDebito ? 1 : -1;
}

function textoVariacao(valor: Centavos): string {
  if (valor > 0) return `+${formatarMoeda(valor)}`;
  if (valor < 0) return `-${formatarMoeda(-valor)}`;
  return formatarMoeda(0);
}

function textoEfeito(conta: Conta, tipo: 'D' | 'C', valor: Centavos, variacao: Centavos): string {
  const grupo = NOMES_GRUPO[conta.grupo];
  const verbo = variacao > 0 ? 'aumentou' : 'diminuiu';
  const lado = tipo === 'D' ? 'Débito' : 'Crédito';
  const redutora = conta.nome.trim().startsWith('(-)') ? ' (conta redutora)' : '';
  const base = `${lado} de ${formatarMoeda(valor)} em "${conta.nome}"${redutora} — ${grupo}`;
  switch (conta.grupo) {
    case 'ATIVO':
      return `${base}: o Ativo ${verbo} (${textoVariacao(variacao)}).`;
    case 'PASSIVO':
      return `${base}: as obrigações (Passivo) ${variacao > 0 ? 'aumentaram' : 'diminuíram'} (${textoVariacao(variacao)}).`;
    case 'PL':
      return `${base}: o Patrimônio Líquido ${verbo} diretamente (${textoVariacao(variacao)}).`;
    case 'RECEITA':
      return variacao > 0
        ? `${base}: registrou receita, que aumenta o resultado e, no fim, o PL (+${formatarMoeda(valor)}).`
        : `${base}: reduziu a receita (dedução/estorno), o que diminui o resultado e o PL (-${formatarMoeda(valor)}).`;
    case 'CUSTO':
    case 'DESPESA':
      return variacao > 0
        ? `${base}: registrou ${conta.grupo === 'CUSTO' ? 'custo' : 'despesa'}, que diminui o resultado e, no fim, o PL (-${formatarMoeda(valor)}).`
        : `${base}: reduziu ${conta.grupo === 'CUSTO' ? 'o custo' : 'a despesa'} (recuperação/estorno), o que aumenta o resultado e o PL (+${formatarMoeda(valor)}).`;
  }
}

export function explicarLancamento(partidas: Partida[], contas: Map<number, Conta>): ExplicacaoLancamento {
  const efeitos: EfeitoPartida[] = [];
  let variacaoAtivo = 0;
  let variacaoPassivo = 0;
  let variacaoPLDireto = 0;
  let variacaoResultado = 0;
  let volumePatrimonial = 0;
  let envolveResultado = false;

  for (const p of partidas) {
    const conta = contas.get(p.contaId);
    if (!conta || !p.valor) continue;
    const variacaoGrupo = sinalNoGrupo(conta.grupo, p.tipo) * p.valor;
    efeitos.push({ conta, tipo: p.tipo, valor: p.valor, variacaoGrupo, texto: textoEfeito(conta, p.tipo, p.valor, variacaoGrupo) });
    switch (conta.grupo) {
      case 'ATIVO':
        variacaoAtivo += variacaoGrupo;
        volumePatrimonial += p.valor;
        break;
      case 'PASSIVO':
        variacaoPassivo += variacaoGrupo;
        volumePatrimonial += p.valor;
        break;
      case 'PL':
        variacaoPLDireto += variacaoGrupo;
        break;
      case 'RECEITA':
        envolveResultado = true;
        variacaoResultado += variacaoGrupo;
        break;
      case 'CUSTO':
      case 'DESPESA':
        envolveResultado = true;
        variacaoResultado -= variacaoGrupo;
        break;
    }
  }

  const variacaoPL = variacaoPLDireto + variacaoResultado;
  const equacaoFecha = variacaoAtivo === variacaoPassivo + variacaoPL;

  let classificacao: ClassificacaoFato;
  if (variacaoPL === 0) classificacao = 'PERMUTATIVO';
  else if (!envolveResultado) classificacao = 'PL_DIRETO';
  else if (volumePatrimonial > Math.abs(variacaoResultado)) classificacao = variacaoPL > 0 ? 'MISTO_AUMENTATIVO' : 'MISTO_DIMINUTIVO';
  else classificacao = variacaoPL > 0 ? 'MODIFICATIVO_AUMENTATIVO' : 'MODIFICATIVO_DIMINUTIVO';

  const titulos: Record<ClassificacaoFato, [string, string]> = {
    PERMUTATIVO: [
      'Fato permutativo',
      'Houve troca entre elementos do patrimônio (bens, direitos ou obrigações) sem alterar o Patrimônio Líquido.',
    ],
    MODIFICATIVO_AUMENTATIVO: ['Fato modificativo aumentativo', 'O lançamento envolve receita e aumenta o Patrimônio Líquido.'],
    MODIFICATIVO_DIMINUTIVO: ['Fato modificativo diminutivo', 'O lançamento envolve custo/despesa e diminui o Patrimônio Líquido.'],
    MISTO_AUMENTATIVO: [
      'Fato misto aumentativo',
      'Combina uma permuta entre elementos patrimoniais com um aumento do PL (ex.: recebimento de cliente com juros).',
    ],
    MISTO_DIMINUTIVO: [
      'Fato misto diminutivo',
      'Combina uma permuta entre elementos patrimoniais com uma redução do PL (ex.: pagamento de fornecedor com multa).',
    ],
    PL_DIRETO: [
      'Variação direta do Patrimônio Líquido',
      'O PL mudou sem passar pelo resultado — típico de transações com sócios (integralização de capital, distribuição de lucros) ou movimentação de reservas.',
    ],
  };

  const resumo = [
    `Ativo: ${textoVariacao(variacaoAtivo)}`,
    `Passivo: ${textoVariacao(variacaoPassivo)}`,
    `Patrimônio Líquido: ${textoVariacao(variacaoPL)}${variacaoResultado !== 0 ? ` (resultado do período ${textoVariacao(variacaoResultado)})` : ''}`,
    equacaoFecha
      ? `A equação fundamental continua valendo: ${textoVariacao(variacaoAtivo)} = ${textoVariacao(variacaoPassivo)} + ${textoVariacao(variacaoPL)}.`
      : 'Atenção: a equação Ativo = Passivo + PL não fecha — confira se débitos e créditos estão iguais.',
  ];

  return {
    efeitos,
    variacaoAtivo,
    variacaoPassivo,
    variacaoPLDireto,
    variacaoResultado,
    variacaoPL,
    equacaoFecha,
    classificacao,
    tituloClassificacao: titulos[classificacao][0],
    explicacaoClassificacao: titulos[classificacao][1],
    resumo,
  };
}
