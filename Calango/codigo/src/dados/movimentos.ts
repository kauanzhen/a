// Movimentação de quotas numa alteração contratual: aumentos, reduções e
// cessões. O novo quadro societário NÃO é digitado: é calculado a partir do
// quadro vigente + movimentos (os dados são a fonte da verdade).

import { CLASSE_UNICA, type DadosEmpresa, type MovimentoQuotas, type Participacao, type Pessoa } from './tipos';
import { buscarPessoa, classesEfetivas, quotasNaClasse, valorQuotaDaClasse } from './quotas';
import { agruparMilhares } from '../lib/dinheiro';

export interface ResultadoMovimentos {
  dados: DadosEmpresa;
  erros: string[];
}

function nome(d: DadosEmpresa, id: string): string {
  return buscarPessoa(d, id)?.nome || 'pessoa sem nome';
}

function nomeClasse(d: DadosEmpresa, id: string): string {
  return id === CLASSE_UNICA ? '' : ` da classe ${classesEfetivas(d).find((c) => c.id === id)?.nome ?? id}`;
}

/**
 * Aplica os movimentos sobre o quadro de `antes` e devolve `depois` com o novo
 * quadro e o novo capital. Sócios que ficam sem quotas saem do quadro (mas a
 * pessoa continua cadastrada, para a qualificação e a assinatura do ato).
 */
export function aplicarMovimentos(antes: DadosEmpresa, depois: DadosEmpresa, movimentos: MovimentoQuotas[]): ResultadoMovimentos {
  const erros: string[] = [];
  const quadro = new Map<string, Record<string, number>>();
  for (const p of antes.participacoes) quadro.set(p.pessoa_id, { ...p.quotas });
  const pegar = (id: string) => {
    if (!quadro.has(id)) quadro.set(id, {});
    return quadro.get(id)!;
  };
  let delta = 0; // variação do capital, em centavos

  movimentos.forEach((m, i) => {
    const n = i + 1;
    if (!Number.isInteger(m.quotas) || m.quotas <= 0) {
      erros.push(`Movimento ${n}: informe uma quantidade inteira de quotas maior que zero.`);
      return;
    }
    const classe = classesEfetivas(depois).find((c) => c.id === m.classe_id) ?? classesEfetivas(antes).find((c) => c.id === m.classe_id);
    if (!classe) {
      erros.push(`Movimento ${n}: escolha a classe das quotas.`);
      return;
    }
    const valorQuota = valorQuotaDaClasse(depois, classe);
    if (m.tipo === 'cessao') {
      if (!m.cedente_id || !m.cessionario_id) return void erros.push(`Cessão ${n}: escolha quem cede e quem recebe as quotas.`);
      if (m.cedente_id === m.cessionario_id) return void erros.push(`Cessão ${n}: quem cede e quem recebe não podem ser a mesma pessoa.`);
      const q = pegar(m.cedente_id);
      const tem = q[m.classe_id] ?? 0;
      if (tem < m.quotas) {
        return void erros.push(
          `Cessão ${n}: ${nome(depois, m.cedente_id)} tem ${agruparMilhares(tem)} quotas${nomeClasse(depois, m.classe_id)} e não pode ceder ${agruparMilhares(m.quotas)}.`,
        );
      }
      q[m.classe_id] = tem - m.quotas;
      const r = pegar(m.cessionario_id);
      r[m.classe_id] = (r[m.classe_id] ?? 0) + m.quotas;
    } else if (m.tipo === 'aumento') {
      if (!m.socio_id) return void erros.push(`Aumento ${n}: escolha quem subscreve as novas quotas.`);
      const q = pegar(m.socio_id);
      q[m.classe_id] = (q[m.classe_id] ?? 0) + m.quotas;
      delta += m.quotas * valorQuota;
    } else {
      if (!m.socio_id) return void erros.push(`Redução ${n}: escolha de quem são as quotas reduzidas.`);
      const q = pegar(m.socio_id);
      const tem = q[m.classe_id] ?? 0;
      if (tem < m.quotas) {
        return void erros.push(`Redução ${n}: ${nome(depois, m.socio_id)} tem ${agruparMilhares(tem)} quotas e não pode ter ${agruparMilhares(m.quotas)} reduzidas.`);
      }
      q[m.classe_id] = tem - m.quotas;
      delta -= m.quotas * valorQuota;
    }
  });

  // Ordem do novo quadro: sócios antigos (na ordem de antes) e depois os novos.
  const ordem = [...antes.participacoes.map((p) => p.pessoa_id), ...[...quadro.keys()].filter((id) => !antes.participacoes.some((p) => p.pessoa_id === id))];
  const participacoes: Participacao[] = [];
  for (const id of ordem) {
    const q = quadro.get(id) ?? {};
    const total = Object.values(q).reduce((s, x) => s + x, 0);
    if (total > 0) participacoes.push({ pessoa_id: id, quotas: q });
  }
  if (participacoes.length === 0) erros.push('Depois dos movimentos não sobra nenhum sócio. Revise as cessões e reduções.');
  const ids = new Set(participacoes.map((p) => p.pessoa_id));
  return {
    dados: {
      ...depois,
      participacoes,
      capital: { ...depois.capital, valor_centavos: antes.capital.valor_centavos + delta },
      administracao: { ...depois.administracao },
      pro_labore: depois.pro_labore.filter((id) => ids.has(id) || !antes.participacoes.some((p) => p.pessoa_id === id)),
    },
    erros,
  };
}

