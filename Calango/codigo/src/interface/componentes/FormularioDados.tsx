// Formulário montado automaticamente: mostra só os campos pedidos (os
// exigidos pelas cláusulas escolhidas), sem repetir, agrupados em seções.

import { useRef, useState } from 'react';
import type { DadosEmpresa, OpcoesAto, Pessoa } from '../../dados/tipos';
import { SECOES } from '../../dados/campos';
import type { Pendencia } from '../../dados/validacao';
import { novaPessoa } from '../../dados/fabricas';
import { socios } from '../../dados/quotas';
import { cnaeValido, formatarCNAE, formatarCNPJ } from '../../dados/documentos';
import { Alerta, CampoAreaTexto, CampoData, CampoMarcar, CampoNumero, CampoSelecao, CampoTexto, CampoUF, CamposEndereco, OpcoesRadio, Rotulo } from './Campos';
import { PessoaForm } from './PessoaForm';
import { EditorQuotas } from './EditorQuotas';

interface Props {
  dados: DadosEmpresa;
  onChange: (d: DadosEmpresa) => void;
  campos: Set<string>;
  pendencias: Pendencia[];
  opcoesAto?: OpcoesAto;
  /** Recebe só a parte alterada das opções do ato. */
  onChangeOpcoes?: (parcial: Partial<OpcoesAto>) => void;
}

