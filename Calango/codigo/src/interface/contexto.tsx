// Estado compartilhado da aplicação: pasta de dados aberta, configurações,
// biblioteca, empresas, navegação e mensagens.

import { createContext, useContext } from 'react';
import type { Repositorio, Lido } from '../armazenamento/repositorio';
import type { Configuracoes } from '../armazenamento/configuracoes';
import type { Clausula } from '../motor/clausula';
import type { Empresa } from '../dados/tipos';

export type Tela =
  | { nome: 'inicio' }
  | { nome: 'novo-documento' }
  | { nome: 'assistente'; caminho: string; atoId: string }
  | { nome: 'empresas' }
  | { nome: 'empresa'; caminho: string }
  | { nome: 'biblioteca' }
  | { nome: 'editor-clausula'; id: string | null; duplicarDe?: string }
  | { nome: 'configuracoes' }
  | { nome: 'exportar' };

export type TipoMensagem = 'ok' | 'erro' | 'aviso' | 'info';

export interface Mensagem {
  id: number;
  tipo: TipoMensagem;
  texto: string;
}

export interface Sessao {
  repo: Repositorio;
  config: Lido<Configuracoes>;
  clausulas: Lido<Clausula>[];
  empresas: Lido<Empresa>[];
  errosLeitura: string[];
}

export interface ContextoApp {
  sessao: Sessao;
  ir: (t: Tela) => void;
  avisar: (tipo: TipoMensagem, texto: string) => void;
  recarregar: () => Promise<void>;
  trocarPasta: () => void;
  /** Busca a cláusula (versão atual) pelo id. */
  buscarClausula: (id: string) => Clausula | undefined;
  /** Atualiza uma empresa na lista em memória depois de gravar. */
  atualizarEmpresaLocal: (lida: Lido<Empresa>) => void;
  removerEmpresaLocal: (caminho: string) => void;
  atualizarClausulaLocal: (lida: Lido<Clausula>) => void;
  atualizarConfigLocal: (lida: Lido<Configuracoes>) => void;
  /** Avisa se há alterações não salvas (para perguntar antes de sair da tela). */
  marcarAlterado: (alterado: boolean) => void;
}

export const Contexto = createContext<ContextoApp | null>(null);

export function useApp(): ContextoApp {
  const c = useContext(Contexto);
  if (!c) throw new Error('Contexto do Calango não encontrado.');
  return c;
}

/** Mensagem amigável para qualquer erro. */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
      return 'O navegador não deu permissão para usar a pasta de dados. Clique em "Liberar acesso" ou escolha a pasta de novo.';
    }
    if (e.name === 'NotFoundError') {
      return 'A pasta de dados não foi encontrada (foi movida, renomeada ou a rede está fora do ar). Verifique a rede e escolha a pasta de novo.';
    }
    if (e.name === 'NoModificationAllowedError' || e.name === 'InvalidStateError') {
      return 'Não foi possível gravar: o arquivo está bloqueado ou foi alterado. Tente de novo em alguns segundos.';
    }
    if (e.name === 'QuotaExceededError') return 'Não há espaço suficiente no disco da pasta de dados.';
    return e.message;
  }
  return String(e);
}
