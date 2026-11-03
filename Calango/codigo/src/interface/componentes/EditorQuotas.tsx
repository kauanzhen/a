// Capital social e quotas: primeiro define-se como funcionam as quotas
// (classe única ou classes distintas); depois capital, valor unitário e a
// participação de cada sócio — em quotas, em valor (R$) ou em percentual.
// Se a conversão não der número inteiro de quotas, o sistema BLOQUEIA e
// mostra as opções; nunca arredonda sozinho.

import { useEffect, useState } from 'react';
import type { ClasseQuota, DadosEmpresa, ModoQuotas, Participacao } from '../../dados/tipos';
import { CLASSE_UNICA } from '../../dados/tipos';
import { novaClasse } from '../../dados/fabricas';
import {
  classesEfetivas,
  percentualParaQuotas,
  socios,
  totalQuotasDaClasse,
  totalQuotasDoSocio,
  totalQuotasEsperado,
  totalQuotasSubscritas,
  valorDoSocio,
  valorParaQuotas,
  valorQuotaDaClasse,
  valorTotalSubscrito,
  type ResultadoConversao,
} from '../../dados/quotas';
import { agruparMilhares, formatarMoeda, formatarNumeroMoeda, formatarPercentualCentesimos, lerMoeda, lerPercentual, percentualCentesimos } from '../../lib/dinheiro';
import { AVISO_CLASSES } from '../../dados/validacao';
import { Alerta, CampoMarcar, CampoMoeda, CampoSelecao, CampoTexto, CampoAreaTexto } from './Campos';

type ModoEntrada = 'quotas' | 'valor' | 'percentual';

function textoDaCelula(q: number, modo: ModoEntrada, vq: number, capital: number): string {
  if (!q) return '';
  if (modo === 'quotas') return agruparMilhares(q);
  if (modo === 'valor') return formatarNumeroMoeda(q * vq);
  return formatarPercentualCentesimos(percentualCentesimos(q * vq, capital));
}

function Celula(p: {
  quotas: number;
  modo: ModoEntrada;
  valorQuota: number;
  capital: number;
  onQuotas: (q: number) => void;
  rotulo: string;
}) {
  const [texto, setTexto] = useState(textoDaCelula(p.quotas, p.modo, p.valorQuota, p.capital));
  const [problema, setProblema] = useState<Extract<ResultadoConversao, { ok: false }> | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setTexto(textoDaCelula(p.quotas, p.modo, p.valorQuota, p.capital));
    setProblema(null);
    setErro('');
  }, [p.quotas, p.modo, p.valorQuota, p.capital]);

  const aplicar = () => {
    setErro('');
    setProblema(null);
    const t = texto.trim();
    if (!t) return p.onQuotas(0);
    let r: ResultadoConversao;
    if (p.modo === 'quotas') {
      const n = Number(t.replace(/\./g, ''));
      if (!Number.isInteger(n) || n < 0) return setErro('Digite um número inteiro de quotas.');
      r = { ok: true, quotas: n };
    } else if (p.modo === 'valor') {
      const v = lerMoeda(t);
      if (v === null || v < 0) return setErro('Valor inválido (ex.: 5.000,00).');
      r = valorParaQuotas(v, p.valorQuota);
    } else {
      const pc = lerPercentual(t);
      if (pc === null || pc > 10000) return setErro('Percentual inválido (ex.: 50 ou 33,33).');
      r = percentualParaQuotas(pc, p.capital, p.valorQuota);
    }
    if (r.ok) p.onQuotas(r.quotas);
    else setProblema(r);
  };

  const pct = (q: number) => `${formatarPercentualCentesimos(percentualCentesimos(q * p.valorQuota, p.capital))}%`;

  return (
    <div>
      <input
        type="text"
        aria-label={p.rotulo}
        value={texto}
        className={problema || erro ? 'invalido' : undefined}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={aplicar}
        onKeyDown={(e) => e.key === 'Enter' && aplicar()}
        style={{ textAlign: 'right' }}
      />
      {erro && <div className="erro-campo">{erro}</div>}
      {problema && (
        <div className="alerta erro pequeno" style={{ marginTop: 4 }}>
          {problema.motivo}
          {problema.acima > 0 && (
            <div className="linha" style={{ marginTop: 6 }}>
              {problema.abaixo > 0 && (
                <button className="pequeno" onClick={() => p.onQuotas(problema.abaixo)}>
                  Usar {agruparMilhares(problema.abaixo)} quotas ({pct(problema.abaixo)})
                </button>
              )}
              <button className="pequeno" onClick={() => p.onQuotas(problema.acima)}>
                Usar {agruparMilhares(problema.acima)} quotas ({pct(problema.acima)})
              </button>
            </div>
          )}
          <div style={{ marginTop: 4 }}>Ou ajuste o capital social ou o valor unitário da quota.</div>
        </div>
      )}
    </div>
  );
}

