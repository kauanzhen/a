// Ficha da empresa: cadastro vigente (com edição direta, para empresas já
// registradas ou correções) e histórico de atos.

import { useMemo, useState } from 'react';
import { mensagemDeErro, useApp } from '../contexto';
import { documentosPossiveis, nomeDaEmpresa, situacaoCadastro } from '../../servicos/atos';
import { useComecarDocumento } from './TelaNovoDocumento';
import { documento, tipoSocietario } from '../../tipos/registro';
import { validarDados } from '../../dados/validacao';
import { situacao } from '../../dados/quotas';
import type { DadosEmpresa, Empresa } from '../../dados/tipos';
import { formatarData } from '../../lib/datas';
import { Alerta } from '../componentes/Campos';
import { FormularioDados } from '../componentes/FormularioDados';

const STATUS: Record<string, [string, string]> = {
  rascunho: ['Rascunho', 'amarela'],
  gerado: ['Gerado — aguardando registro', 'azul'],
  registrado: ['Registrado', 'verde'],
};

export function TelaEmpresa({ caminho }: { caminho: string }) {
  const app = useApp();
  const lida = app.sessao.empresas.find((l) => l.caminho === caminho);
  const [empresa, setEmpresa] = useState<Empresa | undefined>(lida?.dados);
  const [modificadoEm, setModificadoEm] = useState(lida?.modificadoEm ?? null);
  const [dados, setDados] = useState<DadosEmpresa | null>(lida?.dados.vigente ? structuredClone(lida.dados.vigente) : null);
  const [editando, setEditando] = useState(false);
  const [sujo, setSujo] = useState(false);

  const tipo = empresa ? tipoSocietario(empresa.tipo_societario) : null;
  const campos = useMemo(() => new Set(tipo?.campos_cadastro ?? []), [tipo]);
  const comecar = useComecarDocumento();
  const pendencias = useMemo(() => (dados && tipo ? validarDados(dados, campos, { tipo }) : []), [dados, campos, tipo]);

  if (!empresa || !tipo) {
    return <Alerta tipo="erro">Empresa não encontrada. Ela pode ter sido apagada ou movida.</Alerta>;
  }

  async function salvar() {
    try {
      const nova: Empresa = { ...empresa!, vigente: dados };
      let destino = caminho;
      if (/^empresas\/nova-empresa-/.test(caminho) && dados?.razao_social.trim()) {
        destino = app.sessao.repo.novoCaminhoEmpresa(nova, dados.razao_social);
      }
      const atual = await app.sessao.repo.fs.modificadoEm(caminho);
      if (atual !== modificadoEm) throw new Error('A empresa foi alterada por outra pessoa depois que você abriu esta tela. Nada foi gravado. Volte à lista de empresas e abra-a de novo.');
      const m = await app.sessao.repo.salvarEmpresa(nova, destino, destino === caminho ? modificadoEm : null);
      if (destino !== caminho) {
        await app.sessao.repo.fs.excluir(caminho);
        app.removerEmpresaLocal(caminho);
      }
      setEmpresa(nova);
      setModificadoEm(m);
      app.atualizarEmpresaLocal({ dados: nova, caminho: destino, modificadoEm: m });
      setSujo(false);
      app.marcarAlterado(false);
      setEditando(false);
      app.avisar('ok', 'Cadastro da empresa salvo (a versão anterior foi guardada em backups/).');
      if (destino !== caminho) app.ir({ nome: 'empresa', caminho: destino });
    } catch (e) {
      app.avisar('erro', mensagemDeErro(e));
    }
  }

  async function apagarAto(atoId: string) {
    const ato = empresa!.atos.find((a) => a.id === atoId);
    if (!ato || ato.status === 'registrado') return;
    if (!window.confirm(`Apagar o documento “${documento(ato.tipo_documento).nome}” (${ato.status})?\n\nUma cópia do arquivo da empresa fica em backups/.`)) return;
    try {
      const nova: Empresa = { ...empresa!, atos: empresa!.atos.filter((a) => a.id !== atoId) };
      const m = await app.sessao.repo.salvarEmpresa(nova, caminho, modificadoEm);
      setEmpresa(nova);
      setModificadoEm(m);
      app.atualizarEmpresaLocal({ dados: nova, caminho, modificadoEm: m });
      app.avisar('ok', 'Documento apagado.');
    } catch (e) {
      app.avisar('erro', mensagemDeErro(e));
    }
  }

  async function excluir() {
    if (!window.confirm(`Apagar a empresa "${nomeDaEmpresa(empresa!)}" e todos os seus atos?\n\nUma cópia fica guardada em backups/ por 30 dias.`)) return;
    try {
      await app.sessao.repo.excluirEmpresa(caminho);
      app.removerEmpresaLocal(caminho);
      app.marcarAlterado(false);
      app.avisar('ok', 'Empresa apagada (cópia guardada em backups/).');
      app.ir({ nome: 'empresas' });
    } catch (e) {
      app.avisar('erro', mensagemDeErro(e));
    }
  }

  const sit = dados ? situacao(dados) : 'sem_socios';

  return (
    <>
      <div className="entre">
        <div>
          <h1 style={{ marginBottom: 4 }}>{nomeDaEmpresa(empresa)}</h1>
          <span className={`etiqueta ${empresa.vigente ? 'verde' : 'amarela'}`}>{situacaoCadastro(empresa)}</span>
          {sit !== 'sem_socios' && <span className="etiqueta">{sit === 'unipessoal' ? 'Unipessoal' : 'Pluripessoal'}</span>}
          <span className="etiqueta">{tipo.nome}</span>
        </div>
        <button className="perigo" onClick={excluir}>
          Apagar empresa
        </button>
      </div>

      {empresa.extinta_em && <Alerta tipo="aviso">Empresa extinta: distrato registrado em {formatarData(empresa.extinta_em)}.</Alerta>}

      {!empresa.extinta_em && (
        <div className="painel">
          <h2>Novo documento para esta empresa</h2>
          <div className="grade" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {documentosPossiveis(empresa).map(({ def, motivo }) => (
              <div key={def.id}>
                <button
                  className="primario"
                  style={{ width: '100%' }}
                  disabled={!!motivo || sujo}
                  title={motivo}
                  onClick={() => lida && comecar({ dados: empresa, caminho, modificadoEm: modificadoEm ?? 0 }, def)}
                >
                  {def.nome}
                </button>
                {motivo && <div className="suave pequeno">{motivo}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="painel">
        <h2>Atos (documentos)</h2>
        {empresa.atos.length === 0 ? (
          <p className="suave">Nenhum documento gerado para esta empresa ainda.</p>
        ) : (
          <table className="lista">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Situação</th>
                <th>Gerado em</th>
                <th>Registro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...empresa.atos].reverse().map((a) => (
                <tr key={a.id}>
                  <td>{documento(a.tipo_documento).nome}</td>
                  <td>
                    <span className={`etiqueta ${STATUS[a.status][1]}`}>{STATUS[a.status][0]}</span>
                  </td>
                  <td>{a.gerado_em ? formatarData(a.gerado_em.slice(0, 10)) : '—'}</td>
                  <td>{a.registro ? `${formatarData(a.registro.data)}${a.registro.numero ? ` — nº ${a.registro.numero}` : ''}` : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="pequeno" onClick={() => app.ir({ nome: 'assistente', caminho, atoId: a.id })}>
                      {a.status === 'registrado' ? 'Ver' : 'Abrir'}
                    </button>{' '}
                    {a.status !== 'registrado' && (
                      <button className="pequeno perigo" onClick={() => apagarAto(a.id)}>
                        Apagar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!empresa.vigente ? (
        <Alerta tipo="info">
          Esta empresa ainda está em abertura: os dados ficam no rascunho do contrato social e só viram o cadastro vigente quando o ato for marcado como
          registrado.
        </Alerta>
      ) : (
        <div className="painel">
          <div className="entre">
            <h2>Cadastro vigente</h2>
            {!editando ? (
              <button onClick={() => setEditando(true)}>✏️ Editar cadastro</button>
            ) : (
              <div className="linha">
                <button
                  onClick={() => {
                    if (sujo && !window.confirm('Descartar as alterações não salvas?')) return;
                    setDados(structuredClone(empresa.vigente!));
                    setEditando(false);
                    setSujo(false);
                    app.marcarAlterado(false);
                  }}
                >
                  Cancelar
                </button>
                <button className="primario" disabled={!sujo} onClick={salvar}>
                  💾 Salvar cadastro
                </button>
              </div>
            )}
          </div>
          {editando ? (
            <>
              <Alerta tipo="aviso">
                Editar aqui muda o cadastro vigente diretamente. Use para cadastrar uma empresa já registrada ou corrigir dados. Mudanças societárias
                (endereço, capital, sócios) devem ser feitas por alteração contratual (Fase 2).
              </Alerta>
              <FormularioDados
                dados={dados!}
                onChange={(d) => {
                  setDados(d);
                  setSujo(true);
                  app.marcarAlterado(true);
                }}
                campos={campos}
                pendencias={pendencias}
                tipo={tipo}
              />
            </>
          ) : (
            <ResumoCadastro dados={empresa.vigente} />
          )}
        </div>
      )}
    </>
  );
}

function ResumoCadastro({ dados: d }: { dados: DadosEmpresa }) {
  const linhas: [string, string][] = [
    ['Razão social', d.razao_social],
    ['CNPJ', d.cnpj],
    ['NIRE', d.nire],
    ['Registro na Junta', formatarData(d.data_registro)],
    ['Última alteração registrada', d.numero_ultima_alteracao ? `${d.numero_ultima_alteracao}ª` : 'nenhuma'],
    ['Sede', [d.sede.logradouro, d.sede.numero, d.sede.bairro, d.sede.cidade && `${d.sede.cidade}/${d.sede.uf}`].filter(Boolean).join(', ')],
    ['Sócios', d.participacoes.map((p) => d.pessoas.find((x) => x.id === p.pessoa_id)?.nome ?? '?').join(', ')],
    ['Enquadramento', d.enquadramento || '—'],
  ];
  return (
    <table className="lista">
      <tbody>
        {linhas.map(([k, v]) => (
          <tr key={k}>
            <th style={{ width: 240 }}>{k}</th>
            <td>{v || <span className="suave">—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
