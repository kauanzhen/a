# Calango — Gerador de Atos Societários (LTDA)

> Nome provisório. Este arquivo é a especificação completa do projeto. Leia tudo antes de começar e trabalhe **uma fase por vez** (ver seção 14). Ao final de cada fase, pare, explique o que foi feito em linguagem simples e espere minha aprovação.

---

## 0. Sobre mim e como você deve trabalhar

- Não sou programador. Trabalho com legalização de empresas em um escritório de contabilidade.
- Explique decisões técnicas em português simples, sem jargão desnecessário.
- Antes de qualquer decisão estrutural grande que não esteja nesta especificação, **pergunte**.
- Código, comentários, nomes de telas e mensagens de erro: tudo em **português do Brasil**.
- Escreva um `LEIA-ME.md` para usuário leigo: como abrir, como escolher a pasta de dados, como fazer backup, como gerar um documento.
- Os modelos de referência do escritório estão na pasta `modelos/` (arquivos .docx). Use-os como base da biblioteca inicial de cláusulas, **corrigindo os erros listados na seção 13**.

---

## 1. Objetivo

Sistema interno para criar documentos societários de **sociedades limitadas (LTDA)** a partir de dados estruturados. Princípio central:

> **Os dados da empresa são a fonte da verdade. Os documentos são saídas geradas a partir deles.**

Documentos suportados (por fase):
- Contrato social de abertura (LTDA com vários sócios e LTDA unipessoal).
- Alteração contratual com consolidação.
- Distrato.
- Transformação (EI → LTDA unipessoal e LTDA → EI) — fase posterior.

---

## 2. Usuários e ambiente

- Windows 11, 2 a 3 usuários no escritório. Apenas um deles gera documentos que vão para registro, mas todos podem usar.
- Navegador: **Microsoft Edge** (já vem no Windows 11). O sistema deve exibir aviso claro se for aberto em navegador sem suporte à API de acesso a pastas (ex.: Firefox).
- Deve funcionar **sem internet** (exceto a função de IA, que é opcional).

---

## 3. Arquitetura técnica

- Aplicação web **local**, sem servidor e sem instalação: uma pasta com `index.html` e as bibliotecas **copiadas localmente** (nada carregado de CDN).
- A pasta do sistema ficará na rede do escritório; todos abrem o mesmo `index.html` pelo Edge.
- **Armazenamento:** usar a File System Access API (`showDirectoryPicker`).
  - Na primeira execução, o usuário escolhe a **pasta de dados** (pode ser na rede).
  - Guardar a referência da pasta (IndexedDB) para que nas próximas vezes baste um clique para liberar o acesso.
  - Permitir trocar a pasta de dados nas configurações.
- **Estrutura da pasta de dados:**
  ```
  dados/
    configuracoes.json         (cabeçalho, rodapé, fonte, margens, IA)
    clausulas/                 (um arquivo .json por cláusula)
    empresas/                  (um arquivo .json por empresa)
    backups/AAAA-MM-DD/        (cópia anterior de cada arquivo antes de sobrescrever)
    imagens/                   (imagens de cabeçalho)
  ```
- **Um arquivo por empresa** para reduzir conflito entre usuários. Antes de gravar, verificar se o arquivo foi alterado por outra pessoa desde que foi aberto (comparar data de modificação) e avisar em vez de sobrescrever.
- **Backup automático:** antes de cada gravação, copiar a versão anterior para `backups/`. Manter os últimos 30 dias.
- **Exportar/Importar:** botão para exportar uma empresa, a biblioteca de cláusulas ou tudo em um arquivo `.zip` ou `.json`, e importar de volta (para levar entre computadores fora da rede).
- Geração de .docx com a biblioteca `docx` (docx.js) incluída localmente.
- Organize o código em módulos separados (dados, gramática, motor de cláusulas, geração de docx, interface), pensando na manutenção futura.

---

## 4. Modelo de dados

