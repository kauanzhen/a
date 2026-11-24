// Teste no navegador da leitura de documentos por IA (Fase 4).
// Os serviços da Anthropic e do Google são SIMULADOS (as chamadas são
// interceptadas pelo Playwright): nenhum documento sai do computador.
//
// Cobre: configuração (Claude e Gemini, "Testar chave"), aviso obrigatório
// com confirmação antes de cada envio, erros (sem internet, chave inválida,
// arquivo HEIC), tela de revisão (comprovante em nome de outra pessoa, campo
// desmarcado, campo corrigido) e destaque dos campos preenchidos.
//
// Uso:  npm run build && node testes-navegador/leitura-ia.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const SISTEMA = path.resolve(__dirname, '../../sistema');
const S = path.join(os.tmpdir(), 'calango-teste-navegador', 'ia');
fs.mkdirSync(S, { recursive: true });
const PORTA = 8766;
const URL = `http://localhost:${PORTA}/index.html`;
const passo = (m) => console.log('✔', m);
const falhar = (m) => {
  throw new Error(m);
};

const RESPOSTA = {
  documentos: [
    { arquivo: 'rg-frente.png', tipo: 'rg', nome_titular: 'MARIA DA SILVA SOUZA', legivel: true, observacao: '' },
    { arquivo: 'conta-luz.pdf', tipo: 'comprovante_residencia', nome_titular: 'JOÃO PEREIRA DA COSTA', legivel: true, observacao: '' },
  ],
  pessoa: {
    nome: 'MARIA DA SILVA SOUZA',
    genero: 'F',
    nacionalidade: 'BRASILEIRA',
    naturalidade_cidade: 'SÃO JOSÉ DOS CAMPOS',
    naturalidade_uf: 'SP',
    data_nascimento: '1985-03-15',
    estado_civil: '',
    rg: '12.345.678-9',
    rg_orgao: 'SSP/SP',
    rg_uf: '',
    cpf: '52998224725',
    endereco: { logradouro: 'RUA DAS FLORES', numero: '100', complemento: 'APTO 12', bairro: 'JARDIM AMÉRICA', cidade: 'SÃO PAULO', uf: 'SP', cep: '01234567' },
  },
  avisos: [],
};

// 1×1 px PNG válido, PDF mínimo e o começo de um HEIC (foto de iPhone)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const HEIC = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0]);

const servidor = http
  .createServer((req, res) => {
    const arquivo = path.join(SISTEMA, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!arquivo.startsWith(SISTEMA) || !fs.existsSync(arquivo)) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(arquivo).pipe(res);
  })
  .listen(PORTA);

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const json = (corpo, status = 200, extra = {}) => ({ status, headers: { ...CORS, 'content-type': 'application/json', ...extra }, body: JSON.stringify(corpo) });

