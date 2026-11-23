// Seções do formulário próprias de atos sobre empresa já registrada:
// movimentação de quotas (alteração), numeração do contrato vigente e distrato.

import { useState } from 'react';
import type { Ato, DadosEmpresa, MovimentoQuotas, Pessoa } from '../../dados/tipos';
import { CLASSE_UNICA } from '../../dados/tipos';
import { novaPessoa, distratoVazio } from '../../dados/fabricas';
import { aplicarMovimentos, ingressantes, retirantes } from '../../dados/movimentos';
import { buscarPessoa, classesEfetivas, socios, totalQuotasDoSocio } from '../../dados/quotas';
import { agruparMilhares, formatarMoeda } from '../../lib/dinheiro';
import { novoId } from '../../lib/texto';
import { Alerta, CampoAreaTexto, CampoData, CampoMoeda, CampoSelecao, CampoTexto, OpcoesRadio, Rotulo } from './Campos';

const TIPOS_MOV: { valor: MovimentoQuotas['tipo']; rotulo: string }[] = [
  { valor: 'aumento', rotulo: 'Aumento de capital (novas quotas)' },
  { valor: 'cessao', rotulo: 'Cessão / transferência de quotas' },
  { valor: 'reducao', rotulo: 'Redução de capital' },
];

const NOVA = '__nova_pessoa__';

/** Pessoas que podem aparecer nos movimentos: sócios de antes + pessoas novas já criadas. */
function pessoasDisponiveis(antes: DadosEmpresa, depois: DadosEmpresa): Pessoa[] {
  const ids = [...antes.participacoes.map((p) => p.pessoa_id)];
  for (const p of depois.pessoas) if (!ids.includes(p.id) && !antes.pessoas.some((x) => x.id === p.id)) ids.push(p.id);
  return ids.map((id) => buscarPessoa(depois, id) ?? buscarPessoa(antes, id)).filter((p): p is Pessoa => !!p);
}

