// Catálogo dos CAMPOS do formulário. As variáveis das cláusulas dizem de quais
// campos dependem; o formulário da Etapa 2 mostra só os campos exigidos pelas
// cláusulas escolhidas, sem repetir, agrupados nas seções abaixo.

export interface Secao {
  id: string;
  nome: string;
}

export const SECOES: Secao[] = [
  { id: 'empresa', nome: 'Empresa' },
  { id: 'socios', nome: 'Sócios' },
  { id: 'capital', nome: 'Capital e quotas' },
  { id: 'administracao', nome: 'Administração' },
  { id: 'fechamento', nome: 'Fechamento' },
];

export interface DefCampo {
  id: string;
  secao: string;
  rotulo: string;
  /** Campo de pessoa (aparece dentro do cadastro de cada sócio/administrador). */
  dePessoa?: boolean;
}

export const CAMPOS: DefCampo[] = [
  { id: 'empresa.razao_social', secao: 'empresa', rotulo: 'Razão social' },
  { id: 'empresa.cnpj', secao: 'empresa', rotulo: 'CNPJ' },
  { id: 'empresa.nire', secao: 'empresa', rotulo: 'NIRE' },
  { id: 'empresa.data_registro', secao: 'empresa', rotulo: 'Data do registro na Junta' },
  { id: 'empresa.junta_uf', secao: 'empresa', rotulo: 'Junta Comercial (UF)' },
  { id: 'empresa.numero_ultima_alteracao', secao: 'empresa', rotulo: 'Número da última alteração registrada' },
  { id: 'empresa.sede', secao: 'empresa', rotulo: 'Endereço da sede' },
  { id: 'empresa.data_inicio_atividades', secao: 'empresa', rotulo: 'Data de início das atividades' },
  { id: 'empresa.prazo', secao: 'empresa', rotulo: 'Prazo de duração' },
  { id: 'empresa.objeto_social', secao: 'empresa', rotulo: 'Objeto social' },
  { id: 'empresa.cnaes', secao: 'empresa', rotulo: 'CNAEs' },
  { id: 'empresa.enquadramento', secao: 'empresa', rotulo: 'Enquadramento (ME/EPP)' },

  { id: 'socios', secao: 'socios', rotulo: 'Quadro de sócios' },
  { id: 'pessoa.nome', secao: 'socios', rotulo: 'Nome completo', dePessoa: true },
  { id: 'pessoa.genero', secao: 'socios', rotulo: 'Gênero', dePessoa: true },
  { id: 'pessoa.nacionalidade', secao: 'socios', rotulo: 'Nacionalidade', dePessoa: true },
  { id: 'pessoa.maioridade', secao: 'socios', rotulo: 'Maioridade', dePessoa: true },
  { id: 'pessoa.naturalidade', secao: 'socios', rotulo: 'Naturalidade (cidade/UF)', dePessoa: true },
  { id: 'pessoa.data_nascimento', secao: 'socios', rotulo: 'Data de nascimento', dePessoa: true },
  { id: 'pessoa.estado_civil', secao: 'socios', rotulo: 'Estado civil (e regime de bens)', dePessoa: true },
  { id: 'pessoa.profissao', secao: 'socios', rotulo: 'Profissão', dePessoa: true },
  { id: 'pessoa.registro_conselho', secao: 'socios', rotulo: 'Registro em conselho de classe', dePessoa: true },
  { id: 'pessoa.rg', secao: 'socios', rotulo: 'RG (número, órgão e UF)', dePessoa: true },
  { id: 'pessoa.cpf', secao: 'socios', rotulo: 'CPF', dePessoa: true },
  { id: 'pessoa.endereco', secao: 'socios', rotulo: 'Endereço residencial', dePessoa: true },

  { id: 'capital.quotas', secao: 'capital', rotulo: 'Capital social, quotas e participação de cada sócio' },
  { id: 'capital.integralizacao', secao: 'capital', rotulo: 'Forma de integralização' },

  { id: 'administracao.administradores', secao: 'administracao', rotulo: 'Administradores e forma de administração' },
  { id: 'administracao.pro_labore', secao: 'administracao', rotulo: 'Sócios com pró-labore' },

  { id: 'fechamento.foro', secao: 'fechamento', rotulo: 'Foro (cidade/UF)' },
  { id: 'fechamento.exercicio', secao: 'fechamento', rotulo: 'Exercício social' },
  { id: 'fechamento.local_data', secao: 'fechamento', rotulo: 'Local e data do documento' },
];

/** Campos de pessoa sempre exigidos quando há pessoas no documento (concordância). */
export const CAMPOS_PESSOA_SEMPRE = ['pessoa.nome', 'pessoa.genero'];

export function campoPorId(id: string): DefCampo | undefined {
  return CAMPOS.find((c) => c.id === id);
}

/** Todos os campos (usado no cadastro completo da empresa). */
export function todosOsCampos(): Set<string> {
  return new Set(CAMPOS.map((c) => c.id));
}
