// Cadastro de pessoa (sócio, administrador). Mostra só os campos pedidos,
// mais nome e gênero (sempre necessários para a concordância).

import { useState } from 'react';
import type { Pessoa } from '../../dados/tipos';
import { ESTADOS_CIVIS, REGIMES_BENS, exigeRegimeBens, type EstadoCivil, type RegimeBens } from '../../gramatica/concordancia';
import { cpfValido, formatarCPF } from '../../dados/documentos';
import { Alerta, CampoData, CampoSelecao, CampoTexto, CampoUF, CamposEndereco, OpcoesRadio, Rotulo } from './Campos';

export function PessoaForm(p: {
  pessoa: Pessoa;
  /** Recebe uma função que atualiza a pessoa a partir do valor mais recente. */
  onChange: (atualizar: (x: Pessoa) => Pessoa) => void;
  campos: Set<string>;
  erro: (campo: string) => string | undefined;
}) {
  const x = p.pessoa;
  const [aviso, setAviso] = useState('');
  const mostra = (c: string) => p.campos.has(c);
  const mudar = (parcial: Partial<Pessoa>) => p.onChange((atual) => ({ ...atual, ...parcial }));

  const mudarGenero = (g: 'M' | 'F') => {
    const parcial: Partial<Pessoa> = { genero: g };
    const nac = x.nacionalidade.trim().toLowerCase();
    if (!nac || nac === 'brasileiro' || nac === 'brasileira') parcial.nacionalidade = g === 'F' ? 'brasileira' : 'brasileiro';
    mudar(parcial);
  };

  const mudarEstadoCivil = (ec: EstadoCivil | '') => {
    if (!exigeRegimeBens(ec) && x.regime_bens) {
      setAviso('O regime de bens foi apagado, porque o estado civil escolhido não usa regime de bens.');
      mudar({ estado_civil: ec, regime_bens: '' });
    } else {
      setAviso('');
      mudar({ estado_civil: ec });
    }
  };

  const cpfInvalido = x.cpf.trim() !== '' && x.cpf.replace(/\D/g, '').length >= 11 && !cpfValido(x.cpf);

  return (
    <div>
      <div className="grade">
        <CampoTexto
          largo
          rotulo="Nome completo"
          dica="Como no documento de identidade. Aparece em negrito no contrato."
          valor={x.nome}
          maiusculas
          onChange={(v) => mudar({ nome: v })}
          erro={p.erro('pessoa.nome')}
        />
        <Rotulo rotulo="Gênero (para a concordância do texto)" erro={p.erro('pessoa.genero')}>
          <OpcoesRadio
            nome={`genero-${x.id}`}
            valor={x.genero}
            onChange={(v) => mudarGenero(v as 'M' | 'F')}
            opcoes={[
              { valor: 'M', rotulo: 'Masculino' },
              { valor: 'F', rotulo: 'Feminino' },
            ]}
          />
        </Rotulo>
        {mostra('pessoa.nacionalidade') && (
          <CampoTexto
            rotulo="Nacionalidade"
            dica="Já no gênero da pessoa (ex.: brasileira)"
            valor={x.nacionalidade}
            onChange={(v) => mudar({ nacionalidade: v })}
            erro={p.erro('pessoa.nacionalidade')}
          />
        )}
        {mostra('pessoa.maioridade') && (
          <CampoSelecao
            rotulo="Maioridade"
            valor={x.maioridade}
            onChange={(v) => mudar({ maioridade: v })}
            opcoes={[
              { valor: 'maior', rotulo: 'Maior de idade' },
              { valor: 'menor', rotulo: 'Menor (com representante) — em breve', desativado: true },
            ]}
            erro={p.erro('pessoa.maioridade')}
          />
        )}
        {mostra('pessoa.naturalidade') && (
          <>
            <CampoTexto rotulo="Naturalidade — cidade" valor={x.naturalidade_cidade} onChange={(v) => mudar({ naturalidade_cidade: v })} erro={p.erro('pessoa.naturalidade')} />
            <CampoUF rotulo="Naturalidade — UF" valor={x.naturalidade_uf} onChange={(v) => mudar({ naturalidade_uf: v })} />
          </>
        )}
        {mostra('pessoa.data_nascimento') && (
          <CampoData rotulo="Data de nascimento" valor={x.data_nascimento} onChange={(v) => mudar({ data_nascimento: v })} erro={p.erro('pessoa.data_nascimento')} />
        )}
        {mostra('pessoa.estado_civil') && (
          <>
            <CampoSelecao
              rotulo="Estado civil"
              vazio="Escolha…"
              valor={x.estado_civil}
              onChange={(v) => mudarEstadoCivil(v as EstadoCivil | '')}
              opcoes={ESTADOS_CIVIS.map((e) => ({ valor: e.valor, rotulo: e.rotulo }))}
              erro={exigeRegimeBens(x.estado_civil) ? undefined : p.erro('pessoa.estado_civil')}
            />
            {exigeRegimeBens(x.estado_civil) && (
              <CampoSelecao
                rotulo="Regime de bens (obrigatório)"
                vazio="Escolha o regime…"
                valor={x.regime_bens}
                onChange={(v) => mudar({ regime_bens: v as RegimeBens | '' })}
                opcoes={REGIMES_BENS.map((r) => ({ valor: r.valor, rotulo: r.rotulo }))}
                erro={p.erro('pessoa.estado_civil')}
              />
            )}
          </>
        )}
        {mostra('pessoa.profissao') && (
          <CampoTexto rotulo="Profissão" dica="No gênero da pessoa (ex.: empresária)" valor={x.profissao} onChange={(v) => mudar({ profissao: v })} erro={p.erro('pessoa.profissao')} />
        )}
        {mostra('pessoa.registro_conselho') && (
          <CampoTexto rotulo="Registro em conselho de classe" dica="Opcional (ex.: CRC 1SP123456/O-0)" valor={x.registro_conselho} onChange={(v) => mudar({ registro_conselho: v })} />
        )}
        {mostra('pessoa.rg') && (
          <>
            <CampoTexto rotulo="RG — número" valor={x.rg} onChange={(v) => mudar({ rg: v })} erro={p.erro('pessoa.rg')} />
            <CampoTexto rotulo="RG — órgão emissor" dica="Ex.: SSP, DETRAN" valor={x.rg_orgao} maiusculas onChange={(v) => mudar({ rg_orgao: v })} />
            <CampoUF rotulo="RG — UF" valor={x.rg_uf} onChange={(v) => mudar({ rg_uf: v })} />
          </>
        )}
        {mostra('pessoa.cpf') && (
          <CampoTexto
            rotulo="CPF"
            valor={x.cpf}
            placeholder="000.000.000-00"
            onChange={(v) => mudar({ cpf: v })}
            onBlur={(v) => mudar({ cpf: formatarCPF(v) })}
            erro={cpfInvalido ? 'CPF inválido: confira os números.' : p.erro('pessoa.cpf')}
          />
        )}
      </div>
      {aviso && <Alerta tipo="aviso">{aviso}</Alerta>}
      {mostra('pessoa.endereco') && (
        <>
          <h3>Endereço residencial</h3>
          <CamposEndereco valor={x.endereco} onChange={(e) => p.onChange((atual) => ({ ...atual, endereco: { ...atual.endereco, ...e } }))} erro={p.erro('pessoa.endereco')} />
        </>
      )}
    </div>
  );
}
