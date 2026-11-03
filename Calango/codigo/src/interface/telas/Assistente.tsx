// Assistente do documento em 3 etapas: Cláusulas, Dados e Revisão.

import { useEffect, useMemo, useState } from 'react';
import { mensagemDeErro, useApp } from '../contexto';
import { documento, tipoSocietario } from '../../tipos/registro';
import type { Ato, Empresa } from '../../dados/tipos';
import { camposDoAto, comAto, marcarGerado, marcarRegistrado, nomeDaEmpresa, revisarAto, temErros, voltarParaRascunho } from '../../servicos/atos';
import { validarDados } from '../../dados/validacao';
import { gerarDocxBlob, nomeArquivoDocx } from '../../docx/gerarDocx';
import { carregarImagemCabecalho, urlDaImagem } from '../imagens';
import type { ImagemCabecalho } from '../../docx/gerarDocx';
import { hojeISO, formatarData } from '../../lib/datas';
import { Alerta, CampoData, CampoMarcar, CampoTexto, ListaPendencias, Modal, baixarArquivo } from '../componentes/Campos';
import { FormularioDados } from '../componentes/FormularioDados';
import { VisualizacaoDocumento } from '../componentes/VisualizacaoDocumento';
import { EtapaClausulas } from './EtapaClausulas';
import { ErroConflito } from '../../armazenamento/repositorio';

const ETAPAS = ['1. Cláusulas', '2. Dados', '3. Revisão'];

