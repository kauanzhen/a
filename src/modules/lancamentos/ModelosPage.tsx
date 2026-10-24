import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { CabecalhoPagina, Campo, ExigeEmpresa, Modal } from '../../components/ui';
import { db } from '../../db/db';
import type { Conta, ModeloLancamento } from '../../db/types';
import { useAcao, useApp } from '../../hooks/app';
import { competenciasEntre, formatarCompetencia, hojeISO } from '../../lib/date';
import { formatarMoeda } from '../../lib/money';
import { calcularTotais } from './partidas';
import { excluirModelo, gerarLancamentosDoModelo, salvarModelo } from './lancamentoService';

export function ModelosPage() {
  return (
    <ExigeEmpresa>
      <Conteudo />
    </ExigeEmpresa>
  );
}

function Conteudo() {
  const { empresa, confirmar } = useApp();
  const acao = useAcao();
  const navegar = useNavigate();
  const modelos = useLiveQuery(() => db.modelos.where('empresaId').equals(empresa!.id!).toArray(), [empresa?.id], [] as ModeloLancamento[]);
  const contas = useLiveQuery(() => db.contas.where('empresaId').equals(empresa!.id!).toArray(), [empresa?.id], [] as Conta[]);
  const mapa = useMemo(() => new Map(contas.map((c) => [c.id!, c])), [contas]);
  const [gerando, setGerando] = useState<ModeloLancamento | null>(null);

  return (
    <>
      <CabecalhoPagina
        titulo="Lançamentos-modelo"
        descricao='Modelos para lançamentos repetitivos (aluguel, honorários, depreciação…). Crie um modelo no editor de lançamentos com "Salvar como modelo".'
      />
      {!modelos.length && (
        <div className="cartao vazio">
          Nenhum modelo ainda. Abra <strong>Novo lançamento</strong>, preencha e clique em <strong>Salvar como modelo</strong>.
        </div>
      )}
      <div className="grade">
        {modelos.map((m) => {
          const t = calcularTotais(m.partidas);
          return (
            <div className="cartao" key={m.id}>
              <h3>{m.nome}</h3>
              <p className="texto-2">
                {m.historico} {m.complemento}
              </p>
              <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
                {m.partidas.map((p, i) => (
                  <li key={i}>
                    <strong>{p.tipo}</strong> {mapa.get(p.contaId)?.codigo} {mapa.get(p.contaId)?.nome} — {p.valor ? formatarMoeda(p.valor) : 'valor a informar'}
                  </li>
                ))}
              </ul>
              <p className="texto-2">
                {m.recorrente ? `Recorrente · dia ${m.diaPadrao}` : 'Não recorrente'} · {t.diferenca === 0 && t.debitos > 0 ? 'balanceado' : 'valores a completar'}
              </p>
              <div className="acoes">
                <button className="pequeno primario" onClick={() => navegar(`/lancamentos/novo?modelo=${m.id}`)}>
                  Usar
                </button>
                {m.recorrente && (
                  <button className="pequeno" disabled={t.diferenca !== 0 || t.debitos === 0} onClick={() => setGerando(m)} title="Gera um lançamento por mês">
                    Gerar meses
                  </button>
                )}
                <button className="pequeno" onClick={() => acao(() => salvarModelo({ ...m, recorrente: !m.recorrente }))}>
                  {m.recorrente ? 'Tornar avulso' : 'Tornar recorrente'}
                </button>
                <button
                  className="pequeno perigo"
                  onClick={async () => {
                    if (await confirmar({ titulo: 'Excluir modelo', mensagem: `Excluir o modelo "${m.nome}"?`, perigo: true })) await acao(() => excluirModelo(m.id!), 'Modelo excluído.');
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {gerando && <GerarMeses modelo={gerando} aoFechar={() => setGerando(null)} />}
    </>
  );
}

function GerarMeses({ modelo, aoFechar }: { modelo: ModeloLancamento; aoFechar: () => void }) {
  const acao = useAcao();
  const atual = hojeISO().slice(0, 7);
  const [de, setDe] = useState(atual);
  const [ate, setAte] = useState(atual);
  const [dia, setDia] = useState(modelo.diaPadrao);
  const meses = de && ate && de <= ate ? competenciasEntre(de, ate) : [];
  return (
    <Modal
      titulo={`Gerar lançamentos — ${modelo.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button onClick={aoFechar}>Cancelar</button>
          <button
            className="primario"
            disabled={!meses.length || meses.length > 24}
            onClick={async () => {
              const r = await acao(() => gerarLancamentosDoModelo(modelo.id!, meses, dia), `${meses.length} lançamento(s) gerado(s).`);
              if (r) {
                aoFechar();
              }
            }}
          >
            Gerar {meses.length} lançamento(s)
          </button>
        </>
      }
    >
      <p>Um lançamento por mês, todos numa única operação (se algum mês estiver fechado, nada é gerado).</p>
      <div className="form-grade">
        <Campo rotulo="De (mês)" className="col-4">
          <input type="month" value={de} onChange={(e) => setDe(e.target.value)} />
        </Campo>
        <Campo rotulo="Até (mês)" className="col-4">
          <input type="month" value={ate} onChange={(e) => setAte(e.target.value)} />
        </Campo>
        <Campo rotulo="Dia" className="col-4" dica="ajustado ao último dia do mês">
          <input type="number" min={1} max={31} value={dia} onChange={(e) => setDia(Number(e.target.value))} />
        </Campo>
      </div>
      {meses.length > 0 && <p className="texto-2">Meses: {meses.map(formatarCompetencia).join(', ')}</p>}
    </Modal>
  );
}
