# Fases 2 e 3 — Alteração, distrato e transformação: relatório

Este arquivo resume o que foi feito nas Fases 2 e 3, como funciona e o que ainda **precisa da sua revisão**. As Fases 2 e 3 foram feitas em sequência, a seu pedido, sem a parada para aprovação entre elas.

---

## 1. O que foi entregue

| Item da especificação | Situação |
|---|---|
| **Fase 2** — blocos de alteração (seção 6.2): nome, endereço, objeto, CNAEs, aumento e redução de capital, entrada e saída de sócio, cessão de quotas, administração, enquadramento | ✅ |
| Ratificação (fixa, antes da consolidação) e consolidação automática com numeração própria | ✅ |
| Preâmbulo da consolidação: "resolvem consolidar o contrato social" | ✅ |
| Numeração das cláusulas do contrato vigente guardada para citação ("Cláusula Quinta") | ✅ |
| Histórico de atos com rascunho → gerado → registrado; o cadastro vigente só muda no registro | ✅ |
| Assinaturas de todos que participam do ato, inclusive quem sai ou cede quotas | ✅ |
| **Fase 3** — distrato com variantes (sem bens/sem haveres; com partilha), data de encerramento, responsáveis pelo ativo/passivo e pelos livros, quitação recíproca | ✅ |
| Cadastro mínimo de Empresário Individual (titular e firma) | ✅ |
| Transformações LTDA unipessoal → EI e EI → LTDA unipessoal | ✅ |

### Critério de aceite da Fase 2

*A partir da empresa da Fase 1, gerar uma alteração com mudança de endereço, aumento de capital e entrada de um sócio, com consolidação automática correta.*

Ele é conferido automaticamente nos testes. O documento sai assim:

- **Título:** "1ª ALTERAÇÃO CONTRATUAL DA SOCIEDADE EXEMPLO COMÉRCIO E SERVIÇOS LTDA".
- **Preâmbulo:** os dois sócios atuais e a sócia que entra.
- **Cláusulas de alteração:**
  - PRIMEIRA (endereço): cita a "Cláusula Segunda" e mostra o endereço anterior e o novo.
  - SEGUNDA (aumento): "aumentado de R$ 10.500,00 (dez mil e quinhentos reais) para R$ 15.500,00 (quinze mil e quinhentos reais)", com a subscrição de cada sócio.
  - TERCEIRA (entrada da sócia).
  - QUARTA (novo quadro).
  - QUINTA (ratificação).
- **Consolidação:**
  - a numeração recomeça em PRIMEIRA;
  - endereço e capital novos;
  - três sócios no quadro;
  - "A empresa iniciou suas atividades em…";
  - os sócios "resolvem consolidar o contrato social".
- **Assinaturas:** as três pessoas.

O teste no navegador também faz, pela tela:
1. Uma alteração com endereço novo, aumento de capital e cessão para uma sócia nova.
2. O registro dessa alteração.
3. O distrato da mesma empresa.
4. A transformação de uma LTDA unipessoal em empresário individual.

---

## 2. Como funciona (em linguagem simples)

### Alteração contratual

- **O documento sai dos dados.**
  1. A alteração começa com os dados do cadastro vigente.
  2. Na Etapa 2 você muda só o que deve mudar.
  3. O Calango compara "antes" e "depois", e cada cláusula de alteração só entra no documento se aquele dado realmente mudou.
- **Avisos automáticos.** Se nada mudou, o sistema avisa e não deixa gerar. Se um dado mudou mas a cláusula de alteração dele foi desligada na Etapa 1, ele também avisa.
- **Capital e sócios mudam pela movimentação de quotas:** aumento, redução e cessão.
  - O novo quadro e o novo capital são **calculados** a partir do quadro vigente e dos movimentos; não são digitados.
  - Quem recebe quotas sem ser sócio **entra** na sociedade.
  - Quem cede todas as quotas **sai**.
  - O sistema não deixa ceder mais quotas do que a pessoa tem.
- **Citação da cláusula do contrato vigente** ("prevista na Cláusula Segunda do contrato social").
  - Quando a abertura ou a última consolidação foi feita pelo Calango, a numeração já é conhecida.
  - Para empresas cadastradas à mão, a Etapa 2 pede o número das cláusulas citadas.
