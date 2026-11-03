// Regras do sistema de quotas (classe única ou classes distintas).
// A verdade são as QUOTAS inteiras de cada sócio em cada classe; valores e
// percentuais são derivados. Nunca arredondamos sozinhos.

import { percentualCentesimos } from '../lib/dinheiro';
import { CLASSE_UNICA, type ClasseQuota, type DadosEmpresa, type Participacao, type Pessoa } from './tipos';

/** Classe implícita usada quando o modo é "classe única". */
export function classeOrdinaria(): ClasseQuota {
  return {
    id: CLASSE_UNICA,
    nome: 'Quotas ordinárias',
    voto: 'pleno',
    voto_materias: '',
    preferencia_lucros: false,
    preferencia_tipo: 'prioritaria',
    preferencia_descricao: '',
    prioridade_reembolso: false,
    elege_administrador: false,
    valor_quota_centavos: null,
  };
}

/** Classes em uso conforme o modo escolhido. */
export function classesEfetivas(d: DadosEmpresa): ClasseQuota[] {
  if (d.quotas.modo === 'unica') return [classeOrdinaria()];
  if (d.quotas.modo === 'classes') return d.quotas.classes;
  return [];
}

export function valorQuotaDaClasse(d: DadosEmpresa, c: ClasseQuota): number {
  return c.valor_quota_centavos ?? d.capital.valor_quota_centavos;
}

/** true quando todas as classes têm o mesmo valor unitário. */
export function valorUnitarioUniforme(d: DadosEmpresa): boolean {
  const vs = new Set(classesEfetivas(d).map((c) => valorQuotaDaClasse(d, c)));
  return vs.size <= 1;
}

/**
 * Total de quotas que o capital comporta (capital ÷ valor unitário), quando o
 * valor unitário é uniforme. null se não for divisível ou não se aplicar.
 */
export function totalQuotasEsperado(d: DadosEmpresa): number | null {
  const v = d.capital.valor_quota_centavos;
  if (!valorUnitarioUniforme(d) || v <= 0 || d.capital.valor_centavos <= 0) return null;
  if (d.capital.valor_centavos % v !== 0) return null;
  return d.capital.valor_centavos / v;
}

export function quotasNaClasse(p: Participacao | undefined, classeId: string): number {
  return p?.quotas?.[classeId] ?? 0;
}

export function totalQuotasDoSocio(d: DadosEmpresa, p: Participacao | undefined): number {
  if (!p) return 0;
  return classesEfetivas(d).reduce((s, c) => s + quotasNaClasse(p, c.id), 0);
}

export function valorDoSocio(d: DadosEmpresa, p: Participacao | undefined): number {
  if (!p) return 0;
  return classesEfetivas(d).reduce((s, c) => s + quotasNaClasse(p, c.id) * valorQuotaDaClasse(d, c), 0);
}

export function totalQuotasSubscritas(d: DadosEmpresa): number {
  return d.participacoes.reduce((s, p) => s + totalQuotasDoSocio(d, p), 0);
}

export function totalQuotasDaClasse(d: DadosEmpresa, classeId: string): number {
  return d.participacoes.reduce((s, p) => s + quotasNaClasse(p, classeId), 0);
}

export function valorTotalSubscrito(d: DadosEmpresa): number {
  return d.participacoes.reduce((s, p) => s + valorDoSocio(d, p), 0);
}

/** Percentual do sócio no capital (centésimos de ponto), só para exibição. */
export function percentualDoSocio(d: DadosEmpresa, p: Participacao | undefined): number {
  return percentualCentesimos(valorDoSocio(d, p), d.capital.valor_centavos);
}

// ---------------- Sócios e situação ----------------

export function buscarPessoa(d: DadosEmpresa, id: string): Pessoa | undefined {
  return d.pessoas.find((p) => p.id === id);
}

/** Sócios = pessoas que têm participação no quadro, na ordem do quadro. */
export function socios(d: DadosEmpresa): { pessoa: Pessoa; participacao: Participacao }[] {
  const r: { pessoa: Pessoa; participacao: Participacao }[] = [];
  for (const part of d.participacoes) {
    const pessoa = buscarPessoa(d, part.pessoa_id);
    if (pessoa) r.push({ pessoa, participacao: part });
  }
  return r;
}

export type Situacao = 'unipessoal' | 'pluripessoal' | 'sem_socios';

/** Situação derivada automaticamente do quadro societário. */
export function situacao(d: DadosEmpresa): Situacao {
  const n = socios(d).length;
  if (n === 0) return 'sem_socios';
  return n === 1 ? 'unipessoal' : 'pluripessoal';
}

export function eSocio(d: DadosEmpresa, pessoaId: string): boolean {
  return d.participacoes.some((p) => p.pessoa_id === pessoaId);
}

// ---------------- Conversões (valor / percentual -> quotas) ----------------

export type ResultadoConversao =
  | { ok: true; quotas: number }
  | { ok: false; motivo: string; abaixo: number; acima: number };

/** Valor em R$ (centavos) -> quotas. Bloqueia se não der número inteiro. */
export function valorParaQuotas(valorCentavos: number, valorQuotaCentavos: number): ResultadoConversao {
  if (valorQuotaCentavos <= 0) {
    return { ok: false, motivo: 'Informe primeiro o valor unitário da quota.', abaixo: 0, acima: 0 };
  }
  if (valorCentavos % valorQuotaCentavos === 0) return { ok: true, quotas: valorCentavos / valorQuotaCentavos };
  const abaixo = Math.floor(valorCentavos / valorQuotaCentavos);
  return {
    ok: false,
    motivo: 'O valor informado não corresponde a um número inteiro de quotas.',
    abaixo,
    acima: abaixo + 1,
  };
}

/**
 * Percentual (centésimos de ponto: 5000 = 50%) do capital -> quotas de uma classe
 * com o valor unitário informado. Bloqueia se não der número inteiro.
 */
export function percentualParaQuotas(
  percentualCent: number,
  capitalCentavos: number,
  valorQuotaCentavos: number,
): ResultadoConversao {
  if (valorQuotaCentavos <= 0 || capitalCentavos <= 0) {
    return { ok: false, motivo: 'Informe primeiro o capital social e o valor unitário da quota.', abaixo: 0, acima: 0 };
  }
  const numerador = percentualCent * capitalCentavos;
  const denominador = 10000 * valorQuotaCentavos;
  if (numerador % denominador === 0) return { ok: true, quotas: numerador / denominador };
  const abaixo = Math.floor(numerador / denominador);
  return {
    ok: false,
    motivo: 'O percentual informado não resulta em um número inteiro de quotas.',
    abaixo,
    acima: abaixo + 1,
  };
}
