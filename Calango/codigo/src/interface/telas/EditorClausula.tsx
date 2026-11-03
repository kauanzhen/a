// Editor de cláusulas: o usuário não precisa decorar a sintaxe — os botões
// inserem variáveis, concordâncias, condições, repetições, parágrafos,
// alíneas e tabelas. Pré-visualização ao vivo com dados de exemplo.

import { useMemo, useRef, useState } from 'react';
import { mensagemDeErro, useApp } from '../contexto';
import { extrairConteudo, type Clausula, type ConteudoClausula, type TipoBloco, type Natureza } from '../../motor/clausula';
import { aliasesDoBloco, camposDaClausula } from '../../motor/campos';
import { COLECOES, CONDICOES, TIPOS_ITEM, VARIAVEIS, tipoItem } from '../../motor/catalogo';
import { montarDocumento } from '../../motor/montagem';
import { aplicarEdicao, conteudoVazio, criarClausula, duplicarClausula } from '../../biblioteca/edicao';
import { TIPOS_DOCUMENTO_CLAUSULA, tipoSocietario } from '../../tipos/registro';
import { EXEMPLOS } from '../../dados/exemplos';
import { opcoesAtoPadrao } from '../../dados/fabricas';
import { campoPorId } from '../../dados/campos';
import { normalizar } from '../../lib/texto';
import { formatarData } from '../../lib/datas';
import type { DefinicaoDocumento } from '../../tipos/definicoes';
import { Alerta, CampoAreaTexto, CampoMarcar, CampoSelecao, CampoTexto, Modal } from '../componentes/Campos';
import { VisualizacaoDocumento } from '../componentes/VisualizacaoDocumento';

const LTDA = tipoSocietario('ltda');

// ---------------- Inserção no texto ----------------