// ---------------- Comparações antes x depois ----------------

export function idsSocios(d: DadosEmpresa): string[] {
  return d.participacoes.map((p) => p.pessoa_id);
}

/** Pessoas que entram no quadro (estão em depois e não em antes). */
export function ingressantes(antes: DadosEmpresa, depois: DadosEmpresa): string[] {
  const a = new Set(idsSocios(antes));
  return idsSocios(depois).filter((id) => !a.has(id));
}

/** Pessoas que saem do quadro (estavam em antes e não estão em depois). */
export function retirantes(antes: DadosEmpresa, depois: DadosEmpresa): string[] {
  const d = new Set(idsSocios(depois));
  return idsSocios(antes).filter((id) => !d.has(id));
}

/**
 * Pessoas que participam do ato (assinam e são qualificadas): sócios antes do
 * ato (inclusive quem sai) e quem entra. Usa os dados mais novos de cada pessoa.
 */
export function pessoasDoAto(antes: DadosEmpresa, depois: DadosEmpresa): Pessoa[] {
  const ids = [...idsSocios(antes), ...ingressantes(antes, depois)];
  return ids.map((id) => buscarPessoa(depois, id) ?? buscarPessoa(antes, id)).filter((p): p is Pessoa => !!p);
}

export function quotasDe(p: Participacao | undefined, classe: string): number {
  return quotasNaClasse(p, classe);
}

const limpar = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function mudouSede(a: DadosEmpresa, d: DadosEmpresa): boolean {
  const k = (x: DadosEmpresa) =>
    [x.sede.logradouro, x.sede.numero, x.sede.complemento, x.sede.bairro, x.sede.cidade, x.sede.uf, x.sede.cep.replace(/\D/g, '')].map(limpar).join('|');
  return k(a) !== k(d);
}

export function mudouObjeto(a: DadosEmpresa, d: DadosEmpresa): boolean {
  const k = (x: DadosEmpresa) =>
    x.objeto_social.forma === 'lista' ? `L|${x.objeto_social.itens.map(limpar).filter(Boolean).join('|')}` : `T|${limpar(x.objeto_social.texto)}`;
  return k(a) !== k(d);
}

export function mudouCnaes(a: DadosEmpresa, d: DadosEmpresa): boolean {
  const k = (x: DadosEmpresa) =>
    x.cnaes
      .map((c) => `${c.codigo.replace(/\D/g, '')}:${c.tipo}:${limpar(c.descricao)}`)
      .sort()
      .join('|');
  return k(a) !== k(d);
}

export function mudouAdministracao(a: DadosEmpresa, d: DadosEmpresa): boolean {
  const k = (x: DadosEmpresa) => `${[...x.administracao.administradores].sort().join(',')}|${x.administracao.administradores.length > 1 ? x.administracao.forma : ''}`;
  return k(a) !== k(d);
}
