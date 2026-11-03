// Unidades da federação, com a forma usada no nome da Junta Comercial.

export interface UF {
  sigla: string;
  nome: string;
  /** Complemento de "Junta Comercial ..." */
  junta: string;
}

export const UFS: UF[] = [
  { sigla: 'AC', nome: 'Acre', junta: 'do Estado do Acre' },
  { sigla: 'AL', nome: 'Alagoas', junta: 'do Estado de Alagoas' },
  { sigla: 'AP', nome: 'Amapá', junta: 'do Estado do Amapá' },
  { sigla: 'AM', nome: 'Amazonas', junta: 'do Estado do Amazonas' },
  { sigla: 'BA', nome: 'Bahia', junta: 'do Estado da Bahia' },
  { sigla: 'CE', nome: 'Ceará', junta: 'do Estado do Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal', junta: 'do Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo', junta: 'do Estado do Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás', junta: 'do Estado de Goiás' },
  { sigla: 'MA', nome: 'Maranhão', junta: 'do Estado do Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso', junta: 'do Estado de Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul', junta: 'do Estado de Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais', junta: 'do Estado de Minas Gerais' },
  { sigla: 'PA', nome: 'Pará', junta: 'do Estado do Pará' },
  { sigla: 'PB', nome: 'Paraíba', junta: 'do Estado da Paraíba' },
  { sigla: 'PR', nome: 'Paraná', junta: 'do Estado do Paraná' },
  { sigla: 'PE', nome: 'Pernambuco', junta: 'do Estado de Pernambuco' },
  { sigla: 'PI', nome: 'Piauí', junta: 'do Estado do Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro', junta: 'do Estado do Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte', junta: 'do Estado do Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul', junta: 'do Estado do Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia', junta: 'do Estado de Rondônia' },
  { sigla: 'RR', nome: 'Roraima', junta: 'do Estado de Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina', junta: 'do Estado de Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo', junta: 'do Estado de São Paulo' },
  { sigla: 'SE', nome: 'Sergipe', junta: 'do Estado de Sergipe' },
  { sigla: 'TO', nome: 'Tocantins', junta: 'do Estado do Tocantins' },
];

export function buscarUF(sigla: string): UF | undefined {
  return UFS.find((u) => u.sigla === (sigla ?? '').toUpperCase());
}

/** "SP" -> "Junta Comercial do Estado de São Paulo" */
export function nomeJunta(sigla: string): string {
  const uf = buscarUF(sigla);
  return uf ? `Junta Comercial ${uf.junta}` : '';
}
