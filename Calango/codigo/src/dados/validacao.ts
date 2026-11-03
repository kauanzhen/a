// Validações dos dados. Cada pendência diz o que aconteceu e o que fazer.
// Só valida os campos pedidos (os exigidos pelas cláusulas escolhidas).

import { dataValida, diasEntre, hojeISO } from '../lib/datas';
import { formatarMoeda } from '../lib/dinheiro';
import { normalizar } from '../lib/texto';
import { exigeRegimeBens } from '../gramatica/concordancia';
import type { DefinicaoTipoSocietario } from '../tipos/definicoes';
import { CAMPOS_PESSOA_SEMPRE } from './campos';
import { cepValido, cnaeValido, cnpjValido, cpfValido } from './documentos';
import {
  classesEfetivas,
  eSocio,
  socios,
  totalQuotasDoSocio,
  totalQuotasEsperado,
  totalQuotasSubscritas,
  valorQuotaDaClasse,
  valorTotalSubscrito,
} from './quotas';
import type { DadosEmpresa, Endereco, OpcoesAto, Pessoa } from './tipos';
import { buscarUF } from './ufs';

export type NivelPendencia = 'erro' | 'aviso';

export interface Pendencia {
  nivel: NivelPendencia;
  secao: string;
  campo?: string;
  /** Pessoa a que se refere, quando houver. */
  pessoaId?: string;
  mensagem: string;
}

export const AVISO_CLASSES =
  'Classes de quotas com direitos diferentes devem ter a redação revisada por advogado antes do registro.';

function erro(secao: string, campo: string, mensagem: string, pessoaId?: string): Pendencia {
  return { nivel: 'erro', secao, campo, mensagem, pessoaId };
}
function aviso(secao: string, campo: string, mensagem: string, pessoaId?: string): Pendencia {
  return { nivel: 'aviso', secao, campo, mensagem, pessoaId };
}

/** Lista o que falta num endereço ("logradouro, CEP"). */
export function faltasEndereco(e: Endereco): string[] {
  const f: string[] = [];
  if (!e.logradouro.trim()) f.push('logradouro');
  if (!e.bairro.trim()) f.push('bairro');
  if (!e.cidade.trim()) f.push('cidade');
  if (!buscarUF(e.uf)) f.push('UF');
  if (!cepValido(e.cep)) f.push('CEP (8 números)');
  return f;
}

