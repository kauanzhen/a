// Regras dos ATOS (documentos): conjunto padrão de cláusulas, campos do
// formulário, montagem, pendências e registro. Funções puras.

import { analisarExpressao, avaliarExpressao } from '../motor/expressao';
import { camposDaClausula } from '../motor/campos';
import { conteudoNaVersao, type Clausula } from '../motor/clausula';
import { montarDocumento, verificarRegras, type DocumentoMontado, type PendenciaDoc } from '../motor/montagem';
import type { DefinicaoDocumento, DefinicaoTipoSocietario } from '../tipos/definicoes';
import { situacao } from '../dados/quotas';
import { validarDados, type Pendencia } from '../dados/validacao';
import { dadosVazios, novaEmpresa, novoAto, opcoesAtoPadrao } from '../dados/fabricas';
import type { Ato, DadosEmpresa, Empresa, ItemSelecao, OpcoesAto } from '../dados/tipos';
import type { Configuracoes } from '../armazenamento/configuracoes';
import { hojeISO } from '../lib/datas';

export type SituacaoEscolhida = 'unipessoal' | 'pluripessoal';

/**
 * A condição de exibição combina com a situação escolhida? Nomes que não são
 * de situação contam como "talvez" (verdadeiro) — a decisão final é na montagem.
 */
export function combinaComSituacao(condicao: string, s: SituacaoEscolhida): boolean {
  if (!condicao.trim()) return true;
  try {
    const x = analisarExpressao(condicao);
    return avaliarExpressao(x, (nome) => {
      if (nome === 'unipessoal') return s === 'unipessoal';
      if (nome === 'pluripessoal') return s === 'pluripessoal';
      return true;
    });
  } catch {
    return true;
  }
}

/** Conjunto padrão de cláusulas do documento para a situação escolhida. */
export function selecaoPadrao(
  def: DefinicaoDocumento,
  buscar: (id: string) => Clausula | undefined,
  s: SituacaoEscolhida,
): Record<string, ItemSelecao[]> {
  const r: Record<string, ItemSelecao[]> = {};
  for (const area of def.areas) {
    r[area.id] = [];
    for (const id of def.padrao[area.id] ?? []) {
      const c = buscar(id);
      if (!c || c.arquivada) continue;
      if (!combinaComSituacao(c.regras.condicao_de_exibicao, s)) continue;
      r[area.id].push({ clausula_id: id, versao: c.versao, ativa: true });
    }
  }
  return r;
}

/** Campos do formulário exigidos pelas cláusulas ativas (sem repetir). */
export function camposDoAto(
  selecao: Record<string, ItemSelecao[]>,
  buscar: (id: string) => Clausula | undefined,
  tipo: DefinicaoTipoSocietario,
): Set<string> {
  const campos = new Set<string>();
  const buscarConteudo = (id: string) => {
    const c = buscar(id);
    return c ? conteudoNaVersao(c) : undefined;
  };
  for (const itens of Object.values(selecao)) {
    for (const i of itens) {
      if (!i.ativa) continue;
      const c = buscar(i.clausula_id);
      if (!c) continue;
      for (const campo of camposDaClausula(c, tipo, buscarConteudo).campos) campos.add(campo);
    }
  }
  return campos;
}

export interface ResultadoRevisao {
  documento: DocumentoMontado;
  pendencias: PendenciaDoc[];
}

/** Monta o documento e junta todas as pendências (dados, regras e texto). */
export function revisarAto(
  ato: Ato,
  def: DefinicaoDocumento,
  tipo: DefinicaoTipoSocietario,
  buscar: (id: string) => Clausula | undefined,
): ResultadoRevisao {
  const documento = montarDocumento({
    definicao: def,
    selecao: ato.selecao,
    contexto: { dados: ato.dados_depois, tipo, opcoes: ato.opcoes },
    buscarClausula: buscar,
    fixarVersoes: ato.status !== 'rascunho',
  });
  const campos = camposDoAto(ato.selecao, buscar, tipo);
  const validacao: PendenciaDoc[] = validarDados(ato.dados_depois, campos, { tipo, opcoesAto: ato.opcoes }).map(
    (p: Pendencia) => ({ nivel: p.nivel, mensagem: p.mensagem, campos: p.campo ? [p.campo] : [] }),
  );
  const regras: PendenciaDoc[] = verificarRegras(ato.selecao, buscar).map((r) => ({ nivel: r.nivel, mensagem: r.mensagem }));
  const sit = situacao(ato.dados_depois);
  const avisoSituacao: PendenciaDoc[] =
    sit !== 'sem_socios' && sit !== ato.opcoes.situacao_escolhida
      ? [
          {
            nivel: 'aviso',
            mensagem:
              sit === 'unipessoal'
                ? 'Na Etapa 1 você escolheu cláusulas para empresa com vários sócios, mas cadastrou um só. Confira a lista de cláusulas.'
                : 'Na Etapa 1 você escolheu cláusulas para empresa unipessoal, mas cadastrou mais de um sócio. Confira a lista de cláusulas.',
          },
        ]
      : [];
  // Validação primeiro (diz qual campo preencher); depois o que veio do texto.
  const todas = [...validacao, ...regras, ...avisoSituacao, ...documento.pendencias];
  const vistos = new Set<string>();
  const pendencias = todas.filter((p) => {
    if (vistos.has(p.mensagem)) return false;
    vistos.add(p.mensagem);
    return true;
  });
  return { documento, pendencias };
}

