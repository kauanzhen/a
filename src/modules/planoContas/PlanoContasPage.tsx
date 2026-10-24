import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CabecalhoPagina, Campo, ExigeEmpresa, ListaErros, Modal } from '../../components/ui';
import { db } from '../../db/db';
import { NOMES_GRUPO, type Conta, type GrupoConta, type Natureza, type TipoConta } from '../../db/types';
import { useAcao, useApp } from '../../hooks/app';
import { codigoPai, compararCodigos, formatarCodigo, interpretarMascara, nivelDoCodigo, proximoCodigoFilho } from '../../lib/mascara';
import {
  alterarAtivacaoConta,
  aplicarImportacaoContas,
  atualizarConta,
  contasComMovimento,
  criarConta,
  excluirConta,
  naturezaSugerida,
  prepararImportacaoContas,
  type DadosConta,
  type LinhaContaImportada,
  type ResultadoPreparoContas,
} from './contaService';
import { baixarPlanoContas, lerPlanilha } from '../importacao/planilhas';
import { grupoPorCodigo } from './planoPadrao';
import { normalizarCabecalho } from '../importacao/colunas';

export function PlanoContasPage() {
  return (
    <ExigeEmpresa>
      <Conteudo />
    </ExigeEmpresa>
  );
}

type Edicao = { conta?: Conta; codigoInicial?: string } | null;