- **A consolidação usa as cláusulas do contrato vigente**, na mesma ordem, com os dados novos.
- **Registro.** Ao marcar como registrado, o cadastro vigente recebe os dados novos, a consolidação passa a ser o contrato vigente e a próxima alteração sai como "2ª".
- **Um documento por vez.** Só pode haver um documento em andamento por empresa, para não haver duas versões do "depois". Um rascunho pode ser apagado na tela da empresa.

### Distrato

- Usa o cadastro vigente.
- Pede:
  - a data de encerramento;
  - o resultado da liquidação: sem bens/sem haveres, ou partilha com descrição;
  - os dois responsáveis, escolhidos entre os sócios.
- Ao registrar, a empresa fica **Extinta** e não aceita mais documentos.

### Transformação

- **Empresário Individual (EI)** passou a ser um tipo de empresa do sistema, com cadastro mínimo: firma, dados de registro, sede, objeto, CNAEs, capital (sem quotas) e um único titular.
- **LTDA unipessoal → EI:** cláusulas da transformação e, em seguida, o Instrumento de Inscrição de Empresário Individual.
- **EI → LTDA unipessoal:** cláusulas da transformação e, em seguida, o contrato social completo. O titular vira sócio único com todas as quotas.
- Ao registrar, a empresa **muda de tipo**.

### Biblioteca já existente na sua pasta de dados

Quando você abrir o Calango com a pasta de dados da Fase 1:
- **Cláusulas novas** (alteração, distrato, transformação): entram automaticamente.
- **Cláusulas do sistema que você nunca editou:** recebem o texto revisado como nova versão (a anterior fica no histórico).
- **Cláusulas que você editou:** **não são tocadas**.

Exemplos de cláusulas revisadas: "Duração" passou a dizer "iniciou" na consolidação; "Capital social" não diz "neste ato" na consolidação.

---

## 3. Novidades na sintaxe das cláusulas

(Os botões do editor continuam inserindo tudo.)

| Escrita | O que faz |
|---|---|
| `{{anterior.sede.endereco_completo}}` | Valor **antes** do ato (cadastro vigente). Vale para qualquer variável, lista, condição e concordância. |
| `{{clausula_vigente.sede}}` | "Cláusula Segunda": número da cláusula no contrato vigente. |
| `[se mudou_sede]`, `mudou_razao_social`, `mudou_objeto`, `mudou_cnaes`, `mudou_capital`, `mudou_enquadramento`, `mudou_administracao` | O dado mudou em relação ao cadastro vigente. |
| `houve_aumento`, `houve_reducao`, `houve_cessao`, `mudou_quadro`, `entrou_socio`, `saiu_socio` | Resultado da movimentação de quotas. |
| `[para cada cessao em cessoes]`, `aumentos`, `reducoes`, `socios_ingressantes`, `socios_retirantes`, `socios_do_ato` | Listas da alteração. |
| `{{responsavel_livros.qualificacao}}`, `{{responsavel_ativo_passivo.nome}}` | Pessoas escolhidas no distrato. |
| `[se consolidacao]` | O texto está sendo montado como contrato consolidado (e não como abertura). |

---

## 4. Problemas dos modelos tratados nestas fases

**Corrigidos:**
- **Alteração:** o preâmbulo dizia "Únicos (as) titulares da empresa" (termo de EI); agora diz "Únicos sócios da sociedade", com concordância.
- **Consolidação da alteração:**
  - o preâmbulo repetia "resolvem efetivar a presente alteração contratual" e agora diz "resolvem consolidar o contrato social";
  - a numeração pulava de SEXTA para OITAVA e agora é automática;
  - a sociedade era chamada de "limitada unipessoal" com dois sócios e agora isso só sai quando há um sócio;
  - a cláusula de filiais aparecia duplicada e agora não se repete, porque a consolidação usa os blocos da biblioteca.
