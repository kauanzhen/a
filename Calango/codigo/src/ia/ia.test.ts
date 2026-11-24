// Fase 4 — captura de dados por IA. As chamadas aos provedores são simuladas
// (fetch falso): nenhum teste fala com a Anthropic ou o Google de verdade.

import { describe, expect, it } from 'vitest';
import { aplicarNaPessoa, ajustarMaiusculas, conferirLeitura, dataISO, mesmoNome } from './interpretar';
import { conferirLote, detectarTipo, paraBase64 } from './arquivos';
import { interpretarJSON, lerDocumentos, listarModelos } from './provedores';
import { ErroIA, type ArquivoParaLeitura, type ConfigIA } from './tipos';
import { novaPessoa } from '../dados/fabricas';

const RESPOSTA = {
  documentos: [
    { arquivo: 'rg.jpg', tipo: 'rg', nome_titular: 'MARIA DA SILVA SOUZA', legivel: true, observacao: '' },
    { arquivo: 'conta.pdf', tipo: 'comprovante_residencia', nome_titular: 'Maria Silva Souza', legivel: true, observacao: '' },
  ],
  pessoa: {
    nome: 'maria da silva  souza',
    genero: 'F',
    nacionalidade: 'BRASILEIRA',
    naturalidade_cidade: 'SÃO JOSÉ DOS CAMPOS',
    naturalidade_uf: 'sp',
    data_nascimento: '15/03/1985',
    estado_civil: '',
    rg: '12.345.678-9',
    rg_orgao: 'SSP/SP',
    rg_uf: '',
    cpf: '52998224725',
    endereco: { logradouro: 'RUA DAS FLORES', numero: '100', complemento: 'APTO 12', bairro: 'JARDIM AMÉRICA', cidade: 'SÃO PAULO', uf: 'SP', cep: '01234567' },
  },
  avisos: [],
};

const ARQUIVOS: ArquivoParaLeitura[] = [
  { nome: 'rg.jpg', tipo: 'image/jpeg', base64: 'AAAA', bytes: 3 },
  { nome: 'conta.pdf', tipo: 'application/pdf', base64: 'JVBERi0=', bytes: 5 },
];

const CLAUDE: ConfigIA = { provedor: 'claude', modelo: 'claude-opus-5-5', chave: 'sk-ant-teste' };
const GEMINI: ConfigIA = { provedor: 'gemini', modelo: 'gemini-flash-latest', chave: 'AIza-teste' };

type Chamada = { url: string; metodo: string; cabecalhos: Headers; corpo: Record<string, unknown> | null };

/** fetch falso: registra as chamadas e devolve as respostas da fila. */
function fetchFalso(...respostas: (Response | (() => never))[]) {
  const chamadas: Chamada[] = [];
  const f = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const corpo = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    chamadas.push({ url, metodo: init?.method ?? 'GET', cabecalhos: new Headers(init?.headers), corpo });
    const r = respostas.shift();
    if (!r) throw new Error('chamada não esperada');
    if (typeof r === 'function') return r();
    return r;
  }) as typeof fetch;
  return { f, chamadas };
}

const json = (corpo: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json', ...extra } });

const mensagemClaude = (texto: string, stop_reason = 'end_turn') => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content: [{ type: 'text', text: texto }],
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
});

async function erroDe(p: Promise<unknown>): Promise<ErroIA> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ErroIA);
    return e as ErroIA;
  }
  throw new Error('era esperado um erro');
}

