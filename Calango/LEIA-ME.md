# Calango — guia de uso

O Calango monta contratos sociais, alterações contratuais com consolidação, distratos e transformações (empresário individual ↔ LTDA) a partir dos dados da empresa. Você preenche os dados uma vez e o sistema escreve o documento com a concordância certa (sócio/sócia, declara/declaram), a numeração das cláusulas e os valores por extenso.

> **Lembrete:** o Calango não substitui a revisão. **Confira o documento antes de protocolar.**

---

## 1. O que tem na pasta Calango

| Pasta / arquivo | Para que serve |
|---|---|
| `sistema/index.html` | **O programa.** É este arquivo que você abre. |
| `modelos/` | Os modelos .docx do escritório que serviram de base. |
| `LEIA-ME.md` | Este guia. |
| `FASE-1.md` | O que foi feito na Fase 1 (abertura) e os pontos que precisam da sua decisão. |
| `FASES-2-3.md` | O que foi feito nas Fases 2 (alteração) e 3 (distrato e transformação). |
| `ESPECIFICACAO_CALANGO.md` | A especificação completa do projeto. |
| `codigo/` | O código-fonte (só para quem for dar manutenção). |

---

## 2. Como abrir

1. Copie a pasta **`sistema`** para um lugar da rede que todos do escritório acessem (por exemplo `\\servidor\Calango\sistema`).
2. Abra o arquivo **`index.html`** no **Microsoft Edge** (clique com o botão direito → *Abrir com* → *Microsoft Edge*).
3. Dica: crie um atalho na área de trabalho para esse arquivo.

Não precisa instalar nada nem ter internet. Tudo funciona dentro do Edge.

> **Firefox não funciona.** Ele não permite que páginas usem pastas do computador. Se abrir no Firefox, o Calango mostra um aviso pedindo para usar o Edge (o Google Chrome também funciona).

---

## 3. Primeira vez: escolher a pasta de dados

A **pasta de dados** é onde ficam as empresas, as cláusulas, as configurações e os backups. Ela é separada do programa.

1. Crie uma pasta **vazia** chamada `dados` na rede, por exemplo `\\servidor\Calango\dados`.
2. Abra o Calango e clique em **Escolher pasta de dados**.
3. Escolha a pasta `dados` e confirme. Se o Edge perguntar, clique em **Permitir** (ou "Editar arquivos").
4. Na primeira vez, o Calango prepara a pasta e cria a **biblioteca inicial de cláusulas** (feita a partir dos modelos do escritório).

**Todos do escritório devem escolher a mesma pasta `dados`**, para trabalharem com os mesmos cadastros.

### Nas próximas vezes

Quando uma nova versão do Calango traz cláusulas novas, elas são acrescentadas à biblioteca da pasta de dados automaticamente. Cláusulas que você editou nunca são alteradas.

O Calango lembra a pasta. Por segurança, o Edge pode pedir sua confirmação: basta clicar em **Liberar acesso à pasta** e em **Permitir**.

Para trocar de pasta: **Configurações → Trocar pasta de dados**.

---

## 4. Gerar um contrato social de abertura

1. Clique em **Novo documento** → **Contrato social de abertura** → **Começar**.
2. **Etapa 1 — Cláusulas**
   - Diga se a empresa terá **um sócio só** ou **dois ou mais sócios**. O Calango carrega o conjunto padrão de cláusulas.
   - Desmarque as cláusulas opcionais que não quiser. As marcadas com 🔒 são obrigatórias.
   - Para mudar a ordem, **arraste** pela alça ⠿ ou use as setas ↑ ↓.
   - Para incluir outra cláusula, use **+ Adicionar da biblioteca**.
3. **Etapa 2 — Dados**
   - O formulário mostra **só o que as cláusulas escolhidas precisam**.
   - Campos com problema ficam em vermelho, com a explicação do que fazer.
   - **Capital e quotas:** primeiro escolha *classe única* ou *classes distintas*; depois o capital, o valor de cada quota e a participação de cada sócio. Você pode informar a participação em **quotas**, em **reais** ou em **percentual**. Se o valor não der um número inteiro de quotas, o Calango **não arredonda sozinho**: ele mostra as opções.
   - Estado civil **casado** ou **união estável** exige o **regime de bens**.
4. **Etapa 3 — Revisão**
   - Confira o documento na tela. Lacunas aparecem destacadas em amarelo.
   - A lista de **pendências** diz o que falta. Com tudo resolvido, clique em **Gerar .docx**.
   - O arquivo vai para a pasta **Downloads**, com o nome `AAAA-MM-DD - Contrato social de abertura - RAZÃO SOCIAL.docx`.
