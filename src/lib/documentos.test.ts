import { describe, expect, it } from 'vitest';
import { calcularDVsCNPJ, formatarCNAE, formatarCNPJ, formatarCPF, gerarCNPJ, gerarCPF, validarCNPJ, validarCPF } from './documentos';

describe('CPF', () => {
  it('valida dígitos verificadores', () => {
    expect(validarCPF('529.982.247-25')).toBe(true);
    expect(validarCPF('52998224725')).toBe(true);
    expect(validarCPF('529.982.247-24')).toBe(false);
    expect(validarCPF('111.111.111-11')).toBe(false);
    expect(validarCPF('123')).toBe(false);
  });
  it('aplica máscara progressiva', () => {
    expect(formatarCPF('5299')).toBe('529.9');
    expect(formatarCPF('52998224725')).toBe('529.982.247-25');
  });
  it('gera CPFs fictícios válidos', () => {
    for (let i = 0; i < 50; i++) expect(validarCPF(gerarCPF())).toBe(true);
  });
});

describe('CNPJ', () => {
  it('valida CNPJ numérico', () => {
    expect(validarCNPJ('11.222.333/0001-81')).toBe(true);
    expect(validarCNPJ('11.222.333/0001-80')).toBe(false);
    expect(validarCNPJ('00.000.000/0000-00')).toBe(false);
  });
  it('valida CNPJ alfanumérico (exemplo oficial da RFB)', () => {
    expect(calcularDVsCNPJ('12ABC34501DE')).toBe('35');
    expect(validarCNPJ('12.ABC.345/01DE-35')).toBe(true);
    expect(validarCNPJ('12.abc.345/01de-35')).toBe(true);
    expect(validarCNPJ('12.ABC.345/01DE-36')).toBe(false);
  });
  it('aplica máscara', () => {
    expect(formatarCNPJ('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatarCNPJ('12abc34501de35')).toBe('12.ABC.345/01DE-35');
  });
  it('gera CNPJs fictícios válidos', () => {
    for (let i = 0; i < 50; i++) expect(validarCNPJ(gerarCNPJ())).toBe(true);
  });
  it('formata CNAE', () => {
    expect(formatarCNAE('4789099')).toBe('4789-0/99');
  });
});
