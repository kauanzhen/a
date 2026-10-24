import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CabecalhoPagina, Campo, CampoData, CampoMoeda, ListaErros, Modal } from '../../components/ui';
import { db } from '../../db/db';
import {
  NOMES_TIPO_TABELA,
  type DadosAliquotas,
  type DadosINSS,
  type DadosIRRF,
  type DadosSalarioMinimo,
  type ItemAliquota,
  type TabelaFiscal,
  type TipoTabelaFiscal,
} from '../../db/types';
import { useAcao, useApp } from '../../hooks/app';
import { formatarData, formatarDataHora } from '../../lib/date';
import { formatarMoeda } from '../../lib/money';
import { excluirTabela, restaurarTabelasPadrao, salvarTabela, validarTabela } from './tabelaService';

const ORDEM: TipoTabelaFiscal[] = ['SALARIO_MINIMO', 'INSS', 'IRRF', 'ALIQUOTAS'];

function resumo(t: TabelaFiscal): string {
  switch (t.tipo) {
    case 'SALARIO_MINIMO':
      return formatarMoeda((t.dados as DadosSalarioMinimo).valor);
    case 'INSS': {
      const f = (t.dados as DadosINSS).faixas;
      return `${f.length} faixas · teto ${formatarMoeda(f.at(-1)?.ate ?? 0)}`;
    }
    case 'IRRF': {
      const d = t.dados as DadosIRRF;
      return `isento até ${formatarMoeda(d.faixas[0]?.ate ?? 0)} · dependente ${formatarMoeda(d.deducaoDependente)}${d.redutor?.ativo ? ' · com redutor' : ''}`;
    }
    case 'ALIQUOTAS':
      return `${(t.dados as DadosAliquotas).itens.length} parâmetros`;
  }
}

