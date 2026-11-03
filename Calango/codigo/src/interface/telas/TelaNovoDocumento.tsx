import { useState } from 'react';
import { mensagemDeErro, useApp } from '../contexto';
import { DOCUMENTOS, tipoSocietario } from '../../tipos/registro';
import { iniciarAbertura, nomeDaEmpresa } from '../../servicos/atos';
import { Alerta } from '../componentes/Campos';

export function TelaNovoDocumento() {
  const app = useApp();
  const { sessao, ir } = app;
  const [ocupado, setOcupado] = useState(false);
  const rascunhos = sessao.empresas.flatMap((l) =>
    l.dados.atos.filter((a) => a.tipo_documento === 'abertura' && a.status !== 'registrado').map((a) => ({ l, a })),
  );

  async function comecarAbertura() {
    setOcupado(true);
    try {
      const def = DOCUMENTOS.find((d) => d.id === 'abertura')!;
      const { empresa, ato } = iniciarAbertura(def, tipoSocietario('ltda'), app.buscarClausula, sessao.config.dados);
      const caminho = sessao.repo.novoCaminhoEmpresa(empresa, '');
      const m = await sessao.repo.salvarEmpresa(empresa, caminho, null);
      app.atualizarEmpresaLocal({ dados: empresa, caminho, modificadoEm: m });
      ir({ nome: 'assistente', caminho, atoId: ato.id });
    } catch (e) {
      app.avisar('erro', mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <h1>Novo documento</h1>
      <p>Escolha o tipo de documento:</p>
      <div className="grade" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {DOCUMENTOS.map((d) => (
          <div key={d.id} className="painel" style={{ opacity: d.disponivel ? 1 : 0.6 }}>
            <h3>{d.nome}</h3>
            <p className="suave">{d.descricao}</p>
            {d.disponivel ? (
              <button className="primario" disabled={ocupado} onClick={comecarAbertura}>
                Começar
              </button>
            ) : (
              <span className="etiqueta">Em breve — {d.fase}</span>
            )}
          </div>
        ))}
      </div>

      {rascunhos.length > 0 && (
        <div className="painel">
          <h2>Ou continue uma abertura já iniciada</h2>
          <table className="lista">
            <tbody>
              {rascunhos.map(({ l, a }) => (
                <tr key={a.id}>
                  <td>{nomeDaEmpresa(l.dados)}</td>
                  <td className="suave">{a.status === 'gerado' ? 'Gerado, aguardando registro' : 'Rascunho'}</td>
                  <td>
                    <button className="pequeno" onClick={() => ir({ nome: 'assistente', caminho: l.caminho, atoId: a.id })}>
                      Continuar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Alerta tipo="info">
        Alteração contratual e distrato chegam nas próximas fases. Empresas já registradas podem ser cadastradas em
        “Empresas”, para que os dados fiquem prontos para as alterações.
      </Alerta>
    </>
  );
}
