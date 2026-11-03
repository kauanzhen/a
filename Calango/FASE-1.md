# Fase 1 — Motor e abertura: relatório

Este arquivo resume o que foi feito na Fase 1, as decisões tomadas e os pontos que **precisam da sua decisão** antes da Fase 2.

---

## 1. O que foi entregue

| Item da especificação (seção 14) | Situação |
|---|---|
| Estrutura do projeto, escolha da pasta de dados, gravação por empresa | ✅ |
| Backup automático (`backups/AAAA-MM-DD`, últimos 30 dias) e aviso de conflito entre usuários | ✅ |
| Exportar/importar (tudo, biblioteca ou uma empresa) | ✅ em `.json` |
| Cadastro de empresa e pessoas (regime de bens obrigatório para casado/união estável, CPF validado) | ✅ |
| Sistema de quotas: classe única e classes distintas; participação em quotas, R$ ou %; bloqueio sem arredondar | ✅ |
| Motor de gramática (concordância, extenso, ordinais) com testes | ✅ |
| Biblioteca de cláusulas com etiquetas, filtros, editor com botões, pré-visualização e versões | ✅ |
| Fluxo em 3 etapas para abertura (pluripessoal e unipessoal) | ✅ |
| Geração de .docx com estilos nomeados, cabeçalho (texto/imagem) e rodapé configuráveis | ✅ |
| Histórico do ato: rascunho → gerado → registrado (o cadastro vigente só muda no registro) | ✅ (adiantado da Fase 2, só para a abertura) |
| `LEIA-ME.md` para usuário leigo | ✅ |

### Critério de aceite

Os dois documentos pedidos são gerados e conferidos **automaticamente** a cada alteração no código:

- **LTDA com 2 sócios (um homem e uma mulher)**
- **LTDA unipessoal com sócia mulher**

Os testes conferem que não aparece nenhum "(a)", "(as)", "Sr (ra)", "R$ R$", "CPF º", "titular" nem texto de unipessoal em contrato com vários sócios. Também conferem que a numeração vai de PRIMEIRA a DÉCIMA TERCEIRA sem pular nem repetir, que os valores por extenso estão certos e que a concordância está certa em cada cláusula.

Além disso, um teste no navegador percorre o sistema como um usuário faria:
1. Abre o arquivo direto do disco e escolhe a pasta de dados.
2. Importa uma empresa e gera o contrato de 2 sócios.
3. Preenche pela tela uma abertura unipessoal de uma sócia e gera o .docx.
4. Edita uma cláusula, salva as configurações e exporta tudo.

**Para você testar:** siga o `LEIA-ME.md`, seção 4. Use dados fictícios: um homem e uma mulher; depois uma sócia só.

---

## 2. Decisões técnicas (em linguagem simples)

1. **Um único arquivo `sistema/index.html`.** O Edge não deixa uma página aberta direto do disco carregar outros arquivos de programa. Por isso todas as bibliotecas (inclusive a que gera o .docx) foram embutidas nesse arquivo. Ele tem cerca de 600 KB e funciona sem internet.
2. **O código-fonte fica separado, em `codigo/`.** Quem der manutenção altera o código e roda `npm run build`, que gera de novo o `sistema/index.html`.
3. **As pessoas ficam dentro do arquivo de cada empresa.** A especificação não prevê uma pasta `pessoas/`. Se a mesma pessoa for sócia de duas empresas, ela é cadastrada nas duas.
4. **A pasta escolhida é a própria pasta de dados.** O Calango cria dentro dela `configuracoes.json`, `clausulas/`, `empresas/`, `backups/` e `imagens/`. Se a pasta escolhida já tiver outros arquivos, o sistema avisa e pergunta antes de usar.
5. **Preâmbulo, fechamento e assinaturas também são blocos da biblioteca.** Assim podem ser editados como qualquer cláusula, e um documento novo é só configuração.
6. **Os parágrafos de uma cláusula são blocos separados.** Por exemplo, os três parágrafos do capital social. Cada um pode ser ligado ou desligado na Etapa 1. A numeração (Parágrafo Primeiro, Segundo... ou **Único**, quando houver só um) é automática.
7. **Os nomes das pessoas saem em negrito no texto corrido.** No quadro societário, saem sem negrito.
8. **O arquivo de uma empresa nova muda de nome** de `nova-empresa-xxxx.json` para `razao-social-xxxx.json` quando a razão social é preenchida. O arquivo antigo é apagado.

---

## 3. Sintaxe proposta para as cláusulas (seção 7.1)

O usuário não precisa decorar nada: os botões do editor inserem tudo. Para referência:

