// Instruções enviadas ao modelo. Iguais para Claude e Gemini.

import type { ArquivoParaLeitura } from './tipos';

export const INSTRUCOES_SISTEMA = `Você lê documentos brasileiros de pessoas físicas — RG (carteira de identidade), CNH, CIN (carteira de identidade nacional) e comprovantes de residência (contas de luz, água, telefone, internet, banco etc.) — para preencher o cadastro de um sócio em um contrato social. Um escritório de contabilidade vai conferir tudo o que você devolver antes de usar.

Regras:
1. Copie apenas o que está escrito nos documentos. Nunca invente nem deduza um dado que não aparece: deixe o campo como texto vazio "". Não deduza o gênero pelo nome.
2. Se um trecho estiver ilegível, cortado ou em dúvida, deixe o campo vazio e explique em "avisos".
3. Responda somente com o JSON pedido, sem comentários.`;

/** Texto que acompanha os arquivos na mensagem do usuário. */
export function instrucoesLeitura(arquivos: ArquivoParaLeitura[]): string {
  const lista = arquivos.map((a, i) => `${i + 1}. ${a.nome}`).join('\n');
  return `Arquivos enviados, nesta ordem:
${lista}

Preencha o JSON assim:

"documentos": um item por arquivo, na mesma ordem.
- "arquivo": o nome do arquivo.
- "tipo": "rg", "cnh", "cin", "comprovante_residencia" ou "outro".
- "nome_titular": o nome da pessoa a quem o documento pertence. No comprovante de residência, o nome do cliente ou titular da conta.
- "legivel": false se não deu para ler os dados principais.
- "observacao": algo que o escritório deve saber sobre esse arquivo (ou "").

"pessoa": os dados do sócio, juntando os documentos de identificação com o comprovante de residência.
- "nome": nome completo exatamente como no documento de identidade, em letras maiúsculas.
- "genero": "M" ou "F" somente se o documento trouxer o campo sexo; senão "".
- "nacionalidade": se o documento indicar (ex.: "brasileira", "brasileiro"); senão "".
- "naturalidade_cidade" e "naturalidade_uf": cidade e sigla do estado de nascimento (campo naturalidade ou local de nascimento).
- "data_nascimento": no formato AAAA-MM-DD.
- "estado_civil": só se constar no documento: "solteiro", "casado", "uniao_estavel", "divorciado", "separado_judicialmente" ou "viuvo"; senão "".
- "rg": número do RG como impresso (com pontos e traço, se houver). Na CNH, use o campo "Doc. identidade" (não o número de registro da CNH). Na CIN, o número de registro é o próprio CPF.
- "rg_orgao": sigla do órgão emissor do RG (ex.: SSP, SESP, PC, DETRAN), sem a UF.
- "rg_uf": sigla do estado emissor do RG.
- "cpf": CPF com 11 dígitos.
- "endereco": do comprovante de residência. "logradouro" com o tipo por extenso (Rua, Avenida, Travessa, Alameda...); "numero" (ou "" se não houver); "complemento" (apto, bloco, casa...); "bairro"; "cidade"; "uf" (sigla); "cep" (8 dígitos). Escreva nomes de rua, bairro e cidade com letras maiúsculas e minúsculas normais (ex.: "Rua das Flores", "São Paulo"), não tudo em maiúsculas.

"avisos": problemas que o escritório deve conferir, em português — por exemplo: documento ilegível ou cortado, documentos de pessoas diferentes, dados que não batem entre um documento e outro, comprovante em nome de outra pessoa.

Formato exato da resposta:
${MOLDE}`;
}

const MOLDE = JSON.stringify({
  documentos: [{ arquivo: '', tipo: 'rg', nome_titular: '', legivel: true, observacao: '' }],
  pessoa: {
    nome: '',
    genero: '',
    nacionalidade: '',
    naturalidade_cidade: '',
    naturalidade_uf: '',
    data_nascimento: '',
    estado_civil: '',
    rg: '',
    rg_orgao: '',
    rg_uf: '',
    cpf: '',
    endereco: { logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '' },
  },
  avisos: [],
});