### 4.1 Empresa
- Razão social, CNPJ, NIRE, data do registro na Junta, Junta Comercial (UF).
- Número da última alteração registrada (para gerar "Xª ALTERAÇÃO").
- Sede: logradouro, número, complemento, bairro, cidade, UF, CEP (campos separados).
- Data de início das atividades; prazo de duração (indeterminado ou data).
- Objeto social (texto ou lista de itens).
- CNAEs: código, descrição, tipo (principal/secundário). Exatamente um principal.
- Enquadramento: ME, EPP ou nenhum.
- Capital social, valor unitário da quota, forma de integralização (à vista, a prazo com data, em bens com descrição).
- Configuração de quotas (seção 5).
- Quadro societário: lista de participações (pessoa + quotas por classe).
- Administração: lista de administradores (sócios ou não sócios), forma de administração (isolada, conjunta, indistinta).
- Pró-labore: quais sócios.
- Foro (cidade/UF).
- Exercício social (padrão 1º de janeiro a 31 de dezembro).
- **Situação:** derivada automaticamente — unipessoal (1 sócio) ou pluripessoal.
- **Histórico de atos:** cada documento gerado fica salvo com tipo, data, status (`rascunho`, `gerado`, `registrado`), snapshot dos dados **antes** e **depois** e as cláusulas usadas (com a versão de cada uma).
- O cadastro **vigente** só é atualizado quando o usuário marca o ato como `registrado`. Até lá, o ato é uma proposta.

### 4.2 Pessoa (sócio, administrador, representante)
Campos usados nos modelos do escritório:
- Nome completo; **gênero (obrigatório: masculino/feminino)** — usado para concordância.
- Nacionalidade; maioridade (maior/menor); naturalidade (cidade/UF); data de nascimento.
- Estado civil (obrigatório): solteiro, casado, união estável, divorciado, separado judicialmente, viúvo (com flexão de gênero automática).
- **Regime de bens:** quando o estado civil for **casado** ou **união estável**, o sistema **pergunta obrigatoriamente** o regime e não permite avançar sem a resposta. Opções: comunhão parcial de bens, comunhão universal de bens, separação total (convencional) de bens, separação obrigatória de bens, participação final nos aquestos. Para os demais estados civis, a pergunta não aparece.
  - O texto da qualificação é preenchido automaticamente conforme a resposta, com concordância de gênero. Exemplos: "casado sob o regime de comunhão parcial de bens", "casada sob o regime de separação total de bens", "convivente em união estável sob o regime de comunhão parcial de bens".
  - Se o estado civil for alterado para um que não exige regime, o valor salvo do regime é descartado (com aviso).
- Profissão; registro em conselho de classe (opcional).
- RG, órgão emissor e UF; CPF (validar dígitos verificadores).
- Endereço residencial em campos separados.

**Preparado para o futuro, sem interface agora:** pessoa jurídica como sócia (CNPJ, representante), menor ou incapaz (representante/assistente), estrangeiro (documento, RNE). O modelo de dados deve suportar esses casos com um campo `tipo_pessoa` e `representante`, mas as telas podem ficar desativadas.

---

## 5. Sistema de quotas

O usuário **deve obrigatoriamente** definir o funcionamento das quotas antes de preencher o capital:

1. **Classe única (quotas ordinárias):** padrão dos modelos atuais.
2. **Classes distintas:** o usuário cria classes. Cada classe tem:
   - Nome (ex.: "Classe A", "Classe B", "Preferenciais").
   - Direito a voto: pleno, restrito (em quais matérias) ou sem voto.
   - Preferência na distribuição de lucros (sim/não, e descrição: prioritária, fixa, mínima).
   - Prioridade no reembolso do capital em caso de liquidação (sim/não).
   - Direito de eleger administrador(es) em separado (sim/não).
   - Valor unitário (padrão: igual ao das demais).

Regras:
- A participação de cada sócio pode ser informada **em valor (R$)** ou **em percentual**. O sistema converte para número de quotas.
- Se o percentual não resultar em número inteiro de quotas, **bloquear** e mostrar as opções de ajuste (arredondar, ajustar o capital ou o valor unitário). Nunca arredondar sozinho.
- Validar: soma das quotas = capital ÷ valor unitário; soma dos percentuais = 100%.
- Ao usar classes distintas, a cláusula de capital deve descrever as classes e seus direitos, e o quadro societário deve ter uma coluna por classe.
- Exibir aviso fixo: "Classes de quotas com direitos diferentes devem ter a redação revisada por advogado antes do registro."