describe('conferência da leitura', () => {
  it('arruma formatos e valida os dados lidos', () => {
    const r = conferirLeitura(RESPOSTA);
    const v = Object.fromEntries(r.campos.map((c) => [c.chave, c.valor]));
    expect(v.nome).toBe('MARIA DA SILVA SOUZA');
    expect(v.genero).toBe('F');
    expect(v.nacionalidade).toBe('brasileira');
    expect(v.naturalidade_cidade).toBe('São José dos Campos');
    expect(v.naturalidade_uf).toBe('SP');
    expect(v.data_nascimento).toBe('1985-03-15');
    expect(v.rg_orgao).toBe('SSP');
    expect(v.rg_uf).toBe('SP');
    expect(v.cpf).toBe('529.982.247-25');
    expect(v['endereco.logradouro']).toBe('Rua das Flores');
    expect(v['endereco.bairro']).toBe('Jardim América');
    expect(v['endereco.complemento']).toBe('Apto 12');
    expect(v['endereco.cep']).toBe('01234-567');
    expect(v.estado_civil).toBeUndefined(); // vazio não vira campo
    expect(r.campos.every((c) => !c.problema)).toBe(true);
    // comprovante no nome da própria pessoa (sem "da", sem maiúsculas): sem aviso
    expect(r.avisos).toEqual([]);
    expect(r.ilegivel).toBe(false);
  });

  it('aponta CPF inválido', () => {
    const r = conferirLeitura({ ...RESPOSTA, pessoa: { ...RESPOSTA.pessoa, cpf: '529.982.247-26' } });
    expect(r.campos.find((c) => c.chave === 'cpf')!.problema).toMatch(/dígito verificador/);
    const curto = conferirLeitura({ ...RESPOSTA, pessoa: { ...RESPOSTA.pessoa, cpf: '5299822' } });
    expect(curto.campos.find((c) => c.chave === 'cpf')!.problema).toMatch(/11 dígitos/);
  });

  it('avisa quando o comprovante está em nome de outra pessoa', () => {
    const r = conferirLeitura({
      ...RESPOSTA,
      documentos: [RESPOSTA.documentos[0], { ...RESPOSTA.documentos[1], nome_titular: 'JOÃO PEREIRA' }],
    });
    expect(r.avisos.join(' ')).toMatch(/comprovante de residência está em nome de “JOÃO PEREIRA”, e não de “MARIA DA SILVA SOUZA”/);
  });

  it('avisa documentos de pessoas diferentes e nome diferente do já digitado', () => {
    const r = conferirLeitura(
      {
        ...RESPOSTA,
        documentos: [RESPOSTA.documentos[0], { arquivo: 'cnh.jpg', tipo: 'cnh', nome_titular: 'ANA COSTA', legivel: true, observacao: '' }],
      },
      'Carlos Lima',
    );
    expect(r.avisos.join(' ')).toMatch(/pessoas diferentes/);
    expect(r.avisos.join(' ')).toMatch(/diferente do nome que já estava no cadastro/);
  });

  it('documento ilegível e resposta estranha não quebram', () => {
    const r = conferirLeitura({
      documentos: [{ arquivo: 'borrado.jpg', tipo: 'rg', nome_titular: '', legivel: false, observacao: 'foto tremida' }],
      pessoa: {},
      avisos: ['Imagem desfocada'],
    });
    expect(r.ilegivel).toBe(true);
    expect(r.campos).toEqual([]);
    expect(r.avisos.join(' ')).toMatch(/Não foi possível ler “borrado.jpg” \(foto tremida\)/);
    expect(conferirLeitura(null).ilegivel).toBe(true);
    expect(conferirLeitura('texto').campos).toEqual([]);
    expect(conferirLeitura({ pessoa: { nome: 123, endereco: 'x' }, documentos: 'y' }).campos).toEqual([]);
  });

  it('descarta UF e data inválidas', () => {
    const r = conferirLeitura({ ...RESPOSTA, pessoa: { ...RESPOSTA.pessoa, naturalidade_uf: 'XX', data_nascimento: '31/02/1990' } });
    expect(r.campos.find((c) => c.chave === 'naturalidade_uf')).toBeUndefined();
    expect(r.campos.find((c) => c.chave === 'data_nascimento')).toBeUndefined();
    expect(r.avisos.join(' ')).toMatch(/não é uma data válida/);
  });

  it('funções auxiliares', () => {
    expect(mesmoNome('José dos Santos', 'JOSE SANTOS')).toBe(true);
    expect(mesmoNome('José Santos', 'José Souza')).toBe(false);
    expect(mesmoNome('', '')).toBe(false);
    expect(ajustarMaiusculas('AVENIDA DOM PEDRO II')).toBe('Avenida Dom Pedro II');
    expect(ajustarMaiusculas('Rua já Normal')).toBe('Rua já Normal');
    expect(ajustarMaiusculas("SANTA BÁRBARA D'OESTE")).toBe("Santa Bárbara D'Oeste");
    expect(dataISO('1985-03-15')).toBe('1985-03-15');
    expect(dataISO('5.3.1985')).toBe('1985-03-05');
    expect(dataISO('2999-01-01')).toBe('');
  });
});