(async () => {
  const browser = await chromium.launch({ channel: 'chromium' }).catch(() => chromium.launch());
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle('dados-teste-ia', { create: true });
    };
  });

  // ---------- serviços simulados ----------
  let modoClaude = 'ok';
  const pedidosClaude = [];
  await ctx.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.url().includes('/v1/models')) {
      return route.fulfill(json({ data: [{ type: 'model', id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5', created_at: '2026-01-01T00:00:00Z' }], has_more: false, first_id: 'claude-opus-5-5', last_id: 'claude-opus-5-5' }));
    }
    pedidosClaude.push({ cabecalhos: req.headers(), corpo: req.postDataJSON() });
    if (modoClaude === 'sem-rede') return route.abort('internetdisconnected');
    if (modoClaude === 'chave-invalida') return route.fulfill(json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401));
    return route.fulfill(
      json({
        id: 'msg_teste',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [{ type: 'text', text: JSON.stringify(RESPOSTA) }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 100 },
      }),
    );
  });
  const pedidosGemini = [];
  await ctx.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.method() === 'GET') {
      return route.fulfill(json({ models: [{ name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent', 'countTokens'] }] }));
    }
    pedidosGemini.push({ url: req.url(), cabecalhos: req.headers(), corpo: req.postDataJSON() });
    const resposta = { ...RESPOSTA, documentos: [{ ...RESPOSTA.documentos[1], arquivo: 'conta-luz.pdf', nome_titular: 'MARIA DA SILVA SOUZA' }] };
    return route.fulfill(json({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text: JSON.stringify(resposta) }] } }] }));
  });

  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    // falhas de rede simuladas aparecem no console; não são erros do sistema
    if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|401/.test(m.text())) erros.push('console: ' + m.text());
  });
  page.on('dialog', (d) => d.accept());

  await page.goto(URL);
  await page.getByRole('button', { name: 'Escolher pasta de dados' }).click();
  await page.getByText('Bem-vindo ao Calango').waitFor();

  // ---------- 1. sem configuração: o botão explica o que falta ----------
  await page.getByRole('button', { name: /Novo documento/ }).first().click();
  await page.locator('.painel', { hasText: 'Contrato social de abertura' }).getByRole('button', { name: 'Começar' }).click();
  await page.getByText('Um sócio só').click();
  await page.getByRole('button', { name: /Próxima etapa/ }).click();
  const soc = page.locator('#secao-socios');
  await soc.getByRole('button', { name: '+ Adicionar sócio' }).click();
  let cartao = soc.locator('.cartao-pessoa').first();
  await cartao.getByRole('button', { name: /Preencher com documentos \(IA\)/ }).click();
  await page.getByText('Leitura por IA não configurada.').waitFor();
  if (!(await page.getByRole('button', { name: 'Enviar para leitura' }).isDisabled())) falhar('envio liberado sem configuração');
  passo('sem configuração, a janela explica o que fazer e não envia');

  // ---------- 2. configurar o Claude ----------
  await page.getByRole('button', { name: 'Ir para Configurações' }).click();
  const painelIA = page.locator('.painel', { hasText: 'Leitura de documentos por IA' });
  await painelIA.getByLabel('Serviço').selectOption('claude');
  const modelo = await painelIA.getByLabel('Modelo').inputValue();
  if (modelo !== 'claude-opus-5-5') falhar('modelo sugerido errado: ' + modelo);
  await painelIA.getByText(/Qualquer pessoa com acesso a essa pasta pode vê-la/).waitFor();
  await painelIA.getByLabel(/Chave de API do Claude/).fill('sk-ant-teste-123');
  await painelIA.getByRole('button', { name: /Testar chave/ }).click();
  await painelIA.getByText(/Chave aceita. O modelo “claude-opus-5-5” está disponível/).waitFor();
  await page.getByRole('button', { name: /Salvar configurações/ }).click();
  await page.getByText('Configurações salvas.').waitFor();
  await page.screenshot({ path: `${S}/01-configuracoes.png`, fullPage: true });
  passo('Claude configurado (modelo sugerido, aviso da chave, teste da chave)');

  // ---------- 3. voltar ao rascunho e abrir a leitura ----------
  await page.getByRole('button', { name: /Início/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).first().click();
  await page.getByRole('tab', { name: /2\./ }).click();
  // o rascunho não tinha sido salvo antes de ir às Configurações: o sócio é adicionado de novo
  await page.locator('#secao-socios').getByRole('button', { name: '+ Adicionar sócio' }).click();
  cartao = page.locator('#secao-socios .cartao-pessoa').first();
  await cartao.getByRole('button', { name: /Preencher com documentos \(IA\)/ }).click();
  const modal = page.locator('.modal');
  await modal.getByText(/Os documentos selecionados serão enviados a um serviço externo \(Anthropic ou Google\)/).waitFor();
  await modal.getByText(/Em planos gratuitos, os dados podem ser usados para treinamento e revisados por pessoas\. Confirme que o cliente autorizou este tratamento de dados\./).waitFor();

  await modal.locator('input[type=file]').setInputFiles([{ name: 'foto-iphone.heic', mimeType: 'image/heic', buffer: HEIC }]);
  await modal.getByText(/formato HEIC/).waitFor();
  passo('arquivo HEIC recusado com explicação');

  await modal.locator('input[type=file]').setInputFiles([
    { name: 'rg-frente.png', mimeType: 'image/png', buffer: PNG },
    { name: 'conta-luz.pdf', mimeType: 'application/pdf', buffer: PDF },
  ]);
  await modal.getByText('conta-luz.pdf').waitFor();
  const enviar = modal.getByRole('button', { name: 'Enviar para leitura' });
  if (!(await enviar.isDisabled())) falhar('envio liberado sem confirmar o aviso');
  const confirmar = modal.getByLabel(/confirmo que o cliente autorizou/);

  // sem internet
  modoClaude = 'sem-rede';
  await confirmar.check();
  await enviar.click();
  await modal.getByText(/Não foi possível falar com o serviço da Anthropic/).waitFor({ timeout: 30000 });
  if (await confirmar.isChecked()) falhar('a confirmação deveria valer para um envio só');
  if (!(await enviar.isDisabled())) falhar('novo envio sem nova confirmação');
  passo('sem internet: mensagem clara, e a confirmação é pedida de novo');

  // chave inválida
  modoClaude = 'chave-invalida';
  await confirmar.check();
  await enviar.click();
  await modal.getByText(/chave de API do Claude foi recusada/).waitFor({ timeout: 30000 });
  passo('chave inválida: mensagem clara');

  // leitura certa
  modoClaude = 'ok';
  await confirmar.check();
  await enviar.click();
  await page.getByText('Revisar os dados lidos pela IA').waitFor({ timeout: 30000 });
  const ultimo = pedidosClaude[pedidosClaude.length - 1];
  const blocos = ultimo.corpo.messages[0].content.map((b) => b.type).join(',');
  if (blocos !== 'image,document,text') falhar('blocos enviados: ' + blocos);
  if (!/server-side-fallback-2026-07-01/.test(ultimo.cabecalhos['anthropic-beta'] || '')) falhar('sem fallback no pedido');
  if (ultimo.corpo.model !== 'claude-opus-5-5' || ultimo.corpo.output_config?.format?.type !== 'json_schema') falhar('pedido sem modelo/formato');
  passo('pedido ao Claude com imagem + PDF, saída estruturada e fallback');

  await modal.getByText(/comprovante de residência está em nome de “JOÃO PEREIRA DA COSTA”/).waitFor();
  await modal.getByText(/RG \(carteira de identidade\)/).waitFor();
  await page.screenshot({ path: `${S}/02-revisao.png`, fullPage: true });
  // desmarca a data de nascimento e corrige o bairro
  await modal.getByLabel('Usar Data de nascimento').uncheck();
  await modal.getByLabel('Endereço — bairro', { exact: true }).fill('Jardim América II');
  passo('revisão: aviso do comprovante em nome de outra pessoa; campo desmarcado e campo corrigido');
  await modal.getByRole('button', { name: /^Usar \d+ campos marcados/ }).click();
  await modal.waitFor({ state: 'detached' });

  cartao = page.locator('#secao-socios .cartao-pessoa').first();
  const valor = (re) => cartao.getByLabel(re).first().inputValue();
  if ((await valor(/^Nome completo/)) !== 'MARIA DA SILVA SOUZA') falhar('nome não aplicado');
  if ((await valor(/^CPF/)) !== '529.982.247-25') falhar('CPF não aplicado: ' + (await valor(/^CPF/)));
  if ((await valor(/^Nacionalidade/)) !== 'brasileira') falhar('nacionalidade: ' + (await valor(/^Nacionalidade/)));
  if ((await valor(/Naturalidade — cidade/)) !== 'São José dos Campos') falhar('naturalidade');
  if ((await valor(/RG — órgão/)) !== 'SSP') falhar('órgão do RG');
  if ((await valor(/^Bairro/)) !== 'Jardim América II') falhar('bairro corrigido não aplicado');
  if ((await valor(/^Logradouro/)) !== 'Rua das Flores') falhar('logradouro');
  if ((await valor(/Data de nascimento/)) !== '') falhar('data desmarcada foi aplicada');
  const destacados = await cartao.locator('label.destaque-ia').count();
  if (destacados < 10) falhar('poucos campos destacados: ' + destacados);
  await cartao.getByText(/Os campos em amarelo foram preenchidos pela leitura por IA/).waitFor();
  await cartao.getByLabel(/^Nome completo/).fill('MARIA DA SILVA SOUZA COSTA');
  if ((await cartao.locator('label.destaque-ia').count()) !== destacados - 1) falhar('destaque não saiu do campo editado');
  await page.screenshot({ path: `${S}/03-formulario.png`, fullPage: true });
  passo(`dados aplicados ao formulário, ${destacados} campos destacados; o destaque sai quando o campo é editado`);

  // ---------- 4. Gemini ----------
  const salvarRascunho = page.getByRole('button', { name: /Salvar rascunho/ });
  await salvarRascunho.click();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Salvar rascunho/.test(b.textContent || '') && b.disabled));
  await page.getByRole('button', { name: /Configurações/ }).click();
  await painelIA.getByLabel('Serviço').selectOption('gemini');
  if ((await painelIA.getByLabel('Modelo').inputValue()) !== 'gemini-flash-latest') falhar('modelo sugerido do Gemini');
  if ((await painelIA.getByLabel(/Chave de API do Gemini/).inputValue()) !== '') falhar('a chave do Claude ficou no Gemini');
  await painelIA.getByLabel(/Chave de API do Gemini/).fill('AIza-teste-456');
  await painelIA.getByRole('button', { name: /Testar chave/ }).click();
  await painelIA.getByText(/Chave aceita/).waitFor();
  await page.getByRole('button', { name: /Salvar configurações/ }).click();
  await page.getByText('Configurações salvas.').waitFor();
  await page.getByRole('button', { name: /Início/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).first().click();
  await page.getByRole('tab', { name: /2\./ }).click();
  cartao = page.locator('#secao-socios .cartao-pessoa').first();
  await cartao.getByRole('button', { name: /Preencher com documentos \(IA\)/ }).click();
  await modal.getByText(/Serviço: Gemini/).waitFor();
  await modal.locator('input[type=file]').setInputFiles([{ name: 'conta-luz.pdf', mimeType: 'application/pdf', buffer: PDF }]);
  await modal.getByText('conta-luz.pdf').waitFor();
  await modal.getByLabel(/confirmo que o cliente autorizou/).check();
  await modal.getByRole('button', { name: 'Enviar para leitura' }).click();
  await page.getByText('Revisar os dados lidos pela IA').waitFor({ timeout: 30000 });
  const g = pedidosGemini[0];
  if (!g || g.cabecalhos['x-goog-api-key'] !== 'AIza-teste-456' || /AIza/.test(g.url)) falhar('chave do Gemini mal enviada');
  if (g.corpo.contents[0].parts[0].inline_data.mime_type !== 'application/pdf') falhar('PDF não enviado ao Gemini');
  if (await modal.getByText(/comprovante de residência está em nome de/).count()) falhar('aviso indevido: comprovante no nome da pessoa');
  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await modal.waitFor({ state: 'detached' });
  if ((await cartao.getByLabel(/^Nome completo/).inputValue()) !== 'MARIA DA SILVA SOUZA COSTA') falhar('cancelar a revisão mudou o cadastro');
  passo('Gemini: chave no cabeçalho (não no endereço), PDF enviado; cancelar não muda nada');

  if (erros.length) falhar('erros no console:\n' + erros.join('\n'));
  passo('sem erros no console');
  await browser.close();
  servidor.close();
  console.log(`\nCapturas de tela em ${S}`);
})().catch(async (e) => {
  console.error('✘', e.message);
  servidor.close();
  process.exit(1);
});