5. **PDF:** abra o .docx no Word e use **Arquivo → Salvar como → PDF** (fica mais fiel que imprimir do navegador).

O trabalho é salvo como **rascunho** quando você muda de etapa ou clica em **💾 Salvar rascunho**. Para continuar depois: **Início → Documentos em andamento → Continuar**.

### Depois do registro na Junta

Abra o documento e clique em **Marcar como registrado na Junta**. Informe a data, o número do registro e, se já tiver, o NIRE e o CNPJ.

**Só nesse momento o cadastro da empresa é atualizado.** Até lá, o documento é apenas uma proposta.

---

## 5. Alteração contratual (com consolidação)

1. Em **Empresas**, abra a empresa e clique em **Alteração contratual com consolidação** (ou use **Novo documento**).
   - A empresa precisa ter **cadastro vigente**: a abertura marcada como registrada, ou a empresa cadastrada à mão.
2. **Etapa 1:** o conjunto padrão já vem pronto:
   - **Cláusulas de alteração.** Cada uma só aparece no documento se aquele dado mudou.
   - **Ratificação.**
   - **Consolidação.** Usa as cláusulas do contrato vigente.
3. **Etapa 2:** os dados vêm preenchidos com o cadastro vigente. Mude **só o que a alteração deve mudar**:
   - **Nome, endereço, objeto, CNAEs, enquadramento, administração:** é só editar os campos.
   - **Capital e sócios:** use a **Movimentação de quotas**, na seção “Alteração”:
     - **Aumento de capital:** quem subscreve e quantas quotas novas.
     - **Cessão de quotas:** quem cede, quem recebe, quantas quotas e, se quiser, o preço.
     - **Redução de capital:** de quem e quantas quotas; o sistema pede o motivo.
     - **Para incluir um sócio novo**, escolha **“+ Pessoa nova”** em “quem recebe” ou “quem subscreve”. Os dados dele aparecem para preencher na seção “Sócios”.
     - **Quem ceder todas as quotas sai da sociedade** (e assina o documento).
     - A tabela **antes e depois** mostra o novo quadro e o novo capital.
   - **Contrato vigente:** as cláusulas de alteração citam o número da cláusula ("prevista na Cláusula Segunda do contrato social").
     - Se o contrato vigente foi feito pelo Calango, os números já vêm preenchidos.
     - Para empresa antiga, confira no último contrato registrado.
4. **Etapa 3:** confira o documento:
   - título "**1ª ALTERAÇÃO CONTRATUAL...**";
   - cláusulas de alteração numeradas a partir de PRIMEIRA, terminando na ratificação;
   - a **consolidação**, com a numeração recomeçando em PRIMEIRA.
5. Depois do registro, clique em **Marcar como registrado**. O cadastro vigente recebe os dados novos e a próxima alteração já sai como "2ª".

> Só pode haver **um documento em andamento por empresa**. Para desistir de um rascunho, abra a empresa e clique em **Apagar** ao lado do documento.

## 6. Distrato

1. Na empresa, clique em **Distrato**.
2. **Etapa 2**, seção “Distrato”:
   - data de encerramento das atividades;
   - resultado da liquidação: **sem bens e sem haveres**, ou **com partilha** (descreva a partilha);
   - responsável pelo ativo e passivo supervenientes e responsável pela guarda dos livros (escolha entre os sócios).
3. Gere o documento e, depois do registro, marque como registrado: a empresa fica **Extinta** e não aceita mais documentos.

## 7. Transformação (Empresário Individual ↔ LTDA)

- **LTDA unipessoal → Empresário Individual:** só para LTDA com um único sócio.
  - Na Etapa 2, informe a nova firma (razão social) e mude o que mais for preciso (capital, endereço, CNAEs, enquadramento).
  - O documento traz a transformação e, em seguida, o **Instrumento de Inscrição de Empresário Individual**.
- **Empresário Individual → LTDA unipessoal:**
  1. Cadastre o empresário em **Empresas → + Cadastrar empresário individual**: firma, CNPJ, NIRE, sede, objeto, CNAEs, capital e o titular.
  2. Use **Transformação de Empresário Individual em LTDA unipessoal**. O titular vira sócio único com todas as quotas (ajuste o valor da quota se quiser).
  3. O documento traz a transformação e o **contrato social completo** da nova LTDA.
- Ao marcar como registrado, a empresa **muda de tipo** (EI ↔ LTDA).

---

## 8. Empresas

Em **Empresas** você vê todas as empresas da pasta de dados:

- **Em abertura:** os dados ainda estão no rascunho do contrato.
- **Registrada:** tem cadastro vigente, que você pode consultar e corrigir.
- **Extinta:** distrato registrado.
- **+ Cadastrar LTDA já registrada** / **+ Cadastrar empresário individual:** para incluir empresas que já existem, deixando os dados prontos para alteração, distrato ou transformação.

