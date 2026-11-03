// Teste no navegador (Chromium) do sistema já compilado (../sistema/index.html).
// Simula o uso real: abre direto do disco (file://), escolhe a pasta de dados
// (no teste, uma pasta interna do navegador), importa uma empresa, gera o
// contrato de 2 sócios, preenche uma abertura unipessoal pela tela, edita uma
// cláusula, salva configurações e exporta.
//
// Uso:  npm run test:navegador
// Os .docx gerados e as capturas de tela ficam em <pasta temporária>/calango-teste-navegador.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const SISTEMA = path.resolve(__dirname, '../../sistema');
const SAIDA = path.join(os.tmpdir(), 'calango-teste-navegador');
fs.mkdirSync(path.join(SAIDA, 'e2e'), { recursive: true });
const S = SAIDA;
const PORTA = 8765;
const URL = `http://localhost:${PORTA}/index.html`;
const passo = (m) => console.log('✔', m);

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

async function abrirNavegador() {
  // O Chromium completo é mais próximo do Edge; se não houver, usa o padrão.
  return chromium.launch({ channel: 'chromium' }).catch(() => chromium.launch());
}

(async () => {
  const browser = await abrirNavegador();
  // ---------- 1. abrir direto do disco (file://) ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
    await page.goto('file://' + path.join(SISTEMA, 'index.html'));
    await page.getByRole('button', { name: 'Escolher pasta de dados' }).waitFor({ timeout: 10000 });
    await page.screenshot({ path: `${S}/e2e/01-file.png` });
    passo(`abre via file:// sem servidor (erros no console: ${erros.length ? erros.join(' | ') : 'nenhum'})`);
    await ctx.close();
  }
  // ---------- 2. fluxo completo ----------
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
  await ctx.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle('dados-teste', { create: true });
    };
  });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && erros.push('console: ' + m.text()));
  page.on('dialog', (d) => d.accept());

  await page.goto(URL);
  await page.getByRole('button', { name: 'Escolher pasta de dados' }).click();
  await page.getByText('Bem-vindo ao Calango').waitFor();
  passo('pasta de dados escolhida e preparada');

  // carrega uma empresa de teste pela tela de importação (também testa a importação)
  await page.getByRole('button', { name: /Exportar \/ importar/ }).click();
  await page.locator('input[type=file]').setInputFiles(path.join(__dirname, 'pacote-empresa-exemplo.json'));
  await page.getByText('EXEMPLO COMÉRCIO E SERVIÇOS LTDA').waitFor();
  await page.getByRole('button', { name: /Importar 1 item/ }).click();
  await page.getByText('1 item(ns) importado(s).').waitFor();
  passo('importação de empresa por arquivo .json');
  await page.getByRole('button', { name: /Início/ }).click();
  await page.getByText('Documentos em andamento').waitFor();
  await page.screenshot({ path: `${S}/e2e/02-inicio.png`, fullPage: true });

  // --- documento semeado (2 sócios): revisar e gerar ---
  await page.getByRole('button', { name: 'Continuar' }).first().click();
  await page.getByRole('tab', { name: /1\. Cláusulas/ }).waitFor();
  await page.screenshot({ path: `${S}/e2e/03-etapa1.png`, fullPage: true });
  await page.getByRole('tab', { name: /3\. Revisão/ }).click();
  await page.getByText('Nenhuma pendência').waitFor();
  await page.screenshot({ path: `${S}/e2e/04-revisao.png`, fullPage: true });
  let [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Gerar \.docx/ }).click()]);
  await dl.saveAs(`${S}/e2e/${dl.suggestedFilename()}`);
  passo(`gerou .docx (2 sócios): ${dl.suggestedFilename()}`);
  await page.getByRole('button', { name: /Marcar como registrado/ }).click();
  await page.getByLabel(/NIRE atribuído/).fill('35212345678');
  await page.getByRole('button', { name: 'Confirmar registro' }).click();
  await page.getByText(/já foi registrado/).waitFor();
  passo('marcado como registrado');

  // --- nova abertura unipessoal, preenchendo tudo pela tela ---
  await page.getByRole('button', { name: /Novo documento/ }).first().click();
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.getByText('Quantos sócios terá a empresa?').waitFor();
  await page.getByText('Um sócio só').click();
  await page.getByRole('button', { name: /Próxima etapa/ }).click();
  await page.getByText(/Faltam \d+ informação/).waitFor();
  await page.screenshot({ path: `${S}/e2e/05-etapa2-vazia.png`, fullPage: true });

  const emp = page.locator('#secao-empresa');
  await emp.getByLabel(/^Razão social/).fill('Padaria Dona Rosa Ltda');
  await emp.getByLabel(/^Logradouro/).fill('Rua das Flores');
  await emp.getByLabel(/^Número/).fill('45');
  await emp.getByLabel(/^Bairro/).fill('Vila Nova');
  await emp.getByLabel(/^Cidade/).fill('Barueri');
  await emp.getByLabel(/^UF/).selectOption('SP');
  await emp.getByLabel(/^CEP/).fill('06400000');
  await emp.getByLabel(/Início das atividades/).fill('2026-12-01');
  await emp.getByLabel(/Descrição do objeto social/).fill('fabricação de produtos de panificação e confeitaria');
  await emp.getByRole('button', { name: '+ Adicionar CNAE' }).click();
  await emp.getByLabel('Código do CNAE 1').fill('1091102');
  await emp.getByLabel('Descrição do CNAE 1').fill('Fabricação de produtos de padaria e confeitaria com predominância de produção própria');
  await emp.getByLabel(/^Enquadramento/).selectOption('ME');
  await emp.getByLabel(/^Bairro/).click();
  const cep = await emp.getByLabel(/^CEP/).inputValue();
  if (cep !== '06400-000') throw new Error('CEP não formatado: ' + cep);
  passo('dados da empresa preenchidos (CEP formatado ao sair do campo)');

  const soc = page.locator('#secao-socios');
  await soc.getByRole('button', { name: '+ Adicionar sócio' }).click();
  const c = soc.locator('.cartao-pessoa').first();
  await c.getByLabel(/^Nome completo/).fill('Rosa Maria dos Santos');
  await c.getByText('Feminino', { exact: true }).click();
  const nac = await c.getByLabel(/^Nacionalidade/).inputValue();
  if (nac !== 'brasileira') throw new Error('nacionalidade não ajustou ao gênero: ' + nac);
  await c.getByLabel(/Naturalidade — cidade/).fill('São Paulo');
  await c.getByLabel(/Naturalidade — UF/).selectOption('SP');
  await c.getByLabel(/Data de nascimento/).fill('1975-05-20');
  await c.getByLabel(/^Estado civil/).selectOption('casado');
  await c.getByText(/Informe o regime de bens/).waitFor();
  passo('regime de bens exigido para casada');
  await c.getByLabel(/Regime de bens/).selectOption('comunhao_parcial');
  await c.getByLabel(/^Profissão/).fill('empresária');
  await c.getByLabel(/RG — número/).fill('11.222.333-4');
  await c.getByLabel(/RG — UF/).selectOption('SP');
  await c.getByLabel(/^CPF/).fill('111.444.777-36');
  await c.getByText('CPF inválido: confira os números.').waitFor();
  passo('CPF inválido detectado');
  await c.getByLabel(/^CPF/).fill('39053344705');
  await c.getByLabel(/^Logradouro/).fill('Avenida Paulista');
  await c.getByLabel(/^Número/).fill('1000');
  await c.getByLabel(/^Bairro/).fill('Bela Vista');
  await c.getByLabel(/^Cidade/).fill('São Paulo');
  await c.getByLabel(/^UF/).selectOption('SP');
  await c.getByLabel(/^CEP/).fill('01310100');
  const cpf = await c.getByLabel(/^CPF/).inputValue();
  if (cpf !== '390.533.447-05') throw new Error('CPF não formatado/perdido: ' + cpf);
  passo('sócia preenchida (CPF formatado e mantido mesmo com digitação rápida)');

  const cap = page.locator('#secao-capital');
  await cap.getByText('Classe única (quotas ordinárias)').click();
  await cap.getByLabel(/^Capital social/).fill('10.000,00');
  await cap.getByLabel(/^Valor unitário da quota/).fill('1.000,00');
  await cap.getByText('10 quotas', { exact: true }).waitFor();
  await cap.getByText('Percentual (%)').click();
  const celula = cap.getByLabel(/Participação de ROSA MARIA DOS SANTOS/);
  await celula.fill('33,33');
  await celula.press('Enter');
  await cap.getByText('O percentual informado não resulta em um número inteiro de quotas.').waitFor();
  await page.screenshot({ path: `${S}/e2e/06-quotas-bloqueio.png`, fullPage: false, clip: await cap.boundingBox() });
  passo('percentual que não dá quota inteira foi bloqueado com opções');
  await celula.fill('100');
  await celula.press('Enter');
  await cap.getByText('A soma das participações confere com o capital social.').waitFor();
  passo('participação de 100% aceita');

  const adm = page.locator('#secao-administracao');
  await adm.getByText(/ROSA MARIA DOS SANTOS — sócio administrador/).click();
  await adm.locator('label', { hasText: /^ROSA MARIA DOS SANTOS$/ }).click();
  const fec = page.locator('#secao-fechamento');
  await fec.getByLabel(/Foro — cidade/).fill('Barueri');
  await fec.getByLabel(/Foro — UF/).selectOption('SP');
  await fec.getByLabel(/Local da assinatura — cidade/).fill('Barueri');
  await fec.getByLabel(/Local da assinatura — UF/).selectOption('SP');
  await fec.getByLabel(/Data do documento/).fill('2026-11-03');
  await page.getByText('Todos os dados exigidos pelas cláusulas escolhidas estão preenchidos.').waitFor();
  passo('Etapa 2 completa, sem pendências');
  await page.screenshot({ path: `${S}/e2e/07-etapa2-cheia.png`, fullPage: true });

  await page.getByRole('button', { name: /Próxima etapa/ }).click();
  await page.getByText('Nenhuma pendência').waitFor();
  await page.screenshot({ path: `${S}/e2e/08-revisao-unipessoal.png`, fullPage: true });
  [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Gerar \.docx/ }).click()]);
  await dl.saveAs(`${S}/e2e/${dl.suggestedFilename()}`);
  passo(`gerou .docx (unipessoal): ${dl.suggestedFilename()}`);

  // --- biblioteca: editar cláusula e criar versão 2 ---
  await page.getByRole('button', { name: /Biblioteca de cláusulas/ }).click();
  await page.getByPlaceholder('Título, texto ou etiqueta').fill('foro');
  await page.locator('tr', { hasText: 'DO FORO' }).getByRole('button', { name: 'Editar' }).click();
  const ta = page.getByLabel('Texto da cláusula');
  await ta.click();
  await ta.press('End');
  await ta.type(' Teste de edição {o sócio|a sócia|os sócios|as sócias : socios}.');
  await page.locator('.folha').getByText(/Teste de edição os sócios\./).waitFor();
  await page.getByLabel('Dados de exemplo').selectOption('uma-socia');
  await page.locator('.folha').getByText(/Teste de edição a sócia\./).waitFor();
  passo('pré-visualização ao vivo com concordância');
  await page.screenshot({ path: `${S}/e2e/09-editor.png`, fullPage: true });
  await page.getByRole('button', { name: /Salvar nova versão/ }).click();
  await page.getByText(/salva como versão 2/).waitFor();
  await page.getByRole('button', { name: /^v1 — / }).waitFor();
  passo('nova versão salva, versão 1 no histórico');

  // inserir variável pelo botão
  await page.getByRole('button', { name: /Variável/ }).click();
  await page.getByPlaceholder('ex.: CPF, capital, endereço').fill('razão');
  await page.locator('.lista-escolha button', { hasText: 'Razão social' }).first().click();
  const corpo = await ta.inputValue();
  if (!corpo.includes('{{empresa.razao_social}}')) throw new Error('variável não inserida');
  passo('botão “Variável” insere {{empresa.razao_social}}');

  // --- configurações ---
  await page.getByRole('button', { name: /Configurações/ }).click();
  await page.getByRole('button', { name: 'Sim' }).click({ timeout: 500 }).catch(() => {});
  await page.getByLabel(/Texto do cabeçalho/).fill('ESCRITÓRIO MODELO DE CONTABILIDADE');
  await page.getByRole('button', { name: /Salvar configurações/ }).click();
  await page.getByText('Configurações salvas.').waitFor();
  await page.screenshot({ path: `${S}/e2e/10-configuracoes.png`, fullPage: true });
  passo('configurações salvas');

  // --- exportar ---
  await page.getByRole('button', { name: /Exportar \/ importar/ }).click();
  [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Tudo/ }).click()]);
  const caminhoJson = `${S}/e2e/${dl.suggestedFilename()}`;
  await dl.saveAs(caminhoJson);
  const pacote = JSON.parse(fs.readFileSync(caminhoJson, 'utf8'));
  passo(`exportou tudo: ${pacote.empresas.length} empresas, ${pacote.clausulas.length} cláusulas`);

  // --- empresas ---
  await page.getByRole('button', { name: /Empresas/ }).first().click();
  await page.screenshot({ path: `${S}/e2e/11-empresas.png`, fullPage: true });

  // --- estrutura da pasta de dados ---
  const arvore = await page.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('dados-teste');
    const r = [];
    async function andar(d, p) {
      for await (const [n, h] of d.entries()) {
        if (h.kind === 'directory') await andar(h, `${p}${n}/`);
        else if (!p.startsWith('clausulas/')) r.push(p + n);
      }
    }
    await andar(root, '');
    return r.sort();
  });
  console.log('Pasta de dados:\n  ' + arvore.join('\n  '));
  console.log('Erros no console da página:', erros.length ? erros : 'nenhum');
  await browser.close();
  servidor.close();
  console.log(`Arquivos gerados em: ${SAIDA}/e2e`);
})().catch((e) => {
  console.error('FALHOU:', e);
  servidor.close();
  process.exit(1);
});
