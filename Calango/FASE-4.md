# Fase 4 — Leitura de documentos por IA: relatório

Este arquivo resume o que foi feito na Fase 4, como funciona e o que ainda **precisa da sua conferência**. O passo a passo de uso está no `LEIA-ME.md`, seção 11.

---

## 1. O que foi entregue

| Item da especificação (seção 11) | Situação |
|---|---|
| Configurações: escolher **Claude** ou **Gemini**, chave de API e nome do modelo (campo editável, com sugestão; nada fixo no código) | ✅ |
| Aviso de que a chave fica na pasta de dados e quem tem acesso à pasta pode vê-la | ✅ |
| **Aviso obrigatório antes de cada envio**, com o texto da especificação e caixa de confirmação | ✅ (a confirmação vale para um envio só) |
| Envio da imagem ou do PDF direto ao modelo (sem OCR separado), pedindo JSON com os campos da pessoa | ✅ |
| **Tela de revisão obrigatória**, com os campos da IA destacados; nada é salvo sem revisão e confirmação | ✅ |
| Validação do CPF | ✅ |
| Aviso quando o comprovante está em nome de outra pessoa | ✅ |
| Erros (chave inválida, sem internet, documento ilegível) sem travar o sistema | ✅ |

---

## 2. Como funciona (em linguagem simples)

- **Onde aparece:** no cadastro de qualquer pessoa (sócio, administrador, titular do EI), há o botão **📷 Preencher com documentos (IA)**.
- **O que é enviado:** só os arquivos que você escolher e as instruções de leitura. Os dados da empresa e de outros sócios **não** vão.
- **Para onde vai:** o navegador fala **direto** com a Anthropic (Claude) ou com o Google (Gemini). Não há servidor do Calango no meio.
- **Fotos grandes** (de celular) são reduzidas antes do envio, para não mandar dados demais. PDFs vão como estão (até 10 MB cada).
- **A resposta é conferida pelo Calango antes de chegar a você:**
  - formatos: CPF com pontos, CEP com traço, data no formato certo, UF válida;
  - nomes de rua e cidade que vêm TODOS EM MAIÚSCULAS passam para a forma normal ("São José dos Campos");
  - "SSP/SP" no órgão do RG é separado em órgão (SSP) e UF (SP);
  - "brasileira/brasileiro" acompanha o gênero.
- **Avisos automáticos na revisão:**
  - CPF com dígito verificador errado;
  - comprovante de residência em nome de outra pessoa (ignora acentos e "de/da/dos" na comparação);
  - documento ilegível;
  - documentos de identidade de pessoas diferentes;
  - nome lido diferente do nome que já estava no cadastro;
  - nenhum comprovante reconhecido (o endereço fica em branco).
- **A IA não inventa:** ela é instruída a deixar em branco o que não estiver escrito. O **gênero** só é preenchido se o documento trouxer o campo "sexo" (a CIN traz; o RG antigo e a CNH, em geral, não). Estado civil e profissão quase nunca constam nesses documentos e ficam para você.
- **Depois de usar**, os campos lidos ficam em amarelo no formulário até você mexer neles ou clicar em "Já conferi". Nada é gravado até você salvar a tela.

### A chave de API

- Fica no `configuracoes.json` da pasta de dados, e portanto também nas cópias de `backups/`. O aviso aparece na tela de Configurações.
- **Não vai** nos pacotes de exportação: ao exportar, ela sai em branco. Ao importar configurações, a chave que já estava na pasta é mantida.
- Ao trocar de serviço (Claude ↔ Gemini), o Calango pede confirmação e apaga a chave antiga, que é de outro provedor.

### Escolha técnica que vale saber

- **Claude:** usa a biblioteca oficial da Anthropic. Com os modelos que aceitam o recurso, fica ligado o **"fallback" no servidor**: se o modelo escolhido recusar o pedido, a própria Anthropic repete a leitura em outro modelo recomendado, na mesma chamada. Se a conta não tiver esse recurso liberado, o Calango repete o pedido sem ele, automaticamente.
- **Gemini:** usa a API do Google diretamente. A chave vai no cabeçalho do pedido, não no endereço, para não ficar em registros de rede.
- **Resposta em JSON:** os dois serviços recebem o formato exato da resposta. Se o modelo escolhido não aceitar esse recurso, o Calango repete o pedido descrevendo o formato só por texto.
- **Sugestões de modelo:** `claude-opus-5-5` (Claude) e `gemini-flash-latest` (um apelido do Google que aponta sempre para o Flash mais recente). Não consegui confirmar, daqui, a lista atual de modelos do Google; por isso o botão **Testar chave e ver modelos** mostra os modelos que a sua chave pode usar.

