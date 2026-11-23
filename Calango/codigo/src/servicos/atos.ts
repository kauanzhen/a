// Regras dos ATOS (documentos): conjunto padrão de cláusulas, campos do
// formulário, montagem, pendências e registro. Funções puras.

import { analisarExpressao, type Expr } from '../motor/expressao';
import { camposDaClausula } from '../motor/campos';
import { conteudoNaVersao, type Clausula } from '../motor/clausula';
import { Avaliador } from '../motor/avaliador';
import { montarDocumento, verificarRegras, type DocumentoMontado, type PendenciaDoc } from '../motor/montagem';
import type { DefinicaoDocumento, DefinicaoTipoSocietario } from '../tipos/definicoes';
import { documento, tipoDoAto, tipoSocietario } from '../tipos/registro';
import { situacao, socios } from '../dados/quotas';
import { validarDados, type Pendencia } from '../dados/validacao';
import { dadosVazios, distratoVazio, novaEmpresa, novoAto, opcoesAtoPadrao } from '../dados/fabricas';
import { aplicarMovimentos } from '../dados/movimentos';
import { CLASSE_UNICA, type Ato, type DadosEmpresa, type Empresa, type ItemSelecao, type OpcoesAto } from '../dados/tipos';
import type { Configuracoes } from '../armazenamento/configuracoes';
import { dataValida, hojeISO } from '../lib/datas';

export type SituacaoEscolhida = 'unipessoal' | 'pluripessoal';

/**
 * A condição de exibição combina com a situação escolhida? Nomes que não são
 * de situação contam como "talvez" (verdadeiro) — a decisão final é na montagem.
 */
export function combinaComSituacao(condicao: string, s: SituacaoEscolhida): boolean {
  if (!condicao.trim()) return true;
  try {
    // Lógica de três valores: o que não é situação fica "indefinido" (decidido na montagem).
    const avaliar = (x: Expr): boolean | null => {
      switch (x.tipo) {
        case 'nome':
          if (x.nome === 'unipessoal') return s === 'unipessoal';
          if (x.nome === 'pluripessoal') return s === 'pluripessoal';
          return null;
        case 'comparacao':
          return null;
        case 'nao': {
          const v = avaliar(x.expr);
          return v === null ? null : !v;
        }
        case 'e': {
          const a = avaliar(x.esq);
          const b = avaliar(x.dir);
          if (a === false || b === false) return false;
          return a === null || b === null ? null : true;
        }
        case 'ou': {
          const a = avaliar(x.esq);
          const b = avaliar(x.dir);
          if (a === true || b === true) return true;
          return a === null || b === null ? null : false;
        }
      }
    };
    return avaliar(analisarExpressao(condicao)) !== false;
  } catch {
    return true;
  }
}

/**
 * Conjunto padrão de cláusulas do documento para a situação escolhida.
 * Áreas marcadas com "padrao_contrato_vigente" usam as cláusulas do contrato
 * vigente da empresa (quando o Calango as conhece).
 */
