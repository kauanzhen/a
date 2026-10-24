import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import { NOMES_ORIGEM } from '../../db/types';
import { useAcao, useApp } from '../../hooks/app';
import { formatarData } from '../../lib/date';
import { formatarMoeda } from '../../lib/money';
import { calcularTotais } from '../lancamentos/partidas';
import { criarEmpresaExemplo } from './empresaExemplo';

export function InicioPage() {
  const { empresa, empresaId, empresas, selecionarEmpresa } = useApp();
  const acao = useAcao();
  const navegar = useNavigate();

  const dados = useLiveQuery(async () => {
    if (!empresaId) return undefined;
    const [lancamentos, contas, periodos, tabelasVerificar] = await Promise.all([
      db.lancamentos.where('empresaId').equals(empresaId).toArray(),
      db.contas.where('empresaId').equals(empresaId).count(),
      db.periodos.where('empresaId').equals(empresaId).toArray(),
      db.tabelasFiscais.filter((t) => t.verificarVigencia).count(),
    ]);
    const totais = calcularTotais(lancamentos.flatMap((l) => l.partidas));
    return {
      qtd: lancamentos.length,
      contas,
      totais,
      abertos: periodos.filter((p) => p.status === 'ABERTO').length,
      fechados: periodos.filter((p) => p.status === 'FECHADO').length,
      ultimos: lancamentos.sort((a, b) => b.numero - a.numero).slice(0, 8),
      porIA: lancamentos.filter((l) => l.origem === 'IA').length,
      tabelasVerificar,
    };
  }, [empresaId]);

  async function carregarExemplo() {
    const id = await acao(criarEmpresaExemplo, 'Empresa de exemplo criada com lançamentos de janeiro/2026.');
    if (id) selecionarEmpresa(id);
  }

  if (!empresas.length) {
    return (
      <div className="cartao" style={{ maxWidth: 760 }}>
        <h1>Bem-vindo ao Contábil Escola</h1>
        <p>
          Software de contabilidade <strong>educacional</strong> que roda 100% no seu navegador (os dados ficam no IndexedDB deste computador). Segue a
          Lei 6.404/76, os CPCs e a ITG 1000, mas <strong>todos os dados são fictícios</strong> e nada aqui tem valor fiscal.
        </p>
        <div className="acoes" style={{ marginTop: 16 }}>
          <button className="primario" onClick={carregarExemplo}>
            Carregar empresa de exemplo (Comércio Exemplo Ltda)
          </button>
          <Link className="botao" to="/empresas?nova=1">
            Cadastrar minha empresa fictícia
          </Link>
          <Link className="botao" to="/configuracoes">
            Restaurar um backup
          </Link>
        </div>
        <p className="texto-2" style={{ marginTop: 16 }}>
          Dica: depois de cadastrar a empresa, experimente o <strong>Assistente IA</strong> — cole uma mensagem ou e-mail (fictício) e veja o Claude sugerir os
          lançamentos para você aprovar.
        </p>
      </div>
    );
  }

  const fecha = dados && dados.totais.diferenca === 0;

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>{empresa?.razaoSocial ?? 'Início'}</h1>
          <p>Visão geral da escrituração · Fase 1 (cadastros, lançamentos, importação e assistente IA)</p>
        </div>
        <div className="acoes">
          <button className="primario" onClick={() => navegar('/lancamentos/novo')}>
            Novo lançamento <kbd>Alt+L</kbd>
          </button>
          <Link className="botao" to="/assistente">
            Assistente IA <kbd>Alt+I</kbd>
          </Link>
          <Link className="botao" to="/importacao">
            Importar Excel
          </Link>
        </div>
      </div>

      {dados && dados.tabelasVerificar > 0 && (
        <div className="aviso alerta">
          {dados.tabelasVerificar} tabela(s) fiscal(is) marcada(s) para <strong>verificar vigência</strong>. Confira os valores em{' '}
          <Link to="/tabelas-fiscais">Tabelas fiscais</Link> antes de usá-los nas próximas fases (folha e tributos).
        </div>
      )}

      {dados && (
        <div className="grade">
          <div className="cartao compacto">
            <div className="indicador-rotulo">Lançamentos</div>
            <div className="indicador">{dados.qtd}</div>
            <div className="texto-2">{dados.porIA} sugerido(s) pela IA</div>
          </div>
          <div className="cartao compacto">
            <div className="indicador-rotulo">Total de débitos = créditos?</div>
            <div className={`indicador ${fecha ? 'texto-sucesso' : 'texto-perigo'}`}>{fecha ? 'Fecha ✓' : 'NÃO fecha'}</div>
            <div className="texto-2">
              D {formatarMoeda(dados.totais.debitos)} · C {formatarMoeda(dados.totais.creditos)}
            </div>
          </div>
          <div className="cartao compacto">
            <div className="indicador-rotulo">Plano de contas</div>
            <div className="indicador">{dados.contas}</div>
            <div className="texto-2">contas cadastradas</div>
          </div>
          <div className="cartao compacto">
            <div className="indicador-rotulo">Períodos</div>
            <div className="indicador">{dados.abertos} abertos</div>
            <div className="texto-2">{dados.fechados} fechado(s)</div>
          </div>
        </div>
      )}

      <div className="cartao">
        <div className="cabecalho-pagina" style={{ marginBottom: 8 }}>
          <h2>Últimos lançamentos</h2>
          <Link to="/lancamentos">Ver todos</Link>
        </div>
        {!dados?.ultimos.length ? (
          <div className="vazio">
            Nenhum lançamento ainda. <Link to="/lancamentos/novo">Faça o primeiro</Link>.
          </div>
        ) : (
          <div className="tabela-container">
            <table>
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Data</th>
                  <th>Histórico</th>
                  <th>Origem</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {dados.ultimos.map((l) => (
                  <tr key={l.id} onClick={() => navegar(`/lancamentos/${l.id}`)} style={{ cursor: 'pointer' }}>
                    <td>{l.numero}</td>
                    <td>{formatarData(l.data)}</td>
                    <td>{l.historico}</td>
                    <td>
                      <span className={`etiqueta ${l.origem === 'IA' ? 'info' : ''}`}>{NOMES_ORIGEM[l.origem]}</span>
                    </td>
                    <td className="num">{formatarMoeda(l.valorTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="cartao">
        <h2>Roteiro de testes da Fase 1</h2>
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>Cadastre uma empresa (gere um CNPJ fictício) e confira o plano de contas padrão.</li>
          <li>Faça lançamentos simples e compostos; tente salvar um desbalanceado.</li>
          <li>Feche um período e veja o bloqueio; estorne e copie lançamentos.</li>
          <li>Baixe a planilha-modelo, preencha (inclua um erro) e importe; depois desfaça a importação.</li>
          <li>No Assistente IA, cole uma mensagem fictícia e aprove as sugestões.</li>
          <li>Faça backup, apague tudo e restaure.</li>
        </ol>
      </div>
    </>
  );
}