- **CNAEs:** a tabela de CNAEs da alteração (Descrição | CNAE | Tipo) foi padronizada como CNAE | DESCRIÇÃO | TIPO.
- **Distrato:**
  - havia duas "CLÁUSULAS QUINTAS"; a numeração agora é automática;
  - "supervenientes, fica a cargo": tirada a vírgula entre sujeito e verbo;
  - "CEP: XXXXXXXXse compromete, também, manter": acertado o espaço, e "manter" virou "a manter";
  - o texto de quitação e de haveres agora concorda com um sócio ou com vários.
- **Transformação LTDA → EI:**
  - "CLÁUSULA QUARTO" e o pulo para SEXTA: numeração automática;
  - "titular da empresa" para quem ainda é sócio da LTDA virou "único sócio da sociedade";
  - "O Empresário Individual, adotará": tirada a vírgula;
  - no instrumento de inscrição, o capital do EI aparecia **dividido em quotas**; empresário individual não tem quotas, e agora sai "O capital é de R$ …, totalmente integralizado".
- **Transformação EI → LTDA:** o modelo citava o "parágrafo único do art. 1.052" e agora cita o "§ 1º do art. 1.052". Desde a Lei 13.874/2019 o artigo tem §§ 1º e 2º.

**Mantidos — precisam da sua conferência:**
1. **IN DREI.** A cláusula de nome da transformação EI → LTDA cita a "Instrução Normativa DREI nº 1, de 24 de janeiro de 2024", como no modelo. Confira se é essa a norma que vocês querem citar.
2. **Qual modelo de LTDA → EI.** Há dois modelos de LTDA → EI. Usei o `transformacao-ltda-em-ei.docx`, que segue o padrão dos outros modelos e não cita lei. O outro (`modelo-contrato-transformacao-ltda-para-ei.docx`) cita o "parágrafo único do art. 1.033" do Código Civil e a LC 128/08. Dele aproveitei só a declaração de ME/EPP do empresário. Se preferir o outro texto, ele pode virar um bloco da biblioteca.
3. **Os três pontos da Fase 1** continuam como estavam: "sucessores e/ou sucessores do incapaz", "nem está sendo processado" e "será procedido à elaboração". Ver `FASE-1.md`, seção 4.3.

---

## 5. Blocos NOVOS (não existem nos modelos) — revisar antes de usar em registro

Cada um tem a observação "Bloco NOVO" na biblioteca:
- cessão de quotas;
- entrada de sócio;
- saída de sócio;
- alteração da administração;
- novo quadro societário;
- **redução de capital** (o modelo só trazia o aumento);
- texto do distrato com **partilha de haveres** (o modelo só trazia "nada a receber");
- declaração de desimpedimento do empresário individual (adaptada do modelo).

---

## 6. Limitações conhecidas

- **Na alteração, não muda:** o valor unitário da quota e a configuração das classes de quotas. O que muda é a quantidade de quotas, por aumento, redução ou cessão.
- **Contrato vigente de empresas cadastradas à mão:**
  - a consolidação usa o conjunto padrão de cláusulas do Calango (o sistema não conhece o texto do contrato antigo);
  - a importação de contratos existentes é a Fase 5, a planejar;
  - os números das cláusulas citadas são pedidos na Etapa 2.
- **Distrato:** não tem liquidante nomeado nem balanço de encerramento anexo.
- **Transformação EI → LTDA:** é sempre para **LTDA unipessoal**, com o titular como sócio único; outros sócios entram depois, por alteração.
- **Ainda não testado no navegador automático, só por teste de unidade:**
  - a transformação EI → LTDA;
  - a redução de capital pela tela.
- **"Lembrar a pasta de dados"** continua sem teste automático, pelo mesmo motivo da Fase 1. Você confirmou que no navegador funcionou normalmente.

---

## 7. Testes

- **149 testes de unidade** (`npm test`). Os da Fase 1 continuam passando. Os novos cobrem:
  - critério de aceite da Fase 2;
  - cessão com saída e entrada de sócio;
  - alteração sem mudança;
  - número de cláusula faltando;
  - distrato pluripessoal e unipessoal (com partilha);
  - transformações nos dois sentidos;
  - atualização da biblioteca em pastas antigas.
- **Teste no navegador** (`npm run test:navegador`): abertura; alteração com movimentação de quotas e sócia nova; registro; distrato; transformação LTDA → EI.