function mmddParaBR(mmdd: string) {
  const m = /^(\d{2})-(\d{2})$/.exec(mmdd);
  return m ? `${m[2]}/${m[1]}` : '';
}
function brParaMMDD(br: string) {
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(br.trim());
  return m ? `${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : br;
}

function CartaoPessoa(p: {
  pessoa: Pessoa;
  titulo: string;
  aberto: boolean;
  alternar: () => void;
  onChange: (atualizar: (x: Pessoa) => Pessoa) => void;
  onRemover?: () => void;
  campos: Set<string>;
  erro: (campo: string) => string | undefined;
  qtdErros: number;
}) {
  return (
    <div className="cartao-pessoa">
      <div className="cabeca" onClick={p.alternar} role="button" aria-expanded={p.aberto}>
        <span>{p.aberto ? '▾' : '▸'}</span>
        <strong className="espaco">{p.pessoa.nome || '(sem nome)'}</strong>
        <span className="suave pequeno">{p.titulo}</span>
        {p.qtdErros > 0 ? <span className="etiqueta vermelha">{p.qtdErros} pendência(s)</span> : <span className="etiqueta verde">completo</span>}
      </div>
      {p.aberto && (
        <div className="corpo">
          <PessoaForm pessoa={p.pessoa} onChange={p.onChange} campos={p.campos} erro={p.erro} />
          {p.onRemover && (
            <div className="linha fim" style={{ marginTop: '0.75rem' }}>
              <button className="perigo" onClick={p.onRemover}>
                Remover
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FormularioDados({ dados: d, onChange, campos, pendencias, opcoesAto, onChangeOpcoes }: Props) {
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(d.pessoas.length <= 1 ? d.pessoas.map((p) => p.id) : []));
  const tem = (c: string) => campos.has(c);
  // Valor mais recente (inclui mudanças ainda não redesenhadas), para que duas
  // alterações seguidas nunca apaguem uma à outra.
  const atual = useRef(d);
  atual.current = d;
  const mudar = (x: Partial<DadosEmpresa>) => {
    const novo = { ...atual.current, ...x };
    atual.current = novo;
    onChange(novo);
  };
  const erro = (campo: string, pessoaId?: string) =>
    pendencias.find((p) => p.nivel === 'erro' && p.campo === campo && (pessoaId === undefined || p.pessoaId === pessoaId))?.mensagem;
  const camposPessoa = new Set([...campos].filter((c) => c.startsWith('pessoa.')));
  const alternar = (id: string) =>
    setAbertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const atualizarPessoa = (id: string) => (fn: (x: Pessoa) => Pessoa) => mudar({ pessoas: atual.current.pessoas.map((p) => (p.id === id ? fn(p) : p)) });

  const secoesVisiveis = SECOES.filter((s) => {
    if (s.id === 'socios') return tem('socios') || camposPessoa.size > 0;
    if (s.id === 'fechamento') return tem('fechamento.foro') || tem('fechamento.exercicio') || (tem('fechamento.local_data') && !!opcoesAto);
    const prefixo = s.id === 'empresa' ? 'empresa.' : `${s.id}.`;
    return [...campos].some((c) => c.startsWith(prefixo));
  });

  const pendSecao = (s: string) => pendencias.filter((p) => p.secao === s);

  const listaSocios = socios(d);
  const adicionarSocio = () => {
    const p = novaPessoa();
    mudar({ pessoas: [...atual.current.pessoas, p], participacoes: [...atual.current.participacoes, { pessoa_id: p.id, quotas: {} }] });
    setAbertos((s) => new Set([...s, p.id]));
  };
  const removerPessoa = (id: string, nome: string) => {
    if (!window.confirm(`Remover ${nome || 'esta pessoa'}? Ela também sai da administração, do pró-labore e do quadro de quotas.`)) return;
    const d = atual.current;
    mudar({
      pessoas: d.pessoas.filter((p) => p.id !== id),
      participacoes: d.participacoes.filter((p) => p.pessoa_id !== id),
      administracao: { ...atual.current.administracao, administradores: d.administracao.administradores.filter((x) => x !== id) },
      pro_labore: d.pro_labore.filter((x) => x !== id),
    });
  };
  const naoSocios = d.administracao.administradores.map((id) => d.pessoas.find((p) => p.id === id)).filter((p): p is Pessoa => !!p && !d.participacoes.some((x) => x.pessoa_id === p.id));
  const alternarAdm = (id: string, v: boolean) =>
    mudar({
      administracao: {
        ...d.administracao,
        administradores: v
          ? [...atual.current.administracao.administradores.filter((x) => x !== id), id]
          : atual.current.administracao.administradores.filter((x) => x !== id),
      },
    });

  return (
    <div>
      {secoesVisiveis.length === 0 && <p className="suave">As cláusulas escolhidas não pedem nenhum dado.</p>}
      {secoesVisiveis.map((s) => {
        const pend = pendSecao(s.id);
        const qtdErros = pend.filter((p) => p.nivel === 'erro').length;
        return (
          <section key={s.id} className="painel" id={`secao-${s.id}`}>
            <div className="entre">
              <h2>{s.nome}</h2>
              {qtdErros > 0 ? <span className="etiqueta vermelha">{qtdErros} pendência(s)</span> : <span className="etiqueta verde">ok</span>}
            </div>

            {s.id === 'empresa' && (
              <>
                <div className="grade">
                  {tem('empresa.razao_social') && (
                    <CampoTexto largo rotulo="Razão social" dica='Completa, com "LTDA" no final' valor={d.razao_social} maiusculas onChange={(v) => mudar({ razao_social: v })} erro={erro('empresa.razao_social')} />
                  )}
                  {tem('empresa.cnpj') && <CampoTexto rotulo="CNPJ" valor={d.cnpj} onChange={(v) => mudar({ cnpj: v })} onBlur={(v) => mudar({ cnpj: formatarCNPJ(v) })} erro={erro('empresa.cnpj')} />}
                  {tem('empresa.nire') && <CampoTexto rotulo="NIRE" valor={d.nire} onChange={(v) => mudar({ nire: v })} erro={erro('empresa.nire')} />}
                  {tem('empresa.data_registro') && <CampoData rotulo="Data do registro na Junta" valor={d.data_registro} onChange={(v) => mudar({ data_registro: v })} erro={erro('empresa.data_registro')} />}
                  {tem('empresa.junta_uf') && <CampoUF rotulo="Junta Comercial (UF)" valor={d.junta_uf} onChange={(v) => mudar({ junta_uf: v })} erro={erro('empresa.junta_uf')} />}
                  {tem('empresa.numero_ultima_alteracao') && (
                    <CampoNumero rotulo="Número da última alteração registrada" dica="0 = nenhuma alteração ainda" valor={d.numero_ultima_alteracao} min={0} onChange={(v) => mudar({ numero_ultima_alteracao: Math.max(0, Math.floor(v)) })} />
                  )}
                  {tem('empresa.data_inicio_atividades') && (
                    <CampoData rotulo="Início das atividades" valor={d.data_inicio_atividades} onChange={(v) => mudar({ data_inicio_atividades: v })} erro={erro('empresa.data_inicio_atividades')} />
                  )}
                  {tem('empresa.prazo') && (
                    <Rotulo rotulo="Prazo de duração" erro={erro('empresa.prazo')}>
                      <OpcoesRadio
                        nome="prazo"
                        valor={d.prazo.tipo}
                        onChange={(v) => mudar({ prazo: { ...atual.current.prazo, tipo: v } })}
                        opcoes={[
                          { valor: 'indeterminado', rotulo: 'Indeterminado' },
                          { valor: 'determinado', rotulo: 'Até uma data' },
                        ]}
                      />
                      {d.prazo.tipo === 'determinado' && <input type="date" value={d.prazo.data} onChange={(e) => mudar({ prazo: { ...atual.current.prazo, data: e.target.value } })} />}
                    </Rotulo>
                  )}
                  {tem('empresa.enquadramento') && (
                    <CampoSelecao
                      rotulo="Enquadramento"
                      vazio="Escolha…"
                      valor={d.enquadramento}
                      onChange={(v) => mudar({ enquadramento: v })}
                      opcoes={[
                        { valor: 'ME', rotulo: 'Microempresa (ME)' },
                        { valor: 'EPP', rotulo: 'Empresa de Pequeno Porte (EPP)' },
                        { valor: 'nenhum', rotulo: 'Nenhum (não declarar)' },
                      ]}
                      erro={erro('empresa.enquadramento')}
                    />
                  )}
                </div>
                {tem('empresa.sede') && (
                  <>
                    <h3>Endereço da sede</h3>
                    <CamposEndereco
                      valor={d.sede}
                      onChange={(e) => {
                        const sede = { ...atual.current.sede, ...e };
                        mudar({ sede, junta_uf: atual.current.junta_uf || sede.uf });
                      }}
                      erro={erro('empresa.sede')}
                    />
                  </>
                )}
                {tem('empresa.objeto_social') && (
                  <>
                    <h3>Objeto social</h3>
                    <OpcoesRadio
                      nome="objeto-forma"
                      valor={d.objeto_social.forma}
                      onChange={(v) => mudar({ objeto_social: { ...atual.current.objeto_social, forma: v } })}
                      opcoes={[
                        { valor: 'texto', rotulo: 'Texto corrido' },
                        { valor: 'lista', rotulo: 'Lista de itens (vira alíneas a, b, c...)' },
                      ]}
                    />
                    {d.objeto_social.forma === 'texto' ? (
                      <CampoAreaTexto rotulo="Descrição do objeto social" dica="Sem ponto final (o contrato já coloca)" valor={d.objeto_social.texto} onChange={(v) => mudar({ objeto_social: { ...atual.current.objeto_social, texto: v } })} linhas={4} erro={erro('empresa.objeto_social')} />
                    ) : (
                      <CampoAreaTexto
                        rotulo="Itens do objeto social"
                        dica="Um item por linha, sem ponto e vírgula no final (o contrato coloca)"
                        valor={d.objeto_social.itens.join('\n')}
                        onChange={(v) => mudar({ objeto_social: { ...atual.current.objeto_social, itens: v.split('\n') } })}
                        linhas={6}
                        erro={erro('empresa.objeto_social')}
                      />
                    )}
                  </>
                )}
                {tem('empresa.cnaes') && (
                  <>
                    <h3>CNAEs</h3>
                    <table className="lista">
                      <thead>
                        <tr>
                          <th style={{ width: 170 }}>Código</th>
                          <th>Descrição</th>
                          <th style={{ width: 120 }}>Principal?</th>
                          <th style={{ width: 90 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.cnaes.map((c, i) => (
                          <tr key={i}>
                            <td>
                              <input
                                type="text"
                                aria-label={`Código do CNAE ${i + 1}`}
                                value={c.codigo}
                                placeholder="00.00-0-00"
                                className={c.codigo && !cnaeValido(c.codigo) ? 'invalido' : undefined}
                                onChange={(e) => mudar({ cnaes: atual.current.cnaes.map((x, j) => (j === i ? { ...x, codigo: e.target.value } : x)) })}
                                onBlur={(e) => {
                                  const v = e.target.value;
                                  mudar({ cnaes: atual.current.cnaes.map((x, j) => (j === i ? { ...x, codigo: formatarCNAE(v) } : x)) });
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                aria-label={`Descrição do CNAE ${i + 1}`}
                                value={c.descricao}
                                onChange={(e) => mudar({ cnaes: atual.current.cnaes.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)) })}
                              />
                            </td>
                            <td>
                              <label className="opcao">
                                <input
                                  type="radio"
                                  name="cnae-principal"
                                  checked={c.tipo === 'principal'}
                                  onChange={() => mudar({ cnaes: atual.current.cnaes.map((x, j) => ({ ...x, tipo: j === i ? 'principal' : 'secundario' })) })}
                                />
                                Principal
                              </label>
                            </td>
                            <td>
                              <button className="pequeno perigo" onClick={() => mudar({ cnaes: atual.current.cnaes.filter((_, j) => j !== i) })}>
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button style={{ marginTop: 8 }} onClick={() => mudar({ cnaes: [...atual.current.cnaes, { codigo: '', descricao: '', tipo: atual.current.cnaes.some((c) => c.tipo === 'principal') ? 'secundario' : 'principal' }] })}>
                      + Adicionar CNAE
                    </button>
                    {erro('empresa.cnaes') && <div className="erro-campo">{erro('empresa.cnaes')}</div>}
                  </>
                )}
              </>
            )}

            {s.id === 'socios' && (
              <>
                {listaSocios.length === 0 && <p className="suave">Nenhum sócio cadastrado ainda.</p>}
                {listaSocios.map(({ pessoa }, i) => (
                  <CartaoPessoa
                    key={pessoa.id}
                    pessoa={pessoa}
                    titulo={`Sócio ${i + 1}`}
                    aberto={abertos.has(pessoa.id)}
                    alternar={() => alternar(pessoa.id)}
                    onChange={atualizarPessoa(pessoa.id)}
                    onRemover={() => removerPessoa(pessoa.id, pessoa.nome)}
                    campos={camposPessoa}
                    erro={(c) => erro(c, pessoa.id)}
                    qtdErros={pendencias.filter((p) => p.pessoaId === pessoa.id && p.nivel === 'erro').length}
                  />
                ))}
                <button className="primario" onClick={adicionarSocio}>
                  + Adicionar sócio
                </button>
                {erro('socios') && <div className="erro-campo">{erro('socios')}</div>}
              </>
            )}

            {s.id === 'capital' && (
              <>
                {tem('capital.quotas') && (
                  <EditorQuotas dados={d} onChange={mudar} erros={pend.filter((p) => p.campo === 'capital.quotas' && p.nivel === 'erro').map((p) => p.mensagem)} />
                )}
                {tem('capital.integralizacao') && (
                  <>
                    <h3>Integralização</h3>
                    <OpcoesRadio
                      nome="integralizacao"
                      valor={d.capital.integralizacao}
                      onChange={(v) => mudar({ capital: { ...atual.current.capital, integralizacao: v } })}
                      opcoes={[
                        { valor: 'a_vista', rotulo: 'À vista, em dinheiro, neste ato' },
                        { valor: 'a_prazo', rotulo: 'A prazo (até uma data)' },
                        { valor: 'bens', rotulo: 'Em bens' },
                      ]}
                    />
                    {d.capital.integralizacao === 'a_prazo' && (
                      <div style={{ maxWidth: 260 }}>
                        <CampoData rotulo="Integralizar até" valor={d.capital.integralizacao_data} onChange={(v) => mudar({ capital: { ...atual.current.capital, integralizacao_data: v } })} erro={erro('capital.integralizacao')} />
                      </div>
                    )}
                    {d.capital.integralizacao === 'bens' && (
                      <CampoAreaTexto rotulo="Descrição dos bens" valor={d.capital.bens_descricao} onChange={(v) => mudar({ capital: { ...atual.current.capital, bens_descricao: v } })} erro={erro('capital.integralizacao')} />
                    )}
                  </>
                )}
              </>
            )}

            {s.id === 'administracao' && (
              <>
                {tem('administracao.administradores') && (
                  <>
                    <h3>Quem administra a sociedade?</h3>
                    {listaSocios.length === 0 && <p className="suave">Cadastre os sócios primeiro.</p>}
                    {listaSocios.map(({ pessoa }) => (
                      <CampoMarcar
                        key={pessoa.id}
                        rotulo={`${pessoa.nome || '(sócio sem nome)'} — sócio administrador`}
                        valor={d.administracao.administradores.includes(pessoa.id)}
                        onChange={(v) => alternarAdm(pessoa.id, v)}
                      />
                    ))}
                    <h3>Administradores que não são sócios</h3>
                    {naoSocios.map((pessoa) => (
                      <CartaoPessoa
                        key={pessoa.id}
                        pessoa={pessoa}
                        titulo="Administrador não sócio"
                        aberto={abertos.has(pessoa.id)}
                        alternar={() => alternar(pessoa.id)}
                        onChange={atualizarPessoa(pessoa.id)}
                        onRemover={() => removerPessoa(pessoa.id, pessoa.nome)}
                        campos={camposPessoa}
                        erro={(c) => erro(c, pessoa.id)}
                        qtdErros={pendencias.filter((p) => p.pessoaId === pessoa.id && p.nivel === 'erro').length}
                      />
                    ))}
                    <button
                      onClick={() => {
                        const p = novaPessoa();
                        mudar({ pessoas: [...atual.current.pessoas, p], administracao: { ...atual.current.administracao, administradores: [...atual.current.administracao.administradores, p.id] } });
                        setAbertos((x) => new Set([...x, p.id]));
                      }}
                    >
                      + Adicionar administrador não sócio
                    </button>
                    {d.administracao.administradores.length > 1 && (
                      <div style={{ maxWidth: 420, marginTop: '1rem' }}>
                        <CampoSelecao
                          rotulo="Como os administradores atuam?"
                          valor={d.administracao.forma}
                          onChange={(v) => mudar({ administracao: { ...atual.current.administracao, forma: v } })}
                          opcoes={[
                            { valor: 'isolada', rotulo: 'Isoladamente (cada um sozinho)' },
                            { valor: 'conjunta', rotulo: 'Em conjunto (todos juntos)' },
                            { valor: 'indistinta', rotulo: 'Indistintamente' },
                          ]}
                        />
                      </div>
                    )}
                    {erro('administracao.administradores') && <div className="erro-campo">{erro('administracao.administradores')}</div>}
                  </>
                )}
                {tem('administracao.pro_labore') && (
                  <>
                    <h3>Pró-labore</h3>
                    <p className="suave pequeno">Marque os sócios que poderão retirar pró-labore. Se ninguém for marcado, a cláusula de pró-labore não entra no documento.</p>
                    {listaSocios.map(({ pessoa }) => (
                      <CampoMarcar
                        key={pessoa.id}
                        rotulo={pessoa.nome || '(sócio sem nome)'}
                        valor={d.pro_labore.includes(pessoa.id)}
                        onChange={(v) => mudar({ pro_labore: v ? [...atual.current.pro_labore.filter((x) => x !== pessoa.id), pessoa.id] : atual.current.pro_labore.filter((x) => x !== pessoa.id) })}
                      />
                    ))}
                  </>
                )}
              </>
            )}

            {s.id === 'fechamento' && (
              <div className="grade">
                {tem('fechamento.foro') && (
                  <>
                    <CampoTexto rotulo="Foro — cidade" valor={d.foro.cidade} onChange={(v) => mudar({ foro: { ...atual.current.foro, cidade: v } })} erro={erro('fechamento.foro')} />
                    <CampoUF rotulo="Foro — UF" valor={d.foro.uf} onChange={(v) => mudar({ foro: { ...atual.current.foro, uf: v } })} />
                  </>
                )}
                {tem('fechamento.exercicio') && (
                  <>
                    <CampoTexto rotulo="Exercício social — início (dia/mês)" valor={mmddParaBR(d.exercicio.inicio)} placeholder="01/01" onChange={(v) => mudar({ exercicio: { ...atual.current.exercicio, inicio: brParaMMDD(v) } })} erro={erro('fechamento.exercicio')} />
                    <CampoTexto rotulo="Exercício social — fim (dia/mês)" valor={mmddParaBR(d.exercicio.fim)} placeholder="31/12" onChange={(v) => mudar({ exercicio: { ...atual.current.exercicio, fim: brParaMMDD(v) } })} />
                  </>
                )}
                {tem('fechamento.local_data') && opcoesAto && onChangeOpcoes && (
                  <>
                    <CampoTexto rotulo="Local da assinatura — cidade" valor={opcoesAto.local_cidade} onChange={(v) => onChangeOpcoes({ local_cidade: v })} erro={erro('fechamento.local_data')} />
                    <CampoUF rotulo="Local da assinatura — UF" valor={opcoesAto.local_uf} onChange={(v) => onChangeOpcoes({ local_uf: v })} />
                    <CampoData rotulo="Data do documento" valor={opcoesAto.data_ato} onChange={(v) => onChangeOpcoes({ data_ato: v })} />
                  </>
                )}
              </div>
            )}

            {pend.filter((p) => p.nivel === 'aviso').length > 0 && (
              <Alerta tipo="aviso">
                <ul>
                  {pend
                    .filter((p) => p.nivel === 'aviso')
                    .map((p) => (
                      <li key={p.mensagem}>{p.mensagem}</li>
                    ))}
                </ul>
              </Alerta>
            )}
          </section>
        );
      })}
    </div>
  );
}

