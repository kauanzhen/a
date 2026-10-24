import type { Conta, Partida } from '../../db/types';
import { explicarLancamento } from './didatico';

export function PainelDidatico({ partidas, contas, compacto }: { partidas: Partida[]; contas: Map<number, Conta>; compacto?: boolean }) {
  const validas = partidas.filter((p) => p.contaId && p.valor > 0);
  if (!validas.length) {
    return <p className="texto-2">Preencha as partidas para ver o efeito do lançamento no patrimônio.</p>;
  }
  const e = explicarLancamento(validas, contas);
  return (
    <div>
      <div className="acoes" style={{ marginBottom: 6 }}>
        <span className="etiqueta info">{e.tituloClassificacao}</span>
        {e.equacaoFecha ? <span className="etiqueta sucesso">A = P + PL ✓</span> : <span className="etiqueta perigo">A ≠ P + PL</span>}
      </div>
      <p style={{ margin: '4px 0 8px' }}>{e.explicacaoClassificacao}</p>
      {!compacto &&
        e.efeitos.map((ef, i) => (
          <div className="efeito" key={i}>
            <span className={`seta ${ef.variacaoGrupo > 0 ? 'mais' : 'menos'}`}>{ef.variacaoGrupo > 0 ? '↑' : '↓'}</span>
            <span>{ef.texto}</span>
          </div>
        ))}
      <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
        {e.resumo.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </div>
  );
}
