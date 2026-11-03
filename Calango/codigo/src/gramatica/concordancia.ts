// Concordância de gênero e número.
//
// Regra: grupo só de mulheres -> feminino; qualquer homem no grupo (ou grupo
// vazio) -> masculino. Uma pessoa -> singular; duas ou mais -> plural.

export type Genero = 'M' | 'F';

export interface Referente {
  genero: Genero;
  plural: boolean;
}

export function generoDoGrupo(generos: (Genero | '' | undefined)[]): Genero {
  if (generos.length === 0) return 'M';
  return generos.every((g) => g === 'F') ? 'F' : 'M';
}

export function referenteDoGrupo(generos: (Genero | '' | undefined)[]): Referente {
  return { genero: generoDoGrupo(generos), plural: generos.length > 1 };
}

/**
 * Escolhe a forma certa.
 * - 4 formas: [masc. singular, fem. singular, masc. plural, fem. plural]
 * - 2 formas: [masculino, feminino] (o número é ignorado)
 * - 1 forma: sempre ela.
 */
export function escolherForma(formas: string[], r: Referente): string {
  if (formas.length >= 4) {
    const i = (r.plural ? 2 : 0) + (r.genero === 'F' ? 1 : 0);
    return formas[i];
  }
  if (formas.length === 2) return r.genero === 'F' ? formas[1] : formas[0];
  return formas[0] ?? '';
}

// ---------------- Estado civil e regime de bens ----------------

export type EstadoCivil =
  | 'solteiro'
  | 'casado'
  | 'uniao_estavel'
  | 'divorciado'
  | 'separado_judicialmente'
  | 'viuvo';

export type RegimeBens =
  | 'comunhao_parcial'
  | 'comunhao_universal'
  | 'separacao_total'
  | 'separacao_obrigatoria'
  | 'participacao_final_aquestos';

export const ESTADOS_CIVIS: { valor: EstadoCivil; rotulo: string; formas: [string, string] }[] = [
  { valor: 'solteiro', rotulo: 'Solteiro(a)', formas: ['solteiro', 'solteira'] },
  { valor: 'casado', rotulo: 'Casado(a)', formas: ['casado', 'casada'] },
  { valor: 'uniao_estavel', rotulo: 'União estável', formas: ['convivente em união estável', 'convivente em união estável'] },
  { valor: 'divorciado', rotulo: 'Divorciado(a)', formas: ['divorciado', 'divorciada'] },
  { valor: 'separado_judicialmente', rotulo: 'Separado(a) judicialmente', formas: ['separado judicialmente', 'separada judicialmente'] },
  { valor: 'viuvo', rotulo: 'Viúvo(a)', formas: ['viúvo', 'viúva'] },
];

export const REGIMES_BENS: { valor: RegimeBens; rotulo: string; texto: string }[] = [
  { valor: 'comunhao_parcial', rotulo: 'Comunhão parcial de bens', texto: 'comunhão parcial de bens' },
  { valor: 'comunhao_universal', rotulo: 'Comunhão universal de bens', texto: 'comunhão universal de bens' },
  { valor: 'separacao_total', rotulo: 'Separação total (convencional) de bens', texto: 'separação total de bens' },
  { valor: 'separacao_obrigatoria', rotulo: 'Separação obrigatória de bens', texto: 'separação obrigatória de bens' },
  { valor: 'participacao_final_aquestos', rotulo: 'Participação final nos aquestos', texto: 'participação final nos aquestos' },
];

/** Estados civis que obrigam a informar o regime de bens. */
export function exigeRegimeBens(estado: EstadoCivil | '' | undefined): boolean {
  return estado === 'casado' || estado === 'uniao_estavel';
}

/**
 * Texto do estado civil com concordância e regime:
 * "casada sob o regime de separação total de bens",
 * "convivente em união estável sob o regime de comunhão parcial de bens".
 * Devolve '' se faltar informação obrigatória.
 */
export function textoEstadoCivil(
  estado: EstadoCivil | '' | undefined,
  regime: RegimeBens | '' | undefined,
  genero: Genero | '' | undefined,
): string {
  const def = ESTADOS_CIVIS.find((e) => e.valor === estado);
  if (!def || (genero !== 'M' && genero !== 'F')) return '';
  const base = def.formas[genero === 'F' ? 1 : 0];
  if (!exigeRegimeBens(estado)) return base;
  const reg = REGIMES_BENS.find((r) => r.valor === regime);
  if (!reg) return '';
  return `${base} sob o regime de ${reg.texto}`;
}