```
{{empresa.razao_social}}                         variável (dado da empresa)
{o sócio|a sócia|os sócios|as sócias : socios}   concordância (masc. sing. | fem. sing. | masc. pl. | fem. pl.)
{brasileiro|brasileira : socio}                  concordância com uma pessoa (2 formas)
{vocab.membro : socios}                          palavra do vocabulário do tipo societário
**texto**                                        negrito
[se unipessoal] ... [senão] ... [fim]            condição (na mesma linha ou em linhas próprias)
[para cada socio em socios separador=";" ultimo=" e" final="."] ... [fim]
[tabela] ... [fim]                               tabela (colunas separadas por |)
[assinatura]                                     linha de assinatura
§ texto   parágrafo     - texto   alínea     * texto   item     # texto   título de seção
```

Regras de concordância:
- Grupo só de mulheres → feminino plural.
- Grupo misto → masculino plural.
- Uma pessoa → singular, no gênero dela.

Os **campos exigidos** de cada cláusula são calculados sozinhos a partir das variáveis usadas no texto. É assim que o formulário da Etapa 2 mostra só o necessário.

---

## 4. Problemas nos modelos

### 4.1 Corrigidos — os que você listou (seção 13)

Todos foram eliminados "por construção":
- **Numeração automática:** não há como pular nem repetir cláusula.
- **Texto de unipessoal:** "sócio único" e "unipessoal" só aparecem quando há um sócio.
- **Termos de EI em LTDA:** "titulares" virou "sócios".
- **Erros de digitação:** "R$ R$" e "CPF º" corrigidos.
- **Dados fixos no texto:** cidade e órgão do RG agora são variáveis.
- **CNAEs:** tabela padronizada como CNAE | DESCRIÇÃO | TIPO.
- **Hyperlinks:** removidos.

(A consolidação e a cláusula duplicada de filiais ficam para a Fase 2.)

### 4.2 Corrigidos — problemas que encontrei além da lista

São erros de digitação, de concordância ou de pontuação. **O sentido não mudou.** Se discordar de algum, é só editar a cláusula na biblioteca.

| Onde | Como estava no modelo | Como ficou |
|---|---|---|
| Enquadramento | `Lei Complementar no 123`, `§4o do art. 3o` (o "º" virou letra) | `nº 123`, `§ 4º do art. 3º` |
| Enquadramento | `(art. 3o, I, LC no 123 de 2006)` cita o inciso I (ME) mesmo quando é EPP | inciso **I** para ME e **II** para EPP |
| Enquadramento | `Microempresa – ME (OU Empresa de Pequeno Porte - EPP) ,` | escolha automática conforme o cadastro |
| Capital | `divididos em ... quotas` | `dividido` (concorda com "capital") |
| Capital | `R$ 1,00 (Um Real)` | `(um real)` |
| Pró-labore | `O (A) sócio (a) (NOME), poderá` — vírgula entre sujeito e verbo | sem a vírgula |
| Pró-labore | `a título de Pró-Labore, essa retirada poderá` — frases emendadas | `pró-labore, e essa retirada poderá` |
| Pró-labore | `simples entendimento do sócio` mesmo com vários sócios | concorda com os sócios |
| Exercício social | `cabendo ao sócio único, os lucros ou perdas apuradas` | sem a vírgula; `apurados`; com vários sócios: `aos sócios, na proporção de suas quotas,` |
| Balanços intermediários | `se for de interesse do titular` (termo de EI) | `dos sócios` / `da sócia`... |
| Falecimento | `será apurado liquidado` | `apurado e liquidado` |
| Desimpedimento | `que a impeça` e `processado` com gênero fixo | concorda com o(s) administrador(es) |
| Administração | `bem como, autarquias` | `bem como autarquias` |
| Fechamento | `E por estar assim justo e contratado, assinam` (singular e plural misturados) | `E por estarem assim justos e contratados, assinam` (ou o singular/feminino, conforme o caso) |
| Qualificação | `Sr (ra), NOME` | `Sr.` / `Sra.` conforme o gênero, sem a vírgula |
| Foro | `foro da cidade XXXX/Estado` | `foro da cidade de Barueri/SP` |
| Filiais | `poderá a qualquer tempo, abrir` | `poderá, a qualquer tempo, abrir` |
| CEP | formato antigo `XX.XXX-XXX` | `00000-000` |

### 4.3 Mantidos como no modelo — preciso da sua decisão