export function validarPessoa(p: Pessoa, campos: Set<string>, todas: Pessoa[] = []): Pendencia[] {
  const r: Pendencia[] = [];
  const quem = p.nome.trim() || 'pessoa sem nome';
  const s = 'socios';
  const pede = (c: string) => campos.has(c) || CAMPOS_PESSOA_SEMPRE.includes(c);
  if (pede('pessoa.nome') && !p.nome.trim()) r.push(erro(s, 'pessoa.nome', 'Informe o nome completo da pessoa.', p.id));
  if (pede('pessoa.genero') && p.genero !== 'M' && p.genero !== 'F')
    r.push(erro(s, 'pessoa.genero', `Informe o gênero de ${quem} (usado para a concordância do texto).`, p.id));
  if (pede('pessoa.nacionalidade') && !p.nacionalidade.trim())
    r.push(erro(s, 'pessoa.nacionalidade', `Informe a nacionalidade de ${quem}.`, p.id));
  if (pede('pessoa.maioridade') && p.maioridade === 'menor')
    r.push(
      erro(s, 'pessoa.maioridade', `${quem} está marcado como menor. Sócio menor exige representante ou assistente, o que ainda não é suportado nesta versão.`, p.id),
    );
  if (pede('pessoa.naturalidade') && (!p.naturalidade_cidade.trim() || !buscarUF(p.naturalidade_uf)))
    r.push(erro(s, 'pessoa.naturalidade', `Informe a naturalidade (cidade e UF) de ${quem}.`, p.id));
  if (pede('pessoa.data_nascimento')) {
    if (!dataValida(p.data_nascimento)) r.push(erro(s, 'pessoa.data_nascimento', `Informe a data de nascimento de ${quem}.`, p.id));
    else if (p.maioridade === 'maior' && diasEntre(p.data_nascimento, hojeISO()) < 18 * 365.25)
      r.push(aviso(s, 'pessoa.data_nascimento', `${quem} tem menos de 18 anos pela data de nascimento, mas está marcado como maior. Confira (só é possível se for emancipado).`, p.id));
  }
  if (pede('pessoa.estado_civil')) {
    if (!p.estado_civil) r.push(erro(s, 'pessoa.estado_civil', `Informe o estado civil de ${quem}.`, p.id));
    else if (exigeRegimeBens(p.estado_civil) && !p.regime_bens)
      r.push(erro(s, 'pessoa.estado_civil', `Informe o regime de bens de ${quem} (obrigatório para casado ou união estável).`, p.id));
  }
  if (pede('pessoa.profissao') && !p.profissao.trim()) r.push(erro(s, 'pessoa.profissao', `Informe a profissão de ${quem}.`, p.id));
  if (pede('pessoa.rg') && (!p.rg.trim() || !p.rg_orgao.trim() || !buscarUF(p.rg_uf)))
    r.push(erro(s, 'pessoa.rg', `Informe o RG de ${quem} com órgão emissor e UF.`, p.id));
  if (pede('pessoa.cpf')) {
    if (!p.cpf.trim()) r.push(erro(s, 'pessoa.cpf', `Informe o CPF de ${quem}.`, p.id));
    else if (!cpfValido(p.cpf)) r.push(erro(s, 'pessoa.cpf', `O CPF de ${quem} é inválido (os dígitos verificadores não conferem). Confira o número.`, p.id));
    else if (todas.some((o) => o.id !== p.id && o.cpf.replace(/\D/g, '') === p.cpf.replace(/\D/g, '')))
      r.push(erro(s, 'pessoa.cpf', `O CPF de ${quem} está repetido em outra pessoa desta empresa.`, p.id));
  }
  if (pede('pessoa.endereco')) {
    const f = faltasEndereco(p.endereco);
    if (f.length) r.push(erro(s, 'pessoa.endereco', `Endereço residencial de ${quem} incompleto: falta ${f.join(', ')}.`, p.id));
  }
  return r;
}

export interface OpcoesValidacao {
  tipo: DefinicaoTipoSocietario;
  /** Opções do ato (para validar local e data); ausente no cadastro direto. */
  opcoesAto?: OpcoesAto;
}

