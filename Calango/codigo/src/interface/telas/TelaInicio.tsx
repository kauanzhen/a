import { useApp } from '../contexto';
import { nomeDaEmpresa } from '../../servicos/atos';
import { documento } from '../../tipos/registro';
import { formatarData } from '../../lib/datas';

const STATUS: Record<string, string> = { rascunho: 'Rascunho', gerado: 'Gerado (aguardando registro)', registrado: 'Registrado' };

export function TelaInicio() {
  const { sessao, ir } = useApp();
  const pendentes = sessao.empresas
    .flatMap((l) => l.dados.atos.filter((a) => a.status !== 'registrado').map((a) => ({ l, a })))
    .sort((x, y) => y.a.atualizado_em.localeCompare(x.a.atualizado_em));
  const ativas = sessao.clausulas.filter((c) => !c.dados.arquivada).length;

  return (
    <>
      <h1>Bem-vindo ao Calango</h1>
      <p className="suave">
        Os dados da empresa são a fonte da verdade; os documentos são gerados a partir deles.
      </p>
      <div className="linha" style={{ marginBottom: '1.5rem' }}>
        <button className="primario grande" onClick={() => ir({ nome: 'novo-documento' })}>
          📝 Novo documento
        </button>
        <button className="grande" onClick={() => ir({ nome: 'empresas' })}>
          🏢 Empresas ({sessao.empresas.length})
        </button>
        <button className="grande" onClick={() => ir({ nome: 'biblioteca' })}>
          📚 Biblioteca ({ativas} cláusulas)
        </button>
      </div>

      <div className="painel">
        <h2>Documentos em andamento</h2>
        {pendentes.length === 0 ? (
          <p className="suave">Nenhum documento em andamento. Clique em “Novo documento” para começar.</p>
        ) : (
          <table className="lista">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Documento</th>
                <th>Situação</th>
                <th>Atualizado em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pendentes.map(({ l, a }) => (
                <tr key={a.id}>
                  <td>{nomeDaEmpresa(l.dados)}</td>
                  <td>{documento(a.tipo_documento).nome}</td>
                  <td>
                    <span className={`etiqueta ${a.status === 'gerado' ? 'azul' : 'amarela'}`}>{STATUS[a.status]}</span>
                  </td>
                  <td>{formatarData(a.atualizado_em.slice(0, 10))}</td>
                  <td>
                    <button className="pequeno" onClick={() => ir({ nome: 'assistente', caminho: l.caminho, atoId: a.id })}>
                      Continuar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="painel">
        <h2>Como funciona</h2>
        <ol>
          <li>
            <strong>Escolha o documento</strong> (nesta fase: contrato social de abertura).
          </li>
          <li>
            <strong>Etapa 1 — Cláusulas:</strong> o Calango já traz o conjunto padrão; ligue, desligue e reordene.
          </li>
          <li>
            <strong>Etapa 2 — Dados:</strong> o formulário mostra só o que as cláusulas escolhidas precisam.
          </li>
          <li>
            <strong>Etapa 3 — Revisão:</strong> confira o texto, resolva as pendências e gere o .docx.
          </li>
          <li>
            Depois do registro na Junta, marque o ato como <strong>registrado</strong>: só então o cadastro da empresa é
            atualizado.
          </li>
        </ol>
      </div>
    </>
  );
}
