import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CabecalhoPagina, Campo, ExigeEmpresa, Modal } from '../../components/ui';
import { db } from '../../db/db';
import type { CentroCusto } from '../../db/types';
import { useAcao, useApp } from '../../hooks/app';
import { excluirCentroCusto, salvarCentroCusto } from '../lancamentos/lancamentoService';

export function CentrosCustoPage() {
  return (
    <ExigeEmpresa>
      <Conteudo />
    </ExigeEmpresa>
  );
}

function Conteudo() {
  const { empresa, confirmar } = useApp();
  const acao = useAcao();
  const centros = useLiveQuery(() => db.centrosCusto.where('empresaId').equals(empresa!.id!).sortBy('codigo'), [empresa?.id], []);
  const [editando, setEditando] = useState<CentroCusto | null>(null);
  const [busca, setBusca] = useState('');
  const lista = centros.filter((c) => `${c.codigo} ${c.nome}`.toLowerCase().includes(busca.toLowerCase()));

  return (
    <>
      <CabecalhoPagina titulo="Centros de custo" descricao="Usados nas partidas das contas que exigem centro de custo (ex.: despesas com pessoal).">
        <button className="primario" onClick={() => setEditando({ empresaId: empresa!.id!, codigo: String(centros.length + 1).padStart(3, '0'), nome: '', ativo: true })}>
          Novo centro de custo
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
              <th>Nome</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id} className={c.ativo ? '' : 'inativa'}>
                <td className="mono">{c.codigo}</td>
                <td>{c.nome}</td>
                <td>{c.ativo ? <span className="etiqueta sucesso">ativo</span> : <span className="etiqueta">inativo</span>}</td>
                <td>
                  <div className="acoes">
                    <button className="pequeno" onClick={() => setEditando({ ...c })}>
                      Editar
                    </button>
                    <button className="pequeno" onClick={() => acao(() => salvarCentroCusto({ ...c, ativo: !c.ativo }))}>
                      {c.ativo ? 'Inativar' : 'Ativar'}
                    </button>
                    <button
                      className="pequeno perigo"
                      onClick={async () => {
                        if (await confirmar({ titulo: 'Excluir centro de custo', mensagem: `Excluir ${c.codigo} — ${c.nome}?`, perigo: true }))
                          await acao(() => excluirCentroCusto(c.id!), 'Excluído.');
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!lista.length && (
              <tr>
                <td colSpan={4} className="vazio">
                  Nenhum centro de custo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editando && (
        <Modal
          titulo={editando.id ? 'Editar centro de custo' : 'Novo centro de custo'}
          aoFechar={() => setEditando(null)}
          rodape={
            <>
              <button onClick={() => setEditando(null)}>Cancelar</button>
              <button className="primario" onClick={async () => (await acao(() => salvarCentroCusto(editando), 'Salvo.')) && setEditando(null)}>
                Salvar
              </button>
            </>
          }
        >
          <div className="form-grade">
            <Campo rotulo="Código" className="col-4">
              <input className="mono" value={editando.codigo} onChange={(e) => setEditando({ ...editando, codigo: e.target.value })} />
            </Campo>
            <Campo rotulo="Nome" className="col-8">
              <input value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} autoFocus />
            </Campo>
          </div>
        </Modal>
      )}
    </>
  );
}
