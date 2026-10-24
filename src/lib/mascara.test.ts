import { describe, expect, it } from 'vitest';
import { codigoPai, compararCodigos, ehDescendente, formatarCodigo, interpretarMascara, nivelDoCodigo, proximoCodigoFilho, reformatarCodigo } from './mascara';

const m = interpretarMascara('9.9.9.99.9999');

describe('máscara do plano de contas', () => {
  it('interpreta segmentos', () => {
    expect(m.segmentos).toEqual([1, 1, 1, 2, 4]);
    expect(() => interpretarMascara('9.x.9')).toThrow();
    expect(() => interpretarMascara('999')).toThrow();
  });
  it('calcula nível e valida códigos', () => {
    expect(nivelDoCodigo('1', m)).toBe(1);
    expect(nivelDoCodigo('1.1.1.01', m)).toBe(4);
    expect(nivelDoCodigo('1.1.1.01.0001', m)).toBe(5);
    expect(nivelDoCodigo('1.1.1.1', m)).toBeNull();
    expect(nivelDoCodigo('1.1.1.01.0001.1', m)).toBeNull();
    expect(nivelDoCodigo('1-1', m)).toBeNull();
  });
  it('aplica a máscara enquanto digita', () => {
    expect(formatarCodigo('111010001', m)).toBe('1.1.1.01.0001');
    expect(formatarCodigo('11101', m)).toBe('1.1.1.01');
  });
  it('encontra a conta-mãe', () => {
    expect(codigoPai('1.1.1.01.0001', m)).toBe('1.1.1.01');
    expect(codigoPai('1', m)).toBeNull();
  });
  it('converte códigos entre máscaras', () => {
    const nova = interpretarMascara('9.9.99.99.99999');
    expect(reformatarCodigo('1.1.1.01.0001', m, nova)).toBe('1.1.01.01.00001');
    expect(() => reformatarCodigo('1.1.1.01.0001', m, interpretarMascara('9.9.9.99'))).toThrow();
    expect(() => reformatarCodigo('1.1.1.01.1234', m, interpretarMascara('9.9.9.99.99'))).toThrow();
  });
  it('sugere o próximo código filho', () => {
    expect(proximoCodigoFilho('1.1.1.01', ['1.1.1.01.0001', '1.1.1.01.0002', '1.1.1.02.0009'], m)).toBe('1.1.1.01.0003');
    expect(proximoCodigoFilho(null, ['1', '2', '3'], m)).toBe('4');
  });
  it('ordena hierarquicamente', () => {
    const lista = ['1.1.10', '1.1.2', '1', '1.1'].sort(compararCodigos);
    expect(lista).toEqual(['1', '1.1', '1.1.2', '1.1.10']);
    expect(ehDescendente('1.1.2', '1.1')).toBe(true);
    expect(ehDescendente('1.10', '1.1')).toBe(false);
  });
});