function EditorClasse(p: { classe: ClasseQuota; onChange: (c: ClasseQuota) => void; onRemover: () => void; valorPadrao: number }) {
  const c = p.classe;
  const mudar = (x: Partial<ClasseQuota>) => p.onChange({ ...c, ...x });
  return (
    <fieldset>
      <legend>{c.nome || 'Classe sem nome'}</legend>
      <div className="grade">
        <CampoTexto rotulo="Nome da classe" valor={c.nome} onChange={(v) => mudar({ nome: v })} />
        <CampoSelecao
          rotulo="Direito a voto"
          valor={c.voto}
          onChange={(v) => mudar({ voto: v })}
          opcoes={[
            { valor: 'pleno', rotulo: 'Voto pleno' },
            { valor: 'restrito', rotulo: 'Voto restrito (só em algumas matérias)' },
            { valor: 'sem_voto', rotulo: 'Sem direito a voto' },
          ]}
        />
      </div>
      {c.voto === 'restrito' && (
        <CampoAreaTexto rotulo="Em quais matérias há voto?" valor={c.voto_materias} onChange={(v) => mudar({ voto_materias: v })} linhas={2} />
      )}
      <CampoMarcar rotulo="Tem preferência na distribuição de lucros" valor={c.preferencia_lucros} onChange={(v) => mudar({ preferencia_lucros: v })} />
      {c.preferencia_lucros && (
        <div className="grade">
          <CampoSelecao
            rotulo="Tipo de preferência"
            valor={c.preferencia_tipo}
            onChange={(v) => mudar({ preferencia_tipo: v })}
            opcoes={[
              { valor: 'prioritaria', rotulo: 'Prioritária' },
              { valor: 'fixa', rotulo: 'Fixa' },
              { valor: 'minima', rotulo: 'Mínima' },
            ]}
          />
          <CampoTexto rotulo="Descrição da preferência" valor={c.preferencia_descricao} onChange={(v) => mudar({ preferencia_descricao: v })} />
        </div>
      )}
      <CampoMarcar rotulo="Tem prioridade no reembolso do capital em caso de liquidação" valor={c.prioridade_reembolso} onChange={(v) => mudar({ prioridade_reembolso: v })} />
      <CampoMarcar rotulo="Elege administrador(es) em separado" valor={c.elege_administrador} onChange={(v) => mudar({ elege_administrador: v })} />
      <CampoMarcar
        rotulo={`Valor unitário diferente do padrão (${formatarMoeda(p.valorPadrao)})`}
        valor={c.valor_quota_centavos !== null}
        onChange={(v) => mudar({ valor_quota_centavos: v ? p.valorPadrao : null })}
      />
      {c.valor_quota_centavos !== null && (
        <div style={{ maxWidth: 260 }}>
          <CampoMoeda rotulo="Valor unitário desta classe" valor={c.valor_quota_centavos} onChange={(v) => mudar({ valor_quota_centavos: v })} />
        </div>
      )}
      <div className="linha fim">
        <button className="perigo pequeno" onClick={p.onRemover}>
          Remover classe
        </button>
      </div>
    </fieldset>
  );
}

