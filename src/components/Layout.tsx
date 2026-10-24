import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/app';
import { NOMES_REGIME } from '../db/types';

interface ItemMenu {
  rota?: string;
  rotulo: string;
  fase?: number;
}

const MENU: { grupo: string; itens: ItemMenu[] }[] = [
  { grupo: 'Geral', itens: [{ rota: '/', rotulo: 'Início' }] },
  {
    grupo: 'Cadastros',
    itens: [
      { rota: '/empresas', rotulo: 'Empresas' },
      { rota: '/exercicios', rotulo: 'Exercícios e períodos' },
      { rota: '/plano-contas', rotulo: 'Plano de contas' },
      { rota: '/centros-custo', rotulo: 'Centros de custo' },
      { rota: '/historicos', rotulo: 'Históricos padrão' },
      { rota: '/tabelas-fiscais', rotulo: 'Tabelas fiscais' },
    ],
  },
  {
    grupo: 'Escrituração',
    itens: [
      { rota: '/lancamentos', rotulo: 'Lançamentos' },
      { rota: '/modelos', rotulo: 'Lançamentos-modelo' },
      { rota: '/importacao', rotulo: 'Importação Excel' },
      { rota: '/assistente', rotulo: 'Assistente IA (Cowork)' },
    ],
  },
  {
    grupo: 'Em breve',
    itens: [
      { rotulo: 'Relatórios e demonstrações', fase: 2 },
      { rotulo: 'Folha de pagamento', fase: 3 },
      { rotulo: 'Estoque e NF fictícias', fase: 4 },
      { rotulo: 'Financeiro, ativo e tributos', fase: 5 },
    ],
  },
  {
    grupo: 'Sistema',
    itens: [
      { rota: '/auditoria', rotulo: 'Trilha de auditoria' },
      { rota: '/configuracoes', rotulo: 'Configurações e backup' },
      { rota: '/ajuda', rotulo: 'Ajuda e atalhos' },
    ],
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const { empresas, empresaId, selecionarEmpresa, empresa, usuario, tema, definirTema } = useApp();
  const [menuAberto, setMenuAberto] = useState(false);
  const local = useLocation();
  const navegar = useNavigate();

  useEffect(() => setMenuAberto(false), [local.pathname]);

  // atalhos globais: Alt+L = novo lançamento, Alt+I = assistente IA
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      // e.code (tecla física) para funcionar também no macOS, onde Option+letra gera outro caractere
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.code === 'KeyL') {
        e.preventDefault();
        navegar('/lancamentos/novo');
      } else if (e.code === 'KeyI') {
        e.preventDefault();
        navegar('/assistente');
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [navegar]);

  const proximoTema = tema === 'sistema' ? 'escuro' : tema === 'escuro' ? 'claro' : 'sistema';

  return (
    <div className="app">
      <nav className={`sidebar ${menuAberto ? 'aberta' : ''}`} aria-label="Menu principal">
        <div className="marca">
          Contábil Escola
          <small>Contabilidade educacional · dados fictícios</small>
        </div>
        {MENU.map((g) => (
          <div key={g.grupo}>
            <div className="grupo">{g.grupo}</div>
            {g.itens.map((i) =>
              i.rota ? (
                <NavLink key={i.rotulo} to={i.rota} end={i.rota === '/'}>
                  {i.rotulo}
                </NavLink>
              ) : (
                <span key={i.rotulo} className="desabilitado" title={`Disponível na Fase ${i.fase}`}>
                  {i.rotulo}
                  <small>Fase {i.fase}</small>
                </span>
              ),
            )}
          </div>
        ))}
      </nav>
      <div className="principal">
        <div className="faixa-ficticio">SOFTWARE EDUCACIONAL — todos os dados, empresas, pessoas e documentos são FICTÍCIOS</div>
        <header className="topo">
          <button className="botao-menu" onClick={() => setMenuAberto((a) => !a)} aria-label="Abrir menu">
            ☰
          </button>
          <select
            aria-label="Empresa atual"
            value={empresaId ?? ''}
            onChange={(e) => selecionarEmpresa(e.target.value ? Number(e.target.value) : undefined)}
          >
            {!empresas.length && <option value="">Nenhuma empresa cadastrada</option>}
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.razaoSocial} — {e.cnpj}
              </option>
            ))}
          </select>
          {empresa && <span className="etiqueta info esconder-mobile">{NOMES_REGIME[empresa.regime]}</span>}
          <span className="espaco" />
          <span className="texto-2 esconder-mobile">Usuário: {usuario}</span>
          <button onClick={() => definirTema(proximoTema)} title="Alternar tema (sistema → escuro → claro)">
            Tema: {tema}
          </button>
        </header>
        <main className="conteudo">{children}</main>
      </div>
    </div>
  );
}