1. **Falecimento:** "com os herdeiros, sucessores e/ou **sucessores** do incapaz". A palavra "sucessores" aparece duas vezes. Parece que o certo seria "representantes do incapaz" (ou "curador"). Mantive como está.
2. **Desimpedimento:** "declara... não estar incurso..., nem **está** sendo processado". Mistura duas formas do verbo. Uma redação mais correta seria "nem **estar** sendo processado". Mantive a do modelo, só com a concordância.
3. **Exercício social:** "será **procedido à** elaboração". O mais usual é "será **procedida a** elaboração". Mantive.
4. **Para as próximas fases** (modelos de transformação e distrato):
   - O modelo EI → LTDA cita o "parágrafo único do art. 1.052 do Código Civil". Esse artigo hoje tem §§ 1º e 2º; a sociedade unipessoal está no § 1º.
   - O modelo LTDA → EI diz "Fica transformada esta Sociedade Limitada **em Empresária**". O certo seria "em Empresário Individual".
   - Também no LTDA → EI: vírgula duplicada em "FULANO DE TAL - ME, ," e falta um espaço em "Individual,mediante".
   - No distrato: falta um espaço em "CEP: XXXXXXXX**se** compromete".

### 4.4 Blocos novos (não existem nos modelos) — revisar antes de usar em registro

- **Parágrafo — qualificação do administrador não sócio** (usado quando há administrador que não é sócio).
- **Integralização a prazo e em bens:** os modelos só tinham a forma à vista.
- **Prazo determinado:** os modelos só tinham prazo indeterminado.
- **Descrição das classes de quotas:** voto, preferência, reembolso e eleição de administrador. A tela mostra o aviso fixo de revisão por advogado.
- **Parágrafo — sócio único detém 100%:** veio do modelo de transformação. Fica na biblioteca, mas não entra no conjunto padrão.

---

## 5. Teste da arquitetura: o que seria preciso para incluir um novo tipo societário

Exemplo: Sociedade Simples.

1. **Criar a definição do tipo**, um arquivo de configuração em `codigo/src/tipos/` (como o `ltda.ts`), com:
   - o nome, a sigla e as terminações aceitas na razão social;
   - o vocabulário (sócio/sócia, quota, contrato social);
   - quais documentos o tipo aceita e qual bloco faz a qualificação das pessoas.

   Depois, registrar o tipo em `registro.ts`. Nada no motor, na gramática, no formulário ou na geração de .docx precisa mudar.
2. **Definir os documentos** (abertura, alteração...). Também é configuração: as áreas (título, preâmbulo, corpo, fechamento, assinaturas, anexo) e a lista de cláusulas padrão.
3. **Escrever as cláusulas pela própria tela da biblioteca**, marcando o tipo societário de cada uma. Isso não exige programação.
4. **Só se o novo tipo tiver dados que o sistema não conhece, entra programação**, e só no cadastro e no catálogo de variáveis. Por exemplo: S/A tem ações com valor nominal e conselho; o Empresário Individual tem titular e firma. O motor e o gerador de .docx continuam iguais.

Um exemplo de que a separação já existe: a palavra "quota" e as terminações "LTDA" vêm da definição do tipo, não do código. Os textos próprios de LTDA estão só nas cláusulas.

---

## 6. Limitações conhecidas e próximos passos

- **"Lembrar a pasta de dados" foi conferido no código, mas não pôde ser testado no navegador automático.** É o recurso que permite liberar a pasta com um clique da próxima vez. O navegador de teste deste ambiente fecha a página ao reler a pasta guardada. **Confira no Edge:** feche e abra o Calango; ele deve pedir só **Liberar acesso à pasta**.
- **Testes feitos no Chromium (base do Edge), não no Edge.** Todos os testes no navegador rodaram no Chromium. Vale um teste rápido no Edge do escritório, com a pasta de dados na rede.
- **Sócio pessoa jurídica, menor/incapaz e estrangeiro:** o modelo de dados já tem lugar para eles (`tipo_pessoa`, `representante`, `estrangeiro`), mas as telas ainda não existem, como pede a especificação.
- **Exportar/importar** é feito em `.json` (a especificação aceita .zip ou .json).
- **A pré-visualização para impressão pelo navegador não foi feita.** A Etapa 3 mostra o documento na tela; para PDF, use o Word.
- **Fase 2:** blocos de alteração, consolidação automática e a numeração das cláusulas do contrato vigente para citação ("fica alterada a Cláusula Quinta").

---

## 7. Testes automatizados

- **126 testes de unidade** (`npm test`):
  - extenso (1, 21, 100, 101, 1.000, 1.001.000, centavos, "um real", "uma quota", "duas quotas"...);
  - ordinais até CENTÉSIMA e além;
  - concordância e regime de bens;
  - CPF/CNPJ e quotas (bloqueio sem arredondar);
  - motor de cláusulas e biblioteca inicial;
  - os critérios de aceite;
  - backup, conflito, exportação/importação e geração do .docx.
- **Teste no navegador** (`npm run test:navegador`): o fluxo completo descrito na seção 1.