---

## 6. Biblioteca de cláusulas

Cada cláusula é um bloco salvo em `clausulas/` com:

- `id`, `titulo_interno` (nome para a biblioteca), `titulo_secao` opcional (ex.: "DO CAPITAL SOCIAL").
- `tags` (ex.: capital, administração, unipessoal, pluripessoal, distrato, obrigatória).
- `documentos`: em quais tipos de documento pode ser usada (abertura, alteração, consolidação, distrato, transformação).
- `tipo_societario`: por enquanto sempre LTDA, mas o campo deve existir.
- `natureza`: `normal` (abertura/consolidação), `alteracao` (descreve uma mudança: anterior → novo), `fixa` (ex.: ratificação, fechamento).
- `regras`: obrigatória/opcional; `requer` (outras cláusulas); `conflita_com`; `condicao_de_exibicao` (ex.: só quando unipessoal).
- `corpo`: texto com variáveis, condicionais, parágrafos (Parágrafo Primeiro, Parágrafo Único…), alíneas (a, b, c…), listas e **tabelas dinâmicas** (quadro societário, CNAEs, CNAEs anteriores x novos).
- `campos_exigidos`: **derivados automaticamente** das variáveis usadas no corpo (não digitados manualmente).
- `versao` e histórico de versões (o ato salvo guarda qual versão usou).

### 6.1 Editor de cláusulas
- Tela para criar, editar, duplicar e arquivar cláusulas.
- O usuário **não deve precisar decorar sintaxe**: botão "inserir variável" com lista pesquisável dos campos, e botões para inserir condicional, parágrafo, alínea e tabela.
- Pré-visualização ao vivo com dados de exemplo (um sócio homem, uma sócia mulher, dois sócios, etc.) para conferir a concordância.
- Filtro por tags, texto e tipo de documento.

### 6.2 Biblioteca inicial
Criar as cláusulas iniciais a partir dos modelos em `modelos/`, separando cada cláusula e parágrafo em blocos reaproveitáveis. Exemplos de blocos de **alteração** a criar (padrão "anterior → novo", com o "anterior" preenchido automaticamente do cadastro vigente):
- Alteração de CNAEs (lista anterior e nova).
- Alteração de objeto social.
- Alteração de nome empresarial.
- Alteração de endereço da sede.
- Aumento e redução de capital (com integralização).
- Entrada de sócio, retirada de sócio, cessão e transferência de quotas.
- Alteração de administrador.
- Alteração de enquadramento (ME ↔ EPP).
- Ratificação das demais cláusulas (fixa, sempre antes da consolidação).

---

## 7. Gramática automática (essencial)

### 7.1 Concordância de gênero e número
Os modelos usam "Sr (ra)", "brasileiro (a)", "o (a) sócio (a)". **O documento final nunca deve conter essas formas com parênteses.** O motor deve resolver:
- **Gênero** pela pessoa referida: "o sócio"/"a sócia", "brasileiro"/"brasileira", "portador"/"portadora", "inscrito"/"inscrita", "nascido"/"nascida", "domiciliado"/"domiciliada".
- **Número** pela quantidade: "o sócio" / "os sócios"; "declara" / "declaram"; "assina" / "assinam".
- Grupo misto no plural → masculino plural. Grupo só de mulheres → feminino plural.
- **Unipessoal x pluripessoal:** expressões como "sócio único", "sociedade empresária limitada unipessoal" só aparecem quando há um único sócio.

Proponha uma sintaxe simples para isso no corpo das cláusulas (ex.: `{o sócio|a sócia|os sócios|as sócias : socios}`) e use-a em toda a biblioteca inicial.

