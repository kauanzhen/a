// Pré-visualização do documento montado, imitando a folha do Word.

import type { DocumentoMontado } from '../../motor/montagem';
import type { Trecho } from '../../motor/catalogo';
import type { CamposRodape, Configuracoes } from '../../armazenamento/configuracoes';
import { interpretarRodape } from '../../armazenamento/configuracoes';

const NUMERICO = /^[\d.,%\sR$]+$/;

function Trechos({ ts }: { ts: Trecho[] }) {
  return (
    <>
      {ts.map((t, i) => {
        const cls = t.pendente ? 'pendente' : undefined;
        return t.negrito ? (
          <strong key={i} className={cls}>
            {t.texto}
          </strong>
        ) : (
          <span key={i} className={cls}>
            {t.texto}
          </span>
        );
      })}
    </>
  );
}

export function VisualizacaoDocumento(p: {
  documento: DocumentoMontado;
  config?: Configuracoes;
  camposRodape?: CamposRodape;
  usarCabecalho?: boolean;
  imagemUrl?: string | null;
  compacta?: boolean;
}) {
  const cfg = p.config;
  const estiloFolha = cfg
    ? { fontFamily: `'${cfg.pagina.fonte}', Arial, sans-serif`, fontSize: `${cfg.pagina.tamanho_pt}pt`, lineHeight: cfg.pagina.espacamento_linhas * 1.2 }
    : undefined;
  const rodape = cfg && p.camposRodape ? interpretarRodape(cfg.rodape.texto, p.camposRodape) : [];
  const temCabecalho = cfg && p.usarCabecalho && (cfg.cabecalho.texto.trim() || p.imagemUrl);
  return (
    <div className="folha" style={{ ...estiloFolha, ...(p.compacta ? { padding: '1.2rem 1.4rem' } : {}) }}>
      {temCabecalho && (
        <div className="cabecalho-folha" style={{ textAlign: cfg!.cabecalho.alinhamento === 'esquerda' ? 'left' : cfg!.cabecalho.alinhamento === 'direita' ? 'right' : 'center' }}>
          {p.imagemUrl && <img src={p.imagemUrl} alt="Imagem do cabeçalho" />}
          {cfg!.cabecalho.texto.split('\n').map((l, i) => (
            <div key={i}>{l}</div>
          ))}
          {cfg!.cabecalho.ocultar_primeira_pagina && <div className="pequeno">(o cabeçalho não aparece na primeira página)</div>}
        </div>
      )}
      {p.documento.elementos.map((e, i) => {
        if (e.tipo === 'tabela') {
          return (
            <table key={i}>
              <tbody>
                {e.linhas.map((l, j) => (
                  <tr key={j}>
                    {l.map((c, k) => {
                      const texto = c.map((t) => t.texto).join('');
                      return j === 0 ? (
                        <th key={k}>
                          <Trechos ts={c} />
                        </th>
                      ) : (
                        <td key={k} className={NUMERICO.test(texto) ? 'num' : undefined}>
                          <Trechos ts={c} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        if (e.tipo === 'linha_assinatura') return <p key={i} className="e-linha-assinatura">____________________________________________</p>;
        return (
          <p key={i} className={`e-${e.estilo}`}>
            <Trechos ts={e.trechos} />
          </p>
        );
      })}
      {rodape.length > 0 && (
        <div className="rodape-folha" style={{ textAlign: cfg!.rodape.alinhamento === 'esquerda' ? 'left' : cfg!.rodape.alinhamento === 'direita' ? 'right' : 'center' }}>
          {rodape.map((linha, i) => (
            <div key={i}>
              {linha.map((x, j) => (x.tipo === 'texto' ? <span key={j}>{x.texto}</span> : <span key={j}>{x.tipo === 'pagina' ? '1' : 'N'}</span>))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