export function EditorMovimentos(p: { ato: Ato; alterar: (fn: (a: Ato) => Ato) => void; erros: string[] }) {
  const antes = p.ato.dados_antes!;
  const depois = p.ato.dados_depois;
  const movs = p.ato.movimentos;
  const pessoas = pessoasDisponiveis(antes, depois);
  const classes = classesEfetivas(depois);
  const [novoTipo, setNovoTipo] = useState<MovimentoQuotas['tipo']>('aumento');

  const recalcular = (a: Ato): Ato => ({ ...a, dados_depois: aplicarMovimentos(a.dados_antes!, a.dados_depois, a.movimentos).dados });
  const mudarMovs = (fn: (m: MovimentoQuotas[]) => MovimentoQuotas[]) => p.alterar((a) => recalcular({ ...a, movimentos: fn(a.movimentos) }));
  const mudar = (id: string, parcial: Partial<MovimentoQuotas>) =>
    mudarMovs((ms) => ms.map((m) => (m.id === id ? ({ ...m, ...parcial } as MovimentoQuotas) : m)));

  /** Cria uma pessoa nova (sócio que entra) e devolve o id. */
  const criarPessoa = (): string => {
    const nova = novaPessoa();
    p.alterar((a) => ({ ...a, dados_depois: { ...a.dados_depois, pessoas: [...a.dados_depois.pessoas, nova] } }));
    return nova.id;
  };

  const adicionar = () => {
    const classe = classes[0]?.id ?? CLASSE_UNICA;
    const id = novoId();
    const m: MovimentoQuotas =
      novoTipo === 'cessao'
        ? { id, tipo: 'cessao', cedente_id: '', cessionario_id: '', classe_id: classe, quotas: 0, preco_centavos: 0 }
        : { id, tipo: novoTipo, socio_id: '', classe_id: classe, quotas: 0 };
    mudarMovs((ms) => [...ms, m]);
  };

  const seletorPessoa = (rotulo: string, valor: string, onChange: (id: string) => void, permitirNova: boolean, apenasSocios = false) => {
    const opcoes = (apenasSocios ? pessoas.filter((x) => antes.participacoes.some((pp) => pp.pessoa_id === x.id) || depois.participacoes.some((pp) => pp.pessoa_id === x.id)) : pessoas).map(
      (x) => ({ valor: x.id, rotulo: x.nome || '(pessoa nova, sem nome)' }),
    );
    return (
      <CampoSelecao
        rotulo={rotulo}
        vazio="Escolha…"
        valor={valor}
        onChange={(v) => onChange(v === NOVA ? criarPessoa() : v)}
        opcoes={permitirNova ? [...opcoes, { valor: NOVA, rotulo: '+ Pessoa nova (sócio que entra)' }] : opcoes}
      />
    );
  };

  const entram = ingressantes(antes, depois);
  const saem = retirantes(antes, depois);
  const listaAntes = socios(antes);
  const listaDepois = socios(depois);
  const todosIds = [...new Set([...listaAntes.map((s) => s.pessoa.id), ...listaDepois.map((s) => s.pessoa.id)])];

  return (
    <div>
      <p className="suave">
        O novo quadro de sócios é calculado a partir do quadro atual e destes movimentos. Para incluir um sócio, escolha “+ Pessoa nova” no aumento ou na cessão; os
        dados dele aparecem depois na seção “Sócios”. Quem ceder todas as quotas sai da sociedade.
      </p>
      {movs.length === 0 && <p className="suave">Nenhum movimento de quotas. Se o capital e os sócios não mudam, deixe vazio.</p>}
      {movs.map((m, i) => (
        <fieldset key={m.id}>
          <legend>
            {i + 1}. {TIPOS_MOV.find((t) => t.valor === m.tipo)?.rotulo}
          </legend>
          <div className="grade">
            {m.tipo === 'cessao' ? (
              <>
                {seletorPessoa('Quem cede (sócio atual)', m.cedente_id, (v) => mudar(m.id, { cedente_id: v }), false, true)}
                {seletorPessoa('Quem recebe', m.cessionario_id, (v) => mudar(m.id, { cessionario_id: v }), true)}
              </>
            ) : (
              seletorPessoa(m.tipo === 'aumento' ? 'Quem subscreve as novas quotas' : 'De quem são as quotas reduzidas', m.socio_id, (v) => mudar(m.id, { socio_id: v }), m.tipo === 'aumento', m.tipo === 'reducao')
            )}
            <Rotulo rotulo="Quantidade de quotas">
              <input
                type="number"
                min={1}
                step={1}
                value={m.quotas || ''}
                aria-label={`Quantidade de quotas do movimento ${i + 1}`}
                onChange={(e) => mudar(m.id, { quotas: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              />
            </Rotulo>
            {classes.length > 1 && (
              <CampoSelecao rotulo="Classe" valor={m.classe_id} onChange={(v) => mudar(m.id, { classe_id: v })} opcoes={classes.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
            )}
            {m.tipo === 'cessao' && (
              <CampoMoeda rotulo="Preço da cessão (opcional)" dica="Vazio = o contrato não cita preço" valor={m.preco_centavos} onChange={(v) => mudar(m.id, { preco_centavos: v })} />
            )}
          </div>
          <div className="linha fim">
            <button className="perigo pequeno" onClick={() => mudarMovs((ms) => ms.filter((x) => x.id !== m.id))}>
              Remover movimento
            </button>
          </div>
        </fieldset>
      ))}
      <div className="linha">
        <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as MovimentoQuotas['tipo'])} style={{ width: 'auto' }} aria-label="Tipo de movimento">
          {TIPOS_MOV.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </select>
        <button onClick={adicionar}>+ Adicionar movimento</button>
      </div>
      {p.erros.length > 0 && (
        <Alerta tipo="erro">
          <ul>
            {p.erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Alerta>
      )}
      <h3>Quadro de sócios: antes e depois</h3>
      <table className="lista">
        <thead>
          <tr>
            <th>Sócio</th>
            <th className="num">Quotas antes</th>
            <th className="num">Quotas depois</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {todosIds.map((id) => {
            const pessoa = buscarPessoa(depois, id) ?? buscarPessoa(antes, id);
            const a = totalQuotasDoSocio(antes, antes.participacoes.find((x) => x.pessoa_id === id));
            const d = totalQuotasDoSocio(depois, depois.participacoes.find((x) => x.pessoa_id === id));
            return (
              <tr key={id}>
                <td>{pessoa?.nome || '(pessoa nova, sem nome)'}</td>
                <td className="num">{a ? agruparMilhares(a) : '—'}</td>
                <td className="num">{d ? agruparMilhares(d) : '—'}</td>
                <td>
                  {entram.includes(id) && <span className="etiqueta verde">entra</span>}
                  {saem.includes(id) && <span className="etiqueta vermelha">sai</span>}
                </td>
              </tr>
            );
          })}
          <tr>
            <td>
              <strong>Capital social</strong>
            </td>
            <td className="num">{formatarMoeda(antes.capital.valor_centavos)}</td>
            <td className="num">
              <strong>{formatarMoeda(depois.capital.valor_centavos)}</strong>
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Resumo (somente leitura) do capital na alteração: o quadro vem dos movimentos. */
export function ResumoCapitalAlteracao({ d }: { d: DadosEmpresa }) {
  return (
    <Alerta tipo="info">
      Capital social: <strong>{formatarMoeda(d.capital.valor_centavos)}</strong>, em quotas de {formatarMoeda(d.capital.valor_quota_centavos)}. Numa alteração, o capital e o
      quadro de sócios mudam pela <strong>movimentação de quotas</strong> (seção “Alteração”, abaixo).
    </Alerta>
  );
}

export function SecaoNumeracao(p: { ato: Ato; alterar: (fn: (a: Ato) => Ato) => void; citadas: string[]; titulo: (id: string) => string }) {
  const num = p.ato.dados_antes?.numeracao_clausulas ?? {};
  return (
    <div>
      <p className="suave">
        As cláusulas de alteração citam o número da cláusula no contrato vigente (ex.: “Cláusula Segunda”). Quando o contrato vigente foi gerado pelo Calango, os números já
        vêm preenchidos; para empresas antigas, confira no último contrato registrado.
      </p>
      <div className="grade">
        {p.citadas.map((id) => (
          <Rotulo key={id} rotulo={`Nº da cláusula “${p.titulo(id)}”`} erro={!num[id] ? 'Informe o número.' : undefined}>
            <input
              type="number"
              min={1}
              value={num[id] || ''}
              aria-label={`Número da cláusula ${p.titulo(id)} no contrato vigente`}
              onChange={(e) => {
                const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                p.alterar((a) => ({
                  ...a,
                  dados_antes: a.dados_antes ? { ...a.dados_antes, numeracao_clausulas: { ...a.dados_antes.numeracao_clausulas, [id]: n } } : a.dados_antes,
                }));
              }}
            />
          </Rotulo>
        ))}
      </div>
    </div>
  );
}

export function CampoMotivoReducao(p: { ato: Ato; alterar: (fn: (a: Ato) => Ato) => void; erro?: string }) {
  if (!p.ato.movimentos.some((m) => m.tipo === 'reducao')) return null;
  return (
    <CampoTexto
      largo
      rotulo="Motivo da redução do capital"
      dica="Ex.: por ser excessivo em relação ao objeto da sociedade"
      valor={p.ato.extras.motivo_reducao ?? ''}
      onChange={(v) => p.alterar((a) => ({ ...a, extras: { ...a.extras, motivo_reducao: v } }))}
      erro={p.erro}
    />
  );
}

export function SecaoDistrato(p: { ato: Ato; alterar: (fn: (a: Ato) => Ato) => void; campos: Set<string>; erro: (campo: string) => string | undefined }) {
  const d = p.ato.distrato ?? distratoVazio();
  const mudar = (parcial: Partial<typeof d>) => p.alterar((a) => ({ ...a, distrato: { ...(a.distrato ?? distratoVazio()), ...parcial } }));
  const lista = socios(p.ato.dados_depois).map((s) => ({ valor: s.pessoa.id, rotulo: s.pessoa.nome || '(sem nome)' }));
  return (
    <div>
      <div className="grade">
        {p.campos.has('distrato.data_encerramento') && (
          <CampoData rotulo="Data de encerramento das atividades" valor={d.data_encerramento} onChange={(v) => mudar({ data_encerramento: v })} erro={p.erro('distrato.data_encerramento')} />
        )}
        {p.campos.has('distrato.responsaveis') && (
          <>
            <CampoSelecao
              rotulo="Responsável pelo ativo e passivo supervenientes"
              vazio="Escolha…"
              valor={d.responsavel_ativo_passivo_id}
              onChange={(v) => mudar({ responsavel_ativo_passivo_id: v })}
              opcoes={lista}
              erro={!d.responsavel_ativo_passivo_id ? p.erro('distrato.responsaveis') : undefined}
            />
            <CampoSelecao
              rotulo="Responsável pela guarda dos livros e documentos"
              vazio="Escolha…"
              valor={d.responsavel_livros_id}
              onChange={(v) => mudar({ responsavel_livros_id: v })}
              opcoes={lista}
              erro={!d.responsavel_livros_id ? p.erro('distrato.responsaveis') : undefined}
            />
          </>
        )}
      </div>
      {p.campos.has('distrato.liquidacao') && (
        <>
          <h3>Liquidação</h3>
          <OpcoesRadio
            nome="liquidacao"
            valor={d.liquidacao}
            onChange={(v) => mudar({ liquidacao: v })}
            opcoes={[
              { valor: 'sem_haveres', rotulo: 'Não há bens a restituir nem haveres a receber' },
              { valor: 'partilha', rotulo: 'Há saldo/haveres a partilhar' },
            ]}
          />
          {d.liquidacao === 'partilha' && (
            <CampoAreaTexto
              rotulo="Como os haveres são partilhados"
              dica="Ex.: o saldo de R$ 2.000,00 em conta corrente é dividido igualmente entre os sócios (sem ponto final)"
              valor={d.partilha_descricao}
              onChange={(v) => mudar({ partilha_descricao: v })}
              erro={p.erro('distrato.liquidacao')}
            />
          )}
        </>
      )}
    </div>
  );
}
