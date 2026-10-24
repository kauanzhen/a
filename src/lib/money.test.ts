import { describe, expect, it } from 'vitest';
import { aplicarPercentual, arredondar, formatarMoeda, formatarNumero, interpretarMoeda, reaisParaCentavos, somar } from './money';

describe('money (centavos)', () => {
  it('evita erro de ponto flutuante: 0,10 + 0,20 = 0,30', () => {
    expect(somar([reaisParaCentavos(0.1), reaisParaCentavos(0.2)])).toBe(30);
  });

  it('converte reais para centavos arredondando meio para cima', () => {
    expect(reaisParaCentavos(1234.56)).toBe(123456);
    expect(reaisParaCentavos(1.005)).toBe(101);
    expect(reaisParaCentavos(2.675)).toBe(268);
    expect(arredondar(-0.5)).toBe(-1);
    expect(Object.is(arredondar(-0.4), -0)).toBe(false);
  });

  it('formata no padrão brasileiro', () => {
    expect(formatarMoeda(123456)).toBe('R$ 1.234,56');
    expect(formatarMoeda(5)).toBe('R$ 0,05');
    expect(formatarMoeda(-500)).toBe('-R$ 5,00');
    expect(formatarMoeda(123456789012)).toBe('R$ 1.234.567.890,12');
    expect(formatarNumero(100)).toBe('1,00');
  });

  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['R$ 1.234,56', 123456],
    ['1234.56', 123456],
    ['1,234.56', 123456],
    ['1.234', 123400],
    ['1234.5', 123450],
    ['1.234.567', 123456700],
    ['(10,00)', -1000],
    ['-10', -1000],
    ['0,1', 10],
    [1500, 150000],
    [99.99, 9999],
  ])('interpreta %s', (entrada, esperado) => {
    expect(interpretarMoeda(entrada as string | number)).toBe(esperado);
  });

  it.each(['', 'abc', '1,2,3', '12..3', '1.23.4'])('rejeita "%s"', (entrada) => {
    expect(interpretarMoeda(entrada)).toBeNull();
  });

  it('aplica percentual com arredondamento ao centavo', () => {
    expect(aplicarPercentual(250000, 8)).toBe(20000);
    expect(aplicarPercentual(151800, 7.5)).toBe(11385);
    expect(aplicarPercentual(333, 7.5)).toBe(25); // 24,975 -> 25
  });
});
