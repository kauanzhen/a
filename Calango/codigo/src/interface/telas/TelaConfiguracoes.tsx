import { useEffect, useRef, useState } from 'react';
import { mensagemDeErro, useApp } from '../contexto';
import type { Alinhamento, Configuracoes } from '../../armazenamento/configuracoes';
import { CABECALHO_RECOMENDADO } from '../../docx/gerarDocx';
import { dimensoes, tipoDaImagem } from '../imagens';
import { Alerta, CampoAreaTexto, CampoMarcar, CampoNumero, CampoSelecao, CampoTexto, CampoUF } from '../componentes/Campos';
import { VisualizacaoDocumento } from '../componentes/VisualizacaoDocumento';
import { gerarAbertura } from '../previa';
import { AVISO_CHAVE, AVISO_ENVIO, ErroIA, MODELO_PADRAO, PROVEDORES, type ProvedorIA } from '../../ia/tipos';
import { listarModelos } from '../../ia/provedores';

const ALINHAMENTOS: { valor: Alinhamento; rotulo: string }[] = [
  { valor: 'esquerda', rotulo: 'À esquerda' },
  { valor: 'centro', rotulo: 'Centralizado' },
  { valor: 'direita', rotulo: 'À direita' },
];

export function TelaConfiguracoes() {
  const app = useApp();
  const { sessao } = app;
  const [cfg, setCfg] = useState<Configuracoes>(structuredClone(sessao.config.dados));
  const [sujo, setSujo] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgInfo, setImgInfo] = useState('');
  const rodapeRef = useRef<HTMLTextAreaElement>(null);

  const mudar = (fn: (c: Configuracoes) => Configuracoes) => {
    setCfg((c) => fn(structuredClone(c)));
    setSujo(true);
    app.marcarAlterado(true);
  };

  useEffect(() => {
    let url: string | null = null;
    (async () => {
      const dados = cfg.cabecalho.imagem ? await sessao.repo.lerImagem(cfg.cabecalho.imagem) : null;
      const tipo = dados ? tipoDaImagem(dados) : null;
      if (!dados || !tipo) {
        setImgUrl(null);
        setImgInfo('');
        return;
      }
      url = URL.createObjectURL(new Blob([dados as BlobPart], { type: tipo === 'png' ? 'image/png' : 'image/jpeg' }));
      setImgUrl(url);
      const d = await dimensoes(dados, tipo);
      const proporcao = d.largura / d.altura;
      const ideal = CABECALHO_RECOMENDADO.largura / CABECALHO_RECOMENDADO.altura;
      setImgInfo(
        `${d.largura} × ${d.altura} px` +
          (Math.abs(proporcao - ideal) > 0.5 ? ' — proporção diferente da recomendada: a imagem será redimensionada proporcionalmente para caber na faixa.' : ''),
      );
    })().catch(() => setImgInfo('Não foi possível ler a imagem.'));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [cfg.cabecalho.imagem, sessao.repo]);

  async function enviarImagem(arquivo: File) {
    try {
      const dados = new Uint8Array(await arquivo.arrayBuffer());
      const tipo = tipoDaImagem(dados);
      if (!tipo) return app.avisar('erro', 'A imagem precisa ser PNG ou JPG.');
      if (dados.length > 5 * 1024 * 1024) return app.avisar('erro', 'A imagem é muito grande (mais de 5 MB). Reduza o tamanho e tente de novo.');
      const nome = `cabecalho.${tipo}`;
      await sessao.repo.gravarImagem(nome, dados);
      mudar((c) => ({ ...c, cabecalho: { ...c.cabecalho, imagem: nome } }));
      app.avisar('ok', 'Imagem enviada. Clique em “Salvar configurações” para confirmar.');
    } catch (e) {
      app.avisar('erro', mensagemDeErro(e));
    }
  }

  async function salvar() {
    try {
      const m = await sessao.repo.salvarConfiguracoes(cfg, sessao.config.modificadoEm);
      app.atualizarConfigLocal({ dados: cfg, caminho: 'configuracoes.json', modificadoEm: m });
      setSujo(false);
      app.marcarAlterado(false);
      app.avisar('ok', 'Configurações salvas.');
    } catch (e) {
      app.avisar('erro', mensagemDeErro(e));
    }
  }

  const inserirCampo = (campo: string) => {
    const t = rodapeRef.current;
    const ini = t?.selectionStart ?? cfg.rodape.texto.length;
    const fim = t?.selectionEnd ?? cfg.rodape.texto.length;
    mudar((c) => ({ ...c, rodape: { ...c.rodape, texto: c.rodape.texto.slice(0, ini) + `{${campo}}` + c.rodape.texto.slice(fim) } }));
  };

  const exemplo = gerarAbertura();

  return (
    <>
      <div className="entre">
        <h1>Configurações</h1>
        <button className="primario" disabled={!sujo} onClick={salvar}>
          💾 Salvar configurações
        </button>
      </div>

      <div className="painel">
        <h2>Pasta de dados</h2>
        <p>
          Em uso: <strong>{sessao.repo.fs.nome}</strong>
        </p>
        <p className="suave pequeno">
          Na pasta ficam: configuracoes.json, clausulas/, empresas/, backups/ (cópias automáticas dos últimos 30 dias) e imagens/.
        </p>
        <button onClick={app.trocarPasta}>Trocar pasta de dados</button>
      </div>

      <div className="grade-2">
        <div>
          <div className="painel">
            <h2>Página</h2>
            <p className="suave pequeno">Folha A4, texto justificado.</p>
            <div className="grade">
              <CampoNumero rotulo="Margem superior (cm)" valor={cfg.pagina.margem_superior_cm} passo={0.1} min={0.5} onChange={(v) => mudar((c) => ({ ...c, pagina: { ...c.pagina, margem_superior_cm: v } }))} />
              <CampoNumero rotulo="Margem inferior (cm)" valor={cfg.pagina.margem_inferior_cm} passo={0.1} min={0.5} onChange={(v) => mudar((c) => ({ ...c, pagina: { ...c.pagina, margem_inferior_cm: v } }))} />
              <CampoNumero rotulo="Margem esquerda (cm)" valor={cfg.pagina.margem_esquerda_cm} passo={0.1} min={0.5} onChange={(v) => mudar((c) => ({ ...c, pagina: { ...c.pagina, margem_esquerda_cm: v } }))} />
              <CampoNumero rotulo="Margem direita (cm)" valor={cfg.pagina.margem_direita_cm} passo={0.1} min={0.5} onChange={(v) => mudar((c) => ({ ...c, pagina: { ...c.pagina, margem_direita_cm: v } }))} />
              <CampoSelecao
                rotulo="Fonte"
                valor={cfg.pagina.fonte}
                onChange={(v) => mudar((c) => ({ ...c, pagina: { ...c.pagina, fonte: v } }))}
                opcoes={['Arial', 'Calibri', 'Times New Roman', 'Verdana', 'Garamond', 'Cambria'].map((f) => ({ valor: f, rotulo: f }))}
              />
              <CampoNumero rotulo="Tamanho da fonte (pt)" valor={cfg.pagina.tamanho_pt} min={8} max={16} onChange={(v) => mudar((c) => ({ ...c, pagina: { ...c.pagina, tamanho_pt: v } }))} />
              <CampoSelecao
                rotulo="Espaçamento entre linhas"
                valor={String(cfg.pagina.espacamento_linhas)}
                onChange={(v) => mudar((c) => ({ ...c, pagina: { ...c.pagina, espacamento_linhas: Number(v) } }))}
                opcoes={[
                  { valor: '1', rotulo: 'Simples (1,0)' },
                  { valor: '1.15', rotulo: '1,15' },
                  { valor: '1.5', rotulo: '1,5' },
                  { valor: '2', rotulo: 'Duplo (2,0)' },
                ]}
              />
              <CampoNumero rotulo="Espaço após parágrafo (pt)" valor={cfg.pagina.espaco_apos_paragrafo_pt} min={0} max={30} onChange={(v) => mudar((c) => ({ ...c, pagina: { ...c.pagina, espaco_apos_paragrafo_pt: v } }))} />
            </div>
          </div>

          <div className="painel">
            <h2>Cabeçalho</h2>
            <CampoAreaTexto rotulo="Texto do cabeçalho" dica="Opcional. Pode ter várias linhas." valor={cfg.cabecalho.texto} onChange={(v) => mudar((c) => ({ ...c, cabecalho: { ...c.cabecalho, texto: v } }))} linhas={2} />
            <div className="grade" style={{ marginTop: '0.5rem' }}>
              <CampoSelecao rotulo="Alinhamento" valor={cfg.cabecalho.alinhamento} onChange={(v) => mudar((c) => ({ ...c, cabecalho: { ...c.cabecalho, alinhamento: v } }))} opcoes={ALINHAMENTOS} />
            </div>
            <h3>Imagem (logotipo ou faixa)</h3>
            <Alerta tipo="info">
              PNG ou JPG. Tamanho recomendado: <strong>{CABECALHO_RECOMENDADO.largura} × {CABECALHO_RECOMENDADO.altura} px</strong> (faixa de cerca de {CABECALHO_RECOMENDADO.larguraCm} × {CABECALHO_RECOMENDADO.alturaCm} cm). Imagens de outro tamanho são redimensionadas proporcionalmente.
            </Alerta>
            {imgUrl && (
              <div style={{ border: '1px solid var(--borda)', padding: 8, marginBottom: 8, background: '#fff' }}>
                <img src={imgUrl} alt="Imagem atual do cabeçalho" style={{ maxWidth: '100%', maxHeight: 120 }} />
                <div className="suave pequeno">{imgInfo}</div>
              </div>
            )}
            <div className="linha">
              <label className="botao" style={{ display: 'inline-flex', alignItems: 'center' }}>
                {imgUrl ? 'Trocar imagem…' : 'Escolher imagem…'}
                <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && enviarImagem(e.target.files[0])} />
              </label>
              {imgUrl && (
                <button className="perigo" onClick={() => mudar((c) => ({ ...c, cabecalho: { ...c.cabecalho, imagem: '' } }))}>
                  Não usar imagem
                </button>
              )}
            </div>
            <CampoMarcar rotulo="Não mostrar o cabeçalho na primeira página" valor={cfg.cabecalho.ocultar_primeira_pagina} onChange={(v) => mudar((c) => ({ ...c, cabecalho: { ...c.cabecalho, ocultar_primeira_pagina: v } }))} />
          </div>

          <div className="painel">
            <h2>Rodapé</h2>
            <label className="campo">
              Texto do rodapé
              <textarea ref={rodapeRef} rows={2} value={cfg.rodape.texto} onChange={(e) => mudar((c) => ({ ...c, rodape: { ...c.rodape, texto: e.target.value } }))} />
            </label>
            <div className="linha" style={{ margin: '0.5rem 0' }}>
              <span className="suave pequeno">Inserir campo:</span>
              {[
                ['pagina', 'Página X'],
                ['total_paginas', 'Total Y'],
                ['razao_social', 'Razão social'],
                ['cnpj', 'CNPJ'],
                ['nire', 'NIRE'],
                ['titulo_ato', 'Título do ato'],
              ].map(([c, r]) => (
                <button key={c} className="pequeno" onClick={() => inserirCampo(c)}>
                  {r}
                </button>
              ))}
            </div>
            <p className="suave pequeno">
              Trechos entre colchetes somem quando o campo está vazio — ex.: <code>[ — CNPJ {'{cnpj}'}]</code> não aparece numa abertura (ainda sem CNPJ). Use <code>|</code> para
              quebrar linha.
            </p>
            <CampoSelecao rotulo="Alinhamento" valor={cfg.rodape.alinhamento} onChange={(v) => mudar((c) => ({ ...c, rodape: { ...c.rodape, alinhamento: v } }))} opcoes={ALINHAMENTOS} />
          </div>

          <PainelIA cfg={cfg} mudar={mudar} />

          <div className="painel">
            <h2>Valores padrão</h2>
            <p className="suave pequeno">Usados para preencher automaticamente o local do documento, o foro e a Junta Comercial em novas aberturas.</p>
            <div className="grade">
              <CampoTexto rotulo="Cidade do escritório" valor={cfg.padroes.cidade} onChange={(v) => mudar((c) => ({ ...c, padroes: { ...c.padroes, cidade: v } }))} />
              <CampoUF rotulo="UF" valor={cfg.padroes.uf} onChange={(v) => mudar((c) => ({ ...c, padroes: { ...c.padroes, uf: v } }))} />
            </div>
          </div>
        </div>
        <div>
          <div className="painel" style={{ position: 'sticky', top: '1rem' }}>
            <h2>Como fica (exemplo)</h2>
            <div style={{ maxHeight: '75vh', overflow: 'auto' }}>
              <VisualizacaoDocumento
                documento={exemplo}
                config={cfg}
                camposRodape={{ razao_social: 'EXEMPLO COMÉRCIO E SERVIÇOS LTDA', cnpj: '', nire: '', titulo_ato: exemplo.titulo }}
                usarCabecalho
                imagemUrl={imgUrl}
                compacta
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function PainelIA({ cfg, mudar }: { cfg: Configuracoes; mudar: (fn: (c: Configuracoes) => Configuracoes) => void }) {
  const ia = cfg.ia;
  const [verChave, setVerChave] = useState(false);
  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState<{ ok: boolean; texto: string; modelos?: string[] } | null>(null);
  const provedor = PROVEDORES.find((x) => x.valor === ia.provedor);
  const mudarIA = (parcial: Partial<Configuracoes['ia']>) => {
    setTeste(null);
    mudar((c) => ({ ...c, ia: { ...c.ia, ...parcial } }));
  };

  const trocarProvedor = (v: '' | ProvedorIA) => {
    const padroes = Object.values(MODELO_PADRAO);
    // Troca a sugestão de modelo junto, a não ser que o usuário tenha digitado outro.
    const modelo = v && (!ia.modelo.trim() || padroes.includes(ia.modelo.trim())) ? MODELO_PADRAO[v] : ia.modelo;
    const trocou = v !== ia.provedor;
    if (trocou && ia.chave && !window.confirm('Trocar de serviço apaga a chave de API atual (ela é de outro provedor). Continuar?')) return;
    mudarIA({ provedor: v, modelo, chave: trocou ? '' : ia.chave });
  };

  async function testar() {
    setTestando(true);
    setTeste(null);
    try {
      const modelos = await listarModelos(ia);
      const tem = modelos.includes(ia.modelo.trim());
      setTeste({
        ok: tem,
        texto: tem
          ? `Chave aceita. O modelo “${ia.modelo}” está disponível. Lembre de salvar as configurações.`
          : `Chave aceita, mas o modelo “${ia.modelo || '(vazio)'}” não aparece na lista desta chave. Escolha um dos modelos abaixo (ou mantenha, se for um apelido aceito pelo provedor).`,
        modelos,
      });
    } catch (e) {
      setTeste({ ok: false, texto: e instanceof ErroIA ? e.message : String(e) });
    } finally {
      setTestando(false);
    }
  }

  return (
    <div className="painel">
      <h2>Leitura de documentos por IA</h2>
      <p className="suave pequeno">
        Lê fotos ou PDFs do RG, CNH, CIN e do comprovante de residência e preenche o cadastro da pessoa (botão “Preencher com documentos (IA)”). Você sempre confere os
        dados antes de usar. Opcional: sem configurar, nada muda.
      </p>
      <div className="grade">
        <CampoSelecao
          rotulo="Serviço"
          valor={ia.provedor}
          vazio="Desligada (não usar IA)"
          onChange={(v) => trocarProvedor(v as '' | ProvedorIA)}
          opcoes={PROVEDORES.map((x) => ({ valor: x.valor, rotulo: `${x.rotulo} (${x.empresa})` }))}
        />
        {provedor && (
          <label className="campo">
            <span>Modelo</span>
            <input type="text" list="modelos-ia" value={ia.modelo} placeholder={MODELO_PADRAO[provedor.valor]} onChange={(e) => mudarIA({ modelo: e.target.value.trim() })} />
            <datalist id="modelos-ia">
              {(teste?.modelos ?? []).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <span className="dica">
              Sugestão: <code>{MODELO_PADRAO[provedor.valor]}</code>
              {ia.modelo !== MODELO_PADRAO[provedor.valor] && (
                <>
                  {' '}
                  <button className="link" onClick={() => mudarIA({ modelo: MODELO_PADRAO[provedor.valor] })}>
                    usar a sugestão
                  </button>
                </>
              )}
              . Quando o provedor lançar modelos novos, basta trocar o nome aqui.
            </span>
          </label>
        )}
      </div>
      {provedor && (
        <>
          <label className="campo" style={{ marginTop: '0.75rem' }}>
            <span>Chave de API do {provedor.rotulo}</span>
            <div className="linha" style={{ flexWrap: 'nowrap' }}>
              <input
                type={verChave ? 'text' : 'password'}
                value={ia.chave}
                autoComplete="off"
                spellCheck={false}
                placeholder="Cole aqui a chave"
                onChange={(e) => mudarIA({ chave: e.target.value.trim() })}
              />
              <button className="pequeno" onClick={() => setVerChave((v) => !v)}>
                {verChave ? 'Esconder' : 'Mostrar'}
              </button>
            </div>
            <span className="dica">Onde obter: {provedor.ondeObterChave}. O uso é cobrado na conta do escritório nesse provedor.</span>
          </label>
          <Alerta tipo="aviso" titulo="Sobre a chave:">
            {AVISO_CHAVE}
          </Alerta>
          <Alerta tipo="info" titulo="Antes de cada envio, o Calango mostra este aviso e pede confirmação:">
            “{AVISO_ENVIO}”
          </Alerta>
          <div className="linha">
            <button onClick={testar} disabled={testando || !ia.chave}>
              {testando ? 'Testando…' : '🔌 Testar chave e ver modelos'}
            </button>
          </div>
          {teste && (
            <Alerta tipo={teste.ok ? 'ok' : 'aviso'}>
              {teste.texto}
              {!teste.ok && teste.modelos && teste.modelos.length > 0 && (
                <div className="linha" style={{ marginTop: '0.5rem' }}>
                  {teste.modelos.slice(0, 30).map((m) => (
                    <button
                      key={m}
                      className="pequeno"
                      onClick={() => {
                        mudar((c) => ({ ...c, ia: { ...c.ia, modelo: m } }));
                        setTeste({ ok: true, texto: `Modelo “${m}” escolhido. Lembre de salvar as configurações.`, modelos: teste.modelos });
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </Alerta>
          )}
        </>
      )}
    </div>
  );
}