function Conteudo() {
  const { empresa, confirmar } = useApp();
  const acao = useAcao();
  const mascara = useMemo(() => interpretarMascara(empresa!.mascaraPlano), [empresa]);
  const contas = useLiveQuery(async () => (await db.contas.where('empresaId').equals(empresa!.id!).toArray()).sort((a, b) => compararCodigos(a.codigo, b.codigo)), [empresa?.id], []);
  const movimento = useLiveQuery(() => contasComMovimento(empresa!.id!), [empresa?.id], new Set<number>());
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState<GrupoConta | ''>('');
  const [tipo, setTipo] = useState<TipoConta | ''>('');
  const [situacao, setSituacao] = useState<'todas' | 'ativas' | 'inativas'>('todas');
  const [nivelMax, setNivelMax] = useState(mascara.segmentos.length);
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [importando, setImportando] = useState(false);

  const filtradas = useMemo(() => {
    const t = normalizarCabecalho(busca);
    return contas.filter(
      (c) =>
        (!t || normalizarCabecalho(`${c.codigo} ${c.reduzido ?? ''} ${c.nome} ${c.contaReferencial ?? ''}`).includes(t)) &&
        (!grupo || c.grupo === grupo) &&
        (!tipo || c.tipo === tipo) &&
        (situacao === 'todas' || (situacao === 'ativas') === c.ativa) &&
        c.nivel <= nivelMax,
    );
  }, [contas, busca, grupo, tipo, situacao, nivelMax]);

  async function excluir(c: Conta) {
    if (await confirmar({ titulo: 'Excluir conta', mensagem: `Excluir ${c.codigo} — ${c.nome}?`, perigo: true, textoConfirmar: 'Excluir' }))
      await acao(() => excluirConta(c.id!), 'Conta excluída.');
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Plano de contas"
        descricao={`Máscara ${mascara.texto} · ${contas.length} contas (${contas.filter((c) => c.tipo === 'A').length} analíticas). Só contas analíticas recebem lançamentos.`}
      >
        <button onClick={() => baixarPlanoContas(contas)}>Exportar Excel</button>
        <button onClick={() => setImportando(true)}>Importar Excel</button>
        <button className="primario" onClick={() => setEdicao({})}>
          Nova conta
        </button>
      </CabecalhoPagina>
      <div className="filtros nao-imprimir">
        <input type="search" placeholder="Buscar por código, reduzido, nome ou referencial…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select value={grupo} onChange={(e) => setGrupo(e.target.value as GrupoConta | '')} aria-label="Grupo">
          <option value="">Todos os grupos</option>
          {Object.entries(NOMES_GRUPO).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoConta | '')} aria-label="Tipo">
          <option value="">Sintéticas e analíticas</option>
          <option value="S">Só sintéticas</option>
          <option value="A">Só analíticas</option>
        </select>
        <select value={situacao} onChange={(e) => setSituacao(e.target.value as typeof situacao)} aria-label="Situação">
          <option value="todas">Ativas e inativas</option>
          <option value="ativas">Só ativas</option>
          <option value="inativas">Só inativas</option>
        </select>
        <select value={nivelMax} onChange={(e) => setNivelMax(Number(e.target.value))} aria-label="Nível máximo">
          {mascara.segmentos.map((_, i) => (
            <option key={i} value={i + 1}>
              Até o nível {i + 1}
            </option>
          ))}
        </select>
      </div>
      <div className="tabela-container">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Red.</th>
              <th>Nome</th>
              <th className="esconder-mobile">Grupo</th>
              <th>Nat.</th>
              <th className="esconder-mobile">Referencial</th>
              <th className="esconder-mobile">CC</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtradas.map((c) => (
              <tr key={c.id} className={`${c.tipo === 'S' ? 'sintetica' : ''} ${c.ativa ? '' : 'inativa'}`}>
                <td className="mono" style={{ whiteSpace: 'nowrap' }}>
                  {c.codigo}
                </td>
                <td className="mono">{c.reduzido ?? ''}</td>
                <td style={{ paddingLeft: 10 + (c.nivel - 1) * 14 }}>
                  {c.nome}
                  {!c.ativa && <span className="etiqueta" style={{ marginLeft: 6 }}>inativa</span>}
                  {c.id !== undefined && movimento.has(c.id) && <span className="etiqueta info" style={{ marginLeft: 6 }}>com movimento</span>}
                </td>
                <td className="esconder-mobile">{NOMES_GRUPO[c.grupo]}</td>
                <td>{c.natureza}</td>
                <td className="esconder-mobile mono texto-2">{c.contaReferencial ?? ''}</td>
                <td className="esconder-mobile">{c.exigeCentroCusto ? 'exige' : ''}</td>
                <td>
                  <div className="acoes" style={{ flexWrap: 'nowrap' }}>
                    {c.tipo === 'S' && c.nivel < mascara.segmentos.length && (
                      <button
                        className="pequeno"
                        title="Nova subconta"
                        onClick={() => setEdicao({ codigoInicial: proximoCodigoFilho(c.codigo, contas.map((x) => x.codigo), mascara) ?? c.codigo })}
                      >
                        + Sub
                      </button>
                    )}
                    <button className="pequeno" onClick={() => setEdicao({ conta: c })}>
                      Editar
                    </button>
                    <button className="pequeno" onClick={() => acao(() => alterarAtivacaoConta(c.id!, !c.ativa), c.ativa ? 'Conta inativada.' : 'Conta ativada.')}>
                      {c.ativa ? 'Inativar' : 'Ativar'}
                    </button>
                    <button className="pequeno perigo" disabled={c.id !== undefined && movimento.has(c.id)} title={c.id !== undefined && movimento.has(c.id) ? 'Conta com movimento não pode ser excluída' : ''} onClick={() => excluir(c)}>
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtradas.length && (
              <tr>
                <td colSpan={8} className="vazio">
                  Nenhuma conta encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {edicao && <FormConta contas={contas} edicao={edicao} temMovimento={Boolean(edicao.conta?.id && movimento.has(edicao.conta.id))} aoFechar={() => setEdicao(null)} />}
      {importando && <ImportarContas contas={contas} aoFechar={() => setImportando(false)} />}
    </>
  );
}

function FormConta(props: { contas: Conta[]; edicao: NonNullable<Edicao>; temMovimento: boolean; aoFechar: () => void }) {
  const { empresa } = useApp();
  const acao = useAcao();
  const mascara = interpretarMascara(empresa!.mascaraPlano);
  const c = props.edicao.conta;
  const [d, setD] = useState<DadosConta>(() =>
    c
      ? { codigo: c.codigo, nome: c.nome, tipo: c.tipo, natureza: c.natureza, grupo: c.grupo, contaReferencial: c.contaReferencial, exigeCentroCusto: c.exigeCentroCusto, ativa: c.ativa, reduzido: c.reduzido }
      : { codigo: props.edicao.codigoInicial ?? '', nome: '', tipo: 'A', natureza: 'D', exigeCentroCusto: false, ativa: true },
  );
  const [erros, setErros] = useState<string[]>([]);

  // grupo e natureza sugeridos pela conta-mãe (na raiz 2, o subgrupo 2.3 é o PL)
  const sugerirGrupo = (codigo: string): GrupoConta => {
    const nv = nivelDoCodigo(codigo, mascara);
    const mae = nv && nv > 1 ? props.contas.find((x) => x.codigo === codigoPai(codigo, mascara)) : undefined;
    if (mae && !(mae.nivel === 1 && mae.grupo === 'PASSIVO')) return mae.grupo;
    return grupoPorCodigo(codigo);
  };
  const nivel = nivelDoCodigo(d.codigo, mascara);
  const pai = nivel && nivel > 1 ? props.contas.find((x) => x.codigo === codigoPai(d.codigo, mascara)) : undefined;
  const grupoSugerido: GrupoConta = d.grupo ?? sugerirGrupo(d.codigo);

  function mudaCodigo(v: string) {
    const formatado = /[.\-/]$/.test(v) ? v : formatarCodigo(v, mascara);
    const nv = nivelDoCodigo(formatado, mascara);
    setD((x) => {
      if (c) return { ...x, codigo: formatado };
      const g = sugerirGrupo(formatado);
      return { ...x, codigo: formatado, grupo: undefined, natureza: naturezaSugerida(g, x.nome), tipo: nv === mascara.segmentos.length ? 'A' : x.tipo };
    });
  }

  async function salvar() {
    setErros([]);
    const dados = { ...d, grupo: d.grupo ?? grupoSugerido };
    const ok = await acao(async () => {
      try {
        if (c) await atualizarConta(c.id!, dados);
        else await criarConta(empresa!.id!, dados);
        return true;
      } catch (e) {
        setErros((e as Error).message.split('\n'));
        return false;
      }
    });
    if (ok) props.aoFechar();
  }

  return (
    <Modal
      titulo={c ? `Editar conta ${c.codigo}` : 'Nova conta'}
      aoFechar={props.aoFechar}
      rodape={
        <>
          <button onClick={props.aoFechar}>Cancelar</button>
          <button className="primario" onClick={salvar}>
            Salvar
          </button>
        </>
      }
    >
      <ListaErros erros={erros} />
      {props.temMovimento && <div className="aviso info">Esta conta tem lançamentos: não pode virar sintética nem ser excluída.</div>}
      <div className="form-grade">
        <Campo rotulo="Código de classificação" className="col-6" dica={`Máscara ${mascara.texto}${pai ? ` · conta-mãe: ${pai.nome}` : ''}`}>
          <input className="mono" value={d.codigo} onChange={(e) => mudaCodigo(e.target.value)} autoFocus={!c} />
        </Campo>
        <Campo rotulo="Código reduzido" className="col-6" dica="Só analíticas; em branco = automático">
          <input
            className="mono"
            value={d.reduzido ?? ''}
            disabled={d.tipo === 'S'}
            onChange={(e) => setD({ ...d, reduzido: e.target.value.trim() ? Number(e.target.value.replace(/\D/g, '')) : undefined })}
          />
        </Campo>
        <Campo rotulo="Nome" className="col-12" dica='Comece com "(-)" para contas redutoras (ex.: depreciação acumulada).'>
          <input value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} autoFocus={Boolean(c)} />
        </Campo>
        <Campo rotulo="Tipo" className="col-4">
          <select value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value as TipoConta })}>
            <option value="S">Sintética (agrupa)</option>
            <option value="A">Analítica (recebe lançamentos)</option>
          </select>
        </Campo>
        <Campo rotulo="Natureza do saldo" className="col-4">
          <select value={d.natureza} onChange={(e) => setD({ ...d, natureza: e.target.value as Natureza })}>
            <option value="D">Devedora</option>
            <option value="C">Credora</option>
          </select>
        </Campo>
        <Campo rotulo="Grupo" className="col-4">
          <select value={grupoSugerido} onChange={(e) => setD({ ...d, grupo: e.target.value as GrupoConta })}>
            {Object.entries(NOMES_GRUPO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Conta referencial (SPED ECD)" className="col-6" dica="Ilustrativa — confira com a tabela oficial">
          <input className="mono" value={d.contaReferencial ?? ''} onChange={(e) => setD({ ...d, contaReferencial: e.target.value })} />
        </Campo>
        <div className="col-6" style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'end' }}>
          <label className="check">
            <input type="checkbox" checked={d.exigeCentroCusto} onChange={(e) => setD({ ...d, exigeCentroCusto: e.target.checked })} />
            Exigir centro de custo nos lançamentos
          </label>
          <label className="check">
            <input type="checkbox" checked={d.ativa} onChange={(e) => setD({ ...d, ativa: e.target.checked })} />
            Conta ativa
          </label>
        </div>
      </div>
    </Modal>
  );
}

