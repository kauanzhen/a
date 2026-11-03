import { describe, expect, it } from 'vitest';
import {
  moedaComExtenso,
  numeroPorExtenso,
  percentualComExtenso,
  quantidadeComExtenso,
  QUOTA,
  valorPorExtenso,
} from './extenso';
import { letraAlinea, ordinalClausula, ordinalNumerico, ordinalParagrafo, ordinalPorExtenso } from './ordinais';
import { escolherForma, referenteDoGrupo, textoEstadoCivil } from './concordancia';
import { dataPorExtenso, diaMesPorExtenso } from '../lib/datas';
import { lerMoeda, lerPercentual } from '../lib/dinheiro';

describe('número por extenso', () => {
  const casos: [number, string][] = [
    [0, 'zero'],
    [1, 'um'],
    [10, 'dez'],
    [14, 'quatorze'],
    [16, 'dezesseis'],
    [21, 'vinte e um'],
    [99, 'noventa e nove'],
    [100, 'cem'],
    [101, 'cento e um'],
    [110, 'cento e dez'],
    [200, 'duzentos'],
    [999, 'novecentos e noventa e nove'],
    [1000, 'mil'],
    [1001, 'mil e um'],
    [1100, 'mil e cem'],
    [1250, 'mil duzentos e cinquenta'],
    [2101, 'dois mil cento e um'],
    [10500, 'dez mil e quinhentos'],
    [21000, 'vinte e um mil'],
    [100000, 'cem mil'],
    [101000, 'cento e um mil'],
    [1000000, 'um milhão'],
    [1000001, 'um milhão e um'],
    [1001000, 'um milhão e mil'],
    [1200000, 'um milhão e duzentos mil'],
    [1250000, 'um milhão, duzentos e cinquenta mil'],
    [2000000, 'dois milhões'],
    [1000000000, 'um bilhão'],
  ];
  it.each(casos)('%i -> %s', (n, esperado) => {
    expect(numeroPorExtenso(n)).toBe(esperado);
  });

  it('feminino nas unidades, centenas e milhares', () => {
    expect(numeroPorExtenso(1, 'f')).toBe('uma');
    expect(numeroPorExtenso(2, 'f')).toBe('duas');
    expect(numeroPorExtenso(21, 'f')).toBe('vinte e uma');
    expect(numeroPorExtenso(201, 'f')).toBe('duzentas e uma');
    expect(numeroPorExtenso(10500, 'f')).toBe('dez mil e quinhentas');
    expect(numeroPorExtenso(2200, 'f')).toBe('duas mil e duzentas');
  });

  it('milhões continuam masculinos mesmo com substantivo feminino', () => {
    expect(numeroPorExtenso(200000000, 'f')).toBe('duzentos milhões');
    expect(numeroPorExtenso(2200000, 'f')).toBe('dois milhões e duzentas mil');
  });

  it('rejeita números inválidos', () => {
    expect(() => numeroPorExtenso(-1)).toThrow();
    expect(() => numeroPorExtenso(1.5)).toThrow();
  });
});

describe('valor em reais por extenso', () => {
  const casos: [number, string][] = [
    [100, 'um real'],
    [200, 'dois reais'],
    [1, 'um centavo'],
    [50, 'cinquenta centavos'],
    [101, 'um real e um centavo'],
    [1050000, 'dez mil e quinhentos reais'],
    [1050050, 'dez mil e quinhentos reais e cinquenta centavos'],
    [100000000, 'um milhão de reais'],
    [100000050, 'um milhão de reais e cinquenta centavos'],
    [150000000, 'um milhão e quinhentos mil reais'],
    [100100000, 'um milhão e mil reais'],
    [2100, 'vinte e um reais'],
  ];
  it.each(casos)('%i centavos -> %s', (c, esperado) => {
    expect(valorPorExtenso(c)).toBe(esperado);
  });

  it('formato completo com símbolo', () => {
    expect(moedaComExtenso(1050000)).toBe('R$ 10.500,00 (dez mil e quinhentos reais)');
    expect(moedaComExtenso(100)).toBe('R$ 1,00 (um real)');
  });
});

describe('quantidade de quotas por extenso', () => {
  it('concorda em gênero e número', () => {
    expect(quantidadeComExtenso(1, QUOTA)).toBe('1 (uma) quota');
    expect(quantidadeComExtenso(2, QUOTA)).toBe('2 (duas) quotas');
    expect(quantidadeComExtenso(21, QUOTA)).toBe('21 (vinte e uma) quotas');
    expect(quantidadeComExtenso(10500, QUOTA)).toBe('10.500 (dez mil e quinhentas) quotas');
    expect(quantidadeComExtenso(1000, QUOTA)).toBe('1.000 (mil) quotas');
    expect(quantidadeComExtenso(1001000, QUOTA)).toBe('1.001.000 (um milhão e mil) quotas');
    expect(quantidadeComExtenso(1000000, QUOTA)).toBe('1.000.000 (um milhão) de quotas');
  });
});

