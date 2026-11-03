// Casca da aplicação: confere o navegador, abre a pasta de dados e mostra o
// menu e a tela atual.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  escolherPasta,
  esquecerPasta,
  lembrarPasta,
  navegadorSuportaPastas,
  pastaLembrada,
  pedirPermissao,
  temPermissao,
} from '../armazenamento/pastaDados';
import { Repositorio, type Lido } from '../armazenamento/repositorio';
import { SistemaArquivosPasta } from '../armazenamento/sistemaArquivos';
import type { Configuracoes } from '../armazenamento/configuracoes';
import type { Clausula } from '../motor/clausula';
import type { Empresa } from '../dados/tipos';
import { Contexto, mensagemDeErro, type ContextoApp, type Mensagem, type Sessao, type Tela, type TipoMensagem } from './contexto';
import { Alerta } from './componentes/Campos';
import { TelaInicio } from './telas/TelaInicio';
import { TelaNovoDocumento } from './telas/TelaNovoDocumento';
import { Assistente } from './telas/Assistente';
import { TelaEmpresas } from './telas/TelaEmpresas';
import { TelaEmpresa } from './telas/TelaEmpresa';
import { TelaBiblioteca } from './telas/TelaBiblioteca';
import { EditorClausula } from './telas/EditorClausula';
import { TelaConfiguracoes } from './telas/TelaConfiguracoes';
import { TelaExportar } from './telas/TelaExportar';

type EstadoPasta =
  | { fase: 'verificando' }
  | { fase: 'sem-suporte' }
  | { fase: 'escolher'; erro?: string }
  | { fase: 'liberar'; handle: FileSystemDirectoryHandle; erro?: string }
  | { fase: 'carregando'; nome: string }
  | { fase: 'pronta'; sessao: Sessao };

async function carregarSessao(repo: Repositorio): Promise<Sessao> {
  const [config, cl, em] = await Promise.all([repo.carregarConfiguracoes(), repo.listarClausulas(), repo.listarEmpresas()]);
  return { repo, config, clausulas: cl.lidas, empresas: em.lidas, errosLeitura: [...cl.erros, ...em.erros] };
}