const SINONIMOS_CONTA: Record<keyof Omit<LinhaContaImportada, 'linha'>, string[]> = {
  codigo: ['codigo', 'classificacao', 'conta', 'cod'],
  nome: ['nome', 'descricao', 'nome da conta', 'titulo'],
  tipo: ['tipo', 's/a', 'sintetica/analitica'],
  natureza: ['natureza', 'nat', 'd/c'],
  grupo: ['grupo'],
  contaReferencial: ['conta referencial', 'referencial', 'cod referencial'],
  exigeCentroCusto: ['exige cc', 'exige centro de custo', 'centro de custo', 'cc'],
  reduzido: ['reduzido', 'codigo reduzido', 'cod reduzido'],
  ativa: ['ativa', 'ativo', 'situacao'],
};

function ImportarContas(props: { contas: Conta[]; aoFechar: () => void }) {
  const { empresa } = useApp();
  const acao = useAcao();
  const [arquivo, setArquivo] = useState<string>('');
  const [atualizar, setAtualizar] = useState(false);
  const [linhas, setLinhas] = useState<LinhaContaImportada[] | null>(null);
  const [erroLeitura, setErroLeitura] = useState('');
  const movimento = useLiveQuery(() => contasComMovimento(empresa!.id!), [empresa?.id], new Set<number>());

  const preparo: ResultadoPreparoContas | null = useMemo(
    () =>
      linhas
        ? prepararImportacaoContas(empresa!.id!, linhas, props.contas, interpretarMascara(empresa!.mascaraPlano), { atualizarExistentes: atualizar, contasComMovimento: movimento })
        : null,
    [linhas, atualizar, props.contas, empresa, movimento],
  );

  async function ler(f: File) {
    setErroLeitura('');
    setArquivo(f.name);
    try {
      const abas = lerPlanilha(await f.arrayBuffer(), f.name);
      const dados = abas[0].linhas;
      const cab = dados.findIndex((l) => l.some((c) => SINONIMOS_CONTA.codigo.includes(normalizarCabecalho(c))));
      if (cab < 0) throw new Error('Não encontrei a coluna "Código" na primeira aba.');
      const cabecalho = dados[cab].map(normalizarCabecalho);
      const col = (campo: keyof typeof SINONIMOS_CONTA) => cabecalho.findIndex((h) => SINONIMOS_CONTA[campo].includes(h));
      const idx = Object.fromEntries(Object.keys(SINONIMOS_CONTA).map((k) => [k, col(k as keyof typeof SINONIMOS_CONTA)]));
      if (idx.nome < 0) throw new Error('Não encontrei a coluna "Nome".');
      const pega = (l: unknown[], k: string) => (idx[k] >= 0 ? String(l[idx[k]] ?? '').trim() : undefined);
      setLinhas(
        dados.slice(cab + 1).map((l, i) => ({
          linha: cab + i + 2,
          codigo: pega(l, 'codigo') ?? '',
          nome: pega(l, 'nome') ?? '',
          tipo: pega(l, 'tipo'),
          natureza: pega(l, 'natureza'),
          grupo: pega(l, 'grupo'),
          contaReferencial: pega(l, 'contaReferencial'),
          exigeCentroCusto: pega(l, 'exigeCentroCusto'),
          reduzido: pega(l, 'reduzido'),
          ativa: pega(l, 'ativa'),
        })),
      );
    } catch (e) {
      setErroLeitura((e as Error).message);
      setLinhas(null);
    }
  }

  return (
    <Modal
      titulo="Importar plano de contas (Excel)"
      aoFechar={props.aoFechar}
      largo
      rodape={
        <>
          <button onClick={props.aoFechar}>Cancelar</button>
          <button
            className="primario"
            disabled={!preparo || preparo.novas.length + preparo.atualizacoes.length === 0}
            onClick={async () => {
              if (await acao(async () => (await aplicarImportacaoContas(empresa!.id!, preparo!, arquivo), true), 'Plano de contas importado.')) props.aoFechar();
            }}
          >
            Importar {preparo ? `${preparo.novas.length + preparo.atualizacoes.length} conta(s)` : ''}
          </button>
        </>
      }
    >
      <p>
        Colunas aceitas: <code>Código</code>, <code>Nome</code> (obrigatórias), <code>Tipo</code> (S/A), <code>Natureza</code> (D/C), <code>Grupo</code>,{' '}
        <code>Conta Referencial</code>, <code>Exige CC</code> (S/N), <code>Reduzido</code>, <code>Ativa</code> (S/N). Dica: use “Exportar Excel” como modelo.
        Contas-mãe podem vir em qualquer ordem na planilha.
      </p>
      <div className="acoes" style={{ marginBottom: 12 }}>
        <input type="file" accept=".xlsx,.xls,.ods,.csv" onChange={(e) => e.target.files?.[0] && ler(e.target.files[0])} />
        <label className="check">
          <input type="checkbox" checked={atualizar} onChange={(e) => setAtualizar(e.target.checked)} />
          Atualizar contas que já existem (mesmo código)
        </label>
      </div>
      {erroLeitura && <ListaErros erros={[erroLeitura]} />}
      {preparo && (
        <>
          <div className="aviso info">
            {preparo.novas.length} nova(s) · {preparo.atualizacoes.length} atualização(ões) · {preparo.ignoradas} já existente(s) ignorada(s) ·{' '}
            {preparo.erros.length} erro(s)
          </div>
          {preparo.erros.length > 0 && <ListaErros titulo="Linhas com erro (não serão importadas):" erros={preparo.erros.map((e) => `Linha ${e.linha}: ${e.mensagem}`)} />}
          {preparo.novas.length > 0 && (
            <div className="tabela-container" style={{ maxHeight: 300 }}>
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nome</th>
                    <th>Tipo</th>
                    <th>Nat.</th>
                    <th>Grupo</th>
                  </tr>
                </thead>
                <tbody>
                  {preparo.novas.map((c) => (
                    <tr key={c.codigo}>
                      <td className="mono">{c.codigo}</td>
                      <td>{c.nome}</td>
                      <td>{c.tipo}</td>
                      <td>{c.natureza}</td>
                      <td>{NOMES_GRUPO[c.grupo]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