function useInsercao(textarea: React.RefObject<HTMLTextAreaElement | null>, valor: string, mudar: (v: string) => void) {
  const aplicar = (novo: string, cursor: number) => {
    mudar(novo);
    requestAnimationFrame(() => {
      const t = textarea.current;
      if (!t) return;
      t.focus();
      t.setSelectionRange(cursor, cursor);
    });
  };
  return {
    /** Insere (ou envolve a seleção com) antes/depois. */
    envolver(antes: string, depois = '', textoPadrao = '') {
      const t = textarea.current;
      const ini = t?.selectionStart ?? valor.length;
      const fim = t?.selectionEnd ?? valor.length;
      const sel = valor.slice(ini, fim) || textoPadrao;
      const novo = valor.slice(0, ini) + antes + sel + depois + valor.slice(fim);
      aplicar(novo, ini + antes.length + sel.length + (sel ? depois.length : 0));
    },
    /** Insere um bloco em linhas próprias. */
    bloco(abre: string, fecha: string, meio = '') {
      const t = textarea.current;
      const ini = t?.selectionStart ?? valor.length;
      const fim = t?.selectionEnd ?? valor.length;
      const sel = valor.slice(ini, fim);
      const antesTexto = valor.slice(0, ini);
      const prefixo = antesTexto && !antesTexto.endsWith('\n') ? '\n' : '';
      const conteudo = sel || meio;
      const inserido = `${prefixo}${abre}\n${conteudo}${conteudo.endsWith('\n') || !conteudo ? '' : '\n'}${fecha}\n`;
      const novo = antesTexto + inserido + valor.slice(fim);
      aplicar(novo, ini + prefixo.length + abre.length + 1 + (conteudo ? conteudo.length : 0));
    },
    /** Coloca um marcador no começo da linha atual (§, -, *, #). */
    prefixarLinha(prefixo: string) {
      const t = textarea.current;
      const pos = t?.selectionStart ?? valor.length;
      const inicioLinha = valor.lastIndexOf('\n', pos - 1) + 1;
      const resto = valor.slice(inicioLinha).replace(/^([§\-*#])\s/, '');
      const novo = valor.slice(0, inicioLinha) + prefixo + ' ' + resto;
      aplicar(novo, pos + prefixo.length + 1);
    },
  };
}

// ---------------- Modais de inserção ----------------

const CONTEXTOS = [
  { id: '', rotulo: 'Dados gerais (empresa, capital, fechamento...)' },
  ...COLECOES.filter((c, i, a) => a.findIndex((x) => x.tipoItem === c.tipoItem) === i).map((c) => ({
    id: c.itemSugerido,
    rotulo: `Dentro de [para cada ${c.itemSugerido} em ${c.nome}] — ${tipoItem(c.tipoItem)?.rotulo}`,
  })),
  { id: 'pessoa', rotulo: 'Pessoa (bloco de qualificação)' },
];

function variaveisDoContexto(ctx: string) {
  if (!ctx) return VARIAVEIS.filter((v) => !v.tipoItem).map((v) => ({ nome: v.nome, def: v }));
  const col = COLECOES.find((c) => c.itemSugerido === ctx);
  const tipo = col?.tipoItem ?? ctx;
  const cadeia: string[] = [];
  let t: string | undefined = tipo;
  while (t) {
    cadeia.push(t);
    t = tipoItem(t)?.pai;
  }
  return VARIAVEIS.filter((v) => v.tipoItem && cadeia.includes(v.tipoItem)).map((v) => ({ nome: `${ctx}.${v.nome.split('.').slice(1).join('.')}`, def: v }));
}

function ModalVariavel(p: { aoInserir: (nome: string) => void; aoFechar: () => void }) {
  const [ctx, setCtx] = useState('');
  const [busca, setBusca] = useState('');
  const q = normalizar(busca);
  const lista = variaveisDoContexto(ctx).filter((v) => !q || normalizar(`${v.def.rotulo} ${v.nome} ${v.def.grupo}`).includes(q));
  const grupos = [...new Set(lista.map((v) => v.def.grupo))];
  return (
    <Modal titulo="Inserir variável" aoFechar={p.aoFechar} largo>
      <div className="grade">
        <CampoSelecao rotulo="Onde a variável será usada?" valor={ctx} onChange={setCtx} opcoes={CONTEXTOS.map((c) => ({ valor: c.id, rotulo: c.rotulo }))} />
        <label className="campo">
          Buscar
          <input type="search" autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="ex.: CPF, capital, endereço" />
        </label>
      </div>
      {ctx && <Alerta tipo="info">Estas variáveis só funcionam dentro da repetição indicada (ou no bloco de qualificação, para “pessoa”).</Alerta>}
      <div className="lista-escolha" style={{ marginTop: '0.5rem' }}>
        {grupos.map((g) => (
          <div key={g}>
            <div className="grupo">{g}</div>
            {lista
              .filter((v) => v.def.grupo === g)
              .map((v) => (
                <button key={v.nome} onClick={() => p.aoInserir(v.nome)}>
                  {v.def.rotulo}
                  <div className="suave pequeno mono">{`{{${v.nome}}}`}</div>
                </button>
              ))}
          </div>
        ))}
        {lista.length === 0 && <div className="vazio">Nada encontrado.</div>}
      </div>
    </Modal>
  );
}

const REFERENCIAS = [
  { valor: 'socios', rotulo: 'Todos os sócios (socios)' },
  { valor: 'administradores', rotulo: 'Administradores (administradores)' },
  { valor: 'administradores_nao_socios', rotulo: 'Administradores não sócios' },
  { valor: 'pro_labore', rotulo: 'Sócios com pró-labore (pro_labore)' },
  { valor: 'socio', rotulo: 'O sócio da repetição atual (socio)' },
  { valor: 'administrador', rotulo: 'O administrador da repetição atual (administrador)' },
  { valor: 'pessoa', rotulo: 'A pessoa (bloco de qualificação)' },
];

function ModalConcordancia(p: { aoInserir: (t: string) => void; aoFechar: () => void }) {
  const [f, setF] = useState(['o sócio', 'a sócia', 'os sócios', 'as sócias']);
  const [ref, setRef] = useState('socios');
  const individual = ['socio', 'administrador', 'pessoa'].includes(ref);
  const texto = individual ? `{${f[0]}|${f[1]} : ${ref}}` : `{${f.join('|')} : ${ref}}`;
  const mudar = (i: number, v: string) => setF((x) => x.map((y, j) => (j === i ? v : y)));
  return (
    <Modal
      titulo="Inserir concordância (gênero e número)"
      aoFechar={p.aoFechar}
      rodape={
        <button className="primario" onClick={() => p.aoInserir(texto)}>
          Inserir
        </button>
      }
    >
      <p className="suave">Escreva a palavra (ou trecho) nas formas possíveis. O documento usa a forma certa conforme as pessoas cadastradas.</p>
      <CampoSelecao rotulo="Concorda com" valor={ref} onChange={setRef} opcoes={REFERENCIAS} />
      <div className="grade" style={{ marginTop: '0.75rem' }}>
        <CampoTexto rotulo="Masculino, singular" valor={f[0]} onChange={(v) => mudar(0, v)} />
        <CampoTexto rotulo="Feminino, singular" valor={f[1]} onChange={(v) => mudar(1, v)} />
        {!individual && (
          <>
            <CampoTexto rotulo="Masculino, plural (ou grupo misto)" valor={f[2]} onChange={(v) => mudar(2, v)} />
            <CampoTexto rotulo="Feminino, plural (só mulheres)" valor={f[3]} onChange={(v) => mudar(3, v)} />
          </>
        )}
      </div>
      <p className="pequeno">
        Será inserido: <code>{texto}</code>
      </p>
    </Modal>
  );
}

function ModalCondicao(p: { aoInserir: (abre: string, senao: boolean, emBloco: boolean) => void; aoFechar: () => void }) {
  const [nome, setNome] = useState('unipessoal');
  const [op, setOp] = useState('=');
  const [valor, setValor] = useState('');
  const [senao, setSenao] = useState(true);
  const [emBloco, setEmBloco] = useState(false);
  const def = CONDICOES.find((c) => c.nome === nome);
  const nomeFinal = def?.tipoItem ? nome : nome;
  const expr = def?.valores ? `${nomeFinal} ${op} ${valor || def.valores[0].valor}` : nomeFinal;
  return (
    <Modal
      titulo="Inserir condição"
      aoFechar={p.aoFechar}
      rodape={
        <button className="primario" onClick={() => p.aoInserir(`[se ${expr}]`, senao, emBloco)}>
          Inserir
        </button>
      }
    >
      <p className="suave">O trecho só aparece no documento quando a condição for verdadeira. Se houver texto selecionado, ele fica dentro da condição.</p>
      <CampoSelecao
        rotulo="Condição"
        valor={nome}
        onChange={(v) => {
          setNome(v);
          setValor('');
        }}
        opcoes={CONDICOES.map((c) => ({ valor: c.nome, rotulo: `${c.grupo}: ${c.rotulo}${c.tipoItem ? ' (dentro de repetição)' : ''}` }))}
      />
      {def?.valores && (
        <div className="grade" style={{ marginTop: '0.5rem' }}>
          <CampoSelecao
            rotulo="Comparação"
            valor={op}
            onChange={setOp}
            opcoes={[
              { valor: '=', rotulo: 'é igual a' },
              { valor: '!=', rotulo: 'é diferente de' },
            ]}
          />
          <CampoSelecao rotulo="Valor" valor={valor || def.valores[0].valor} onChange={setValor} opcoes={def.valores.map((v) => ({ valor: v.valor, rotulo: v.rotulo }))} />
        </div>
      )}
      <CampoMarcar rotulo="Incluir [senão] (texto para quando a condição for falsa)" valor={senao} onChange={setSenao} />
      <CampoMarcar rotulo="Em linhas próprias (para parágrafos inteiros)" valor={emBloco} onChange={setEmBloco} />
      <p className="pequeno">
        Condição: <code>[se {expr}]</code>
      </p>
    </Modal>
  );
}

function ModalRepeticao(p: { aoInserir: (abre: string, meio: string) => void; aoFechar: () => void }) {
  const [col, setCol] = useState('socios');
  const [modo, setModo] = useState('paragrafos');
  const c = COLECOES.find((x) => x.nome === col)!;
  const opcoes: Record<string, string> = {
    paragrafos: '',
    qualificacao: ' separador=";" ultimo=" e" final="."',
    virgulas: ' separador=", " ultimo=" e "',
    pontoevirgula: ' separador=";" final="."',
  };
  const abre = `[para cada ${c.itemSugerido} em ${c.nome}${opcoes[modo]}]`;
  const tipo = tipoItem(c.tipoItem);
  const meio = tipo?.pai === 'pessoa' ? `{{${c.itemSugerido}.nome}}` : c.tipoItem === 'cnae' ? `{{cnae.codigo}} - {{cnae.descricao}}` : `{{${c.itemSugerido}.${variaveisDoContexto(c.itemSugerido)[0]?.nome.split('.')[1] ?? 'nome'}}}`;
  return (
    <Modal
      titulo="Inserir repetição (um trecho para cada item de uma lista)"
      aoFechar={p.aoFechar}
      rodape={
        <button className="primario" onClick={() => p.aoInserir(abre, meio)}>
          Inserir
        </button>
      }
    >
      <CampoSelecao rotulo="Repetir para cada" valor={col} onChange={setCol} opcoes={COLECOES.map((x) => ({ valor: x.nome, rotulo: x.rotulo }))} />
      <div style={{ marginTop: '0.5rem' }}>
        <CampoSelecao
          rotulo="Como separar os itens"
          valor={modo}
          onChange={setModo}
          opcoes={[
            { valor: 'paragrafos', rotulo: 'Um parágrafo para cada, sem pontuação extra' },
            { valor: 'qualificacao', rotulo: 'Como na qualificação: “A; B e C.”' },
            { valor: 'virgulas', rotulo: 'Na mesma frase: “A, B e C”' },
            { valor: 'pontoevirgula', rotulo: 'Lista: “A; B; C.”' },
          ]}
        />
      </div>
      <p className="pequeno">
        Dentro da repetição, use as variáveis de “{tipo?.rotulo}” começando por <code>{c.itemSugerido}.</code> (botão “Variável”).
      </p>
      <pre className="texto-clausula" style={{ marginLeft: 0 }}>{`${abre}\n${meio}\n[fim]`}</pre>
    </Modal>
  );
}

const AJUDA = `{{empresa.razao_social}}        variável (dado da empresa)
{o sócio|a sócia|os sócios|as sócias : socios}
                                concordância: masc. sing. | fem. sing. | masc. pl. | fem. pl.
{brasileiro|brasileira : socio} concordância com uma pessoa (2 formas)
**texto**                       negrito
[se unipessoal] ... [senão] ... [fim]
                                condição (na mesma linha ou em linhas próprias)
[para cada socio em socios] ... [fim]
                                repetição
[tabela]                        tabela: colunas separadas por |, 1ª linha = cabeçalho
Sócio | Quotas
[fim]
[assinatura]                    linha de assinatura
§ texto     parágrafo (Parágrafo Primeiro, Segundo... ou Único)
- texto     alínea (a, b, c...)
* texto     item de lista
# texto     título de seção`;

// ---------------- Editor ----------------

export function EditorClausula(p: { id: string | null; duplicarDe?: string }) {
  const app = useApp();
  const { sessao } = app;
  const lida = p.id ? sessao.clausulas.find((l) => l.dados.id === p.id) : undefined;
  const original = lida?.dados ?? null;
  const ids = useMemo(() => new Set(sessao.clausulas.map((l) => l.dados.id)), [sessao.clausulas]);

  const [conteudo, setConteudo] = useState<ConteudoClausula>(() => {
    if (original) return extrairConteudo(original);
    if (p.duplicarDe) {
      const base = sessao.clausulas.find((l) => l.dados.id === p.duplicarDe)?.dados;
      if (base) return extrairConteudo(duplicarClausula(base, ids, LTDA, app.buscarClausula));
    }
    return conteudoVazio();
  });
  const [sujo, setSujo] = useState(!!p.duplicarDe);
  const [exemploId, setExemploId] = useState('dois-socios');
  const [modal, setModal] = useState<'' | 'variavel' | 'concordancia' | 'condicao' | 'repeticao' | 'ajuda'>('');
  const [versaoVista, setVersaoVista] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  const mudar = (x: Partial<ConteudoClausula>) => {
    setConteudo((c) => ({ ...c, ...x }));
    setSujo(true);
    app.marcarAlterado(true);
  };
  const ins = useInsercao(ta, conteudo.corpo, (v) => mudar({ corpo: v }));
  const idAtual = original?.id ?? '__nova__';

  const rascunho: Clausula = useMemo(
    () => ({
      ...(original ?? {
        formato: 'calango/clausula' as const,
        versao_formato: 1 as const,
        id: idAtual,
        campos_exigidos: [],
        versao: 1,
        historico: [],
        arquivada: false,
        origem: 'usuario' as const,
        criada_em: '',
        atualizada_em: '',
      }),
      ...conteudo,
    }),
    [conteudo, original, idAtual],
  );
  const buscar = (id: string) => (id === idAtual ? rascunho : app.buscarClausula(id));
  const analise = useMemo(() => camposDaClausula(rascunho, LTDA, buscar), [rascunho]); // eslint-disable-line react-hooks/exhaustive-deps

  const previa = useMemo(() => {
    const ex = EXEMPLOS.find((e) => e.id === exemploId)!;
    const componente = Object.keys(aliasesDoBloco(idAtual === '__nova__' ? undefined : idAtual, LTDA)).length > 0;
    const def: DefinicaoDocumento = {
      id: 'previa',
      nome: 'Pré-visualização',
      nome_arquivo: '',
      descricao: '',
      disponivel: true,
      empresa: 'nova',
      areas: [{ id: 'a', nome: '', numerada: conteudo.tipo_bloco !== 'texto', estilo: 'texto', editavel: false }],
      padrao: {},
    };
    const idPrevia = componente ? '__previa__' : idAtual;
    const previaClausula: Clausula = componente
      ? { ...rascunho, id: '__previa__', tipo_bloco: 'texto', corpo: '[para cada socio em socios]\n{{socio.qualificacao}}\n[fim]', regras: { ...rascunho.regras, condicao_de_exibicao: '' } }
      : rascunho;
    try {
      return montarDocumento({
        definicao: def,
        selecao: { a: [{ clausula_id: idPrevia, versao: rascunho.versao, ativa: true }] },
        contexto: { dados: ex.dados(), tipo: LTDA, opcoes: { ...opcoesAtoPadrao('Barueri', 'SP'), data_ato: new Date().toISOString().slice(0, 10) } },
        buscarClausula: (id) => (id === '__previa__' ? previaClausula : buscar(id)),
      });
    } catch (e) {
      return { elementos: [], pendencias: [{ nivel: 'erro' as const, mensagem: mensagemDeErro(e) }], usadas: [], titulo: '' };
    }
  }, [rascunho, exemploId, conteudo.tipo_bloco]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar() {
    if (!conteudo.titulo_interno.trim()) return app.avisar('erro', 'Dê um título interno à cláusula (é o nome dela na biblioteca).');
    if (analise.erros.length && !window.confirm(`O texto tem ${analise.erros.length} problema(s) apontado(s) na conferência. Salvar mesmo assim?`)) return;
    setSalvando(true);
    try {
      if (original && lida) {
        const nova = aplicarEdicao(original, conteudo, LTDA, buscar);
        if (nova === original) {
          app.avisar('info', 'Nada mudou desde a última versão.');
        } else {
          const m = await sessao.repo.salvarClausula(nova, lida.modificadoEm);
          app.atualizarClausulaLocal({ dados: nova, caminho: lida.caminho, modificadoEm: m });
          app.avisar('ok', `Cláusula salva como versão ${nova.versao}. A versão anterior ficou no histórico.`);
        }
      } else {
        const nova = criarClausula(conteudo, ids, LTDA, buscar);
        const m = await sessao.repo.salvarClausula(nova, null);
        app.atualizarClausulaLocal({ dados: nova, caminho: sessao.repo.caminhoClausula(nova.id), modificadoEm: m });
        app.avisar('ok', `Cláusula “${nova.titulo_interno}” criada.`);
        app.marcarAlterado(false);
        setSujo(false);
        app.ir({ nome: 'editor-clausula', id: nova.id });
        return;
      }
      setSujo(false);
      app.marcarAlterado(false);
    } catch (e) {
      app.avisar('erro', mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  const outras = sessao.clausulas.map((l) => l.dados).filter((c) => c.id !== idAtual);
  const versao = versaoVista !== null ? original?.historico.find((h) => h.versao === versaoVista) : undefined;
  const pendPrevia = previa.pendencias.filter((x) => !/não está logo depois de uma cláusula/.test(x.mensagem));

  return (
    <div>
      <div className="entre">
        <div>
          <h1 style={{ marginBottom: 4 }}>{original ? 'Editar cláusula' : 'Nova cláusula'}</h1>
          <div className="suave">
            {original ? (
              <>
                <span className="mono">{original.id}</span> · versão {original.versao}
                {original.origem === 'biblioteca-inicial' && <span className="etiqueta">biblioteca inicial</span>}
              </>
            ) : (
              'O identificador é criado a partir do título.'
            )}
            {sujo && <span className="etiqueta amarela">alterações não salvas</span>}
          </div>
        </div>
        <div className="linha">
          <button onClick={() => app.ir({ nome: 'biblioteca' })}>← Biblioteca</button>
          <button className="primario" onClick={salvar} disabled={salvando || (!sujo && !!original)}>
            💾 Salvar {original ? 'nova versão' : 'cláusula'}
          </button>
        </div>
      </div>

      <div className="painel">
        <div className="grade">
          <CampoTexto rotulo="Título interno (nome na biblioteca)" valor={conteudo.titulo_interno} onChange={(v) => mudar({ titulo_interno: v })} />
          <CampoTexto rotulo="Título de seção (opcional)" dica='Ex.: "DO CAPITAL SOCIAL" (aparece antes da cláusula)' valor={conteudo.titulo_secao} maiusculas onChange={(v) => mudar({ titulo_secao: v })} />
          <CampoSelecao<TipoBloco>
            rotulo="Tipo de bloco"
            valor={conteudo.tipo_bloco}
            onChange={(v) => mudar({ tipo_bloco: v })}
            opcoes={[
              { valor: 'clausula', rotulo: 'Cláusula (recebe "CLÁUSULA PRIMEIRA:")' },
              { valor: 'paragrafo', rotulo: 'Parágrafo (fica dentro da cláusula anterior)' },
              { valor: 'texto', rotulo: 'Texto sem número (título, preâmbulo, fechamento)' },
            ]}
          />
          <CampoSelecao<Natureza>
            rotulo="Natureza"
            valor={conteudo.natureza}
            onChange={(v) => mudar({ natureza: v })}
            opcoes={[
              { valor: 'normal', rotulo: 'Normal (abertura/consolidação)' },
              { valor: 'alteracao', rotulo: 'Alteração (anterior → novo) — Fase 2' },
              { valor: 'fixa', rotulo: 'Fixa (ratificação, fechamento)' },
            ]}
          />
          <CampoTexto rotulo="Etiquetas" dica="Separadas por vírgula" valor={conteudo.tags.join(', ')} onChange={(v) => mudar({ tags: v.split(',').map((t) => t.trim()).filter(Boolean) })} />
          <div className="campo">
            <span>Pode ser usada em</span>
            <div className="radios">
              {TIPOS_DOCUMENTO_CLAUSULA.map((t) => (
                <CampoMarcar
                  key={t.id}
                  rotulo={t.nome}
                  valor={conteudo.documentos.includes(t.id)}
                  onChange={(v) => mudar({ documentos: v ? [...conteudo.documentos, t.id] : conteudo.documentos.filter((d) => d !== t.id) })}
                />
              ))}
            </div>
          </div>
        </div>
        <details style={{ marginTop: '0.75rem' }}>
          <summary>
            <strong>Regras</strong> (obrigatória, requer, conflita, condição de exibição)
          </summary>
          <div className="grade" style={{ marginTop: '0.75rem' }}>
            <CampoMarcar rotulo="Obrigatória (não pode ser removida do documento)" valor={conteudo.regras.obrigatoria} onChange={(v) => mudar({ regras: { ...conteudo.regras, obrigatoria: v } })} />
            <CampoTexto
              rotulo="Condição de exibição"
              dica='Ex.: "unipessoal" ou "enquadramento != nenhum". Vazio = sempre aparece.'
              valor={conteudo.regras.condicao_de_exibicao}
              onChange={(v) => mudar({ regras: { ...conteudo.regras, condicao_de_exibicao: v } })}
            />
            <SeletorIds rotulo="Requer (precisa estar junto com)" valor={conteudo.regras.requer} opcoes={outras} onChange={(v) => mudar({ regras: { ...conteudo.regras, requer: v } })} />
            <SeletorIds rotulo="Conflita com (não pode estar junto)" valor={conteudo.regras.conflita_com} opcoes={outras} onChange={(v) => mudar({ regras: { ...conteudo.regras, conflita_com: v } })} />
          </div>
          <CampoAreaTexto rotulo="Observações internas" valor={conteudo.observacoes} onChange={(v) => mudar({ observacoes: v })} linhas={2} />
        </details>
      </div>

      <div className="editor">
        <div className="painel">
          <h2>Texto da cláusula</h2>
          <div className="barra-ferramentas">
            <button onClick={() => setModal('variavel')}>{'{{ }}'} Variável</button>
            <button onClick={() => setModal('concordancia')}>⚥ Concordância</button>
            <button onClick={() => setModal('condicao')}>❓ Condição</button>
            <button onClick={() => setModal('repeticao')}>🔁 Repetição</button>
            <button onClick={() => ins.prefixarLinha('§')}>§ Parágrafo</button>
            <button onClick={() => ins.prefixarLinha('-')}>a) Alínea</button>
            <button onClick={() => ins.prefixarLinha('*')}>• Item</button>
            <button onClick={() => ins.prefixarLinha('#')}># Título</button>
            <button onClick={() => ins.bloco('[tabela]', '[fim]', 'COLUNA 1 | COLUNA 2\nvalor 1 | valor 2')}>▦ Tabela</button>
            <button onClick={() => ins.envolver('**', '**', 'texto')}>
              <strong>N</strong> Negrito
            </button>
            <button onClick={() => ins.bloco('[assinatura]', '', '')}>✍ Assinatura</button>
            <button onClick={() => setModal('ajuda')}>? Ajuda</button>
          </div>
          <textarea
            ref={ta}
            className={`corpo-clausula ${analise.erros.length ? 'invalido' : ''}`}
            value={conteudo.corpo}
            spellCheck
            aria-label="Texto da cláusula"
            onChange={(e) => mudar({ corpo: e.target.value })}
          />
          <h3>Conferência</h3>
          {analise.erros.length > 0 ? (
            <Alerta tipo="erro">
              <ul>
                {analise.erros.map((e, i) => (
                  <li key={i}>
                    {e.linha ? `Linha ${e.linha}: ` : ''}
                    {e.mensagem}
                  </li>
                ))}
              </ul>
            </Alerta>
          ) : (
            <Alerta tipo="ok">Nenhum problema no texto.</Alerta>
          )}
          <div className="pequeno">
            <strong>Campos exigidos</strong> (calculados automaticamente):{' '}
            {analise.campos.length === 0 ? <span className="suave">nenhum</span> : analise.campos.map((c) => <span key={c} className="etiqueta">{campoPorId(c)?.rotulo ?? c}</span>)}
          </div>
          {original && original.historico.length > 0 && (
            <>
              <h3>Histórico de versões</h3>
              <div className="linha">
                {[...original.historico].reverse().map((h) => (
                  <button key={h.versao} className="pequeno" onClick={() => setVersaoVista(h.versao)}>
                    v{h.versao} — {formatarData(h.salvo_em.slice(0, 10))}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="painel">
          <div className="entre">
            <h2>Pré-visualização</h2>
            <select value={exemploId} onChange={(e) => setExemploId(e.target.value)} style={{ width: 'auto' }} aria-label="Dados de exemplo">
              {EXEMPLOS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <p className="suave pequeno">Com dados de exemplo, para conferir a concordância. A numeração aqui é ilustrativa.</p>
          {previa.elementos.length === 0 ? (
            <Alerta tipo="info">
              {conteudo.regras.condicao_de_exibicao
                ? `Com este exemplo, a condição de exibição (“${conteudo.regras.condicao_de_exibicao}”) é falsa: a cláusula não apareceria no documento.`
                : 'O texto está vazio ou nenhuma linha aparece com este exemplo.'}
            </Alerta>
          ) : (
            <VisualizacaoDocumento documento={previa} compacta />
          )}
          {pendPrevia.length > 0 && (
            <Alerta tipo="aviso">
              <ul>
                {pendPrevia.map((x) => (
                  <li key={x.mensagem}>{x.mensagem}</li>
                ))}
              </ul>
            </Alerta>
          )}
        </div>
      </div>

      {modal === 'variavel' && (
        <ModalVariavel
          aoFechar={() => setModal('')}
          aoInserir={(n) => {
            setModal('');
            ins.envolver(`{{${n}}}`);
          }}
        />
      )}
      {modal === 'concordancia' && (
        <ModalConcordancia
          aoFechar={() => setModal('')}
          aoInserir={(t) => {
            setModal('');
            ins.envolver(t);
          }}
        />
      )}
      {modal === 'condicao' && (
        <ModalCondicao
          aoFechar={() => setModal('')}
          aoInserir={(abre, senao, emBloco) => {
            setModal('');
            if (emBloco) ins.bloco(senao ? `${abre}` : abre, senao ? '[senão]\n\n[fim]' : '[fim]', 'texto quando verdadeiro');
            else ins.envolver(abre, senao ? '[senão]texto quando falso[fim]' : '[fim]', 'texto');
          }}
        />
      )}
      {modal === 'repeticao' && (
        <ModalRepeticao
          aoFechar={() => setModal('')}
          aoInserir={(abre, meio) => {
            setModal('');
            ins.bloco(abre, '[fim]', meio);
          }}
        />
      )}
      {modal === 'ajuda' && (
        <Modal titulo="Como escrever as cláusulas" aoFechar={() => setModal('')} largo>
          <p>Você não precisa decorar nada: use os botões. Este é só um resumo do que eles inserem.</p>
          <pre className="texto-clausula" style={{ marginLeft: 0, maxHeight: 'none' }}>
            {AJUDA}
          </pre>
          <p className="pequeno">
            Tipos de item disponíveis em repetições: {TIPOS_ITEM.map((t) => t.rotulo).join(', ')}.
          </p>
        </Modal>
      )}
      {versao && (
        <Modal
          titulo={`Versão ${versao.versao} (${formatarData(versao.salvo_em.slice(0, 10))})`}
          aoFechar={() => setVersaoVista(null)}
          largo
          rodape={
            <button
              onClick={() => {
                mudar(extrairConteudo(versao));
                setVersaoVista(null);
                app.avisar('info', `Texto da versão ${versao.versao} copiado para o editor. Salve para criar uma nova versão com ele.`);
              }}
            >
              Restaurar no editor
            </button>
          }
        >
          <p>
            <strong>{versao.titulo_interno}</strong>
          </p>
          <pre className="texto-clausula" style={{ marginLeft: 0, maxHeight: 400 }}>
            {versao.corpo}
          </pre>
        </Modal>
      )}
    </div>
  );
}

function SeletorIds(p: { rotulo: string; valor: string[]; opcoes: Clausula[]; onChange: (v: string[]) => void }) {
  const [escolha, setEscolha] = useState('');
  return (
    <div className="campo">
      <span>{p.rotulo}</span>
      <div>
        {p.valor.map((id) => (
          <span key={id} className="etiqueta">
            {p.opcoes.find((o) => o.id === id)?.titulo_interno ?? id}{' '}
            <button className="link" onClick={() => p.onChange(p.valor.filter((x) => x !== id))} aria-label="Remover">
              ✕
            </button>
          </span>
        ))}
      </div>
      <div className="linha" style={{ flexWrap: 'nowrap' }}>
        <select value={escolha} onChange={(e) => setEscolha(e.target.value)}>
          <option value="">Escolha uma cláusula…</option>
          {p.opcoes
            .filter((o) => !p.valor.includes(o.id))
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.titulo_interno}
              </option>
            ))}
        </select>
        <button
          className="pequeno"
          disabled={!escolha}
          onClick={() => {
            p.onChange([...p.valor, escolha]);
            setEscolha('');
          }}
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}
