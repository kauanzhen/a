import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CabecalhoPagina, Campo, ExigeEmpresa, Modal } from '../../components/ui';
import { db } from '../../db/db';
import { useAcao, useApp } from '../../hooks/app';
import { competenciaPorExtenso, formatarData, formatarDataHora, montarISO } from '../../lib/date';
import { criarExercicio, excluirExercicio, fecharPeriodo, fimPadraoExercicio, reabrirPeriodo } from './periodoService';

export function ExerciciosPage() {
  return (
    <ExigeEmpresa>
      <Conteudo />
    </ExigeEmpresa>
  );
}

function Conteudo() {
  const { empresa, confirmar } = useApp();
  const acao = useAcao();
  const [novo, setNovo] = useState(false);
  const dados = useLiveQuery(async () => {
    const [exercicios, periodos, lancamentos] = await Promise.all([
      db.exercicios.where('empresaId').equals(empresa!.id!).sortBy('inicio'),
      db.periodos.where('empresaId').equals(empresa!.id!).sortBy('competencia'),
      db.lancamentos.where('empresaId').equals(empresa!.id!).toArray(),
    ]);
    const qtd = new Map<string, number>();
    for (const l of lancamentos) qtd.set(l.competencia, (qtd.get(l.competencia) ?? 0) + 1);
    return { exercicios, periodos, qtd };
  }, [empresa?.id]);

  return (
    <>
      <CabecalhoPagina
        titulo="Exercícios e períodos"
        descricao="Cada exercício social é dividido em períodos mensais. Um período FECHADO não aceita novos lançamentos, alterações ou exclusões."
      >
        <button className="primario" onClick={() => setNovo(true)}>
          Novo exercício
        </button>
      </CabecalhoPagina>
      {dados?.exercicios.map((ex) => (
        <div className="cartao" key={ex.id}>
          <div className="cabecalho-pagina" style={{ marginBottom: 10 }}>
            <div>
              <h2>{ex.descricao}</h2>
              <p>
                {formatarData(ex.inicio)} a {formatarData(ex.fim)} ·{' '}
                <span className={`etiqueta ${ex.status === 'ABERTO' ? 'sucesso' : ''}`}>{ex.status === 'ABERTO' ? 'Aberto' : 'Encerrado'}</span>
              </p>
            </div>
            <div className="acoes">
              <button
                className="pequeno"
                onClick={async () => {
                  const abertos = dados.periodos.filter((p) => p.exercicioId === ex.id && p.status === 'ABERTO');
                  if (await confirmar({ titulo: 'Fechar todos os períodos', mensagem: `Fechar ${abertos.length} período(s) de ${ex.descricao}?` }))
                    await acao(async () => {
                      for (const p of abertos) await fecharPeriodo(p.id!);
                    }, 'Períodos fechados.');
                }}
              >
                Fechar todos
              </button>
              <button
                className="pequeno perigo"
                onClick={async () => {
                  if (await confirmar({ titulo: 'Excluir exercício', mensagem: `Excluir ${ex.descricao}? Só é possível se não houver lançamentos.`, perigo: true }))
                    await acao(() => excluirExercicio(ex.id!), 'Exercício excluído.');
                }}
              >
                Excluir
              </button>
            </div>
          </div>
          <div className="grade-periodos">
            {dados.periodos
              .filter((p) => p.exercicioId === ex.id)
              .map((p) => (
                <div key={p.id} className={`periodo ${p.status}`}>
                  <div className="negrito" style={{ textTransform: 'capitalize' }}>
                    {competenciaPorExtenso(p.competencia)}
                  </div>
                  <div className="texto-2">{dados.qtd.get(p.competencia) ?? 0} lançamento(s)</div>
                  <div style={{ margin: '6px 0' }}>
                    <span className={`etiqueta ${p.status === 'ABERTO' ? 'sucesso' : 'perigo'}`}>{p.status === 'ABERTO' ? 'Aberto' : 'Fechado'}</span>
                  </div>
                  {p.status === 'FECHADO' && p.fechadoEm && (
                    <div className="texto-2" style={{ fontSize: '0.72rem' }}>
                      {formatarDataHora(p.fechadoEm)} por {p.fechadoPor}
                    </div>
                  )}
                  <button
                    className="pequeno"
                    style={{ marginTop: 6 }}
                    onClick={() =>
                      p.status === 'ABERTO'
                        ? acao(() => fecharPeriodo(p.id!), `Período ${competenciaPorExtenso(p.competencia)} fechado.`)
                        : acao(() => reabrirPeriodo(p.id!), `Período ${competenciaPorExtenso(p.competencia)} reaberto.`)
                    }
                  >
                    {p.status === 'ABERTO' ? 'Fechar' : 'Reabrir'}
                  </button>
                </div>
              ))}
          </div>
        </div>
      ))}
      {dados && !dados.exercicios.length && <div className="cartao vazio">Nenhum exercício. Crie um para poder lançar.</div>}
      {novo && <NovoExercicio aoFechar={() => setNovo(false)} mesInicio={empresa!.inicioExercicioMes} empresaId={empresa!.id!} />}
    </>
  );
}

function NovoExercicio(props: { aoFechar: () => void; mesInicio: number; empresaId: number }) {
  const acao = useAcao();
  const [ano, setAno] = useState(new Date().getFullYear());
  const inicio = montarISO(ano || 2000, props.mesInicio, 1);
  return (
    <Modal
      titulo="Novo exercício social"
      aoFechar={props.aoFechar}
      rodape={
        <>
          <button onClick={props.aoFechar}>Cancelar</button>
          <button
            className="primario"
            onClick={async () => {
              if (await acao(() => criarExercicio(props.empresaId, inicio), 'Exercício criado com 12 períodos abertos.')) props.aoFechar();
            }}
          >
            Criar
          </button>
        </>
      }
    >
      <Campo rotulo="Ano de início" dica={`O exercício vai de ${formatarData(inicio)} a ${formatarData(fimPadraoExercicio(inicio))}.`}>
        <input type="number" value={ano || ''} onChange={(e) => setAno(Number(e.target.value))} autoFocus />
      </Campo>
    </Modal>
  );
}