export function EditorQuotas(p: { dados: DadosEmpresa; onChange: (parcial: Partial<DadosEmpresa>) => void; erros: string[] }) {
  const d = p.dados;
  const [modoEntrada, setModoEntrada] = useState<ModoEntrada>('quotas');
  const mudar = (x: Partial<DadosEmpresa>) => p.onChange(x);

  const escolherModo = (m: ModoQuotas) => {
    if (m === d.quotas.modo) return;
    const temParticipacao = d.participacoes.some((x) => Object.values(x.quotas).some((q) => q > 0));
    if (temParticipacao && !window.confirm('Mudar o funcionamento das quotas apaga as participações já informadas. Continuar?')) return;
    const classes = m === 'classes' && d.quotas.classes.length === 0 ? [novaClasse('Classe A'), novaClasse('Classe B')] : d.quotas.classes;
    mudar({ quotas: { modo: m, classes }, participacoes: d.participacoes.map((x) => ({ ...x, quotas: {} })) });
  };

  const lista = socios(d);
  const classes = classesEfetivas(d);
  const esperado = totalQuotasEsperado(d);
  const subscrito = valorTotalSubscrito(d);

  const definirQuotas = (part: Participacao, classeId: string, q: number) => {
    mudar({
      participacoes: d.participacoes.map((x) => (x.pessoa_id === part.pessoa_id ? { ...x, quotas: { ...x.quotas, [classeId]: q } } : x)),
    });
  };

  const letra = String.fromCharCode(65 + d.quotas.classes.length);

  return (
    <div>
      <h3>1. Como funcionam as quotas?</h3>
      <div className="cartoes-opcao">
        {(
          [
            { v: 'unica', t: 'Classe única (quotas ordinárias)', s: 'Todas as quotas têm os mesmos direitos. É o padrão dos modelos.' },
            { v: 'classes', t: 'Classes distintas', s: 'Quotas com direitos diferentes (voto, lucros, reembolso).' },
          ] as const
        ).map((o) => (
          <label key={o.v} className={d.quotas.modo === o.v ? 'marcado' : ''}>
            <input type="radio" name="modo-quotas" checked={d.quotas.modo === o.v} onChange={() => escolherModo(o.v)} />
            <strong>{o.t}</strong>
            <div className="suave pequeno">{o.s}</div>
          </label>
        ))}
      </div>
      {!d.quotas.modo && <Alerta tipo="info">Escolha uma das opções acima para preencher o capital.</Alerta>}

      {d.quotas.modo && (
        <>
          {d.quotas.modo === 'classes' && <Alerta tipo="aviso">{AVISO_CLASSES}</Alerta>}
          <h3>2. Capital social</h3>
          <div className="grade">
            <CampoMoeda rotulo="Capital social" valor={d.capital.valor_centavos} onChange={(v) => mudar({ capital: { ...d.capital, valor_centavos: v } })} />
            <CampoMoeda
              rotulo="Valor unitário da quota"
              dica={d.quotas.modo === 'classes' ? 'Padrão para as classes' : undefined}
              valor={d.capital.valor_quota_centavos}
              onChange={(v) => mudar({ capital: { ...d.capital, valor_quota_centavos: v } })}
            />
            <div className="campo">
              <span className="suave pequeno">Total de quotas</span>
              <strong style={{ fontSize: '1.2rem' }}>
                {esperado !== null ? `${agruparMilhares(esperado)} quotas` : d.quotas.modo === 'classes' ? 'conforme as classes' : '—'}
              </strong>
            </div>
          </div>

          {d.quotas.modo === 'classes' && (
            <>
              <h3>3. Classes de quotas</h3>
              {d.quotas.classes.map((c) => (
                <EditorClasse
                  key={c.id}
                  classe={c}
                  valorPadrao={d.capital.valor_quota_centavos}
                  onChange={(nc) => mudar({ quotas: { ...d.quotas, classes: d.quotas.classes.map((x) => (x.id === c.id ? nc : x)) } })}
                  onRemover={() => {
                    if (!window.confirm(`Remover a classe "${c.nome}"? As quotas dos sócios nesta classe serão apagadas.`)) return;
                    mudar({
                      quotas: { ...d.quotas, classes: d.quotas.classes.filter((x) => x.id !== c.id) },
                      participacoes: d.participacoes.map((x) => {
                        const q = { ...x.quotas };
                        delete q[c.id];
                        return { ...x, quotas: q };
                      }),
                    });
                  }}
                />
              ))}
              <button onClick={() => mudar({ quotas: { ...d.quotas, classes: [...d.quotas.classes, novaClasse(`Classe ${letra}`)] } })}>
                + Adicionar classe
              </button>
            </>
          )}

          <h3>{d.quotas.modo === 'classes' ? '4' : '3'}. Participação de cada sócio</h3>
          {lista.length === 0 ? (
            <Alerta tipo="info">Cadastre os sócios na seção “Sócios” para informar a participação de cada um.</Alerta>
          ) : (
            <>
              <div className="linha" style={{ marginBottom: '0.5rem' }}>
                <span>Informar a participação em:</span>
                {(
                  [
                    ['quotas', 'Quotas'],
                    ['valor', 'Valor (R$)'],
                    ['percentual', 'Percentual (%)'],
                  ] as const
                ).map(([v, t]) => (
                  <label key={v} className="opcao">
                    <input type="radio" name="modo-entrada" checked={modoEntrada === v} onChange={() => setModoEntrada(v)} />
                    {t}
                  </label>
                ))}
              </div>
              <table className="lista">
                <thead>
                  <tr>
                    <th>Sócio</th>
                    {classes.map((c) => (
                      <th key={c.id} className="num">
                        {d.quotas.modo === 'classes' ? c.nome : ''} {modoEntrada === 'quotas' ? '(quotas)' : modoEntrada === 'valor' ? '(R$)' : '(%)'}
                      </th>
                    ))}
                    <th className="num">Quotas</th>
                    <th className="num">Valor</th>
                    <th className="num">%</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(({ pessoa, participacao }) => (
                    <tr key={pessoa.id}>
                      <td>{pessoa.nome || <span className="suave">(sem nome)</span>}</td>
                      {classes.map((c) => (
                        <td key={c.id} style={{ minWidth: 150 }}>
                          <Celula
                            rotulo={`Participação de ${pessoa.nome} ${c.id === CLASSE_UNICA ? '' : c.nome}`}
                            quotas={participacao.quotas[c.id] ?? 0}
                            modo={modoEntrada}
                            valorQuota={valorQuotaDaClasse(d, c)}
                            capital={d.capital.valor_centavos}
                            onQuotas={(q) => definirQuotas(participacao, c.id, q)}
                          />
                        </td>
                      ))}
                      <td className="num">{agruparMilhares(totalQuotasDoSocio(d, participacao))}</td>
                      <td className="num">{formatarMoeda(valorDoSocio(d, participacao))}</td>
                      <td className="num">{formatarPercentualCentesimos(percentualCentesimos(valorDoSocio(d, participacao), d.capital.valor_centavos))}%</td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <strong>Total</strong>
                    </td>
                    {classes.map((c) => (
                      <td key={c.id} className="num">
                        {d.quotas.modo === 'classes' ? `${agruparMilhares(totalQuotasDaClasse(d, c.id))} quotas` : ''}
                      </td>
                    ))}
                    <td className="num">
                      <strong>{agruparMilhares(totalQuotasSubscritas(d))}</strong>
                    </td>
                    <td className="num">
                      <strong>{formatarMoeda(subscrito)}</strong>
                    </td>
                    <td className="num">
                      <strong>{formatarPercentualCentesimos(percentualCentesimos(subscrito, d.capital.valor_centavos))}%</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
              {subscrito === d.capital.valor_centavos && d.capital.valor_centavos > 0 && (
                <Alerta tipo="ok">A soma das participações confere com o capital social.</Alerta>
              )}
            </>
          )}
          {p.erros.length > 0 && (
            <Alerta tipo="erro">
              <ul>
                {p.erros.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alerta>
          )}
        </>
      )}
    </div>
  );
}