### 7.2 Por extenso
- Valores em reais: `R$ 10.500,00 (dez mil e quinhentos reais)`; centavos corretos.
- Quantidade de quotas, com concordância: `10.500 (dez mil e quinhentas) quotas`.
- Datas do fechamento por extenso: `Barueri/SP, 3 de novembro de 2026`.
- Ordinais das cláusulas: PRIMEIRA, SEGUNDA… DÉCIMA, DÉCIMA PRIMEIRA… VIGÉSIMA QUINTA (até pelo menos CENTÉSIMA).
- Número da alteração: "1ª ALTERAÇÃO", "12ª ALTERAÇÃO".
- Percentuais.

Crie **testes automatizados** para extenso e concordância (incluindo casos difíceis: 1, 21, 100, 101, 1.000, 1.001.000, valores com centavos, "um real", "uma quota", "duas quotas").

---

## 8. Fluxo de uso

1. **Escolher o tipo de documento** (abertura, alteração, distrato).
2. **Escolher a empresa:** nova (abertura) ou existente (alteração/distrato).
3. **Etapa 1 — Cláusulas:**
   - O sistema já carrega um **conjunto padrão** de cláusulas para aquele tipo de documento e situação (unipessoal/pluripessoal).
   - O usuário liga/desliga as opcionais, adiciona outras da biblioteca (com filtro por tags) e **reordena arrastando**.
   - Áreas separadas: **corpo** e **anexo**.
   - Na alteração: duas áreas — **cláusulas de alteração** e **consolidação**.
   - Cláusulas obrigatórias não podem ser removidas; regras de `requer`/`conflita_com` geram aviso.
4. **Etapa 2 — Dados:**
   - Formulário montado automaticamente apenas com os campos exigidos pelas cláusulas escolhidas, **sem repetir** campos e agrupado em seções (Empresa, Sócios, Capital e quotas, Administração, Fechamento).
   - Em empresas existentes, os campos já vêm preenchidos com o cadastro vigente.
   - Validações em tempo real (CPF, soma das quotas, CNAE principal único, administrador definido, campos obrigatórios).
5. **Etapa 3 — Revisão:** pré-visualização do documento completo, lista de pendências e botão "Gerar .docx".
6. Salvar o ato no histórico como `gerado`. Depois, o usuário marca como `registrado` (informando data e número do registro), e só então o cadastro vigente é atualizado.

---

## 9. Regras por documento

### 9.1 Abertura
- Preâmbulo com qualificação de todos os sócios, ligados por "e", e frase de constituição.
- Cláusulas numeradas automaticamente, com títulos de seção.
- Quadro societário em tabela: sócio, percentual, quotas, valor (e colunas por classe, se houver).
- Fechamento: frase final, local e data por extenso, bloco de assinatura de cada sócio (nome e CPF) e, se configurado, administrador não sócio.

### 9.2 Alteração com consolidação
1. Título: "Xª ALTERAÇÃO CONTRATUAL DA SOCIEDADE (RAZÃO SOCIAL)" + CNPJ e NIRE.
2. Preâmbulo com a qualificação dos sócios atuais (e dos que entram, quando houver) e os dados de registro.
3. **Cláusulas de alteração**, numeradas a partir de PRIMEIRA, cada uma mostrando a situação anterior e a nova.
4. Cláusula fixa de **ratificação** das demais cláusulas.
5. **Consolidação**, gerada automaticamente com os dados já atualizados, numeração própria reiniciada, preâmbulo correto (os sócios "resolvem consolidar o contrato social", e não "efetivar a alteração").
6. Fechamento e assinaturas de todos que participam do ato (inclusive quem sai ou cede quotas).

O sistema deve guardar a **numeração das cláusulas do contrato vigente** para que as alterações possam citá-las ("fica alterada a Cláusula Quinta").

### 9.3 Distrato
- Data de encerramento das atividades.
- Variantes de liquidação: sem bens a restituir e sem haveres; com partilha de haveres (descrever).
- Responsável pelo ativo e passivo supervenientes (selecionar pessoa do quadro).
- Responsável pela guarda dos livros e documentos (selecionar pessoa do quadro).
- Quitação recíproca entre os sócios.

### 9.4 Transformação (fase posterior)
- EI → LTDA unipessoal e LTDA → EI, com base nos modelos `transformacao-ei-em-ltda-unipessoal.docx`, `transformacao-ltda-em-ei.docx` e `modelo-contrato-transformacao-ltda-para-ei.docx`.
- Exige um cadastro mínimo de **Empresário Individual** (titular, firma). Planeje o modelo de dados para isso desde já, mas não implemente agora.