export function selecaoPadrao(
  def: DefinicaoDocumento,
  buscar: (id: string) => Clausula | undefined,
  s: SituacaoEscolhida,
  clausulasVigentes: string[] = [],
): Record<string, ItemSelecao[]> {
  const r: Record<string, ItemSelecao[]> = {};
  for (const area of def.areas) {
    r[area.id] = [];
    const ids = area.padrao_contrato_vigente && clausulasVigentes.length ? clausulasVigentes : (def.padrao[area.id] ?? []);
    for (const id of ids) {
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

/** Textos (corpos) das cláusulas ativas — usado para descobrir as cláusulas citadas. */
export function corposDoAto(selecao: Record<string, ItemSelecao[]>, buscar: (id: string) => Clausula | undefined): string[] {
  return Object.values(selecao)
    .flat()
    .filter((i) => i.ativa)
    .map((i) => buscar(i.clausula_id)?.corpo ?? '');
}

/** Contexto de avaliação de um ato (dados novos, anteriores, movimentos...). */
export function contextoDoAto(ato: Ato, tipo: DefinicaoTipoSocietario) {
  return {
    dados: ato.dados_depois,
    tipo,
    opcoes: ato.opcoes,
    dadosAntes: ato.dados_antes,
    movimentos: ato.movimentos,
    distrato: ato.distrato,
    extras: ato.extras,
  };
}

/** Validações próprias do ato (além dos dados da empresa). */
export function validarAto(ato: Ato, def: DefinicaoDocumento, campos: Set<string>, tipo: DefinicaoTipoSocietario): Pendencia[] {
  const r = validarDados(ato.dados_depois, campos, { tipo, opcoesAto: ato.opcoes });
  if (tipo.max_membros && socios(ato.dados_depois).length > tipo.max_membros) {
    r.push({ nivel: 'erro', secao: 'socios', campo: 'socios', mensagem: `${tipo.nome}: só pode haver ${tipo.max_membros} titular.` });
  }
  if (ato.dados_antes && ato.movimentos.length) {
    for (const e of aplicarMovimentos(ato.dados_antes, ato.dados_depois, ato.movimentos).erros) {
      r.push({ nivel: 'erro', secao: 'alteracao', campo: 'alteracao.quotas', mensagem: e });
    }
  }
  if (campos.has('alteracao.motivo_reducao') && ato.movimentos.some((m) => m.tipo === 'reducao') && !(ato.extras.motivo_reducao ?? '').trim()) {
    r.push({ nivel: 'erro', secao: 'alteracao', campo: 'alteracao.motivo_reducao', mensagem: 'Informe o motivo da redução do capital.' });
  }
  if (def.efeito_registro === 'extincao') {
    const d = ato.distrato ?? distratoVazio();
    const ids = new Set(socios(ato.dados_depois).map((s) => s.pessoa.id));
    if (campos.has('distrato.data_encerramento') && !dataValida(d.data_encerramento))
      r.push({ nivel: 'erro', secao: 'distrato', campo: 'distrato.data_encerramento', mensagem: 'Informe a data de encerramento das atividades.' });
    if (campos.has('distrato.liquidacao') && d.liquidacao === 'partilha' && !d.partilha_descricao.trim())
      r.push({ nivel: 'erro', secao: 'distrato', campo: 'distrato.liquidacao', mensagem: 'Descreva como os haveres são partilhados.' });
    if (campos.has('distrato.responsaveis')) {
      if (!ids.has(d.responsavel_ativo_passivo_id))
        r.push({ nivel: 'erro', secao: 'distrato', campo: 'distrato.responsaveis', mensagem: 'Escolha o responsável pelo ativo e passivo supervenientes.' });
      if (!ids.has(d.responsavel_livros_id))
        r.push({ nivel: 'erro', secao: 'distrato', campo: 'distrato.responsaveis', mensagem: 'Escolha o responsável pela guarda dos livros e documentos.' });
    }
  }
  return r;
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
  const contexto = contextoDoAto(ato, tipo);
  const documento = montarDocumento({
    definicao: def,
    selecao: ato.selecao,
    contexto,
    buscarClausula: buscar,
    fixarVersoes: ato.status !== 'rascunho',
  });
  const campos = camposDoAto(ato.selecao, buscar, tipo);
  const validacao: PendenciaDoc[] = validarAto(ato, def, campos, tipo).map((p: Pendencia) => ({
    nivel: p.nivel,
    mensagem: p.mensagem,
    campos: p.campo ? [p.campo] : [],
  }));
  const regras: PendenciaDoc[] = verificarRegras(ato.selecao, buscar).map((r) => ({ nivel: r.nivel, mensagem: r.mensagem }));
  const extras: PendenciaDoc[] = [];
  const sit = situacao(ato.dados_depois);
  if (def.empresa === 'nova' && sit !== 'sem_socios' && sit !== ato.opcoes.situacao_escolhida) {
    extras.push({
      nivel: 'aviso',
      mensagem:
        sit === 'unipessoal'
          ? 'Na Etapa 1 você escolheu cláusulas para empresa com vários sócios, mas cadastrou um só. Confira a lista de cláusulas.'
          : 'Na Etapa 1 você escolheu cláusulas para empresa unipessoal, mas cadastrou mais de um sócio. Confira a lista de cláusulas.',
    });
  }
  if (def.efeito_registro === 'alteracao') {
    const numeradas = documento.numeracao.filter((n) => n.area === 'alteracoes').length;
    if (numeradas === 0) {
      extras.push({
        nivel: 'erro',
        mensagem: 'Nenhuma alteração foi feita. Na Etapa 2, mude o que a alteração contratual deve mudar (endereço, capital, sócios, administração...).',
      });
    }
    // Dado mudou, mas a cláusula de alteração correspondente foi tirada do documento.
    const av = new Avaliador({ ...contexto, buscarClausula: (id) => buscar(id), profundidade: 0 });
    const ativas = new Set((ato.selecao.alteracoes ?? []).filter((i) => i.ativa).map((i) => i.clausula_id));
    for (const id of def.padrao.alteracoes ?? []) {
      const c = buscar(id);
      if (!c || ativas.has(id) || !c.regras.condicao_de_exibicao) continue;
      if (av.condicao(c.regras.condicao_de_exibicao)) {
        extras.push({ nivel: 'aviso', mensagem: `O dado de “${c.titulo_interno.replace(/^Alteração — /, '')}” mudou, mas essa cláusula de alteração não está no documento (Etapa 1).` });
      }
    }
  }
  const todas = [...validacao, ...regras, ...extras, ...documento.pendencias];
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

/** Documentos que podem ser feitos agora para esta empresa (alteração, distrato, transformação). */
export function documentosPossiveis(e: Empresa): { def: DefinicaoDocumento; motivo?: string }[] {
  const r: { def: DefinicaoDocumento; motivo?: string }[] = [];
  for (const id of tipoSocietario(e.tipo_societario).documentos) {
    const def = documento(id);
    if (def.empresa !== 'existente') continue;
    let motivo: string | undefined;
    if (e.extinta_em) motivo = 'A empresa está extinta (distrato registrado).';
    else if (!e.vigente) motivo = 'A empresa ainda não tem cadastro vigente (falta registrar a abertura ou cadastrar os dados).';
    else if (e.atos.some((a) => a.status !== 'registrado' && documento(a.tipo_documento).empresa === 'existente'))
      motivo = 'Já existe um documento em andamento para esta empresa. Conclua-o (marque como registrado) ou apague-o antes.';
    else if (def.exige_unipessoal && situacao(e.vigente) !== 'unipessoal') motivo = 'Só para empresa com um único sócio.';
    r.push({ def, motivo });
  }
  return r;
}

/**
 * Começa um ato sobre empresa já registrada (alteração, distrato,
 * transformação). Os dados novos partem do cadastro vigente.
 */
export function iniciarAtoExistente(
  empresa: Empresa,
  def: DefinicaoDocumento,
  buscar: (id: string) => Clausula | undefined,
  cfg: Configuracoes,
): { empresa: Empresa; ato: Ato } {
  if (!empresa.vigente) throw new Error('A empresa não tem cadastro vigente.');
  const vigente = empresa.vigente;
  const s: SituacaoEscolhida = situacao(vigente) === 'unipessoal' ? 'unipessoal' : 'pluripessoal';
  const ato = novoAto(def.id, vigente, { ...opcoesAtoPadrao(cfg.padroes.cidade || vigente.sede.cidade, cfg.padroes.uf || vigente.sede.uf), situacao_escolhida: s });
  if (def.efeito_registro === 'extincao') ato.distrato = distratoVazio();
  if (def.tipo_depois === 'ltda' && empresa.tipo_societario !== 'ltda') {
    // EI -> LTDA unipessoal: o titular passa a sócio com todas as quotas.
    const d = ato.dados_depois;
    d.quotas = { modo: 'unica', classes: [] };
    d.capital.valor_quota_centavos = 100;
    const titular = d.participacoes[0]?.pessoa_id;
    if (titular) {
      d.participacoes = [{ pessoa_id: titular, quotas: { [CLASSE_UNICA]: Math.floor(d.capital.valor_centavos / 100) } }];
      d.administracao = { administradores: [titular], forma: 'isolada' };
    }
    d.razao_social = d.razao_social.replace(/\s*-\s*(ME|EPP)$/i, '').trim();
  }
  if (def.tipo_depois === 'ei') {
    const d = ato.dados_depois;
    d.quotas = { modo: '', classes: [] };
    d.participacoes = d.participacoes.slice(0, 1).map((p) => ({ pessoa_id: p.pessoa_id, quotas: {} }));
    d.administracao = { administradores: [], forma: 'isolada' };
    d.pro_labore = [];
  }
  ato.selecao = selecaoPadrao(def, buscar, s, vigente.clausulas_vigentes);
  return { empresa: { ...empresa, atos: [...empresa.atos, ato] }, ato };
}

/** Recalcula o novo quadro (e o capital) a partir dos movimentos de quotas. */
export function aplicarMovimentosNoAto(ato: Ato): Ato {
  if (!ato.dados_antes) return ato;
  const { dados } = aplicarMovimentos(ato.dados_antes, ato.dados_depois, ato.movimentos);
  return { ...ato, dados_depois: dados };
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
  if (e.extinta_em) return 'Extinta';
  if (e.vigente) return 'Registrada';
  if (e.atos.some((a) => a.tipo_documento === 'abertura')) return 'Em abertura';
  return 'Sem cadastro';
}

/** Substitui um ato dentro da empresa (sem alterar o original). */
export function comAto(e: Empresa, ato: Ato): Empresa {
  return { ...e, atos: e.atos.map((a) => (a.id === ato.id ? { ...ato, atualizado_em: new Date().toISOString() } : a)) };
}

/** Marca o ato como gerado, guardando as versões das cláusulas usadas e a estrutura do novo contrato. */
export function marcarGerado(ato: Ato, doc: DocumentoMontado, nomeArquivo: string, agora = new Date()): Ato {
  const versoes = new Map(doc.usadas.map((u) => [u.clausula_id, u.versao]));
  const selecao: Record<string, ItemSelecao[]> = {};
  for (const [area, itens] of Object.entries(ato.selecao)) {
    selecao[area] = itens.map((i) => ({ ...i, versao: versoes.get(i.clausula_id) ?? i.versao }));
  }
  const def = documento(ato.tipo_documento);
  const area = def.area_contrato_vigente;
  const estrutura = area
    ? {
        clausulas: doc.usadas.filter((u) => u.area === area).map((u) => u.clausula_id),
        numeracao: Object.fromEntries(doc.numeracao.filter((n) => n.area === area).map((n) => [n.clausula_id, n.numero])),
      }
    : null;
  return {
    ...ato,
    status: ato.status === 'registrado' ? 'registrado' : 'gerado',
    gerado_em: agora.toISOString(),
    arquivo_gerado: nomeArquivo,
    selecao,
    estrutura_gerada: estrutura,
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

/** Mantém só as pessoas que são sócias ou administradoras. */
function semPessoasSoltas(d: DadosEmpresa): DadosEmpresa {
  const ids = new Set([...d.participacoes.map((p) => p.pessoa_id), ...d.administracao.administradores]);
  return { ...d, pessoas: d.pessoas.filter((p) => ids.has(p.id)) };
}

/**
 * Marca o ato como REGISTRADO. Só agora o cadastro da empresa muda:
 * - abertura: o contrato passa a ser o cadastro vigente;
 * - alteração: o cadastro vigente recebe os dados novos (e a consolidação vira o contrato vigente);
 * - distrato: a empresa fica extinta;
 * - transformação: a empresa muda de tipo societário.
 */
export function marcarRegistrado(e: Empresa, atoId: string, r: DadosRegistro): Empresa {
  const ato = e.atos.find((a) => a.id === atoId);
  if (!ato) throw new Error('Ato não encontrado.');
  if (ato.status === 'rascunho') throw new Error('Gere o documento antes de marcá-lo como registrado.');
  const def = documento(ato.tipo_documento);
  const registro = { data: r.data || hojeISO(), numero: r.numero.trim() };
  const atualizado: Ato = { ...ato, status: 'registrado', registro };
  const atos = e.atos.map((a) => (a.id === atoId ? atualizado : a));

  if (def.efeito_registro === 'extincao') {
    return { ...e, atos, extinta_em: registro.data };
  }

  let vigente: DadosEmpresa = semPessoasSoltas(structuredClone(ato.dados_depois));
  if (ato.estrutura_gerada) {
    vigente.clausulas_vigentes = ato.estrutura_gerada.clausulas;
    vigente.numeracao_clausulas = ato.estrutura_gerada.numeracao;
  }
  let tipo = e.tipo_societario;
  if (def.efeito_registro === 'constituicao') {
    vigente.data_registro = r.data || vigente.data_registro;
    if (r.nire.trim()) vigente.nire = r.nire.trim();
    vigente.numero_ultima_alteracao = 0;
  } else if (def.efeito_registro === 'alteracao') {
    vigente.numero_ultima_alteracao = (ato.dados_antes?.numero_ultima_alteracao ?? 0) + 1;
  } else if (def.efeito_registro === 'transformacao') {
    tipo = def.tipo_depois ?? tipo;
    vigente.numero_ultima_alteracao = def.tipo_depois === 'ltda' ? 0 : (ato.dados_antes?.numero_ultima_alteracao ?? 0) + 1;
    if (def.tipo_depois === 'ei') vigente = { ...vigente, numeracao_clausulas: {}, clausulas_vigentes: [] };
  }
  if (r.cnpj.trim()) vigente.cnpj = r.cnpj.trim();
  return { ...e, tipo_societario: tipo, vigente, atos };
}

/** Tipo societário com que o ato é escrito (o novo tipo, numa transformação). */
export function tipoParaAto(e: Empresa, ato: Ato): DefinicaoTipoSocietario {
  return tipoDoAto(e.tipo_societario, documento(ato.tipo_documento));
}
