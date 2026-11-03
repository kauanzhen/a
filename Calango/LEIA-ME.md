# Calango — guia de uso

O Calango monta contratos sociais de **sociedades limitadas (LTDA)** a partir dos dados da empresa. Você preenche os dados uma vez e o sistema escreve o documento com a concordância certa (sócio/sócia, declara/declaram), a numeração das cláusulas e os valores por extenso.

> **Lembrete:** o Calango não substitui a revisão. **Confira o documento antes de protocolar.**

---

## 1. O que tem na pasta Calango

| Pasta / arquivo | Para que serve |
|---|---|
| `sistema/index.html` | **O programa.** É este arquivo que você abre. |
| `modelos/` | Os modelos .docx do escritório que serviram de base. |
| `LEIA-ME.md` | Este guia. |
| `FASE-1.md` | O que foi feito nesta fase e os pontos que precisam da sua decisão. |
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

## 5. Empresas

Em **Empresas** você vê todas as empresas da pasta de dados:

- **Em abertura:** os dados ainda estão no rascunho do contrato.
- **Registrada:** tem cadastro vigente, que você pode consultar e corrigir.
- **+ Cadastrar empresa já registrada:** para incluir empresas que já existem, deixando os dados prontos para as alterações contratuais (próxima fase).

---

## 6. Biblioteca de cláusulas

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

## 7. Configurações

- **Página:** margens, fonte, tamanho, espaçamento entre linhas.
- **Cabeçalho:** texto e/ou imagem (PNG ou JPG).
  - Tamanho recomendado da imagem: **2000 × 350 pixels** (uma faixa de cerca de 17 × 3 cm).
  - Imagens de outro tamanho são redimensionadas proporcionalmente.
  - Há a opção de **não mostrar o cabeçalho na primeira página**.
- **Rodapé:** texto livre com campos como *Página X de Y*, razão social, CNPJ, NIRE e título do ato.
  - Um trecho entre colchetes some se o campo estiver vazio. Exemplo: `[ — CNPJ {cnpj}]` não aparece numa abertura, que ainda não tem CNPJ.
- **Valores padrão:** a cidade e a UF do escritório já vêm preenchidas no local do documento, no foro e na Junta Comercial.

---

## 8. Backup e segurança dos dados

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

## 9. Problemas comuns

| O que aparece | O que fazer |
|---|---|
| "Navegador sem suporte" | Abra o `index.html` no Microsoft Edge. |
| "Liberar acesso à pasta" | Clique no botão e em **Permitir**. É normal o Edge pedir de vez em quando. |
| "A pasta de dados não foi encontrada" | Verifique se a rede está funcionando. Depois clique em **Escolher outra pasta** e escolha a pasta `dados` de novo. |
| "O arquivo ... foi alterado por outra pessoa" | Outra pessoa salvou a mesma empresa. Volte à lista, abra de novo e refaça sua alteração. |
| "Não foi possível ler ... (arquivo corrompido?)" | Pegue a cópia mais recente em `dados/backups/`. |
| O botão **Gerar .docx** está desligado | Há pendências em vermelho na Etapa 3. Resolva-as primeiro. |