---

## 3. Precisa da sua conferência

1. **Teste com documentos reais.** Os testes automáticos **simulam** a Anthropic e o Google; nenhuma chamada de verdade foi feita, porque não há chave neste ambiente. Na primeira vez:
   - use documentos de alguém da equipe (com autorização);
   - comece pelo botão **Testar chave**;
   - confira se a leitura e os avisos fazem sentido.
2. **Bloqueio de rede.** Se o escritório tiver firewall ou filtro de sites, libere `api.anthropic.com` (Claude) e/ou `generativelanguage.googleapis.com` (Gemini).
3. **Custo e plano.** Cada leitura é cobrada na conta do provedor. O Claude Opus é o modelo mais capaz e também o mais caro da Anthropic. Se quiser economizar, troque o modelo em Configurações (por exemplo `claude-sonnet-5-5`) e compare a qualidade.
4. **Termos de uso e LGPD.** O aviso da especificação aparece antes de cada envio. Vale confirmar no contrato com o provedor se o plano usado permite o envio de documentos de clientes. Em planos gratuitos, os dados podem ser usados para treinamento.
5. **CIN (nova carteira de identidade).** Nela, o número de registro é o próprio CPF. A IA preenche o campo "RG — número" com esse número. Confira se é assim que vocês querem no contrato, ou se preferem outra redação para quem tem CIN.
6. **Comprovante em nome de outra pessoa.** O aviso sugere conferir se o registro vai pedir uma declaração de residência. Ajuste a orientação ao que a Junta de vocês exige.

---

## 4. Limitações conhecidas

- Uma pessoa por envio (até 6 arquivos). Para dois sócios, use o botão no cadastro de cada um.
- Fotos HEIC (iPhone) não abrem no navegador; precisam ser enviadas como JPG.
- Profissão e regime de bens não são lidos: não constam nesses documentos.
- Pessoa jurídica, menor de idade e estrangeiro continuam fora do cadastro, como nas fases anteriores.
- O arquivo `sistema/index.html` passou de cerca de 690 KB para cerca de 1,1 MB, por causa da biblioteca oficial da Anthropic. Ele continua abrindo direto do disco, sem internet.

---

## 5. Testes

- **179 testes de unidade** (`npm test`); os das fases anteriores continuam passando. Os novos cobrem:
  - conferência da resposta: formatos, CPF inválido, comprovante em nome de outra pessoa, documentos de pessoas diferentes, documento ilegível, respostas malformadas;
  - aplicação no cadastro: nacionalidade pelo gênero, regime de bens apagado quando não se aplica;
  - arquivos: reconhecimento de PDF, JPG, PNG e HEIC pelo conteúdo, limites de quantidade e tamanho;
  - Claude simulado: formato do pedido (imagem, PDF, JSON, esforço, fallback); chave inválida; modelo inexistente; sem internet; serviço sobrecarregado; recusa; repetição sem o formato JSON ou sem o fallback; lista de modelos;
  - Gemini simulado: formato do pedido (chave no cabeçalho); chave inválida; modelo inexistente; limite; sem internet; bloqueio; repetição sem o formato; lista de modelos;
  - a chave de API não vai na exportação e é mantida na importação.
- **Teste no navegador** (`npm run test:navegador`), novo arquivo `testes-navegador/leitura-ia.cjs`, com os serviços simulados. Ele passa por:
  - janela sem configuração;
  - configuração do Claude e "Testar chave";
  - arquivo HEIC recusado;
  - aviso obrigatório: o envio fica bloqueado sem a confirmação, e ela é pedida de novo a cada envio;
  - erros de "sem internet" e de chave inválida;
  - revisão com o aviso do comprovante em nome de outra pessoa, um campo desmarcado e outro corrigido;
  - campos destacados no formulário;
  - configuração do Gemini e uma leitura com ele;
  - cancelar a revisão não muda o cadastro.
- O teste das Fases 1 a 3 continua passando, sem erros no console.
