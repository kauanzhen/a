// Teste no navegador (Chromium) do sistema já compilado (../sistema/index.html).
// Simula o uso real: abre direto do disco (file://), escolhe a pasta de dados
// (no teste, uma pasta interna do navegador), importa uma empresa, gera o
// contrato de 2 sócios, preenche uma abertura unipessoal pela tela, edita uma
// cláusula, salva configurações, exporta e, nas Fases 2 e 3, faz uma alteração
// com consolidação (endereço, aumento, cessão para sócia nova), um distrato e
// uma transformação de LTDA em empresário individual.
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
const JSZip = require('jszip');
async function textoDocx(caminho) {
  const zip = await JSZip.loadAsync(fs.readFileSync(caminho));
  const xml = await zip.file('word/document.xml').async('string');
  return xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
}
async function esperarSemPendencias(page) {
  try {
    await page.getByText('Nenhuma pendência').waitFor({ timeout: 15000 });
  } catch (e) {
    const txt = (await page.locator('.alerta').allInnerTexts().catch(() => [])).join('\n');
    throw new Error('Ainda há pendências na Etapa 3:\n' + txt);
  }
}
async function preencherPessoa(c, d) {
  await c.getByLabel(/^Nome completo/).fill(d.nome);
  await c.getByText(d.genero, { exact: true }).click();
  await c.getByLabel(/Naturalidade — cidade/).fill(d.cidadeNat);
  await c.getByLabel(/Naturalidade — UF/).selectOption('SP');
  await c.getByLabel(/Data de nascimento/).fill(d.nascimento);
  await c.getByLabel(/^Estado civil/).selectOption('solteiro');
  await c.getByLabel(/^Profissão/).fill(d.profissao);
  await c.getByLabel(/RG — número/).fill(d.rg);
  await c.getByLabel(/RG — UF/).selectOption('SP');
  await c.getByLabel(/^CPF/).fill(d.cpf);
  await c.getByLabel(/^Logradouro/).fill('Rua Itapeva');
  await c.getByLabel(/^Número/).fill('77');
  await c.getByLabel(/^Bairro/).fill('Bela Vista');
  await c.getByLabel(/^Cidade/).fill('São Paulo');
  await c.getByLabel(/^UF/).selectOption('SP');
  await c.getByLabel(/^CEP/).fill('01332000');
}

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
  await page.locator('.painel', { hasText: 'Contrato social de abertura' }).getByRole('button', { name: 'Começar' }).click();
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

  // ---------- FASE 2: alteração contratual da empresa registrada ----------
  await page.getByRole('button', { name: /Empresas/ }).first().click();
  await page.locator('tr', { hasText: 'EXEMPLO COMÉRCIO E SERVIÇOS LTDA' }).getByRole('button', { name: 'Abrir' }).click();
  await page.getByRole('button', { name: 'Alteração contratual com consolidação' }).click();
  await page.getByRole('tab', { name: /1\. Cláusulas/ }).waitFor();
  await page.screenshot({ path: `${S}/e2e/12-alteracao-etapa1.png`, fullPage: true });
  await page.getByRole('button', { name: /Próxima etapa/ }).click();
  const empAlt = page.locator('#secao-empresa');
  await empAlt.getByLabel(/^Logradouro/).fill('Avenida Sebastião Davino dos Reis');
  await empAlt.getByLabel(/^Número/).fill('672');
  await empAlt.getByLabel(/^CNPJ/).fill('11.222.333/0001-81');
  const alt = page.locator('#secao-alteracao');
  await alt.getByLabel('Tipo de movimento').selectOption('aumento');
  await alt.getByRole('button', { name: '+ Adicionar movimento' }).click();
  await alt.getByLabel(/^Quem subscreve/).selectOption({ label: 'JOÃO DA SILVA PEREIRA' });
  await alt.getByLabel('Quantidade de quotas do movimento 1').fill('2000');
  await alt.getByText('R$ 12.500,00').waitFor();
  passo('alteração: aumento de capital recalcula o novo capital');
  await alt.getByLabel('Tipo de movimento').selectOption('cessao');
  await alt.getByRole('button', { name: '+ Adicionar movimento' }).click();
  await alt.getByLabel(/^Quem cede/).selectOption({ label: 'MARIA APARECIDA SOUZA' });
  await alt.getByLabel(/^Quem recebe/).selectOption({ label: '+ Pessoa nova (sócio que entra)' });
  await alt.getByLabel('Quantidade de quotas do movimento 2').fill('1000');
  await alt.locator('.etiqueta', { hasText: 'entra' }).waitFor();
  passo('alteração: cessão para pessoa nova (entra na sociedade)');
  const socAlt = page.locator('#secao-socios');
  const novaCard = socAlt.locator('.cartao-pessoa').last();
  await novaCard.locator('.cabeca').click();
  await preencherPessoa(novaCard, { nome: 'Beatriz Ramos Costa', genero: 'Feminino', cidadeNat: 'Barueri', nascimento: '1992-04-10', profissao: 'designer', rg: '55.666.777-8', cpf: '39053344705' });
  await page.getByText('Todos os dados exigidos pelas cláusulas escolhidas estão preenchidos.').waitFor();
  passo('alteração: Etapa 2 completa (dados da nova sócia preenchidos)');
  await page.screenshot({ path: `${S}/e2e/13-alteracao-etapa2.png`, fullPage: true });
  await page.getByRole('button', { name: /Próxima etapa/ }).click();
  await esperarSemPendencias(page);
  await page.screenshot({ path: `${S}/e2e/14-alteracao-revisao.png`, fullPage: true });
  [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Gerar \.docx/ }).click()]);
  const arqAlt = `${S}/e2e/${dl.suggestedFilename()}`;
  await dl.saveAs(arqAlt);
  const tAlt = await textoDocx(arqAlt);
  for (const trecho of [
    '1ª ALTERAÇÃO CONTRATUAL DA SOCIEDADE EXEMPLO COMÉRCIO E SERVIÇOS LTDA',
    'previsto na Cláusula Segunda do contrato social',
    'é aumentado de R$ 10.500,00 (dez mil e quinhentos reais) para R$ 12.500,00 (doze mil e quinhentos reais)',
    'cede e transfere, neste ato, 1.000 (mil) quotas',
    'à sócia ingressante BEATRIZ RAMOS COSTA',
    'Ingressa na sociedade, neste ato, a sócia BEATRIZ RAMOS COSTA',
    'CONSOLIDAÇÃO DO CONTRATO SOCIAL',
    'resolvem consolidar o contrato social',
  ]) {
    if (!tAlt.includes(trecho)) throw new Error('Trecho não encontrado na alteração: ' + trecho);
  }
  if (/\((a|as|o|os)\)/.test(tAlt)) throw new Error('A alteração tem "(a)"');
  passo(`gerou .docx da alteração com consolidação: ${dl.suggestedFilename()}`);
  await page.getByRole('button', { name: /Marcar como registrado/ }).click();
  await page.getByRole('button', { name: 'Confirmar registro' }).click();
  await page.getByText(/já foi registrado/).waitFor();
  passo('alteração registrada (cadastro vigente atualizado)');

  // ---------- FASE 3: distrato ----------
  await page.getByRole('button', { name: /Empresas/ }).first().click();
  await page.locator('tr', { hasText: 'EXEMPLO COMÉRCIO E SERVIÇOS LTDA' }).getByRole('button', { name: 'Abrir' }).click();
  await page.getByText('Avenida Sebastião Davino dos Reis').waitFor();
  passo('cadastro vigente mostra o endereço novo depois do registro');
  await page.getByRole('button', { name: 'Distrato' }).click();
  await page.getByRole('button', { name: /Próxima etapa/ }).click();
  const dis = page.locator('#secao-distrato');
  await dis.getByLabel(/Data de encerramento/).fill('2026-12-15');
  await dis.getByLabel(/Responsável pelo ativo e passivo/).selectOption({ label: 'JOÃO DA SILVA PEREIRA' });
  await dis.getByLabel(/Responsável pela guarda dos livros/).selectOption({ label: 'BEATRIZ RAMOS COSTA' });
  await page.getByText('Todos os dados exigidos pelas cláusulas escolhidas estão preenchidos.').waitFor();
  await page.getByRole('button', { name: /Próxima etapa/ }).click();
  await esperarSemPendencias(page);
  [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Gerar \.docx/ }).click()]);
  const arqDis = `${S}/e2e/${dl.suggestedFilename()}`;
  await dl.saveAs(arqDis);
  const tDis = await textoDocx(arqDis);
  for (const trecho of ['DISTRATO DE SOCIEDADE LIMITADA', 'Únicos sócios da sociedade limitada', 'CLÁUSULA SEXTA:', 'fica a cargo do ex-sócio JOÃO DA SILVA PEREIRA', 'A sócia BEATRIZ RAMOS COSTA']) {
    if (!tDis.includes(trecho)) throw new Error('Trecho não encontrado no distrato: ' + trecho);
  }
  passo(`gerou .docx do distrato: ${dl.suggestedFilename()}`);
  await page.getByRole('button', { name: /Marcar como registrado/ }).click();
  await page.getByRole('button', { name: 'Confirmar registro' }).click();
  await page.getByText(/já foi registrado/).waitFor();
  await page.getByRole('button', { name: /Empresas/ }).first().click();
  await page.locator('tr', { hasText: 'EXEMPLO COMÉRCIO E SERVIÇOS LTDA' }).getByText('Extinta').waitFor();
  passo('distrato registrado: empresa marcada como extinta');

  // ---------- FASE 3: transformação de LTDA unipessoal em empresário individual ----------
  await page.locator('tr', { hasText: 'PADARIA DONA ROSA LTDA' }).getByRole('button', { name: 'Abrir' }).click();
  await page.getByRole('button', { name: 'Abrir', exact: true }).first().click();
  await page.getByRole('button', { name: /Marcar como registrado/ }).click();
  await page.getByLabel(/^CNPJ/).fill('11.444.777/0001-61');
  await page.getByRole('button', { name: 'Confirmar registro' }).click();
  await page.getByText(/já foi registrado/).waitFor();
  await page.getByRole('button', { name: /Empresas/ }).first().click();
  await page.locator('tr', { hasText: 'PADARIA DONA ROSA LTDA' }).getByRole('button', { name: 'Abrir' }).click();
  await page.getByRole('button', { name: 'Transformação de LTDA em Empresário Individual' }).click();
  await page.getByRole('button', { name: /Próxima etapa/ }).click();
  await page.locator('#secao-empresa').getByLabel(/^Razão social/).fill('ROSA MARIA DOS SANTOS');
  await page.locator('#secao-empresa').getByLabel(/^NIRE/).fill('35212345679');
  await page.locator('#secao-socios h2', { hasText: 'Titular' }).waitFor();
  await page.screenshot({ path: `${S}/e2e/15-transformacao-etapa2.png`, fullPage: true });
  await page.getByRole('button', { name: /Próxima etapa/ }).click();
  await esperarSemPendencias(page);
  [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Gerar \.docx/ }).click()]);
  const arqTr = `${S}/e2e/${dl.suggestedFilename()}`;
  await dl.saveAs(arqTr);
  const tTr = await textoDocx(arqTr);
  for (const trecho of [
    'ALTERAÇÃO POR TRANSFORMAÇÃO DE SOCIEDADE EMPRESÁRIA LIMITADA EM EMPRESÁRIO INDIVIDUAL',
    'única sócia da sociedade PADARIA DONA ROSA LTDA',
    'O Empresário Individual adotará o nome empresarial ROSA MARIA DOS SANTOS.',
    'INSTRUMENTO DE INSCRIÇÃO DE EMPRESÁRIO INDIVIDUAL',
    'O capital é de R$ 10.000,00 (dez mil reais), totalmente integralizado',
  ]) {
    if (!tTr.includes(trecho)) throw new Error('Trecho não encontrado na transformação: ' + trecho);
  }
  passo(`gerou .docx da transformação LTDA → EI: ${dl.suggestedFilename()}`);
  await page.getByRole('button', { name: /Marcar como registrado/ }).click();
  await page.getByRole('button', { name: 'Confirmar registro' }).click();
  await page.getByText(/agora é Empresário Individual/).waitFor();
  await page.getByRole('button', { name: /Empresas/ }).first().click();
  await page.locator('tr', { hasText: 'ROSA MARIA DOS SANTOS' }).getByText('EI', { exact: true }).waitFor();
  passo('transformação registrada: a empresa passou a ser Empresário Individual');

  // --- empresas ---
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