---

## 10. Formatação e exportação

- **Configurações de página:** A4, margens, fonte e tamanho padrão configuráveis; espaçamento entre linhas; texto justificado.
- **Estilos nomeados do Word** (Título, Título de Seção, Cláusula, Parágrafo, Tabela, Assinatura) — nada de formatação manual solta.
- **Numeração das cláusulas como texto** gerado pelo sistema, nunca como lista automática do Word.
- "CLÁUSULA XXX:" e títulos de seção em negrito; nomes dos sócios em negrito.
- **Cabeçalho** (configurável por escritório e por documento):
  - Texto livre, imagem ou ambos.
  - Imagem PNG ou JPG; tamanho recomendado **2000 × 350 px** (faixa de ~17 × 3 cm). Mostrar essa recomendação na tela de envio e redimensionar proporcionalmente se for diferente.
  - Opção de não exibir o cabeçalho na primeira página.
- **Rodapé:** texto livre combinado com campos: "Página X de Y", razão social, CNPJ, NIRE, título do ato. Alinhamento configurável.
- **Exportação:**
  - .docx (principal).
  - PDF: orientar o usuário a abrir o .docx no Word e salvar como PDF (mais fiel). Opcionalmente, oferecer pré-visualização para impressão pelo navegador.
- Nome do arquivo gerado: `AAAA-MM-DD - Tipo do ato - Razão social.docx`.
- **Não copiar hyperlinks** dos modelos (eles contêm links para sites externos no meio das cláusulas).

---

## 11. Captura de dados por IA (fase posterior)

- Configurações: escolher provedor (**Claude** ou **Gemini**), informar a chave de API e o nome do modelo (campo editável, com sugestão padrão; não fixar no código).
- Avisar que a chave fica salva no computador/pasta de dados e quem tiver acesso à pasta poderá vê-la.
- **Aviso obrigatório antes de cada envio**, com confirmação por caixa de seleção:
  > "Os documentos selecionados serão enviados a um serviço externo (Anthropic ou Google) para leitura automática. O uso desses dados, inclusive para treinamento de modelos de IA, depende dos termos do plano contratado com o provedor. Em planos gratuitos, os dados podem ser usados para treinamento e revisados por pessoas. Confirme que o cliente autorizou este tratamento de dados."
- Envio de imagem ou PDF (RG, CNH, CIN, comprovante de residência) diretamente para o modelo (sem OCR separado), pedindo resposta em JSON com os campos da Pessoa.
- **Tela de conferência obrigatória**: campos preenchidos pela IA destacados; nada é salvo sem o usuário revisar e confirmar. Validar CPF. Avisar quando o comprovante estiver em nome de outra pessoa.
- Tratar erros (chave inválida, sem internet, documento ilegível) sem travar o sistema.

---

## 12. Importação de contratos existentes (futuro — não implementar agora)

Planejar o modelo de dados para suportar, mais tarde:
- Importar um .docx de contrato/consolidação existente, dividir em cláusulas e associar cada uma a um bloco da biblioteca ou mantê-la como **"bloco importado"** com o texto original preservado.
- Guardar a numeração original das cláusulas.
- Preencher o cadastro da empresa a partir do texto (manual primeiro, com IA opcional depois).

---

## 13. Problemas encontrados nos modelos (não reproduzir)

