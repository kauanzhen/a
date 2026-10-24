/**
 * CPF e CNPJ: máscara, validação de dígito verificador e geração de números FICTÍCIOS.
 *
 * O CNPJ aceita o formato numérico tradicional e o formato alfanumérico (IN RFB 2.229/2024,
 * em vigor a partir de julho/2026): as 12 primeiras posições podem ser letras A-Z ou dígitos,
 * e os 2 dígitos verificadores continuam numéricos. No cálculo, cada caractere vale
 * (código ASCII - 48): '0'..'9' => 0..9, 'A' => 17, 'B' => 18, ... 'Z' => 42.
 */

export function somenteDigitos(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}

function aleatorioDigito(): number {
  return Math.floor(Math.random() * 10);
}

// ---------------------------------------------------------------- CPF

function dvCPF(base: number[]): number {
  const peso = base.length + 1;
  const soma = base.reduce((acc, d, i) => acc + d * (peso - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

export function validarCPF(cpf: string | null | undefined): boolean {
  const d = somenteDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const nums = d.split('').map(Number);
  const dv1 = dvCPF(nums.slice(0, 9));
  const dv2 = dvCPF([...nums.slice(0, 9), dv1]);
  return dv1 === nums[9] && dv2 === nums[10];
}

/** Aplica a máscara 000.000.000-00 progressivamente (útil enquanto digita). */
export function formatarCPF(cpf: string | null | undefined): string {
  const d = somenteDigitos(cpf).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Gera um CPF com dígitos verificadores válidos, para uso FICTÍCIO em estudos. */
export function gerarCPF(): string {
  let base: number[];
  do {
    base = Array.from({ length: 9 }, aleatorioDigito);
  } while (base.every((n) => n === base[0]));
  const dv1 = dvCPF(base);
  const dv2 = dvCPF([...base, dv1]);
  return formatarCPF([...base, dv1, dv2].join(''));
}

// ---------------------------------------------------------------- CNPJ

/** Remove máscara e espaços e deixa as letras em maiúsculas. */
export function normalizarCNPJ(cnpj: string | null | undefined): string {
  return (cnpj ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

function valorCaractereCNPJ(c: string): number {
  return c.charCodeAt(0) - 48;
}

function dvCNPJ(base: string): number {
  const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = base.split('').reduce((acc, c, i) => acc + valorCaractereCNPJ(c) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function calcularDVsCNPJ(base12: string): string {
  const b = normalizarCNPJ(base12);
  if (!/^[0-9A-Z]{12}$/.test(b)) throw new Error('A base do CNPJ deve ter 12 caracteres (dígitos ou letras).');
  const dv1 = dvCNPJ(b);
  const dv2 = dvCNPJ(b + dv1);
  return `${dv1}${dv2}`;
}

export function validarCNPJ(cnpj: string | null | undefined): boolean {
  const c = normalizarCNPJ(cnpj);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(c)) return false;
  if (/^(.)\1{13}$/.test(c)) return false;
  return calcularDVsCNPJ(c.slice(0, 12)) === c.slice(12);
}

/** Aplica a máscara 00.000.000/0000-00 progressivamente (aceita letras nas 12 primeiras posições). */
export function formatarCNPJ(cnpj: string | null | undefined): string {
  const c = normalizarCNPJ(cnpj).slice(0, 14);
  if (c.length <= 2) return c;
  if (c.length <= 5) return `${c.slice(0, 2)}.${c.slice(2)}`;
  if (c.length <= 8) return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5)}`;
  if (c.length <= 12) return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8)}`;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

/** Gera um CNPJ numérico (matriz 0001) com DV válido, para uso FICTÍCIO em estudos. */
export function gerarCNPJ(): string {
  let raiz: string;
  do {
    raiz = Array.from({ length: 8 }, aleatorioDigito).join('');
  } while (/^(\d)\1{7}$/.test(raiz));
  const base = `${raiz}0001`;
  return formatarCNPJ(base + calcularDVsCNPJ(base));
}

// ---------------------------------------------------------------- Outros

/** CEP 00000-000 */
export function formatarCEP(cep: string | null | undefined): string {
  const d = somenteDigitos(cep).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** CNAE 0000-0/00 (subclasse, 7 dígitos) */
export function formatarCNAE(cnae: string | null | undefined): string {
  const d = somenteDigitos(cnae).slice(0, 7);
  if (d.length <= 4) return d;
  if (d.length === 5) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5)}`;
}

export function validarCNAE(cnae: string | null | undefined): boolean {
  return somenteDigitos(cnae).length === 7;
}

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
