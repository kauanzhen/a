import { useState } from 'react';
import { mensagemDeErro, useApp } from '../contexto';
import { nomeDaEmpresa, situacaoCadastro } from '../../servicos/atos';
import { novaEmpresa, dadosVazios } from '../../dados/fabricas';
import { formatarCNPJ } from '../../dados/documentos';
import { normalizar } from '../../lib/texto';
import { situacao } from '../../dados/quotas';

export function TelaEmpresas() {
  const app = useApp();
  const { sessao, ir } = app;
  const [busca, setBusca] = useState('');
  const q = normalizar(busca);
  const lista = sessao.empresas
    .filter((l) => !q || normalizar(`${nomeDaEmpresa(l.dados)} ${l.dados.vigente?.cnpj ?? ''}`).includes(q))
    .sort((a, b) => nomeDaEmpresa(a.dados).localeCompare(nomeDaEmpresa(b.dados)));

  async function cadastrarExistente() {
    try {
      const e = novaEmpresa('ltda');
      e.vigente = dadosVazios();
      e.vigente.junta_uf = sessao.config.dados.padroes.uf;
      const caminho = sessao.repo.novoCaminhoEmpresa(e, '');
      const m = await sessao.repo.salvarEmpresa(e, caminho, null);
      app.atualizarEmpresaLocal({ dados: e, caminho, modificadoEm: m });
      ir({ nome: 'empresa', caminho });
    } catch (err) {
      app.avisar('erro', mensagemDeErro(err));
    }
  }

  return (
    <>
      <div className="entre">
        <h1>Empresas</h1>
        <div className="linha">
          <button onClick={cadastrarExistente}>+ Cadastrar empresa já registrada</button>
          <button className="primario" onClick={() => ir({ nome: 'novo-documento' })}>
            + Nova abertura
          </button>
        </div>
      </div>
      <p className="suave">Cada empresa é um arquivo separado na pasta de dados (empresas/).</p>
      <input type="search" placeholder="Buscar por razão social ou CNPJ" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 480, marginBottom: '1rem' }} />
      <div className="painel" style={{ padding: 0 }}>
        {lista.length === 0 ? (
          <div className="vazio">Nenhuma empresa {busca ? 'encontrada' : 'cadastrada ainda'}.</div>
        ) : (
          <table className="lista">
            <thead>
              <tr>
                <th>Razão social</th>
                <th>CNPJ</th>
                <th>Situação</th>
                <th>Sócios</th>
                <th>Atos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => {
                const d = l.dados.vigente ?? l.dados.atos[l.dados.atos.length - 1]?.dados_depois;
                const s = d ? situacao(d) : 'sem_socios';
                return (
                  <tr key={l.caminho}>
                    <td>
                      <strong>{nomeDaEmpresa(l.dados)}</strong>
                    </td>
                    <td>{l.dados.vigente?.cnpj ? formatarCNPJ(l.dados.vigente.cnpj) : <span className="suave">—</span>}</td>
                    <td>
                      <span className={`etiqueta ${l.dados.vigente ? 'verde' : 'amarela'}`}>{situacaoCadastro(l.dados)}</span>
                    </td>
                    <td>{s === 'unipessoal' ? 'Unipessoal' : s === 'pluripessoal' ? 'Pluripessoal' : '—'}</td>
                    <td>{l.dados.atos.length}</td>
                    <td>
                      <button className="pequeno" onClick={() => ir({ nome: 'empresa', caminho: l.caminho })}>
                        Abrir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
