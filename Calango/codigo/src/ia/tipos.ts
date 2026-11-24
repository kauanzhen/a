// Captura de dados por IA (Fase 4): tipos, provedores e o formato da resposta.

export type ProvedorIA = 'claude' | 'gemini';

export interface ConfigIA {
  provedor: '' | ProvedorIA;
  modelo: string;
  chave: string;
}

export const PROVEDORES: { valor: ProvedorIA; rotulo: string; empresa: string; ondeObterChave: string }[] = [
  { valor: 'claude', rotulo: 'Claude', empresa: 'Anthropic', ondeObterChave: 'platform.claude.com (menu API Keys)' },
  { valor: 'gemini', rotulo: 'Gemini', empresa: 'Google', ondeObterChave: 'aistudio.google.com (menu Get API key)' },
];

/**
 * Sugestão de modelo para cada provedor. O campo continua editável nas
 * Configurações: quando o provedor lançar modelos novos, basta trocar o nome.
 * "gemini-flash-latest" é um apelido do Google que aponta sempre para o Flash
 * mais recente.
 */
export const MODELO_PADRAO: Record<ProvedorIA, string> = {
  claude: 'claude-opus-5-5',
  gemini: 'gemini-flash-latest',
};

/** Texto do aviso obrigatório antes de cada envio (especificação, seção 11). */
export const AVISO_ENVIO =
  'Os documentos selecionados serão enviados a um serviço externo (Anthropic ou Google) para leitura automática. O uso desses dados, inclusive para treinamento de modelos de IA, depende dos termos do plano contratado com o provedor. Em planos gratuitos, os dados podem ser usados para treinamento e revisados por pessoas. Confirme que o cliente autorizou este tratamento de dados.';

export const AVISO_CHAVE =
  'A chave fica gravada no arquivo configuracoes.json da pasta de dados (e nas cópias de backups/). Qualquer pessoa com acesso a essa pasta pode vê-la e usá-la — e o uso é cobrado na sua conta do provedor. Ela não vai nos pacotes de exportação.';

export type TipoMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf';

/** Arquivo já preparado para envio (conteúdo em base64, sem o prefixo "data:"). */
export interface ArquivoParaLeitura {
  nome: string;
  tipo: TipoMime;
  base64: string;
  /** Tamanho em bytes do conteúdo enviado (depois de reduzir a imagem). */
  bytes: number;
}

export type TipoDocumentoLido = 'rg' | 'cnh' | 'cin' | 'comprovante_residencia' | 'outro';

export const NOMES_TIPO_DOCUMENTO: Record<TipoDocumentoLido, string> = {
  rg: 'RG (carteira de identidade)',
  cnh: 'CNH',
  cin: 'CIN (carteira de identidade nacional)',
  comprovante_residencia: 'Comprovante de residência',
  outro: 'Outro documento',
};

/** Resposta da IA, já no formato pedido (antes da conferência pelo Calango). */
export interface RespostaIA {
  documentos: {
    arquivo: string;
    tipo: TipoDocumentoLido;
    nome_titular: string;
    legivel: boolean;
    observacao: string;
  }[];
  pessoa: {
    nome: string;
    genero: 'M' | 'F' | '';
    nacionalidade: string;
    naturalidade_cidade: string;
    naturalidade_uf: string;
    data_nascimento: string;
    estado_civil: string;
    rg: string;
    rg_orgao: string;
    rg_uf: string;
    cpf: string;
    endereco: {
      logradouro: string;
      numero: string;
      complemento: string;
      bairro: string;
      cidade: string;
      uf: string;
      cep: string;
    };
  };
  avisos: string[];
}

const texto = { type: 'string' } as const;

/**
 * Esquema JSON da resposta. Todos os campos são obrigatórios; o que não
 * constar nos documentos vem como texto vazio.
 */
export const ESQUEMA_RESPOSTA = {
  type: 'object',
  additionalProperties: false,
  required: ['documentos', 'pessoa', 'avisos'],
  properties: {
    documentos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['arquivo', 'tipo', 'nome_titular', 'legivel', 'observacao'],
        properties: {
          arquivo: texto,
          tipo: { type: 'string', enum: ['rg', 'cnh', 'cin', 'comprovante_residencia', 'outro'] },
          nome_titular: texto,
          legivel: { type: 'boolean' },
          observacao: texto,
        },
      },
    },
    pessoa: {
      type: 'object',
      additionalProperties: false,
      required: [
        'nome',
        'genero',
        'nacionalidade',
        'naturalidade_cidade',
        'naturalidade_uf',
        'data_nascimento',
        'estado_civil',
        'rg',
        'rg_orgao',
        'rg_uf',
        'cpf',
        'endereco',
      ],
      properties: {
        nome: texto,
        genero: { type: 'string', enum: ['M', 'F', ''] },
        nacionalidade: texto,
        naturalidade_cidade: texto,
        naturalidade_uf: texto,
        data_nascimento: texto,
        estado_civil: {
          type: 'string',
          enum: ['', 'solteiro', 'casado', 'uniao_estavel', 'divorciado', 'separado_judicialmente', 'viuvo'],
        },
        rg: texto,
        rg_orgao: texto,
        rg_uf: texto,
        cpf: texto,
        endereco: {
          type: 'object',
          additionalProperties: false,
          required: ['logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep'],
          properties: {
            logradouro: texto,
            numero: texto,
            complemento: texto,
            bairro: texto,
            cidade: texto,
            uf: texto,
            cep: texto,
          },
        },
      },
    },
    avisos: { type: 'array', items: texto },
  },
} as const;

export type TipoErroIA =
  | 'configuracao'
  | 'arquivo'
  | 'chave'
  | 'permissao'
  | 'modelo'
  | 'limite'
  | 'credito'
  | 'tamanho'
  | 'sem_internet'
  | 'tempo'
  | 'servico'
  | 'recusa'
  | 'resposta'
  | 'cancelado'
  | 'outro';

/** Erro com mensagem pronta para o usuário (diz o que houve e o que fazer). */
export class ErroIA extends Error {
  readonly tipo: TipoErroIA;
  readonly detalhe: string;
  constructor(tipo: TipoErroIA, mensagem: string, detalhe = '') {
    super(mensagem);
    this.name = 'ErroIA';
    this.tipo = tipo;
    this.detalhe = detalhe;
  }
}