export function Assistente(p: { caminho: string; atoId: string }) {
  const app = useApp();
  const { sessao } = app;
  const lida = sessao.empresas.find((l) => l.caminho === p.caminho);
  const [caminho, setCaminho] = useState(p.caminho);
  const [empresa, setEmpresa] = useState<Empresa | undefined>(lida?.dados);
  const [modificadoEm, setModificadoEm] = useState<number | null>(lida?.modificadoEm ?? null);
  const [ato, setAto] = useState<Ato | undefined>(lida?.dados.atos.find((a) => a.id === p.atoId));
  const [etapa, setEtapa] = useState(ato && ato.status !== 'rascunho' ? 2 : 0);
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [registrar, setRegistrar] = useState(false);
  const [imagem, setImagem] = useState<ImagemCabecalho | null>(null);
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);

  const cfg = sessao.config.dados;
  useEffect(() => {
    let url: string | null = null;
    carregarImagemCabecalho(sessao.repo, cfg.cabecalho.imagem)
      .then((img) => {
        setImagem(img);
        if (img) {
          url = urlDaImagem(img);
          setImagemUrl(url);
        }
      })
      .catch(() => setImagem(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [sessao.repo, cfg.cabecalho.imagem]);

  const def = ato ? documento(ato.tipo_documento) : null;
  const tipo = empresa ? tipoSocietario(empresa.tipo_societario) : null;
  const somenteLeitura = ato?.status === 'registrado';

  const campos = useMemo(() => (ato && tipo ? camposDoAto(ato.selecao, app.buscarClausula, tipo) : new Set<string>()), [ato, tipo, app]);
  const pendenciasDados = useMemo(
    () => (ato && tipo ? validarDados(ato.dados_depois, campos, { tipo, opcoesAto: ato.opcoes }) : []),
    [ato, tipo, campos],
  );
  const revisao = useMemo(() => (etapa === 2 && ato && def && tipo ? revisarAto(ato, def, tipo, app.buscarClausula) : null), [etapa, ato, def, tipo, app]);

  if (!empresa || !ato || !def || !tipo) {
    return (
      <Alerta tipo="erro">
        Documento não encontrado (o arquivo da empresa pode ter sido movido ou apagado).{' '}
        <button className="link" onClick={() => app.ir({ nome: 'inicio' })}>
          Voltar ao início
        </button>
      </Alerta>
    );
  }

  const alterar = (fn: (a: Ato) => Ato) => {
    if (somenteLeitura) return;
    setAto((a) => {
      const novo = fn(a!);
      return novo.status === 'gerado' ? voltarParaRascunho(novo) : novo;
    });
    setSujo(true);
    app.marcarAlterado(true);
  };

  async function salvar(atoParaSalvar: Ato = ato!, empresaBase: Empresa = empresa!): Promise<boolean> {
    setSalvando(true);
    try {
      const nova = comAto(empresaBase, atoParaSalvar);
      let destino = caminho;
      const razao = atoParaSalvar.dados_depois.razao_social.trim();
      const renomear = /^empresas\/nova-empresa-/.test(caminho) && razao !== '';
      if (renomear) destino = sessao.repo.novoCaminhoEmpresa(nova, razao);
      // confere conflito no arquivo atual antes de qualquer coisa
      const atual = await sessao.repo.fs.modificadoEm(caminho);
      if (atual !== null && atual !== modificadoEm) throw new ErroConflito(caminho);
      const m = await sessao.repo.salvarEmpresa(nova, destino, destino === caminho ? modificadoEm : null);
      if (destino !== caminho) {
        await sessao.repo.fs.excluir(caminho);
        app.removerEmpresaLocal(caminho);
        setCaminho(destino);
      }
      setEmpresa(nova);
      setAto(nova.atos.find((a) => a.id === atoParaSalvar.id));
      setModificadoEm(m);
      app.atualizarEmpresaLocal({ dados: nova, caminho: destino, modificadoEm: m });
      setSujo(false);
      app.marcarAlterado(false);
      return true;
    } catch (e) {
      app.avisar('erro', mensagemDeErro(e));
      return false;
    } finally {
      setSalvando(false);
    }
  }

  const irPara = async (n: number) => {
    if (sujo && !(await salvar())) return;
    setEtapa(n);
    window.scrollTo(0, 0);
  };

  async function gerar() {
    if (!revisao || !def) return;
    try {
      const nome = nomeArquivoDocx(hojeISO(), def.nome_arquivo, ato!.dados_depois.razao_social);
      const d = ato!.dados_depois;
      const blob = await gerarDocxBlob({
        documento: revisao.documento,
        configuracoes: cfg,
        camposRodape: { razao_social: d.razao_social, cnpj: d.cnpj, nire: d.nire, titulo_ato: revisao.documento.titulo },
        usarCabecalho: ato!.opcoes.usar_cabecalho,
        imagemCabecalho: imagem,
      });
      baixarArquivo(blob, nome);
      const novo = marcarGerado(ato!, revisao.documento, nome);
      setAto(novo);
      if (await salvar(novo)) {
        app.avisar('ok', `Documento gerado: “${nome}”. Ele foi para a pasta de Downloads. Abra no Word e confira antes de protocolar.`);
      }
    } catch (e) {
      app.avisar('erro', `Não foi possível gerar o .docx: ${mensagemDeErro(e)}`);
    }
  }

  const statusTexto = { rascunho: 'Rascunho', gerado: 'Gerado — aguardando registro', registrado: 'Registrado' }[ato.status];

  return (
    <div>
      <div className="entre">
        <div>
          <h1 style={{ marginBottom: 4 }}>{def.nome}</h1>
          <div className="suave">
            {ato.dados_depois.razao_social.trim() || nomeDaEmpresa(empresa)} · <span className={`etiqueta ${ato.status === 'registrado' ? 'verde' : ato.status === 'gerado' ? 'azul' : 'amarela'}`}>{statusTexto}</span>
            {sujo && <span className="etiqueta amarela">alterações não salvas</span>}
          </div>
        </div>
        <button onClick={() => salvar()} disabled={!sujo || salvando}>
          {salvando ? 'Salvando…' : '💾 Salvar rascunho'}
        </button>
      </div>

      {somenteLeitura && (
        <Alerta tipo="info">
          Este documento já foi registrado ({ato.registro?.numero ? `nº ${ato.registro.numero}, ` : ''}
          {formatarData(ato.registro?.data ?? '')}) e não pode mais ser alterado. Você ainda pode ver e baixar o .docx.
        </Alerta>
      )}
      {ato.status === 'gerado' && (
        <Alerta tipo="info">
          Este documento já foi gerado. Se você mudar alguma coisa, ele volta a ser rascunho e precisa ser gerado de novo.
        </Alerta>
      )}

      <div className="etapas" role="tablist">
        {ETAPAS.map((e, i) => (
          <button key={e} role="tab" aria-selected={etapa === i} className={etapa === i ? 'ativa' : ''} onClick={() => irPara(i)}>
            {e}
            {i === 1 && pendenciasDados.some((x) => x.nivel === 'erro') && (
              <span className="etiqueta vermelha" style={{ marginLeft: 6 }}>
                {pendenciasDados.filter((x) => x.nivel === 'erro').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {etapa === 0 && <EtapaClausulas ato={ato} def={def} tipoSocietario={tipo.id} alterar={alterar} somenteLeitura={somenteLeitura} />}

      {etapa === 1 && (
        <>
          {pendenciasDados.some((x) => x.nivel === 'erro') ? (
            <Alerta tipo="info">
              Faltam {pendenciasDados.filter((x) => x.nivel === 'erro').length} informação(ões). Os campos com problema estão marcados em vermelho em cada seção.
            </Alerta>
          ) : (
            <Alerta tipo="ok">Todos os dados exigidos pelas cláusulas escolhidas estão preenchidos.</Alerta>
          )}
          <fieldset disabled={somenteLeitura} style={{ border: 0, padding: 0, margin: 0 }}>
            <FormularioDados
              dados={ato.dados_depois}
              onChange={(d) => alterar((a) => ({ ...a, dados_depois: d }))}
              campos={campos}
              pendencias={pendenciasDados}
              opcoesAto={ato.opcoes}
              onChangeOpcoes={(o) => alterar((a) => ({ ...a, opcoes: { ...a.opcoes, ...o } }))}
            />
          </fieldset>
        </>
      )}

      {etapa === 2 && revisao && (
        <div className="grade-2" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', alignItems: 'start' }}>
          <div>
            <VisualizacaoDocumento
              documento={revisao.documento}
              config={cfg}
              camposRodape={{ razao_social: ato.dados_depois.razao_social, cnpj: ato.dados_depois.cnpj, nire: ato.dados_depois.nire, titulo_ato: revisao.documento.titulo }}
              usarCabecalho={ato.opcoes.usar_cabecalho}
              imagemUrl={imagemUrl}
            />
            <p className="lembrete">Confira o documento antes de protocolar.</p>
          </div>
          <div style={{ position: 'sticky', top: '1rem' }}>
            <div className="painel">
              <h2>Pendências</h2>
              <ListaPendencias itens={revisao.pendencias} vazio="Nenhuma pendência. O documento está pronto para ser gerado." />
              <CampoMarcar
                rotulo="Usar o cabeçalho do escritório neste documento"
                valor={ato.opcoes.usar_cabecalho}
                desativado={somenteLeitura}
                onChange={(v) => alterar((a) => ({ ...a, opcoes: { ...a.opcoes, usar_cabecalho: v } }))}
              />
              <div style={{ marginTop: '0.75rem' }}>
                <button className="primario grande" style={{ width: '100%' }} disabled={temErros(revisao.pendencias) || salvando} onClick={gerar}>
                  📄 Gerar .docx
                </button>
                {temErros(revisao.pendencias) && <p className="suave pequeno">Resolva as pendências em vermelho para liberar a geração.</p>}
              </div>
              {ato.status !== 'rascunho' && ato.arquivo_gerado && (
                <p className="suave pequeno">Último arquivo gerado: {ato.arquivo_gerado}</p>
              )}
              {ato.status === 'gerado' && (
                <button style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => setRegistrar(true)}>
                  ✅ Marcar como registrado na Junta
                </button>
              )}
              <p className="suave pequeno">
                Para PDF: abra o .docx no Word e use “Salvar como → PDF” (fica mais fiel).
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="barra-acoes linha">
        <button onClick={() => irPara(etapa - 1)} disabled={etapa === 0}>
          ← Voltar
        </button>
        <div className="espaco" />
        {etapa < 2 && (
          <button className="primario" onClick={() => irPara(etapa + 1)}>
            Próxima etapa →
          </button>
        )}
      </div>

      {registrar && (
        <ModalRegistro
          abertura={ato.tipo_documento === 'abertura'}
          aoFechar={() => setRegistrar(false)}
          aoConfirmar={async (r) => {
            try {
              const base = comAto(empresa, ato);
              const nova = marcarRegistrado(base, ato.id, r);
              const novoAto = nova.atos.find((a) => a.id === ato.id)!;
              if (await salvar(novoAto, nova)) {
                setEmpresa({ ...nova });
                setRegistrar(false);
                app.avisar('ok', 'Ato marcado como registrado. O cadastro vigente da empresa foi atualizado.');
              }
            } catch (e) {
              app.avisar('erro', mensagemDeErro(e));
            }
          }}
        />
      )}
    </div>
  );
}

function ModalRegistro(p: {
  abertura: boolean;
  aoFechar: () => void;
  aoConfirmar: (r: { data: string; numero: string; nire: string; cnpj: string }) => void;
}) {
  const [data, setData] = useState(hojeISO());
  const [numero, setNumero] = useState('');
  const [nire, setNire] = useState('');
  const [cnpj, setCnpj] = useState('');
  return (
    <Modal
      titulo="Marcar como registrado"
      aoFechar={p.aoFechar}
      rodape={
        <>
          <button onClick={p.aoFechar}>Cancelar</button>
          <button className="primario" disabled={!data} onClick={() => p.aoConfirmar({ data, numero, nire, cnpj })}>
            Confirmar registro
          </button>
        </>
      }
    >
      <p>Só depois desta confirmação o cadastro vigente da empresa passa a ter os dados deste documento.</p>
      <div className="grade">
        <CampoData rotulo="Data do registro" valor={data} onChange={setData} />
        <CampoTexto rotulo="Número do registro / protocolo" valor={numero} onChange={setNumero} />
        {p.abertura && <CampoTexto rotulo="NIRE atribuído" dica="Opcional" valor={nire} onChange={setNire} />}
        <CampoTexto rotulo="CNPJ" dica="Opcional (se já tiver)" valor={cnpj} onChange={setCnpj} />
      </div>
    </Modal>
  );
}
