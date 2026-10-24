import { db } from './db';
import { obterUsuarioAtual } from './sessao';
import { agoraTimestamp } from '../lib/date';
import type { AcaoAuditoria, DiferencaCampo } from './types';

const CAMPOS_IGNORADOS = new Set(['id', 'contaIds', 'alteradoEm', 'alteradoPor']);

/** Compara dois objetos (raso) e devolve os campos que mudaram. */
export function calcularDiferencas(antes: object | undefined, depois: object | undefined): DiferencaCampo[] {
  const a = (antes ?? {}) as Record<string, unknown>;
  const d = (depois ?? {}) as Record<string, unknown>;
  const campos = new Set([...Object.keys(a), ...Object.keys(d)]);
  const difs: DiferencaCampo[] = [];
  for (const campo of campos) {
    if (CAMPOS_IGNORADOS.has(campo)) continue;
    if (JSON.stringify(a[campo]) !== JSON.stringify(d[campo])) {
      difs.push({ campo, de: a[campo], para: d[campo] });
    }
  }
  return difs;
}

interface DadosAuditoria {
  empresaId?: number;
  entidade: string;
  entidadeId?: number;
  acao: AcaoAuditoria;
  descricao: string;
  antes?: object;
  depois?: object;
}

/**
 * Registra uma entrada na trilha de auditoria (quem, quando, o que mudou).
 * Deve ser chamada DENTRO da mesma transação da alteração, incluindo a tabela "auditoria".
 */
export async function registrarAuditoria(dados: DadosAuditoria): Promise<void> {
  const diferencas = dados.acao === 'ALTERAR' ? calcularDiferencas(dados.antes, dados.depois) : undefined;
  await db.auditoria.add({
    empresaId: dados.empresaId,
    data: agoraTimestamp(),
    usuario: obterUsuarioAtual(),
    entidade: dados.entidade,
    entidadeId: dados.entidadeId,
    acao: dados.acao,
    descricao: dados.descricao,
    diferencas,
    antes: dados.acao === 'EXCLUIR' ? dados.antes : undefined,
    depois: dados.acao === 'CRIAR' ? dados.depois : undefined,
  });
}
