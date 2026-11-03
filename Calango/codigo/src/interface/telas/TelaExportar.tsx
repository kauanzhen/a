import { useState } from 'react';
import { mensagemDeErro, useApp } from '../contexto';
import { analisarImportacao, exportar, importar, lerPacote, nomeArquivoExportacao, type ItemImportacao, type PacoteExportacao } from '../../armazenamento/exportacao';
import { nomeDaEmpresa } from '../../servicos/atos';
import { paraSlug } from '../../lib/texto';
import { Alerta, baixarArquivo } from '../componentes/Campos';

const TIPO: Record<string, string> = { configuracoes: 'Configurações', clausula: 'Cláusula', empresa: 'Empresa', imagem: 'Imagem' };

export function TelaExportar() {
  const app = useApp();
  const { sessao } = app;
  const [empresaId, setEmpresaId] = useState(sessao.empresas[0]?.dados.id ?? '');
  const [pacote, setPacote] = useState<PacoteExportacao | null>(null);
  const [itens, setItens] = useState<ItemImportacao[]>([]);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<{ importados: number; erros: string[] } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function baixar(conteudo: 'tudo' | 'clausulas' | 'empresa') {
    try {
      const p = await exportar(sessao.repo, conteudo, empresaId);
      const emp = conteudo === 'empresa' ? sessao.empresas.find((l) => l.dados.id === empresaId) : undefined;
      const nome = nomeArquivoExportacao(p, emp ? paraSlug(nomeDaEmpresa(emp.dados), 30) : '');
      baixarArquivo(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }), nome);
      app.avisar('ok', `Arquivo “${nome}” salvo na pasta de Downloads.`);
    } catch (e) {
      app.avisar('erro', mensagemDeErro(e));
    }
  }

  async function lerArquivo(arquivo: File) {
    setResultado(null);
    try {
      const p = lerPacote(await arquivo.text());
      const lista = await analisarImportacao(sessao.repo, p);
      setPacote(p);
      setItens(lista);
      setEscolhidos(new Set(lista.map((i) => i.chave)));
    } catch (e) {
      setPacote(null);
      setItens([]);
      app.avisar('erro', mensagemDeErro(e));
    }
  }

  async function confirmar() {
    if (!pacote) return;
    const substituir = itens.filter((i) => i.existe && escolhidos.has(i.chave)).length;
    if (substituir && !window.confirm(`${substituir} item(ns) já existe(m) e será(ão) substituído(s). Uma cópia da versão atual fica em backups/. Continuar?`)) return;
    setOcupado(true);
    try {
      const r = await importar(sessao.repo, pacote, escolhidos);
      setResultado(r);
      setPacote(null);
      setItens([]);
      await app.recarregar();
    } catch (e) {
      app.avisar('erro', mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <h1>Exportar e importar</h1>
      <p className="suave">Use para levar dados entre computadores que não estão na mesma rede. O arquivo gerado é um .json.</p>
      <div className="grade-2">
        <div className="painel">
          <h2>Exportar</h2>
          <div className="linha" style={{ marginBottom: '0.75rem' }}>
            <button className="primario" onClick={() => baixar('tudo')}>
              Tudo (empresas, cláusulas, configurações e imagens)
            </button>
          </div>
          <div className="linha" style={{ marginBottom: '0.75rem' }}>
            <button onClick={() => baixar('clausulas')}>Só a biblioteca de cláusulas</button>
          </div>
          <div className="linha">
            <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} style={{ maxWidth: 320 }} aria-label="Empresa a exportar">
              {sessao.empresas.map((l) => (
                <option key={l.dados.id} value={l.dados.id}>
                  {nomeDaEmpresa(l.dados)}
                </option>
              ))}
            </select>
            <button disabled={!empresaId} onClick={() => baixar('empresa')}>
              Exportar esta empresa
            </button>
          </div>
        </div>
        <div className="painel">
          <h2>Importar</h2>
          <label className="botao" style={{ display: 'inline-flex', alignItems: 'center' }}>
            Escolher arquivo .json…
            <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && lerArquivo(e.target.files[0])} />
          </label>
          {resultado && (
            <Alerta tipo={resultado.erros.length ? 'aviso' : 'ok'}>
              {resultado.importados} item(ns) importado(s).
              {resultado.erros.length > 0 && (
                <ul>
                  {resultado.erros.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </Alerta>
          )}
          {pacote && (
            <>
              <p>
                Arquivo exportado em {new Date(pacote.exportado_em).toLocaleString('pt-BR')}. Escolha o que importar:
              </p>
              <div className="lista-escolha" style={{ maxHeight: 320 }}>
                {itens.map((i) => (
                  <label key={i.chave} className="opcao" style={{ display: 'flex', padding: '0.35rem 0.6rem', borderBottom: '1px solid #eee' }}>
                    <input
                      type="checkbox"
                      checked={escolhidos.has(i.chave)}
                      onChange={(e) =>
                        setEscolhidos((s) => {
                          const n = new Set(s);
                          if (e.target.checked) n.add(i.chave);
                          else n.delete(i.chave);
                          return n;
                        })
                      }
                    />
                    <span className="espaco">
                      <span className="etiqueta">{TIPO[i.tipo]}</span> {i.nome}
                    </span>
                    {i.existe ? <span className="etiqueta amarela">substitui (com backup)</span> : <span className="etiqueta verde">novo</span>}
                  </label>
                ))}
              </div>
              <div className="linha fim" style={{ marginTop: '0.75rem' }}>
                <button onClick={() => setPacote(null)}>Cancelar</button>
                <button className="primario" disabled={ocupado || escolhidos.size === 0} onClick={confirmar}>
                  Importar {escolhidos.size} item(ns)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