export function temErros(p: PendenciaDoc[]): boolean {
  return p.some((x) => x.nivel === 'erro');
}

/** Nova empresa em abertura, já com o rascunho do contrato. */
export function iniciarAbertura(
  def: DefinicaoDocumento,
  tipo: DefinicaoTipoSocietario,
  buscar: (id: string) => Clausula | undefined,
  cfg: Configuracoes,
  s: SituacaoEscolhida = 'pluripessoal',
): { empresa: Empresa; ato: Ato } {
  const empresa = novaEmpresa(tipo.id);
  const opcoes: OpcoesAto = { ...opcoesAtoPadrao(cfg.padroes.cidade, cfg.padroes.uf), situacao_escolhida: s };
  const ato = novoAto(def.id, null, opcoes);
  const dados: DadosEmpresa = dadosVazios();
  dados.junta_uf = cfg.padroes.uf;
  dados.foro = { cidade: cfg.padroes.cidade, uf: cfg.padroes.uf };
  ato.dados_depois = dados;
  ato.selecao = selecaoPadrao(def, buscar, s);
  empresa.atos.push(ato);
  return { empresa, ato };
}

/** Razão social para mostrar (vigente ou do último ato). */
export function nomeDaEmpresa(e: Empresa): string {
  return (
    e.vigente?.razao_social?.trim() ||
    [...e.atos].reverse().find((a) => a.dados_depois.razao_social.trim())?.dados_depois.razao_social.trim() ||
    '(empresa sem razão social)'
  );
}

export function situacaoCadastro(e: Empresa): string {
  if (e.vigente) return 'Registrada';
  if (e.atos.some((a) => a.tipo_documento === 'abertura')) return 'Em abertura';
  return 'Sem cadastro';
}

/** Substitui um ato dentro da empresa (sem alterar o original). */
export function comAto(e: Empresa, ato: Ato): Empresa {
  return { ...e, atos: e.atos.map((a) => (a.id === ato.id ? { ...ato, atualizado_em: new Date().toISOString() } : a)) };
}

/** Marca o ato como gerado, guardando as versões das cláusulas usadas. */
export function marcarGerado(ato: Ato, doc: DocumentoMontado, nomeArquivo: string, agora = new Date()): Ato {
  const versoes = new Map(doc.usadas.map((u) => [u.clausula_id, u.versao]));
  const selecao: Record<string, ItemSelecao[]> = {};
  for (const [area, itens] of Object.entries(ato.selecao)) {
    selecao[area] = itens.map((i) => ({ ...i, versao: versoes.get(i.clausula_id) ?? i.versao }));
  }
  return {
    ...ato,
    status: ato.status === 'registrado' ? 'registrado' : 'gerado',
    gerado_em: agora.toISOString(),
    arquivo_gerado: nomeArquivo,
    selecao,
  };
}

/** Volta um ato gerado para rascunho (para corrigir e gerar de novo). */
export function voltarParaRascunho(ato: Ato): Ato {
  return { ...ato, status: 'rascunho' };
}

export interface DadosRegistro {
  data: string; // AAAA-MM-DD
  numero: string; // número/protocolo do registro
  nire: string;
  cnpj: string;
}

/**
 * Marca o ato como REGISTRADO. Só agora o cadastro vigente da empresa é
 * atualizado com os dados do ato.
 */
export function marcarRegistrado(e: Empresa, atoId: string, r: DadosRegistro): Empresa {
  const ato = e.atos.find((a) => a.id === atoId);
  if (!ato) throw new Error('Ato não encontrado.');
  if (ato.status === 'rascunho') throw new Error('Gere o documento antes de marcá-lo como registrado.');
  const vigente: DadosEmpresa = structuredClone(ato.dados_depois);
  if (ato.tipo_documento === 'abertura') {
    vigente.data_registro = r.data || vigente.data_registro;
    if (r.nire.trim()) vigente.nire = r.nire.trim();
    vigente.numero_ultima_alteracao = 0;
  } else if (ato.tipo_documento === 'alteracao') {
    vigente.numero_ultima_alteracao = (ato.dados_antes?.numero_ultima_alteracao ?? 0) + 1;
  }
  if (r.cnpj.trim()) vigente.cnpj = r.cnpj.trim();
  const atualizado: Ato = { ...ato, status: 'registrado', registro: { data: r.data || hojeISO(), numero: r.numero.trim() } };
  return { ...e, vigente, atos: e.atos.map((a) => (a.id === atoId ? atualizado : a)) };
}
