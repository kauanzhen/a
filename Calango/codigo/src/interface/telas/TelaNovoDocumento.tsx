import { useState } from 'react';
import { mensagemDeErro, useApp } from '../contexto';
import { DOCUMENTOS, documento, tipoSocietario } from '../../tipos/registro';
import { documentosPossiveis, iniciarAbertura, iniciarAtoExistente, nomeDaEmpresa } from '../../servicos/atos';
import type { DefinicaoDocumento } from '../../tipos/definicoes';
import type { Lido } from '../../armazenamento/repositorio';
import type { Empresa } from '../../dados/tipos';
import { Alerta } from '../componentes/Campos';

/** Começa um documento sobre empresa já registrada e abre o assistente. */
export function useComecarDocumento() {
  const app = useApp();
  return async (lida: Lido<Empresa>, def: DefinicaoDocumento) => {
    try {
      const { empresa, ato } = iniciarAtoExistente(lida.dados, def, app.buscarClausula, app.sessao.config.dados);
      const m = await app.sessao.repo.salvarEmpresa(empresa, lida.caminho, lida.modificadoEm);
      app.atualizarEmpresaLocal({ dados: empresa, caminho: lida.caminho, modificadoEm: m });
      app.ir({ nome: 'assistente', caminho: lida.caminho, atoId: ato.id });
    } catch (e) {
      app.avisar('erro', mensagemDeErro(e));
    }
  };
}

function CartaoExistente({ def }: { def: DefinicaoDocumento }) {
  const { sessao } = useApp();
  const comecar = useComecarDocumento();
  const elegiveis = sessao.empresas
    .filter((l) => def.tipos_societarios.includes(l.dados.tipo_societario))
    .filter((l) => documentosPossiveis(l.dados).some((d) => d.def.id === def.id && !d.motivo))
    .sort((a, b) => nomeDaEmpresa(a.dados).localeCompare(nomeDaEmpresa(b.dados)));
  const [escolhida, setEscolhida] = useState('');
  const lida = elegiveis.find((l) => l.caminho === escolhida) ?? elegiveis[0];
  return (
    <div className="painel">
      <h3>{def.nome}</h3>
      <p className="suave">{def.descricao}</p>
      {elegiveis.length === 0 ? (
        <p className="pequeno suave">
          Nenhuma empresa pode receber este documento agora. A empresa precisa ser {def.tipos_societarios.map((t) => tipoSocietario(t).nome).join(' ou ')}, estar
          registrada{def.exige_unipessoal ? ', ter um único sócio' : ''} e não ter outro documento em andamento.
        </p>
      ) : (
        <div className="linha">
          <select value={lida?.caminho ?? ''} onChange={(e) => setEscolhida(e.target.value)} aria-label={`Empresa para ${def.nome}`} style={{ maxWidth: 320 }}>
            {elegiveis.map((l) => (
              <option key={l.caminho} value={l.caminho}>
                {nomeDaEmpresa(l.dados)}
              </option>
            ))}
          </select>
          <button className="primario" onClick={() => lida && comecar(lida, def)}>
            Começar
          </button>
        </div>
      )}
    </div>
  );
}

export function TelaNovoDocumento() {
  const app = useApp();
  const { sessao, ir } = app;
  const [ocupado, setOcupado] = useState(false);
  const andamento = sessao.empresas.flatMap((l) => l.dados.atos.filter((a) => a.status !== 'registrado').map((a) => ({ l, a })));

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
      <div className="grade" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {DOCUMENTOS.map((d) =>
          d.empresa === 'nova' ? (
            <div key={d.id} className="painel">
              <h3>{d.nome}</h3>
              <p className="suave">{d.descricao}</p>
              <button className="primario" disabled={ocupado} onClick={comecarAbertura}>
                Começar
              </button>
            </div>
          ) : (
            <CartaoExistente key={d.id} def={d} />
          ),
        )}
      </div>

      {andamento.length > 0 && (
        <div className="painel">
          <h2>Ou continue um documento já iniciado</h2>
          <table className="lista">
            <tbody>
              {andamento.map(({ l, a }) => (
                <tr key={a.id}>
                  <td>{nomeDaEmpresa(l.dados)}</td>
                  <td>{documento(a.tipo_documento).nome}</td>
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
        Alteração, distrato e transformação partem do <strong>cadastro vigente</strong>: a empresa precisa ter a abertura marcada como registrada ou ter sido cadastrada em
        “Empresas”.
      </Alerta>
    </>
  );
}
