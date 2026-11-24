// Janela "Preencher com documentos (IA)": escolha dos arquivos, aviso
// obrigatório antes de cada envio, leitura e revisão campo a campo.
// Nada vai para o cadastro sem o usuário revisar e confirmar.

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../contexto';
import type { Pessoa } from '../../dados/tipos';
import { cepValido, cpfValido } from '../../dados/documentos';
import { ESTADOS_CIVIS } from '../../gramatica/concordancia';
import { formatarData } from '../../lib/datas';
import { lerDocumentos } from '../../ia/provedores';
import { ACEITOS, MAX_ARQUIVOS, conferirLote, prepararArquivo, tamanhoLegivel } from '../../ia/arquivos';
import { CAMPOS_IA, conferirLeitura, nomeTipoDocumento, valorNaPessoa, type ChaveCampo, type LeituraConferida, type TipoCampo } from '../../ia/interpretar';
import { AVISO_ENVIO, ErroIA, PROVEDORES, type ArquivoParaLeitura } from '../../ia/tipos';
import { UFS } from '../../dados/ufs';
import { Alerta, Modal } from './Campos';

type Linha = { usar: boolean; valor: string };

const SEMPRE_MOSTRADOS = new Set(['pessoa.nome', 'pessoa.genero']);

export function LeituraIA(p: {
  pessoa: Pessoa;
  /** Campos que o formulário mostra (só eles podem ser preenchidos). */
  campos: Set<string>;
  aoAplicar: (valores: Partial<Record<ChaveCampo, string>>) => void;
  aoFechar: () => void;
}) {
  const app = useApp();
  const ia = app.sessao.config.dados.ia;
  const provedor = PROVEDORES.find((x) => x.valor === ia.provedor);
  const configurado = !!provedor && !!ia.chave.trim() && !!ia.modelo.trim();

  const [arquivos, setArquivos] = useState<ArquivoParaLeitura[]>([]);
  const [preparando, setPreparando] = useState(false);
  const [errosArquivo, setErrosArquivo] = useState<string[]>([]);
  const [autorizado, setAutorizado] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<ErroIA | null>(null);
  const [leitura, setLeitura] = useState<LeituraConferida | null>(null);
  const [linhas, setLinhas] = useState<Partial<Record<ChaveCampo, Linha>>>({});
  const controle = useRef<AbortController | null>(null);

  useEffect(() => () => controle.current?.abort(), []);

  const visiveis = CAMPOS_IA.filter((c) => SEMPRE_MOSTRADOS.has(c.grupo) || p.campos.has(c.grupo));

  async function adicionar(lista: FileList | null) {
    if (!lista?.length) return;
    setPreparando(true);
    const erros: string[] = [];
    const novos: ArquivoParaLeitura[] = [];
    for (const f of Array.from(lista)) {
      if (arquivos.length + novos.length >= MAX_ARQUIVOS) {
        erros.push(`Limite de ${MAX_ARQUIVOS} arquivos por envio: “${f.name}” ficou de fora.`);
        continue;
      }
      try {
        novos.push(await prepararArquivo(f));
      } catch (e) {
        erros.push(e instanceof Error ? e.message : String(e));
      }
    }
    setArquivos((a) => [...a, ...novos]);
    setErrosArquivo(erros);
    setPreparando(false);
  }

  async function enviar() {
    setErro(null);
    try {
      conferirLote(arquivos);
    } catch (e) {
      setErro(e as ErroIA);
      return;
    }
    const c = new AbortController();
    controle.current = c;
    setLendo(true);
    try {
      const bruto = await lerDocumentos(ia, arquivos, { signal: c.signal });
      const conferida = conferirLeitura(bruto, p.pessoa.nome);
      const novas: Partial<Record<ChaveCampo, Linha>> = {};
      for (const campo of conferida.campos) {
        if (!visiveis.some((v) => v.chave === campo.chave)) continue;
        novas[campo.chave] = { usar: campo.valor !== valorNaPessoa(p.pessoa, campo.chave), valor: campo.valor };
      }
      setLinhas(novas);
      setLeitura(conferida);
    } catch (e) {
      setErro(e instanceof ErroIA ? e : new ErroIA('outro', 'Erro inesperado na leitura. Tente de novo.', String(e)));
    } finally {
      setLendo(false);
      // O aviso vale para um envio: o próximo precisa de nova confirmação.
      setAutorizado(false);
      controle.current = null;
    }
  }

  function fechar() {
    if (lendo) {
      controle.current?.abort();
      return p.aoFechar();
    }
    if (leitura && Object.keys(linhas).length && !window.confirm('Fechar sem usar os dados lidos?')) return;
    p.aoFechar();
  }

  function aplicar() {
    const valores: Partial<Record<ChaveCampo, string>> = {};
    for (const [chave, l] of Object.entries(linhas) as [ChaveCampo, Linha][]) if (l.usar) valores[chave] = l.valor;
    p.aoAplicar(valores);
  }

  const mudarLinha = (chave: ChaveCampo, parcial: Partial<Linha>) => setLinhas((ls) => ({ ...ls, [chave]: { ...ls[chave]!, ...parcial } }));
  const marcadas = Object.values(linhas).filter((l) => l?.usar).length;

  // ---------- Revisão ----------
  if (leitura) {
    const comValor = visiveis.filter((c) => linhas[c.chave]);
    const naoLidos = visiveis.filter((c) => !linhas[c.chave]);
    return (
      <Modal
        titulo="Revisar os dados lidos pela IA"
        largo
        aoFechar={fechar}
        rodape={
          <>
            <button
              onClick={() => {
                setLeitura(null);
                setLinhas({});
                setArquivos([]);
              }}
            >
              Ler outros documentos
            </button>
            <button onClick={fechar}>Cancelar</button>
            <button className="primario" disabled={marcadas === 0} onClick={aplicar}>
              Usar {marcadas} {marcadas === 1 ? 'campo marcado' : 'campos marcados'}
            </button>
          </>
        }
      >
        <Alerta tipo="info">
          Confira cada valor com o documento. Os valores em <span style={{ background: '#fff8d6', padding: '0 4px', border: '1px solid #d9a520' }}>amarelo</span> foram lidos
          pela IA e podem ser corrigidos aqui. Só os campos marcados vão para o cadastro, e o cadastro só é gravado quando você salvar a tela, como sempre.
        </Alerta>

        <h3>Documentos reconhecidos</h3>
        <ul>
          {leitura.documentos.map((d, i) => (
            <li key={i}>
              <strong>{d.arquivo || `Arquivo ${i + 1}`}</strong>: {nomeTipoDocumento(d.tipo)}
              {d.nome_titular && <> — em nome de {d.nome_titular}</>}
              {!d.legivel && <span className="erro-campo"> — ilegível</span>}
              {d.observacao && <span className="suave"> ({d.observacao})</span>}
            </li>
          ))}
        </ul>

        {leitura.avisos.length > 0 && (
          <Alerta tipo="aviso" titulo="Confira:">
            <ul>
              {leitura.avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Alerta>
        )}

        {leitura.ilegivel || comValor.length === 0 ? (
          <Alerta tipo="erro">
            Não foi possível ler os dados destes documentos. Tente fotos mais nítidas: documento inteiro, sem reflexo, sem dedos na frente e com boa luz. Ou
            preencha à mão.
          </Alerta>
        ) : (
          <table className="lista revisao-ia">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Usar</th>
                <th>Campo</th>
                <th>No cadastro agora</th>
                <th>Lido pela IA (pode corrigir)</th>
              </tr>
            </thead>
            <tbody>
              {comValor.map((c) => {
                const l = linhas[c.chave]!;
                const atual = valorNaPessoa(p.pessoa, c.chave);
                const problema = problemaDoValor(c.chave, l.valor) ?? leitura.campos.find((x) => x.chave === c.chave)?.problema;
                return (
                  <tr key={c.chave} className={l.usar ? '' : 'ignorado'}>
                    <td>
                      <input type="checkbox" aria-label={`Usar ${c.rotulo}`} checked={l.usar} onChange={(e) => mudarLinha(c.chave, { usar: e.target.checked })} />
                    </td>
                    <td>{c.rotulo}</td>
                    <td className="suave">{mostrar(c.tipo, atual) || '—'}</td>
                    <td className="lido">
                      <EntradaValor tipo={c.tipo} rotulo={c.rotulo} valor={l.valor} onChange={(v) => mudarLinha(c.chave, { valor: v, usar: true })} />
                      {problema && <div className="erro-campo">{problema}</div>}
                      {atual && atual === l.valor && <div className="suave pequeno">Igual ao que já está no cadastro.</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {naoLidos.length > 0 && comValor.length > 0 && (
          <p className="suave pequeno">Não lidos (preencha à mão, se necessário): {naoLidos.map((c) => c.rotulo).join(', ')}.</p>
        )}
      </Modal>
    );
  }

  // ---------- Escolha e envio ----------
  return (
    <Modal
      titulo="Preencher com documentos (IA)"
      aoFechar={fechar}
      rodape={
        <>
          <button onClick={fechar}>{lendo ? 'Cancelar leitura' : 'Cancelar'}</button>
          <button className="primario" disabled={!configurado || !arquivos.length || !autorizado || lendo || preparando} onClick={enviar}>
            {lendo ? 'Lendo…' : 'Enviar para leitura'}
          </button>
        </>
      }
    >
      {!configurado ? (
        <Alerta tipo="aviso" titulo="Leitura por IA não configurada.">
          Para usar, escolha o serviço (Claude ou Gemini) e cole a chave de API em Configurações → Leitura de documentos por IA.{' '}
          <button className="link" onClick={() => app.ir({ nome: 'configuracoes' })}>
            Ir para Configurações
          </button>
        </Alerta>
      ) : (
        <p className="suave">
          Serviço: <strong>{provedor!.rotulo}</strong> ({provedor!.empresa}), modelo <code>{ia.modelo}</code>.
        </p>
      )}

      <p>
        Escolha fotos ou PDFs do <strong>RG, CNH ou CIN</strong> e do <strong>comprovante de residência</strong> de uma pessoa. Frente e verso podem ir em arquivos
        separados (até {MAX_ARQUIVOS}).
      </p>
      <label className="botao" style={{ display: 'inline-flex', alignItems: 'center' }}>
        {preparando ? 'Preparando…' : 'Escolher arquivos…'}
        <input
          type="file"
          multiple
          accept={ACEITOS}
          style={{ display: 'none' }}
          disabled={lendo || preparando}
          onChange={(e) => {
            void adicionar(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
      {arquivos.length > 0 && (
        <ul className="lista-arquivos-ia">
          {arquivos.map((a, i) => (
            <li key={`${a.nome}-${i}`}>
              <span>
                {a.tipo === 'application/pdf' ? '📄' : '🖼️'} {a.nome} <span className="suave pequeno">({tamanhoLegivel(a.bytes)})</span>
              </span>
              <button className="pequeno" disabled={lendo} onClick={() => setArquivos((l) => l.filter((_, j) => j !== i))}>
                Tirar
              </button>
            </li>
          ))}
        </ul>
      )}
      {errosArquivo.map((e, i) => (
        <Alerta key={i} tipo="erro">
          {e}
        </Alerta>
      ))}

      <div className="aviso-envio-ia" role="group" aria-label="Aviso sobre o envio dos documentos">
        <p style={{ marginTop: 0 }}>
          <strong>⚠️ Atenção:</strong> {AVISO_ENVIO}
        </p>
        <label className="opcao">
          <input type="checkbox" checked={autorizado} disabled={lendo} onChange={(e) => setAutorizado(e.target.checked)} />
          <span>Li o aviso e confirmo que o cliente autorizou o envio destes documentos.</span>
        </label>
      </div>

      {lendo && <Alerta tipo="info">Lendo os documentos… Isso pode levar até um minuto.</Alerta>}
      {erro && (
        <Alerta tipo="erro" titulo="Não deu certo.">
          {erro.message}
          {erro.detalhe && (
            <details>
              <summary className="pequeno">Detalhe técnico</summary>
              <code className="pequeno">{erro.detalhe}</code>
            </details>
          )}
        </Alerta>
      )}
    </Modal>
  );
}

function problemaDoValor(chave: ChaveCampo, valor: string): string | undefined {
  if (chave === 'cpf' && valor && !cpfValido(valor)) return 'CPF inválido: confira os números no documento.';
  if (chave === 'endereco.cep' && valor && !cepValido(valor)) return 'O CEP precisa ter 8 dígitos.';
  return undefined;
}

function mostrar(tipo: TipoCampo, v: string): string {
  if (!v) return '';
  if (tipo === 'data') return formatarData(v);
  if (tipo === 'genero') return v === 'F' ? 'Feminino' : v === 'M' ? 'Masculino' : v;
  if (tipo === 'estado_civil') return ESTADOS_CIVIS.find((e) => e.valor === v)?.rotulo ?? v;
  return v;
}

function EntradaValor(p: { tipo: TipoCampo; rotulo: string; valor: string; onChange: (v: string) => void }) {
  if (p.tipo === 'genero') {
    return (
      <select aria-label={p.rotulo} value={p.valor} onChange={(e) => p.onChange(e.target.value)}>
        <option value="">—</option>
        <option value="M">Masculino</option>
        <option value="F">Feminino</option>
      </select>
    );
  }
  if (p.tipo === 'estado_civil') {
    return (
      <select aria-label={p.rotulo} value={p.valor} onChange={(e) => p.onChange(e.target.value)}>
        <option value="">—</option>
        {ESTADOS_CIVIS.map((e) => (
          <option key={e.valor} value={e.valor}>
            {e.rotulo}
          </option>
        ))}
      </select>
    );
  }
  if (p.tipo === 'uf') {
    return (
      <select aria-label={p.rotulo} value={p.valor} onChange={(e) => p.onChange(e.target.value)}>
        <option value="">UF</option>
        {UFS.map((u) => (
          <option key={u.sigla} value={u.sigla}>
            {u.sigla} — {u.nome}
          </option>
        ))}
      </select>
    );
  }
  if (p.tipo === 'data') return <input type="date" aria-label={p.rotulo} value={p.valor} onChange={(e) => p.onChange(e.target.value)} />;
  return <input type="text" aria-label={p.rotulo} value={p.valor} onChange={(e) => p.onChange(e.target.value)} />;
}
