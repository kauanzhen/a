// Validação e formatação de documentos (CPF, CNPJ, CEP, CNAE).

import { apenasDigitos } from '../lib/texto';

export function cpfValido(cpf: string): boolean {
  const d = apenasDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = calc(d.slice(0, 9), 10);
  const d2 = calc(d.slice(0, 10), 11);
  return d1 === Number(d[9]) && d2 === Number(d[10]);
}

export function formatarCPF(cpf: string): string {
  const d = apenasDigitos(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function cnpjValido(cnpj: string): boolean {
  const d = apenasDigitos(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calc(d.slice(0, 12)) === Number(d[12]) && calc(d.slice(0, 13)) === Number(d[13]);
}

export function formatarCNPJ(cnpj: string): string {
  const d = apenasDigitos(cnpj);
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function cepValido(cep: string): boolean {
  return apenasDigitos(cep).length === 8;
}

export function formatarCEP(cep: string): string {
  const d = apenasDigitos(cep);
  if (d.length !== 8) return cep;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** CNAE (subclasse) tem 7 dígitos: 7490-1/04 ou 74.90-1-04. */
export function cnaeValido(codigo: string): boolean {
  return apenasDigitos(codigo).length === 7;
}

/** Formata como nos modelos do escritório: "74.90-1-04". */
export function formatarCNAE(codigo: string): string {
  const d = apenasDigitos(codigo);
  if (d.length !== 7) return codigo;
  return `${d.slice(0, 2)}.${d.slice(2, 4)}-${d.slice(4, 5)}-${d.slice(5)}`;
}
