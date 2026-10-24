import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CabecalhoPagina, Campo, ExigeEmpresa, Modal } from '../../components/ui';
import { db } from '../../db/db';
import type { HistoricoPadrao } from '../../db/types';
import { useAcao, useApp } from '../../hooks/app';
import { excluirHistorico, salvarHistorico } from './lancamentoService';

export function HistoricosPage() {
  return (
    <ExigeEmpresa>
      <Conteudo />
    </ExigeEmpresa>
  );
}

function Conteudo() {
  const { empresa, confirmar } = useApp();
  const acao = useAcao();
  const historicos = useLiveQuery(() => db.historicos.where('empresaId').equals(empresa!.id!).sortBy('codigo'), [empresa?.id], []);
  const [editando, setEditando] = useState<HistoricoPadrao | null>(null);
  const [busca, setBusca] = useState('');
  const lista = historicos.filter((h) => `${h.codigo} ${h.texto}`.toLowerCase().includes(busca.toLowerCase()));
  const proximo = historicos.reduce((m, h) => Math.max(m, h.codigo), 0) + 1;

  return (
    <>
      <CabecalhoPagina titulo="Históricos padrão" descricao="Textos prontos para os lançamentos. No editor, digite o código do histórico para preenchê-lo e complete o texto.">
        <button className="primario" onClick={() => setEditando({ empresaId: empresa!.id!, codigo: proximo, texto: '', ativo: true })}>
          Novo histórico
        </button>
      </CabecalhoPagina>
      <div className="filtros">
        <input type="search" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <div className="tabela-container">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Texto</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.map((h) => (
              <tr key={h.id} className={h.ativo ? '' : 'inativa'}>
                <td className="mono">{h.codigo}</td>
                <td>{h.texto}</td>
                <td>{h.ativo ? <span className="etiqueta sucesso">ativo</span> : <span className="etiqueta">inativo</span>}</td>
                <td>
                  <div className="acoes">
                    <button className="pequeno" onClick={() => setEditando({ ...h })}>
                      Editar
                    </button>
                    <button className="pequeno" onClick={() => acao(() => salvarHistorico({ ...h, ativo: !h.ativo }))}>
                      {h.ativo ? 'Inativar' : 'Ativar'}
                    </button>
                    <button
                      className="pequeno perigo"
                      onClick={async () => {
                        if (await confirmar({ titulo: 'Excluir histórico', mensagem: `Excluir o histórico ${h.codigo}?`, perigo: true }))
                          await acao(() => excluirHistorico(h.id!), 'Excluído.');
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
      {editando && (
        <Modal
          titulo={editando.id ? 'Editar histórico' : 'Novo histórico'}
          aoFechar={() => setEditando(null)}
          rodape={
            <>
              <button onClick={() => setEditando(null)}>Cancelar</button>
              <button className="primario" onClick={async () => (await acao(() => salvarHistorico(editando), 'Salvo.')) && setEditando(null)}>
                Salvar
              </button>
            </>
          }
        >
          <div className="form-grade">
            <Campo rotulo="Código" className="col-3">
              <input type="number" value={editando.codigo} onChange={(e) => setEditando({ ...editando, codigo: Number(e.target.value) })} />
            </Campo>
            <Campo rotulo="Texto" className="col-9">
              <input value={editando.texto} onChange={(e) => setEditando({ ...editando, texto: e.target.value })} autoFocus />
            </Campo>
          </div>
        </Modal>
      )}
    </>
  );
}