export function App() {
  const [estado, setEstado] = useState<EstadoPasta>({ fase: 'verificando' });
  const [tela, setTela] = useState<Tela>({ nome: 'inicio' });
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const alterado = useRef(false);
  const contador = useRef(0);

  const avisar = useCallback((tipo: TipoMensagem, texto: string) => {
    const id = ++contador.current;
    setMensagens((m) => [...m.slice(-3), { id, tipo, texto }]);
    if (tipo === 'ok' || tipo === 'info') setTimeout(() => setMensagens((m) => m.filter((x) => x.id !== id)), 6000);
  }, []);

  const abrir = useCallback(
    async (handle: FileSystemDirectoryHandle) => {
      setEstado({ fase: 'carregando', nome: handle.name });
      try {
        const repo = new Repositorio(new SistemaArquivosPasta(handle));
        const ini = await repo.inicializar();
        const sessao = await carregarSessao(repo);
        setEstado({ fase: 'pronta', sessao });
        if (ini.nova) avisar('ok', `Pasta de dados "${handle.name}" preparada. Biblioteca inicial criada com ${ini.clausulasCriadas} cláusulas.`);
        else if (ini.clausulasCriadas) avisar('info', `A pasta não tinha cláusulas: a biblioteca inicial foi criada (${ini.clausulasCriadas}).`);
      } catch (e) {
        setEstado({ fase: 'liberar', handle, erro: mensagemDeErro(e) });
      }
    },
    [avisar],
  );

  useEffect(() => {
    (async () => {
      if (!navegadorSuportaPastas()) return setEstado({ fase: 'sem-suporte' });
      const h = await pastaLembrada();
      if (!h) return setEstado({ fase: 'escolher' });
      if (await temPermissao(h)) return abrir(h);
      setEstado({ fase: 'liberar', handle: h });
    })();
  }, [abrir]);

  useEffect(() => {
    const antesDeSair = (e: BeforeUnloadEvent) => {
      if (alterado.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', antesDeSair);
    return () => window.removeEventListener('beforeunload', antesDeSair);
  }, []);

  const escolherNova = useCallback(async () => {
    try {
      const h = await escolherPasta();
      if (!h) return;
      const repo = new Repositorio(new SistemaArquivosPasta(h));
      if (await repo.pastaPareceEstranha()) {
        const ok = window.confirm(
          `A pasta "${h.name}" já tem arquivos que não são do Calango.\n\nO recomendado é usar uma pasta vazia (por exemplo, "dados" ao lado da pasta do sistema).\n\nUsar esta pasta mesmo assim?`,
        );
        if (!ok) return;
      }
      await lembrarPasta(h);
      alterado.current = false;
      setTela({ nome: 'inicio' });
      await abrir(h);
    } catch (e) {
      setEstado({ fase: 'escolher', erro: mensagemDeErro(e) });
    }
  }, [abrir]);

  const ctx = useMemo<ContextoApp | null>(() => {
    if (estado.fase !== 'pronta') return null;
    const sessao = estado.sessao;
    const atualizar = (fn: (s: Sessao) => Sessao) =>
      setEstado((st) => (st.fase === 'pronta' ? { fase: 'pronta', sessao: fn(st.sessao) } : st));
    return {
      sessao,
      ir: (t: Tela) => {
        if (alterado.current && !window.confirm('Há alterações que ainda não foram salvas. Sair desta tela e perdê-las?')) return;
        alterado.current = false;
        setTela(t);
        window.scrollTo(0, 0);
      },
      avisar,
      recarregar: async () => {
        try {
          const nova = await carregarSessao(sessao.repo);
          atualizar(() => nova);
        } catch (e) {
          avisar('erro', mensagemDeErro(e));
        }
      },
      trocarPasta: () => {
        if (alterado.current && !window.confirm('Há alterações não salvas. Trocar de pasta mesmo assim?')) return;
        void escolherNova();
      },
      buscarClausula: (id: string) => sessao.clausulas.find((l) => l.dados.id === id)?.dados,
      atualizarEmpresaLocal: (lida: Lido<Empresa>) =>
        atualizar((s) => ({
          ...s,
          empresas: s.empresas.some((l) => l.caminho === lida.caminho)
            ? s.empresas.map((l) => (l.caminho === lida.caminho ? lida : l))
            : [...s.empresas, lida],
        })),
      removerEmpresaLocal: (caminho: string) => atualizar((s) => ({ ...s, empresas: s.empresas.filter((l) => l.caminho !== caminho) })),
      atualizarClausulaLocal: (lida: Lido<Clausula>) =>
        atualizar((s) => ({
          ...s,
          clausulas: s.clausulas.some((l) => l.caminho === lida.caminho)
            ? s.clausulas.map((l) => (l.caminho === lida.caminho ? lida : l))
            : [...s.clausulas, lida],
        })),
      atualizarConfigLocal: (lida: Lido<Configuracoes>) => atualizar((s) => ({ ...s, config: lida })),
      marcarAlterado: (v: boolean) => {
        alterado.current = v;
      },
    };
  }, [estado, avisar, escolherNova]);

  const avisos = (
    <div className="avisos-flutuantes" aria-live="polite">
      {mensagens.map((m) => (
        <div key={m.id} className={`alerta ${m.tipo}`}>
          <div className="espaco">{m.texto}</div>
          <button onClick={() => setMensagens((x) => x.filter((y) => y.id !== m.id))} aria-label="Fechar aviso">
            ✕
          </button>
        </div>
      ))}
    </div>
  );

  if (estado.fase !== 'pronta' || !ctx) {
    return (
      <div className="tela-centro">
        <div className="painel">
          <h1>🦎 Calango</h1>
          <p className="suave">Gerador de atos societários</p>
          {estado.fase === 'verificando' && <p>Abrindo…</p>}
          {estado.fase === 'carregando' && <p>Lendo a pasta de dados “{estado.nome}”…</p>}
          {estado.fase === 'sem-suporte' && (
            <Alerta tipo="erro" titulo="Navegador sem suporte.">
              Este navegador não permite que o Calango use uma pasta do computador ou da rede (é o caso do Firefox).
              Abra este mesmo arquivo <strong>index.html</strong> no <strong>Microsoft Edge</strong> (ou no Google Chrome).
            </Alerta>
          )}
          {estado.fase === 'escolher' && (
            <>
              {estado.erro && <Alerta tipo="erro">{estado.erro}</Alerta>}
              <p>
                Para começar, escolha a <strong>pasta de dados</strong>: é onde ficam as empresas, as cláusulas, as
                configurações e os backups. Pode ser uma pasta na rede do escritório, para que todos usem os mesmos dados.
              </p>
              <p className="suave pequeno">Dica: crie uma pasta vazia chamada “dados” ao lado da pasta do sistema e escolha-a.</p>
              <button className="primario grande" onClick={escolherNova}>
                Escolher pasta de dados
              </button>
            </>
          )}
          {estado.fase === 'liberar' && (
            <>
              {estado.erro && <Alerta tipo="erro">{estado.erro}</Alerta>}
              <p>
                O navegador precisa da sua autorização para usar a pasta de dados <strong>“{estado.handle.name}”</strong>.
              </p>
              <div className="linha">
                <button
                  className="primario grande"
                  onClick={async () => {
                    if (await pedirPermissao(estado.handle)) await abrir(estado.handle);
                    else setEstado({ ...estado, erro: 'A permissão não foi dada. Clique de novo e escolha “Permitir”.' });
                  }}
                >
                  Liberar acesso à pasta
                </button>
                <button
                  onClick={async () => {
                    await esquecerPasta();
                    await escolherNova();
                  }}
                >
                  Escolher outra pasta
                </button>
              </div>
            </>
          )}
        </div>
        {avisos}
      </div>
    );
  }

  const itens: { tela: Tela; rotulo: string; ativo: string[] }[] = [
    { tela: { nome: 'inicio' }, rotulo: '🏠 Início', ativo: ['inicio'] },
    { tela: { nome: 'novo-documento' }, rotulo: '📝 Novo documento', ativo: ['novo-documento', 'assistente'] },
    { tela: { nome: 'empresas' }, rotulo: '🏢 Empresas', ativo: ['empresas', 'empresa'] },
    { tela: { nome: 'biblioteca' }, rotulo: '📚 Biblioteca de cláusulas', ativo: ['biblioteca', 'editor-clausula'] },
    { tela: { nome: 'configuracoes' }, rotulo: '⚙️ Configurações', ativo: ['configuracoes'] },
    { tela: { nome: 'exportar' }, rotulo: '📦 Exportar / importar', ativo: ['exportar'] },
  ];

  return (
    <Contexto.Provider value={ctx}>
      <div className="app">
        <nav className="menu" aria-label="Menu principal">
          <div className="marca">
            🦎 Calango<small>Atos societários</small>
          </div>
          {itens.map((i) => (
            <button key={i.rotulo} className={i.ativo.includes(tela.nome) ? 'ativo' : ''} onClick={() => ctx.ir(i.tela)}>
              {i.rotulo}
            </button>
          ))}
          <div className="rodape-menu">
            Pasta de dados:
            <br />
            <strong>{ctx.sessao.repo.fs.nome}</strong>
          </div>
        </nav>
        <main className="conteudo">
          {ctx.sessao.errosLeitura.length > 0 && (
            <Alerta tipo="aviso" titulo="Alguns arquivos da pasta de dados não puderam ser lidos:">
              <ul>
                {ctx.sessao.errosLeitura.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alerta>
          )}
          <TelaAtual tela={tela} />
        </main>
      </div>
      {avisos}
    </Contexto.Provider>
  );
}

function TelaAtual({ tela }: { tela: Tela }) {
  switch (tela.nome) {
    case 'inicio':
      return <TelaInicio />;
    case 'novo-documento':
      return <TelaNovoDocumento />;
    case 'assistente':
      return <Assistente key={`${tela.caminho}|${tela.atoId}`} caminho={tela.caminho} atoId={tela.atoId} />;
    case 'empresas':
      return <TelaEmpresas />;
    case 'empresa':
      return <TelaEmpresa key={tela.caminho} caminho={tela.caminho} />;
    case 'biblioteca':
      return <TelaBiblioteca />;
    case 'editor-clausula':
      return <EditorClausula key={`${tela.id}|${tela.duplicarDe ?? ''}`} id={tela.id} duplicarDe={tela.duplicarDe} />;
    case 'configuracoes':
      return <TelaConfiguracoes />;
    case 'exportar':
      return <TelaExportar />;
  }
}