---

## 9. Biblioteca de cláusulas

Em **Biblioteca de cláusulas** você pode criar, editar, duplicar e arquivar cláusulas.

- **Filtros:** por texto, por etiqueta e por tipo de documento.
- **Editor:** você não precisa decorar nada. Use os botões:
  - **Variável:** insere um dado da empresa (razão social, CPF do sócio...).
  - **Concordância:** escreve uma palavra nas formas masculino/feminino e singular/plural (*o sócio / a sócia / os sócios / as sócias*).
  - **Condição:** um trecho que só aparece em certos casos (por exemplo, só quando for unipessoal).
  - **Repetição:** um trecho para cada sócio, cada CNAE etc.
  - **§ Parágrafo**, **a) Alínea**, **Tabela**, **Negrito**, **Assinatura**.
- **Pré-visualização:** mostra o texto ao vivo com dados de exemplo (um sócio, uma sócia, dois sócios...). Assim você confere a concordância.
- **Conferência:** aponta erros no texto e mostra quais dados a cláusula vai pedir no formulário.
- **Versões:** cada vez que você salva, a versão anterior fica guardada no **histórico** e pode ser restaurada.
- **Arquivar** tira a cláusula das listas sem apagá-la.

---

## 10. Configurações

- **Página:** margens, fonte, tamanho, espaçamento entre linhas.
- **Cabeçalho:** texto e/ou imagem (PNG ou JPG).
  - Tamanho recomendado da imagem: **2000 × 350 pixels** (uma faixa de cerca de 17 × 3 cm).
  - Imagens de outro tamanho são redimensionadas proporcionalmente.
  - Há a opção de **não mostrar o cabeçalho na primeira página**.
- **Rodapé:** texto livre com campos como *Página X de Y*, razão social, CNPJ, NIRE e título do ato.
  - Um trecho entre colchetes some se o campo estiver vazio. Exemplo: `[ — CNPJ {cnpj}]` não aparece numa abertura, que ainda não tem CNPJ.
- **Valores padrão:** a cidade e a UF do escritório já vêm preenchidas no local do documento, no foro e na Junta Comercial.

---

## 11. Backup e segurança dos dados

- **Backup automático:** antes de gravar qualquer arquivo, o Calango guarda a versão anterior em `dados/backups/AAAA-MM-DD/`. Os backups com mais de **30 dias** são apagados automaticamente.
- **Para recuperar um arquivo:**
  1. Entre em `dados/backups/<data>/`.
  2. Copie o arquivo desejado para `dados/empresas/` (ou `dados/clausulas/`).
  3. Tire do nome a parte com a hora: `empresas__padaria-...__101530-123.json` vira `padaria-....json`.
- **Nada é apagado sem confirmação.** Ao apagar uma empresa, uma cópia fica em `backups/`.
- **Recomendação:** inclua a pasta `dados` no backup normal do escritório.
- **Exportar / importar** (menu 📦): gera um arquivo `.json` com tudo, só com a biblioteca ou com uma empresa. Use para levar dados para um computador fora da rede, ou como cópia extra.

### Várias pessoas ao mesmo tempo

Cada empresa é um arquivo separado. Se duas pessoas alterarem a mesma empresa ao mesmo tempo, quem salvar por último recebe um **aviso** e **nada é sobrescrito**. Recarregue e refaça a alteração.

---

## 12. Problemas comuns

| O que aparece | O que fazer |
|---|---|
| "Navegador sem suporte" | Abra o `index.html` no Microsoft Edge. |
| "Liberar acesso à pasta" | Clique no botão e em **Permitir**. É normal o Edge pedir de vez em quando. |
| "A pasta de dados não foi encontrada" | Verifique se a rede está funcionando. Depois clique em **Escolher outra pasta** e escolha a pasta `dados` de novo. |
| "O arquivo ... foi alterado por outra pessoa" | Outra pessoa salvou a mesma empresa. Volte à lista, abra de novo e refaça sua alteração. |
| "Não foi possível ler ... (arquivo corrompido?)" | Pegue a cópia mais recente em `dados/backups/`. |
| O botão **Gerar .docx** está desligado | Há pendências em vermelho na Etapa 3. Resolva-as primeiro. |
| "Já existe um documento em andamento para esta empresa" | Conclua (marque como registrado) ou apague o documento em andamento, na tela da empresa. |
| "Nenhuma alteração foi feita" | Numa alteração, mude na Etapa 2 o que deve ser alterado (endereço, capital, sócios...). |
| "Falta preencher: número da cláusula ... no contrato vigente" | Informe o número na seção “Alteração → Contrato vigente” da Etapa 2. |