describe('aplicar na pessoa', () => {
  it('preenche os campos marcados e ajusta nacionalidade e regime de bens', () => {
    const p = { ...novaPessoa(), nacionalidade: 'brasileiro', estado_civil: 'casado' as const, regime_bens: 'comunhao_parcial' as const };
    const nova = aplicarNaPessoa(p, { nome: 'maria souza', genero: 'F', estado_civil: 'solteiro', 'endereco.cidade': 'Campinas', cpf: '529.982.247-25' });
    expect(nova.nome).toBe('MARIA SOUZA');
    expect(nova.nacionalidade).toBe('brasileira');
    expect(nova.estado_civil).toBe('solteiro');
    expect(nova.regime_bens).toBe('');
    expect(nova.endereco.cidade).toBe('Campinas');
    expect(nova.cpf).toBe('529.982.247-25');
    expect(p.endereco.cidade).toBe(''); // não altera o original
  });
});

describe('arquivos', () => {
  it('reconhece o tipo pelo conteúdo', () => {
    expect(detectarTipo(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe('application/pdf');
    expect(detectarTipo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectarTipo(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe('image/png');
    const heic = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    expect(detectarTipo(heic)).toBe('heic');
    expect(detectarTipo(new TextEncoder().encode('olá, mundo'))).toBeNull();
  });
  it('base64 de arquivos grandes', () => {
    const b = new Uint8Array(100_000).map((_, i) => i % 256);
    expect(Buffer.from(paraBase64(b), 'base64')).toEqual(Buffer.from(b));
  });
  it('limites do envio', () => {
    expect(() => conferirLote([])).toThrow(/pelo menos um arquivo/);
    expect(() => conferirLote(Array(7).fill(ARQUIVOS[0]))).toThrow(/no máximo 6/);
    expect(() => conferirLote([{ ...ARQUIVOS[1], bytes: 19 * 1024 * 1024 }])).toThrow(/limite/);
  });
});

describe('resposta em JSON', () => {
  it('tolera cercas e texto em volta', () => {
    expect(interpretarJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(interpretarJSON('Aqui está: {"a":2} pronto')).toEqual({ a: 2 });
    expect(() => interpretarJSON('não sei')).toThrow(ErroIA);
  });
});

describe('Claude (simulado)', () => {
  it('envia imagem e PDF com saída estruturada, esforço e fallback, e lê a resposta', async () => {
    const { f, chamadas } = fetchFalso(json(mensagemClaude(JSON.stringify(RESPOSTA))));
    const r = await lerDocumentos(CLAUDE, ARQUIVOS, { fetch: f });
    expect(r).toEqual(RESPOSTA);
    expect(chamadas).toHaveLength(1);
    const c = chamadas[0];
    expect(c.url).toMatch(/^https:\/\/api\.anthropic\.com\/v1\/messages/);
    expect(c.cabecalhos.get('authorization') ?? c.cabecalhos.get('x-api-key')).toMatch(/sk-ant-teste/);
    expect(c.cabecalhos.get('anthropic-dangerous-direct-browser-access')).toBe('true');
    expect(c.cabecalhos.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    const corpo = c.corpo as Record<string, any>;
    expect(corpo.model).toBe('claude-opus-5-5');
    expect(corpo.fallbacks).toBe('default');
    expect(corpo.output_config.effort).toBe('medium');
    expect(corpo.output_config.format.type).toBe('json_schema');
    expect(corpo.thinking).toBeUndefined();
    const conteudo = corpo.messages[0].content;
    expect(conteudo[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } });
    expect(conteudo[1]).toMatchObject({ type: 'document', source: { type: 'base64', media_type: 'application/pdf' } });
    expect(conteudo[2].type).toBe('text');
    expect(conteudo[2].text).toContain('1. rg.jpg');
  });

  it('modelo sem fallback nem esforço: não manda esses parâmetros', async () => {
    const { f, chamadas } = fetchFalso(json(mensagemClaude(JSON.stringify(RESPOSTA))));
    await lerDocumentos({ ...CLAUDE, modelo: 'claude-3-haiku-20240307' }, ARQUIVOS, { fetch: f });
    const corpo = chamadas[0].corpo as Record<string, any>;
    expect(corpo.fallbacks).toBeUndefined();
    expect(corpo.output_config.effort).toBeUndefined();
    expect(chamadas[0].cabecalhos.get('anthropic-beta') ?? '').not.toContain('server-side-fallback');
  });

  it('chave inválida', async () => {
    const { f } = fetchFalso(json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401));
    const e = await erroDe(lerDocumentos(CLAUDE, ARQUIVOS, { fetch: f }));
    expect(e.tipo).toBe('chave');
    expect(e.message).toMatch(/chave de API do Claude foi recusada/);
  });

  it('modelo inexistente', async () => {
    const { f } = fetchFalso(json({ type: 'error', error: { type: 'not_found_error', message: 'model: claude-xyz' } }, 404));
    const e = await erroDe(lerDocumentos({ ...CLAUDE, modelo: 'claude-xyz' }, ARQUIVOS, { fetch: f }));
    expect(e.tipo).toBe('modelo');
    expect(e.message).toMatch(/“claude-xyz”|"claude-xyz"/);
  });

  it('sem internet', async () => {
    const semRede = () => {
      throw new TypeError('Failed to fetch');
    };
    const { f } = fetchFalso(semRede, semRede);
    const e = await erroDe(lerDocumentos(CLAUDE, ARQUIVOS, { fetch: f }));
    expect(e.tipo).toBe('sem_internet');
  });

  it('serviço sobrecarregado', async () => {
    const { f } = fetchFalso(json({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }, 529, { 'x-should-retry': 'false' }));
    const e = await erroDe(lerDocumentos(CLAUDE, ARQUIVOS, { fetch: f }));
    expect(e.tipo).toBe('servico');
  });

  it('recusa do modelo', async () => {
    const { f } = fetchFalso(json({ ...mensagemClaude(''), content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: 'x' } }));
    const e = await erroDe(lerDocumentos(CLAUDE, ARQUIVOS, { fetch: f }));
    expect(e.tipo).toBe('recusa');
  });

  it('modelo sem saída estruturada: repete pedindo só pelo texto', async () => {
    const { f, chamadas } = fetchFalso(
      json({ type: 'error', error: { type: 'invalid_request_error', message: 'output_config.format: structured outputs are not supported for this model' } }, 400),
      json(mensagemClaude('```json\n' + JSON.stringify(RESPOSTA) + '\n```')),
    );
    const r = await lerDocumentos(CLAUDE, ARQUIVOS, { fetch: f });
    expect(r).toEqual(RESPOSTA);
    expect((chamadas[1].corpo as any).output_config.format).toBeUndefined();
  });

  it('conta sem o recurso de fallback: repete sem ele', async () => {
    const { f, chamadas } = fetchFalso(
      json({ type: 'error', error: { type: 'invalid_request_error', message: 'Unexpected value(s) `server-side-fallback-2026-07-01` for the `anthropic-beta` header.' } }, 400),
      json(mensagemClaude(JSON.stringify(RESPOSTA))),
    );
    await lerDocumentos(CLAUDE, ARQUIVOS, { fetch: f });
    expect((chamadas[1].corpo as any).fallbacks).toBeUndefined();
    expect((chamadas[1].corpo as any).output_config.format.type).toBe('json_schema');
  });

  it('lista os modelos da chave', async () => {
    const { f, chamadas } = fetchFalso(
      json({ data: [{ id: 'claude-opus-5-5', type: 'model', display_name: 'Opus', created_at: '2026-01-01T00:00:00Z' }], has_more: false, first_id: 'a', last_id: 'a' }),
    );
    expect(await listarModelos(CLAUDE, { fetch: f })).toEqual(['claude-opus-5-5']);
    expect(chamadas[0].url).toMatch(/\/v1\/models/);
  });
});

describe('Gemini (simulado)', () => {
  const respostaGemini = (texto: string, finishReason = 'STOP') => ({ candidates: [{ finishReason, content: { role: 'model', parts: [{ text: texto }] } }] });

  it('envia os arquivos e lê a resposta', async () => {
    const { f, chamadas } = fetchFalso(json(respostaGemini(JSON.stringify(RESPOSTA))));
    const r = await lerDocumentos(GEMINI, ARQUIVOS, { fetch: f });
    expect(r).toEqual(RESPOSTA);
    const c = chamadas[0];
    expect(c.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent');
    expect(c.metodo).toBe('POST');
    expect(c.cabecalhos.get('x-goog-api-key')).toBe('AIza-teste');
    expect(c.url).not.toContain('AIza'); // a chave não vai no endereço
    const corpo = c.corpo as Record<string, any>;
    expect(corpo.contents[0].parts[0]).toEqual({ inline_data: { mime_type: 'image/jpeg', data: 'AAAA' } });
    expect(corpo.contents[0].parts[1].inline_data.mime_type).toBe('application/pdf');
    expect(corpo.generationConfig.responseMimeType).toBe('application/json');
    expect(corpo.generationConfig.responseJsonSchema).toBeDefined();
  });

  it('chave inválida', async () => {
    const { f } = fetchFalso(json({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }, 400));
    const e = await erroDe(lerDocumentos(GEMINI, ARQUIVOS, { fetch: f }));
    expect(e.tipo).toBe('chave');
    expect(e.message).toMatch(/Gemini/);
  });

  it('modelo inexistente, limite e sem internet', async () => {
    let r = fetchFalso(json({ error: { code: 404, message: 'models/x is not found', status: 'NOT_FOUND' } }, 404));
    expect((await erroDe(lerDocumentos({ ...GEMINI, modelo: 'x' }, ARQUIVOS, { fetch: r.f }))).tipo).toBe('modelo');
    r = fetchFalso(json({ error: { code: 429, message: 'quota', status: 'RESOURCE_EXHAUSTED' } }, 429));
    expect((await erroDe(lerDocumentos(GEMINI, ARQUIVOS, { fetch: r.f }))).tipo).toBe('limite');
    r = fetchFalso(() => {
      throw new TypeError('Failed to fetch');
    });
    expect((await erroDe(lerDocumentos(GEMINI, ARQUIVOS, { fetch: r.f }))).tipo).toBe('sem_internet');
  });

  it('bloqueio de segurança', async () => {
    const { f } = fetchFalso(json({ promptFeedback: { blockReason: 'SAFETY' } }));
    expect((await erroDe(lerDocumentos(GEMINI, ARQUIVOS, { fetch: f }))).tipo).toBe('recusa');
  });

  it('modelo que não aceita o esquema: repete sem ele', async () => {
    const { f, chamadas } = fetchFalso(
      json({ error: { code: 400, message: 'Invalid JSON payload received. Unknown name "responseJsonSchema"', status: 'INVALID_ARGUMENT' } }, 400),
      json(respostaGemini(JSON.stringify(RESPOSTA))),
    );
    expect(await lerDocumentos(GEMINI, ARQUIVOS, { fetch: f })).toEqual(RESPOSTA);
    expect((chamadas[1].corpo as any).generationConfig.responseJsonSchema).toBeUndefined();
  });

  it('lista os modelos que geram conteúdo', async () => {
    const { f } = fetchFalso(
      json({
        models: [
          { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
        ],
      }),
    );
    expect(await listarModelos(GEMINI, { fetch: f })).toEqual(['gemini-flash-latest']);
  });
});

describe('configuração incompleta', () => {
  it('explica o que falta', async () => {
    expect((await erroDe(lerDocumentos({ provedor: '', modelo: '', chave: '' }, ARQUIVOS))).message).toMatch(/Nenhum serviço de IA/);
    expect((await erroDe(lerDocumentos({ ...CLAUDE, chave: ' ' }, ARQUIVOS))).message).toMatch(/Falta a chave/);
    expect((await erroDe(lerDocumentos({ ...CLAUDE, modelo: '' }, ARQUIVOS))).message).toMatch(/Falta o nome do modelo/);
    expect((await erroDe(lerDocumentos(CLAUDE, []))).tipo).toBe('arquivo');
  });
});
