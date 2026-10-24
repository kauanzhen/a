#!/usr/bin/env node
/**
 * Validador do lote de lançamentos sugeridos (contabil-escola/lote-lancamentos).
 * Sem dependências. Uso:
 *   node validar-lote.mjs <lote.json> [contexto-contabil.json]
 * Com o contexto, confere também contas, centros de custo e períodos abertos.
 * Sai com código 1 se houver erro. O sistema valida de novo ao importar — isto é a autoconferência do assistente.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const CONFIANCAS = ['alta', 'media', 'baixa'];
const ORIGENS = ['email', 'mensagem', 'documento', 'extrato', 'outro'];

function dataValida(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function centavos(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.round(Number((v * 100).toPrecision(15)));
}

function reais(c) {
  return (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Retorna { erros: string[], avisos: string[] }. */
export function validarLote(lote, contexto) {
  const erros = [];
  const avisos = [];
  if (!lote || typeof lote !== 'object') return { erros: ['O lote não é um objeto JSON.'], avisos };
  if (lote.formato && lote.formato !== 'contabil-escola/lote-lancamentos') erros.push(`formato deve ser "contabil-escola/lote-lancamentos" (veio "${lote.formato}").`);
  if (!Array.isArray(lote.lancamentos)) return { erros: [...erros, '"lancamentos" deve ser uma lista.'], avisos };
  if (!Array.isArray(lote.naoLancados)) avisos.push('"naoLancados" ausente: inclua [] se todas as mensagens geraram lançamento.');
  if (contexto && lote.empresaCnpj && contexto.empresa?.cnpj && lote.empresaCnpj !== contexto.empresa.cnpj) {
    erros.push(`empresaCnpj (${lote.empresaCnpj}) diferente do contexto (${contexto.empresa.cnpj}).`);
  }

  const contas = new Map();
  for (const c of contexto?.contas ?? []) {
    contas.set(c.codigo, c);
    if (c.reduzido !== undefined) contas.set(String(c.reduzido), c);
  }
  const centros = new Set((contexto?.centrosCusto ?? []).map((c) => c.codigo));
  const abertos = new Set((contexto?.periodosAbertos ?? []).map((p) => p.competencia));
  const ids = new Set();
  const assinaturas = new Map();

  lote.lancamentos.forEach((l, i) => {
    const rot = `Lançamento ${l?.id ?? `#${i + 1}`}`;
    if (!l || typeof l !== 'object') return erros.push(`${rot}: não é um objeto.`);
    if (!l.id) erros.push(`${rot}: falta "id".`);
    else if (ids.has(l.id)) erros.push(`${rot}: id repetido.`);
    ids.add(l.id);
    if (!dataValida(l.data)) erros.push(`${rot}: data "${l.data}" inválida (use AAAA-MM-DD).`);
    else if (contexto && !abertos.has(l.data.slice(0, 7))) avisos.push(`${rot}: ${l.data} não está em período aberto — o sistema vai rejeitar; marque confiança "baixa" e explique em "duvidas".`);
    if (!String(l.historico ?? '').trim()) erros.push(`${rot}: falta "historico".`);
    if (!CONFIANCAS.includes(l.confianca)) erros.push(`${rot}: confianca deve ser alta, media ou baixa.`);
    if (!l.origem || !ORIGENS.includes(l.origem.tipo)) erros.push(`${rot}: origem.tipo deve ser ${ORIGENS.join(', ')}.`);
    else if (!String(l.origem.referencia ?? '').trim()) avisos.push(`${rot}: preencha origem.referencia (remetente/assunto/data ou arquivo).`);
    if (!Array.isArray(l.duvidas)) erros.push(`${rot}: "duvidas" deve ser uma lista (pode ser vazia).`);
    if (!Array.isArray(l.partidas) || l.partidas.length < 2) return erros.push(`${rot}: precisa de pelo menos 2 partidas.`);
    let d = 0;
    let c = 0;
    l.partidas.forEach((p, j) => {
      const rp = `${rot}, partida ${j + 1}`;
      if (p.tipo !== 'D' && p.tipo !== 'C') erros.push(`${rp}: tipo deve ser "D" ou "C".`);
      const v = centavos(p.valor);
      if (v === null || v <= 0) erros.push(`${rp}: valor deve ser número positivo em reais (veio ${JSON.stringify(p.valor)}).`);
      else if (Math.abs(v - p.valor * 100) > 1e-6) erros.push(`${rp}: valor com mais de 2 casas decimais (${p.valor}).`);
      else if (p.tipo === 'D') d += v;
      else if (p.tipo === 'C') c += v;
      if (contexto) {
        const conta = contas.get(String(p.conta));
        if (!conta) erros.push(`${rp}: conta "${p.conta}" não existe entre as analíticas ativas do contexto.`);
        else if (conta.exigeCentroCusto && !centros.has(p.centroCusto)) erros.push(`${rp}: a conta ${conta.codigo} (${conta.nome}) exige centroCusto válido (${[...centros].join(', ')}).`);
      }
      if (p.centroCusto && contexto && !centros.has(p.centroCusto)) erros.push(`${rp}: centro de custo "${p.centroCusto}" não existe.`);
    });
    if (!l.partidas.some((p) => p.tipo === 'D') || !l.partidas.some((p) => p.tipo === 'C')) erros.push(`${rot}: precisa de ao menos um débito e um crédito.`);
    if (d !== c) erros.push(`${rot}: desbalanceado — débitos ${reais(d)} ≠ créditos ${reais(c)}.`);
    const assinatura = `${l.data}|${d}|${String(l.documento ?? '').trim().toLowerCase()}`;
    if (assinaturas.has(assinatura)) avisos.push(`${rot}: mesma data, valor e documento de ${assinaturas.get(assinatura)} — possível duplicidade.`);
    else assinaturas.set(assinatura, rot);
  });
  return { erros, avisos };
}

function principal() {
  const [arqLote, arqContexto] = process.argv.slice(2);
  if (!arqLote) {
    console.error('Uso: node validar-lote.mjs <lote.json> [contexto-contabil.json]');
    process.exit(2);
  }
  const ler = (f) => JSON.parse(readFileSync(f, 'utf8'));
  let lote;
  let contexto;
  try {
    lote = ler(arqLote);
    contexto = arqContexto ? ler(arqContexto) : undefined;
  } catch (e) {
    console.error(`Não foi possível ler o JSON: ${e.message}`);
    process.exit(1);
  }
  const { erros, avisos } = validarLote(lote, contexto);
  const n = Array.isArray(lote.lancamentos) ? lote.lancamentos.length : 0;
  console.log(`Lote com ${n} lançamento(s)${contexto ? ` para ${contexto.empresa?.razaoSocial}` : ' (sem contexto: contas e períodos não conferidos)'}.`);
  for (const a of avisos) console.log(`AVISO: ${a}`);
  for (const e of erros) console.log(`ERRO: ${e}`);
  console.log(erros.length ? `\n${erros.length} erro(s). Corrija antes de entregar.` : '\nOK — nenhum erro estrutural. O usuário ainda revisa e aprova no sistema.');
  process.exit(erros.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) principal();