Os modelos do escritório têm erros típicos de "copiar e colar", que o sistema deve eliminar por construção:
- **Numeração de cláusulas pulando ou repetida:** abertura vai de OITAVA para DÉCIMA (sem NONA); consolidação da alteração vai de SEXTA para OITAVA; o distrato tem duas CLÁUSULAS QUINTAS; a transformação LTDA→EI vai de "QUARTO" para SEXTA.
- **Texto de unipessoal em contrato com vários sócios:** a abertura com dois sócios usa "cabendo ao sócio único", "assinada pelo sócio único" e "sócio (a) único (a) administrador (a)"; a consolidação da alteração chama a sociedade de "limitada unipessoal" mesmo com dois sócios.
- **Termos de empresário individual em LTDA:** "Únicos (as) titulares da empresa" na alteração (o correto para LTDA é "sócios").
- **Preâmbulo da consolidação** repete "resolvem efetivar a presente alteração contratual".
- **"R$ R$"** duplicado na cláusula de capital.
- **"inscrito no CPF º"** (falta o "n").
- **Cláusula de filiais duplicada** na consolidação (parágrafo único e cláusula separada com o mesmo conteúdo).
- **Ordem das colunas da tabela de CNAEs** diferente entre modelos — padronizar (CNAE | Descrição | Tipo).
- **Cidade fixa** ("Barueri/SP") e órgão emissor fixo ("SSP/SP") no texto — devem ser variáveis.
- **Hyperlinks** para sites externos dentro das cláusulas.

Se encontrar outros problemas ao processar os modelos, liste-os para mim antes de corrigir.

---

## 14. Fases de desenvolvimento

Entregue e pare ao fim de cada fase para eu testar.

**Fase 1 — Motor e abertura**
- Estrutura do projeto, escolha da pasta de dados, gravação por empresa, backup automático, exportar/importar.
- Cadastro de empresa e pessoas, sistema de quotas (classe única e classes distintas).
- Motor de gramática (concordância e extenso) com testes.
- Biblioteca de cláusulas com tags, filtro e editor.
- Fluxo em 3 etapas para **abertura** (pluripessoal e unipessoal).
- Geração de .docx com cabeçalho e rodapé configuráveis.
- *Critério de aceite:* gerar a abertura de uma LTDA com 2 sócios (um homem e uma mulher) e de uma LTDA unipessoal com sócia mulher, sem nenhum "(a)" ou erro de concordância, com numeração correta e valores por extenso corretos.

**Fase 2 — Alteração e consolidação**
- Blocos de alteração (seção 6.2), histórico de atos, status rascunho/gerado/registrado.
- *Critério de aceite:* a partir da empresa da Fase 1, gerar uma alteração com mudança de endereço, aumento de capital e entrada de um sócio, com consolidação automática correta.

**Fase 3 — Distrato e transformação**
- Distrato com variantes; cadastro mínimo de EI; transformações EI ↔ LTDA.

**Fase 4 — Captura de dados por IA**
- Seção 11 completa.

**Fase 5 (a planejar comigo) — Importação de contratos existentes**

---

## 15. Preparação para outros tipos societários

Hoje só LTDA, mas no futuro entrarão outros tipos (Sociedade Simples, Empresário Individual, S/A e outros). **O sistema não pode precisar ser reconstruído para isso.** Regras de arquitetura desde a Fase 1:
- Nada de "LTDA" fixo no código. Tipo societário é um **dado**: cada tipo é uma definição (arquivo de configuração) com seus documentos possíveis, vocabulário e cláusulas padrão.
- **Vocabulário por tipo** como variável: sócio/titular/acionista, quotas/ações, contrato social/estatuto/requerimento, sociedade/empresa.
- **Tipos de documento também são dados**: cada documento define suas áreas (preâmbulo, corpo, alteração, consolidação, anexo, fechamento) e quais cláusulas carrega por padrão. Criar um documento novo deve ser configuração, não reprogramação.
- O motor de cláusulas, a gramática, o formulário automático e a geração de .docx devem ser **genéricos**, sem conhecer regras específicas de LTDA; as regras de LTDA ficam na definição do tipo e nas cláusulas.
- Ao terminar a Fase 1, descreva para mim em poucos parágrafos o que seria preciso para adicionar um novo tipo societário, como teste de que a arquitetura está correta.

---

## 16. Regras gerais de qualidade

- Nunca apagar dados sem confirmação; nunca sobrescrever sem backup.
- Toda mensagem de erro deve dizer o que aconteceu e o que fazer.
- Interface simples, com fonte legível, botões grandes e textos em português.
- O sistema não substitui revisão jurídica: incluir no rodapé da tela de revisão o lembrete "Confira o documento antes de protocolar."
