import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CabecalhoPagina, Campo, ListaErros, Modal } from '../../components/ui';
import { NOMES_REGIME, type Empresa, type Regime } from '../../db/types';
import { useAcao, useApp } from '../../hooks/app';
import { formatarCEP, formatarCNAE, formatarCNPJ, gerarCNPJ, UFS, validarCNPJ } from '../../lib/documentos';
import { MASCARA_PADRAO } from '../../lib/mascara';
import { atualizarEmpresa, criarEmpresa, empresaVazia, excluirEmpresa, validarEmpresa, type DadosEmpresa } from './empresaService';
import { criarEmpresaExemplo } from '../inicio/empresaExemplo';

export function EmpresasPage() {
  const { empresas, empresaId, selecionarEmpresa, confirmar } = useApp();
  const acao = useAcao();
  const [editando, setEditando] = useState<Empresa | 'nova' | null>(null);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get('nova')) {
      setEditando('nova');
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  async function excluir(e: Empresa) {
    const ok = await confirmar({
      titulo: 'Excluir empresa',
      mensagem: (
        <p>
          Excluir <strong>{e.razaoSocial}</strong> e <strong>todos</strong> os seus dados (plano de contas, lançamentos, períodos…)? Esta ação não pode
          ser desfeita — faça um backup antes, se quiser.
        </p>
      ),
      textoConfirmar: 'Excluir tudo',
      perigo: true,
    });
    if (ok) await acao(() => excluirEmpresa(e.id!), 'Empresa excluída.');
  }

  return (
    <>
      <CabecalhoPagina titulo="Empresas" descricao="Cadastre quantas empresas fictícias quiser. A empresa selecionada aparece no topo da tela.">
        <button onClick={() => acao(async () => selecionarEmpresa(await criarEmpresaExemplo()), 'Empresa de exemplo criada.')}>
          Criar empresa de exemplo
        </button>
        <button className="primario" onClick={() => setEditando('nova')}>
          Nova empresa
        </button>
      </CabecalhoPagina>
      <div className="tabela-container">
        <table>
          <thead>
            <tr>
              <th>Razão social</th>
              <th>CNPJ</th>
              <th className="esconder-mobile">CNAE</th>
              <th>Regime</th>
              <th className="esconder-mobile">Máscara</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {empresas.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.razaoSocial}
                  {e.id === empresaId && (
                    <span className="etiqueta sucesso" style={{ marginLeft: 6 }}>
                      atual
                    </span>
                  )}
                  {e.nomeFantasia && <div className="texto-2">{e.nomeFantasia}</div>}
                </td>
                <td className="mono">{e.cnpj}</td>
                <td className="esconder-mobile mono">{formatarCNAE(e.cnae)}</td>
                <td>{NOMES_REGIME[e.regime]}</td>
                <td className="esconder-mobile mono">{e.mascaraPlano}</td>
                <td>
                  <div className="acoes">
                    {e.id !== empresaId && (
                      <button className="pequeno" onClick={() => selecionarEmpresa(e.id)}>
                        Selecionar
                      </button>
                    )}
                    <button className="pequeno" onClick={() => setEditando(e)}>
                      Editar
                    </button>
                    <button className="pequeno perigo" onClick={() => excluir(e)}>
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!empresas.length && (
              <tr>
                <td colSpan={6} className="vazio">
                  Nenhuma empresa cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editando && (
        <FormEmpresa
          empresa={editando === 'nova' ? undefined : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={(id) => {
            setEditando(null);
            if (editando === 'nova') selecionarEmpresa(id);
          }}
        />
      )}
    </>
  );
}

function FormEmpresa(props: { empresa?: Empresa; aoFechar: () => void; aoSalvar: (id: number) => void }) {
  const acao = useAcao();
  const { confirmar } = useApp();
  const [d, setD] = useState<DadosEmpresa>(() => {
    if (!props.empresa) return empresaVazia();
    const { id: _id, criadaEm: _c, ...resto } = props.empresa;
    return structuredClone(resto);
  });
  const [carregarPlano, setCarregarPlano] = useState(true);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [erros, setErros] = useState<string[]>([]);
  const novo = !props.empresa;

  const muda = <K extends keyof DadosEmpresa>(k: K, v: DadosEmpresa[K]) => setD((x) => ({ ...x, [k]: v }));
  const mudaEnd = (k: keyof DadosEmpresa['endereco'], v: string) => setD((x) => ({ ...x, endereco: { ...x.endereco, [k]: v } }));

  async function salvar() {
    const e = validarEmpresa(d, { exigirCincoNiveis: novo && carregarPlano });
    setErros(e);
    if (e.length) return;
    if (!novo && props.empresa!.mascaraPlano !== d.mascaraPlano) {
      const ok = await confirmar({
        titulo: 'Alterar a máscara do plano',
        mensagem: `Todos os códigos de conta serão convertidos de ${props.empresa!.mascaraPlano} para ${d.mascaraPlano}. Os lançamentos continuam ligados às mesmas contas. Continuar?`,
      });
      if (!ok) return;
    }
    const id = await acao(
      async () => {
        if (novo) return criarEmpresa(d, { carregarPlanoPadrao: carregarPlano, anoExercicio: ano || undefined });
        await atualizarEmpresa(props.empresa!.id!, d);
        return props.empresa!.id!;
      },
      novo ? 'Empresa criada.' : 'Empresa atualizada.',
    );
    if (id) props.aoSalvar(id);
  }

  const cnpjInvalido = d.cnpj.length >= 18 && !validarCNPJ(d.cnpj);

  return (
    <Modal
      titulo={novo ? 'Nova empresa fictícia' : `Editar ${props.empresa!.razaoSocial}`}
      aoFechar={props.aoFechar}
      largo
      rodape={
        <>
          <button onClick={props.aoFechar}>Cancelar</button>
          <button className="primario" onClick={salvar}>
            Salvar
          </button>
        </>
      }
    >
      <ListaErros erros={erros} />
      <div className="form-grade">
        <Campo rotulo="Razão social *" className="col-8">
          <input value={d.razaoSocial} onChange={(e) => muda('razaoSocial', e.target.value)} autoFocus />
        </Campo>
        <Campo rotulo="Nome fantasia" className="col-4">
          <input value={d.nomeFantasia ?? ''} onChange={(e) => muda('nomeFantasia', e.target.value)} />
        </Campo>
        <Campo rotulo="CNPJ *" className="col-4" dica={cnpjInvalido ? <span className="texto-perigo">Dígito verificador inválido</span> : 'Numérico ou alfanumérico'}>
          <div className="acoes" style={{ flexWrap: 'nowrap' }}>
            <input className={cnpjInvalido ? 'invalido' : ''} style={{ flex: 1 }} value={d.cnpj} onChange={(e) => muda('cnpj', formatarCNPJ(e.target.value))} placeholder="00.000.000/0000-00" />
            <button type="button" className="pequeno" onClick={() => muda('cnpj', gerarCNPJ())} title="Gera um CNPJ com DV válido para estudo">
              Gerar fictício
            </button>
          </div>
        </Campo>
        <Campo rotulo="Inscrição estadual" className="col-3">
          <input value={d.inscricaoEstadual ?? ''} onChange={(e) => muda('inscricaoEstadual', e.target.value)} />
        </Campo>
        <Campo rotulo="CNAE (subclasse) *" className="col-2">
          <input value={formatarCNAE(d.cnae)} onChange={(e) => muda('cnae', e.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="0000-0/00" />
        </Campo>
        <Campo rotulo="Descrição do CNAE" className="col-3">
          <input value={d.descricaoCnae ?? ''} onChange={(e) => muda('descricaoCnae', e.target.value)} />
        </Campo>
        <Campo rotulo="Logradouro" className="col-6">
          <input value={d.endereco.logradouro} onChange={(e) => mudaEnd('logradouro', e.target.value)} />
        </Campo>
        <Campo rotulo="Número" className="col-2">
          <input value={d.endereco.numero} onChange={(e) => mudaEnd('numero', e.target.value)} />
        </Campo>
        <Campo rotulo="Complemento" className="col-4">
          <input value={d.endereco.complemento ?? ''} onChange={(e) => mudaEnd('complemento', e.target.value)} />
        </Campo>
        <Campo rotulo="Bairro" className="col-4">
          <input value={d.endereco.bairro} onChange={(e) => mudaEnd('bairro', e.target.value)} />
        </Campo>
        <Campo rotulo="Município" className="col-4">
          <input value={d.endereco.municipio} onChange={(e) => mudaEnd('municipio', e.target.value)} />
        </Campo>
        <Campo rotulo="UF" className="col-2">
          <select value={d.endereco.uf} onChange={(e) => mudaEnd('uf', e.target.value)}>
            {UFS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="CEP" className="col-2">
          <input value={d.endereco.cep} onChange={(e) => mudaEnd('cep', formatarCEP(e.target.value))} placeholder="00000-000" />
        </Campo>
        <Campo rotulo="Regime tributário *" className="col-4">
          <select value={d.regime} onChange={(e) => muda('regime', e.target.value as Regime)}>
            {Object.entries(NOMES_REGIME).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Máscara do plano de contas *" className="col-4" dica={`"9" = dígito. Padrão: ${MASCARA_PADRAO}`}>
          <input className="mono" value={d.mascaraPlano} onChange={(e) => muda('mascaraPlano', e.target.value)} />
        </Campo>
        <Campo rotulo="Início do exercício social" className="col-4">
          <select value={d.inicioExercicioMes} onChange={(e) => muda('inicioExercicioMes', Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                01/{String(i + 1).padStart(2, '0')} {i === 0 ? '(ano civil — padrão)' : ''}
              </option>
            ))}
          </select>
        </Campo>
        {novo && (
          <>
            <div className="col-6">
              <label className="check">
                <input type="checkbox" checked={carregarPlano} onChange={(e) => setCarregarPlano(e.target.checked)} />
                Carregar o plano de contas padrão (Lei 6.404/76)
              </label>
            </div>
            <Campo rotulo="Criar o exercício do ano (12 períodos abertos)" className="col-6">
              <input type="number" min={1900} max={2999} value={ano || ''} onChange={(e) => setAno(Number(e.target.value))} />
            </Campo>
          </>
        )}
      </div>
    </Modal>
  );
}