/** Valida os dados da empresa considerando apenas os campos pedidos. */
export function validarDados(d: DadosEmpresa, campos: Set<string>, op: OpcoesValidacao): Pendencia[] {
  const r: Pendencia[] = [];
  const tem = (c: string) => campos.has(c);

  // ---------- Empresa ----------
  if (tem('empresa.razao_social')) {
    const rs = d.razao_social.trim();
    if (!rs) r.push(erro('empresa', 'empresa.razao_social', 'Informe a razão social da empresa.'));
    else {
      const fim = normalizar(rs).toUpperCase();
      if (!op.tipo.sufixos_nome.some((s) => fim.endsWith(normalizar(s).toUpperCase())))
        r.push(aviso('empresa', 'empresa.razao_social', `A razão social normalmente termina com "${op.tipo.sufixos_nome[0]}". Confira.`));
    }
  }
  if (tem('empresa.cnpj')) {
    if (!d.cnpj.trim()) r.push(erro('empresa', 'empresa.cnpj', 'Informe o CNPJ da empresa.'));
    else if (!cnpjValido(d.cnpj)) r.push(erro('empresa', 'empresa.cnpj', 'O CNPJ é inválido (os dígitos verificadores não conferem).'));
  } else if (d.cnpj.trim() && !cnpjValido(d.cnpj)) {
    r.push(aviso('empresa', 'empresa.cnpj', 'O CNPJ informado é inválido (os dígitos verificadores não conferem).'));
  }
  if (tem('empresa.nire') && !d.nire.trim()) r.push(erro('empresa', 'empresa.nire', 'Informe o NIRE da empresa.'));
  if (tem('empresa.data_registro') && !dataValida(d.data_registro))
    r.push(erro('empresa', 'empresa.data_registro', 'Informe a data do registro na Junta Comercial.'));
  if (tem('empresa.junta_uf') && !buscarUF(d.junta_uf))
    r.push(erro('empresa', 'empresa.junta_uf', 'Escolha a UF da Junta Comercial.'));
  if (tem('empresa.sede')) {
    const f = faltasEndereco(d.sede);
    if (f.length) r.push(erro('empresa', 'empresa.sede', `Endereço da sede incompleto: falta ${f.join(', ')}.`));
  }
  if (tem('empresa.data_inicio_atividades') && !dataValida(d.data_inicio_atividades))
    r.push(erro('empresa', 'empresa.data_inicio_atividades', 'Informe a data de início das atividades.'));
  if (tem('empresa.prazo') && d.prazo.tipo === 'determinado' && !dataValida(d.prazo.data))
    r.push(erro('empresa', 'empresa.prazo', 'Prazo determinado: informe a data de término.'));
  if (tem('empresa.objeto_social')) {
    const vazio = d.objeto_social.forma === 'lista'
      ? d.objeto_social.itens.filter((i) => i.trim()).length === 0
      : !d.objeto_social.texto.trim();
    if (vazio) r.push(erro('empresa', 'empresa.objeto_social', 'Descreva o objeto social.'));
  }
  if (tem('empresa.cnaes')) {
    if (d.cnaes.length === 0) r.push(erro('empresa', 'empresa.cnaes', 'Inclua ao menos um CNAE (o principal).'));
    const principais = d.cnaes.filter((c) => c.tipo === 'principal').length;
    if (d.cnaes.length > 0 && principais !== 1)
      r.push(erro('empresa', 'empresa.cnaes', `Deve haver exatamente um CNAE principal (há ${principais}).`));
    d.cnaes.forEach((c, i) => {
      if (!cnaeValido(c.codigo)) r.push(erro('empresa', 'empresa.cnaes', `CNAE da linha ${i + 1}: o código deve ter 7 números (ex.: 74.90-1-04).`));
      if (!c.descricao.trim()) r.push(erro('empresa', 'empresa.cnaes', `CNAE da linha ${i + 1}: falta a descrição.`));
    });
    const codigos = d.cnaes.map((c) => c.codigo.replace(/\D/g, '')).filter(Boolean);
    if (new Set(codigos).size !== codigos.length) r.push(erro('empresa', 'empresa.cnaes', 'Há CNAE repetido na lista.'));
  }
  if (tem('empresa.enquadramento') && !d.enquadramento)
    r.push(erro('empresa', 'empresa.enquadramento', 'Escolha o enquadramento: ME, EPP ou nenhum.'));

  // ---------- Sócios e pessoas ----------
  const camposPessoa = new Set([...campos].filter((c) => c.startsWith('pessoa.')));
  const lista = socios(d);
  if (tem('socios') && lista.length === 0) r.push(erro('socios', 'socios', 'Cadastre ao menos um sócio.'));
  const pessoasNoDocumento = new Set<string>();
  if (tem('socios') || tem('capital.quotas')) lista.forEach((s) => pessoasNoDocumento.add(s.pessoa.id));
  if (tem('administracao.administradores')) d.administracao.administradores.forEach((id) => pessoasNoDocumento.add(id));
  for (const id of pessoasNoDocumento) {
    const p = d.pessoas.find((x) => x.id === id);
    if (p) r.push(...validarPessoa(p, camposPessoa, d.pessoas));
  }

  // ---------- Capital e quotas ----------
  if (tem('capital.quotas')) r.push(...validarQuotas(d));
  if (tem('capital.integralizacao')) {
    if (d.capital.integralizacao === 'a_prazo' && !dataValida(d.capital.integralizacao_data))
      r.push(erro('capital', 'capital.integralizacao', 'Integralização a prazo: informe a data limite.'));
    if (d.capital.integralizacao === 'bens' && !d.capital.bens_descricao.trim())
      r.push(erro('capital', 'capital.integralizacao', 'Integralização em bens: descreva os bens.'));
  }

  // ---------- Administração ----------
  if (tem('administracao.administradores')) {
    const adms = d.administracao.administradores.filter((id) => d.pessoas.some((p) => p.id === id));
    if (adms.length === 0) r.push(erro('administracao', 'administracao.administradores', 'Defina quem será o administrador da sociedade.'));
  }
  if (tem('administracao.pro_labore')) {
    for (const id of d.pro_labore) {
      if (!eSocio(d, id)) r.push(erro('administracao', 'administracao.pro_labore', 'Há pessoa marcada com pró-labore que não é sócia. Revise a lista.'));
    }
  }

  // ---------- Fechamento ----------
  if (tem('fechamento.foro') && (!d.foro.cidade.trim() || !buscarUF(d.foro.uf)))
    r.push(erro('fechamento', 'fechamento.foro', 'Informe a cidade e a UF do foro.'));
  if (tem('fechamento.exercicio') && (!/^\d{2}-\d{2}$/.test(d.exercicio.inicio) || !/^\d{2}-\d{2}$/.test(d.exercicio.fim)))
    r.push(erro('fechamento', 'fechamento.exercicio', 'Informe o início e o fim do exercício social.'));
  if (tem('fechamento.local_data') && op.opcoesAto) {
    const o = op.opcoesAto;
    if (!o.local_cidade.trim() || !buscarUF(o.local_uf))
      r.push(erro('fechamento', 'fechamento.local_data', 'Informe a cidade e a UF onde o documento é assinado.'));
    if (!dataValida(o.data_ato)) r.push(erro('fechamento', 'fechamento.local_data', 'Informe a data do documento.'));
  }
  return r;
}