describe('percentual por extenso', () => {
  it('inteiros e decimais', () => {
    expect(percentualComExtenso(5000)).toBe('50% (cinquenta por cento)');
    expect(percentualComExtenso(10000)).toBe('100% (cem por cento)');
    expect(percentualComExtenso(3333)).toBe('33,33% (trinta e três vírgula trinta e três por cento)');
    expect(percentualComExtenso(1250)).toBe('12,5% (doze vírgula cinco por cento)');
    expect(percentualComExtenso(1205)).toBe('12,05% (doze vírgula zero cinco por cento)');
  });
});

describe('ordinais', () => {
  it('cláusulas (feminino, maiúsculas)', () => {
    expect(ordinalClausula(1)).toBe('PRIMEIRA');
    expect(ordinalClausula(9)).toBe('NONA');
    expect(ordinalClausula(10)).toBe('DÉCIMA');
    expect(ordinalClausula(11)).toBe('DÉCIMA PRIMEIRA');
    expect(ordinalClausula(20)).toBe('VIGÉSIMA');
    expect(ordinalClausula(25)).toBe('VIGÉSIMA QUINTA');
    expect(ordinalClausula(99)).toBe('NONAGÉSIMA NONA');
    expect(ordinalClausula(100)).toBe('CENTÉSIMA');
    expect(ordinalClausula(101)).toBe('CENTÉSIMA PRIMEIRA');
    expect(ordinalClausula(150)).toBe('CENTÉSIMA QUINQUAGÉSIMA');
  });
  it('todas as cláusulas de 1 a 120 são diferentes', () => {
    const vistos = new Set<string>();
    for (let i = 1; i <= 120; i++) vistos.add(ordinalClausula(i));
    expect(vistos.size).toBe(120);
  });
  it('parágrafos (masculino)', () => {
    expect(ordinalParagrafo(1)).toBe('Primeiro');
    expect(ordinalParagrafo(12)).toBe('Décimo Segundo');
    expect(ordinalPorExtenso(3, 'm')).toBe('terceiro');
  });
  it('número da alteração', () => {
    expect(`${ordinalNumerico(1)} ALTERAÇÃO`).toBe('1ª ALTERAÇÃO');
    expect(`${ordinalNumerico(12)} ALTERAÇÃO`).toBe('12ª ALTERAÇÃO');
  });
  it('letras das alíneas', () => {
    expect(letraAlinea(0)).toBe('a');
    expect(letraAlinea(2)).toBe('c');
    expect(letraAlinea(25)).toBe('z');
    expect(letraAlinea(26)).toBe('aa');
  });
});

describe('datas por extenso', () => {
  it('fechamento', () => {
    expect(dataPorExtenso('2026-11-03')).toBe('3 de novembro de 2026');
    expect(dataPorExtenso('2026-01-01')).toBe('1º de janeiro de 2026');
    expect(dataPorExtenso('2026-02-30')).toBe('');
    expect(diaMesPorExtenso('12-31')).toBe('31 de dezembro');
    expect(diaMesPorExtenso('01-01')).toBe('1º de janeiro');
  });
});

describe('concordância', () => {
  const formas = ['o sócio', 'a sócia', 'os sócios', 'as sócias'];
  it('um homem, uma mulher, grupo misto, grupo de mulheres', () => {
    expect(escolherForma(formas, referenteDoGrupo(['M']))).toBe('o sócio');
    expect(escolherForma(formas, referenteDoGrupo(['F']))).toBe('a sócia');
    expect(escolherForma(formas, referenteDoGrupo(['M', 'F']))).toBe('os sócios');
    expect(escolherForma(formas, referenteDoGrupo(['F', 'F']))).toBe('as sócias');
    expect(escolherForma(['brasileiro', 'brasileira'], referenteDoGrupo(['F']))).toBe('brasileira');
  });
  it('estado civil com regime de bens', () => {
    expect(textoEstadoCivil('casado', 'comunhao_parcial', 'M')).toBe('casado sob o regime de comunhão parcial de bens');
    expect(textoEstadoCivil('casado', 'separacao_total', 'F')).toBe('casada sob o regime de separação total de bens');
    expect(textoEstadoCivil('uniao_estavel', 'comunhao_parcial', 'F')).toBe(
      'convivente em união estável sob o regime de comunhão parcial de bens',
    );
    expect(textoEstadoCivil('casado', '', 'M')).toBe('');
    expect(textoEstadoCivil('solteiro', 'comunhao_parcial', 'F')).toBe('solteira');
    expect(textoEstadoCivil('viuvo', '', 'F')).toBe('viúva');
    expect(textoEstadoCivil('separado_judicialmente', '', 'M')).toBe('separado judicialmente');
  });
});

describe('leitura de valores digitados', () => {
  it('moeda', () => {
    expect(lerMoeda('10.500,00')).toBe(1050000);
    expect(lerMoeda('R$ 1.234,5')).toBe(123450);
    expect(lerMoeda('100')).toBe(10000);
    expect(lerMoeda('abc')).toBeNull();
    expect(lerMoeda('')).toBeNull();
  });
  it('percentual', () => {
    expect(lerPercentual('50')).toBe(5000);
    expect(lerPercentual('33,33')).toBe(3333);
    expect(lerPercentual('12,5%')).toBe(1250);
    expect(lerPercentual('1,234')).toBeNull();
  });
});