export function TabelasFiscaisPage() {
  const { confirmar } = useApp();
  const acao = useAcao();
  const tabelas = useLiveQuery(() => db.tabelasFiscais.toArray(), [], []);
  const [editando, setEditando] = useState<TabelaFiscal | null>(null);

  return (
    <>
      <CabecalhoPagina
        titulo="Tabelas fiscais"
        descricao="Valores com data de vigência, usados pela folha e pela apuração de tributos. Os valores iniciais vêm marcados como “verificar vigência”: confira na fonte oficial e edite."
      >
        <button
          onClick={async () => {
            if (await confirmar({ titulo: 'Restaurar tabelas padrão', mensagem: 'Suas alterações nas tabelas fiscais serão perdidas. Continuar?', perigo: true }))
              await acao(restaurarTabelasPadrao, 'Tabelas restauradas.');
          }}
        >
          Restaurar padrão
        </button>
      </CabecalhoPagina>
      <div className="aviso alerta">
        As tabelas são <strong>globais</strong> (valem para todas as empresas). O sistema escolhe a tabela pela data: vale a de maior início de vigência que
        seja anterior ou igual à data do cálculo. Premissas e fontes estão no arquivo <code>PREMISSAS.md</code>.
      </div>
      {ORDEM.map((tipo) => {
        const lista = tabelas.filter((t) => t.tipo === tipo).sort((a, b) => (a.conjunto + a.vigenciaInicio < b.conjunto + b.vigenciaInicio ? 1 : -1));
        return (
          <div className="cartao" key={tipo}>
            <h2>{NOMES_TIPO_TABELA[tipo]}</h2>
            <div className="tabela-container">
              <table>
                <thead>
                  <tr>
                    <th>Vigência</th>
                    <th>Descrição</th>
                    <th className="esconder-mobile">Resumo</th>
                    <th>Situação</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((t) => (
                    <tr key={t.id}>
                      <td>a partir de {formatarData(t.vigenciaInicio)}</td>
                      <td>
                        {t.descricao}
                        {t.fonte && <div className="texto-2">Fonte: {t.fonte}</div>}
                      </td>
                      <td className="esconder-mobile">{resumo(t)}</td>
                      <td>
                        {t.verificarVigencia ? <span className="etiqueta aviso">verificar vigência</span> : <span className="etiqueta sucesso">verificada</span>}
                        {t.alteradaEm && <div className="texto-2">alterada {formatarDataHora(t.alteradaEm)}</div>}
                      </td>
                      <td>
                        <div className="acoes">
                          <button className="pequeno" onClick={() => setEditando(structuredClone(t))}>
                            Editar
                          </button>
                          <button
                            className="pequeno"
                            onClick={() => {
                              const { id: _id, ...copia } = structuredClone(t);
                              setEditando({ ...copia, descricao: `${t.descricao} (nova vigência)`, verificarVigencia: true });
                            }}
                          >
                            Nova vigência
                          </button>
                          {t.verificarVigencia && (
                            <button className="pequeno" onClick={() => acao(() => salvarTabela({ ...t, verificarVigencia: false }), 'Marcada como verificada.')}>
                              Marcar verificada
                            </button>
                          )}
                          <button
                            className="pequeno perigo"
                            onClick={async () => {
                              if (await confirmar({ titulo: 'Excluir tabela', mensagem: `Excluir "${t.descricao}"?`, perigo: true }))
                                await acao(() => excluirTabela(t.id!), 'Tabela excluída.');
                            }}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {editando && <EditorTabela tabela={editando} aoFechar={() => setEditando(null)} />}
    </>
  );
}

function EditorTabela(props: { tabela: TabelaFiscal; aoFechar: () => void }) {
  const acao = useAcao();
  const [t, setT] = useState<TabelaFiscal>(props.tabela);
  const [erros, setErros] = useState<string[]>([]);
  const dados = <D,>() => t.dados as D;
  const mudaDados = (d: TabelaFiscal['dados']) => setT((x) => ({ ...x, dados: d }));

  async function salvar() {
    const e = validarTabela(t);
    setErros(e);
    if (e.length) return;
    if (await acao(() => salvarTabela(t), 'Tabela salva.')) props.aoFechar();
  }

  return (
    <Modal
      titulo={`${t.id ? 'Editar' : 'Nova'} tabela — ${NOMES_TIPO_TABELA[t.tipo]}`}
      aoFechar={props.aoFechar}
      largo
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
      <div className="form-grade">
        <Campo rotulo="Descrição" className="col-6">
          <input value={t.descricao} onChange={(e) => setT({ ...t, descricao: e.target.value })} />
        </Campo>
        <Campo rotulo="Início da vigência" className="col-3">
          <CampoData valor={t.vigenciaInicio} aoMudar={(v) => setT({ ...t, vigenciaInicio: v })} />
        </Campo>
        <Campo rotulo="Conjunto" className="col-3" dica="Agrupa tabelas do mesmo assunto">
          <input value={t.conjunto} onChange={(e) => setT({ ...t, conjunto: e.target.value.toUpperCase() })} />
        </Campo>
        <Campo rotulo="Fonte (norma)" className="col-9">
          <input value={t.fonte ?? ''} onChange={(e) => setT({ ...t, fonte: e.target.value })} />
        </Campo>
        <div className="col-3" style={{ alignSelf: 'end' }}>
          <label className="check">
            <input type="checkbox" checked={t.verificarVigencia} onChange={(e) => setT({ ...t, verificarVigencia: e.target.checked })} />
            Verificar vigência
          </label>
        </div>
      </div>
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      {t.tipo === 'SALARIO_MINIMO' && (
        <Campo rotulo="Valor mensal (R$)">
          <CampoMoeda valor={dados<DadosSalarioMinimo>().valor} aoMudar={(v) => mudaDados({ valor: v })} />
        </Campo>
      )}

      {t.tipo === 'INSS' && (
        <FaixasINSS dados={dados<DadosINSS>()} aoMudar={mudaDados} />
      )}

      {t.tipo === 'IRRF' && <EditorIRRF dados={dados<DadosIRRF>()} aoMudar={mudaDados} />}

      {t.tipo === 'ALIQUOTAS' && <EditorAliquotas dados={dados<DadosAliquotas>()} aoMudar={mudaDados} />}
    </Modal>
  );
}

function FaixasINSS(props: { dados: DadosINSS; aoMudar: (d: DadosINSS) => void }) {
  const f = props.dados.faixas;
  const muda = (i: number, campo: 'ate' | 'aliquota', v: number) => props.aoMudar({ faixas: f.map((x, j) => (j === i ? { ...x, [campo]: v } : x)) });
  return (
    <>
      <h3>Faixas progressivas (cada faixa incide só sobre a parte do salário dentro dela)</h3>
      <div className="tabela-container">
        <table>
          <thead>
            <tr>
              <th>Faixa</th>
              <th>De</th>
              <th>Até (R$)</th>
              <th>Alíquota (%)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {f.map((x, i) => (
              <tr key={i}>
                <td>{i + 1}ª</td>
                <td className="num">{formatarMoeda(i === 0 ? 0 : f[i - 1].ate + 1)}</td>
                <td>
                  <CampoMoeda valor={x.ate} aoMudar={(v) => muda(i, 'ate', v)} />
                </td>
                <td>
                  <input type="number" step="0.01" value={x.aliquota} onChange={(e) => muda(i, 'aliquota', Number(e.target.value))} />
                </td>
                <td>
                  <button className="pequeno perigo" onClick={() => props.aoMudar({ faixas: f.filter((_, j) => j !== i) })}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="pequeno" style={{ marginTop: 8 }} onClick={() => props.aoMudar({ faixas: [...f, { ate: (f.at(-1)?.ate ?? 0) + 100000, aliquota: 0 }] })}>
        Adicionar faixa
      </button>
      <p className="texto-2">O limite da última faixa é o teto de contribuição.</p>
    </>
  );
}

function EditorIRRF(props: { dados: DadosIRRF; aoMudar: (d: DadosIRRF) => void }) {
  const d = props.dados;
  const mudaFaixa = (i: number, campo: 'ate' | 'aliquota' | 'deducao', v: number | null) =>
    props.aoMudar({ ...d, faixas: d.faixas.map((x, j) => (j === i ? { ...x, [campo]: v } : x)) });
  const r = d.redutor;
  const mudaRedutor = (campo: string, v: unknown) =>
    props.aoMudar({
      ...d,
      redutor: { ativo: false, limiteIsencao: 0, valorMaximo: 0, limiteFaixa: 0, constante: 0, fator: 0, ...r, [campo]: v },
    });
  return (
    <>
      <h3>Tabela progressiva mensal</h3>
      <div className="tabela-container">
        <table>
          <thead>
            <tr>
              <th>Base de cálculo até (R$)</th>
              <th>Alíquota (%)</th>
              <th>Parcela a deduzir (R$)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {d.faixas.map((x, i) => (
              <tr key={i}>
                <td>
                  {x.ate === null ? (
                    <span className="texto-2">acima da faixa anterior</span>
                  ) : (
                    <CampoMoeda valor={x.ate} aoMudar={(v) => mudaFaixa(i, 'ate', v)} />
                  )}
                </td>
                <td>
                  <input type="number" step="0.01" value={x.aliquota} onChange={(e) => mudaFaixa(i, 'aliquota', Number(e.target.value))} />
                </td>
                <td>
                  <CampoMoeda valor={x.deducao} aoMudar={(v) => mudaFaixa(i, 'deducao', v)} />
                </td>
                <td>
                  <button className="pequeno perigo" onClick={() => props.aoMudar({ ...d, faixas: d.faixas.filter((_, j) => j !== i) })}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-grade" style={{ marginTop: 12 }}>
        <Campo rotulo="Dedução por dependente (R$)" className="col-4">
          <CampoMoeda valor={d.deducaoDependente} aoMudar={(v) => props.aoMudar({ ...d, deducaoDependente: v })} />
        </Campo>
        <Campo rotulo="Desconto simplificado mensal (R$)" className="col-4" dica="Usado quando for mais vantajoso que as deduções legais">
          <CampoMoeda valor={d.descontoSimplificado} aoMudar={(v) => props.aoMudar({ ...d, descontoSimplificado: v })} />
        </Campo>
      </div>
      <h3 style={{ marginTop: 16 }}>Redução mensal do imposto (Lei 15.270/2025)</h3>
      <label className="check">
        <input type="checkbox" checked={Boolean(r?.ativo)} onChange={(e) => mudaRedutor('ativo', e.target.checked)} />
        Aplicar redução
      </label>
      {r?.ativo && (
        <div className="form-grade" style={{ marginTop: 8 }}>
          <Campo rotulo="Isenção total até (R$)" className="col-4">
            <CampoMoeda valor={r.limiteIsencao} aoMudar={(v) => mudaRedutor('limiteIsencao', v)} />
          </Campo>
          <Campo rotulo="Redução máxima (R$)" className="col-4">
            <CampoMoeda valor={r.valorMaximo} aoMudar={(v) => mudaRedutor('valorMaximo', v)} />
          </Campo>
          <Campo rotulo="Redução parcial até (R$)" className="col-4">
            <CampoMoeda valor={r.limiteFaixa} aoMudar={(v) => mudaRedutor('limiteFaixa', v)} />
          </Campo>
          <Campo rotulo="Constante (R$)" className="col-4" dica="redução = constante − fator × rendimento">
            <CampoMoeda valor={r.constante} aoMudar={(v) => mudaRedutor('constante', v)} />
          </Campo>
          <Campo rotulo="Fator" className="col-4">
            <input type="number" step="0.000001" value={r.fator} onChange={(e) => mudaRedutor('fator', Number(e.target.value))} />
          </Campo>
          {r.observacao && <p className="texto-2 col-12">{r.observacao}</p>}
        </div>
      )}
    </>
  );
}

function EditorAliquotas(props: { dados: DadosAliquotas; aoMudar: (d: DadosAliquotas) => void }) {
  const itens = props.dados.itens;
  const muda = (i: number, campo: keyof ItemAliquota, v: unknown) => props.aoMudar({ itens: itens.map((x, j) => (j === i ? { ...x, [campo]: v } : x)) });
  return (
    <>
      <div className="tabela-container">
        <table>
          <thead>
            <tr>
              <th>Chave</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Unidade</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {itens.map((x, i) => (
              <tr key={i}>
                <td>
                  <input className="mono" value={x.chave} onChange={(e) => muda(i, 'chave', e.target.value.toUpperCase().replace(/\s/g, '_'))} />
                </td>
                <td>
                  <input value={x.descricao} onChange={(e) => muda(i, 'descricao', e.target.value)} style={{ width: '100%' }} />
                </td>
                <td>
                  <input type="number" step="0.0001" value={x.valor} onChange={(e) => muda(i, 'valor', Number(e.target.value))} style={{ width: 110 }} />
                </td>
                <td>
                  <select value={x.unidade} onChange={(e) => muda(i, 'unidade', e.target.value)}>
                    {['%', 'R$', 'fator', 'dias', 'horas'].map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button className="pequeno perigo" onClick={() => props.aoMudar({ itens: itens.filter((_, j) => j !== i) })}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="pequeno" style={{ marginTop: 8 }} onClick={() => props.aoMudar({ itens: [...itens, { chave: 'NOVO', descricao: '', valor: 0, unidade: '%' }] })}>
        Adicionar parâmetro
      </button>
    </>
  );
}