export function validarQuotas(d: DadosEmpresa): Pendencia[] {
  const r: Pendencia[] = [];
  const s = 'capital';
  const c = 'capital.quotas';
  if (!d.quotas.modo) {
    r.push(erro(s, c, 'Defina como funcionam as quotas (classe única ou classes distintas) antes de preencher o capital.'));
    return r;
  }
  if (d.capital.valor_centavos <= 0) r.push(erro(s, c, 'Informe o valor do capital social.'));
  if (d.capital.valor_quota_centavos <= 0) r.push(erro(s, c, 'Informe o valor unitário da quota.'));
  if (r.length) return r;

  const classes = classesEfetivas(d);
  if (d.quotas.modo === 'classes') {
    r.push(aviso(s, c, AVISO_CLASSES));
    if (classes.length < 2) r.push(erro(s, c, 'Com classes distintas, crie ao menos duas classes.'));
    const nomes = classes.map((k) => normalizar(k.nome));
    if (nomes.some((n) => !n)) r.push(erro(s, c, 'Toda classe precisa de um nome (ex.: "Classe A").'));
    if (new Set(nomes).size !== nomes.length) r.push(erro(s, c, 'Há classes com o mesmo nome.'));
    for (const k of classes) {
      if (k.voto === 'restrito' && !k.voto_materias.trim())
        r.push(erro(s, c, `${k.nome || 'Classe'}: voto restrito — informe em quais matérias há voto.`));
      if (valorQuotaDaClasse(d, k) <= 0) r.push(erro(s, c, `${k.nome || 'Classe'}: valor unitário inválido.`));
    }
  }

  const esperado = totalQuotasEsperado(d);
  if (d.quotas.modo === 'unica' && esperado === null) {
    r.push(
      erro(s, c, `O capital (${formatarMoeda(d.capital.valor_centavos)}) não é divisível pelo valor da quota (${formatarMoeda(d.capital.valor_quota_centavos)}). Ajuste o capital ou o valor unitário.`),
    );
    return r;
  }

  const lista = socios(d);
  for (const { pessoa, participacao } of lista) {
    if (totalQuotasDoSocio(d, participacao) <= 0)
      r.push(erro(s, c, `${pessoa.nome || 'Sócio sem nome'} está sem quotas. Informe a participação.`, pessoa.id));
  }
  const subscrito = valorTotalSubscrito(d);
  if (lista.length > 0 && subscrito !== d.capital.valor_centavos) {
    const dif = d.capital.valor_centavos - subscrito;
    r.push(
      erro(s, c, dif > 0
        ? `A soma das participações (${formatarMoeda(subscrito)}) é menor que o capital (${formatarMoeda(d.capital.valor_centavos)}). Faltam ${formatarMoeda(dif)}.`
        : `A soma das participações (${formatarMoeda(subscrito)}) passa do capital (${formatarMoeda(d.capital.valor_centavos)}) em ${formatarMoeda(-dif)}.`),
    );
  }
  if (esperado !== null && lista.length > 0) {
    const soma = totalQuotasSubscritas(d);
    if (soma !== esperado && subscrito === d.capital.valor_centavos)
      r.push(erro(s, c, `A soma das quotas (${soma}) difere do capital ÷ valor unitário (${esperado}).`));
  }
  return r;
}
