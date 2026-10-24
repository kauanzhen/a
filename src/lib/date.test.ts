import { describe, expect, it } from 'vitest';
import {
  competenciasEntre, dataNaCompetencia, fimDaCompetencia, formatarData, interpretarData,
  isoParaSerialExcel, serialExcelParaISO, somarMeses,
} from './date';

describe('datas', () => {
  it('formata ISO como dd/mm/aaaa', () => {
    expect(formatarData('2026-01-31')).toBe('31/01/2026');
  });

  it.each([
    ['31/01/2026', '2026-01-31'],
    ['1/2/2026', '2026-02-01'],
    ['31/01/26', '2026-01-31'],
    ['31012026', '2026-01-31'],
    ['2026-01-31', '2026-01-31'],
    ['29/02/2028', '2028-02-29'],
  ])('interpreta %s', (entrada, esperado) => {
    expect(interpretarData(entrada)).toBe(esperado);
  });

  it.each(['31/02/2026', '29/02/2026', '00/01/2026', '13/13/2026', 'ontem', ''])('rejeita %s', (entrada) => {
    expect(interpretarData(entrada)).toBeNull();
  });

  it('converte número de série do Excel', () => {
    expect(serialExcelParaISO(45658)).toBe('2025-01-01');
    expect(serialExcelParaISO(46023)).toBe('2026-01-01');
    expect(serialExcelParaISO(isoParaSerialExcel('2026-03-15'))).toBe('2026-03-15');
  });

  it('trabalha com competências', () => {
    expect(somarMeses('2026-12', 1)).toBe('2027-01');
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
    expect(competenciasEntre('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(fimDaCompetencia('2028-02')).toBe('2028-02-29');
    expect(dataNaCompetencia('2026-02', 31)).toBe('2026-02-28');
  });
});
