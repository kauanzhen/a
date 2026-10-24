# Manual do Assistente IA — suas mensagens e e-mails viram lançamentos

> Contábil Escola é um software **educacional**. Use mensagens, e-mails e documentos **fictícios** (ou sem dados pessoais).

## A ideia em uma figura

```text
 e-mails, WhatsApp, SMS do banco,        ┌──────────────┐      lote JSON       ┌────────────────────────────┐
 PDFs de NF, extratos, recibos   ──────▶ │    Claude    │ ───────────────────▶ │  Contábil Escola           │
                                         │ (com a skill │  (sugestões, nunca   │  valida (D = C, contas,    │
 contexto-contabil.json  ──────────────▶ │  do sistema) │   lançamentos        │  período, centro de custo) │
 (plano de contas, períodos abertos…)    └──────────────┘   gravados)          │  → VOCÊ aprova cada um     │
                                                                               └────────────────────────────┘
```

O Claude **sugere**; quem lança é você. Cada sugestão traz a fonte (de qual e-mail/mensagem veio), a justificativa das contas, o grau de confiança e as dúvidas que você precisa confirmar. O sistema aplica as mesmas regras da importação Excel e só deixa aprovar o que está correto. Tudo o que foi aprovado fica com origem **"Assistente IA"** na lista de lançamentos e pode ser desfeito de uma vez em *Importação Excel → Histórico de importações*.

## Os três jeitos de usar

| Modo | Para quem | O Claude lê | Precisa de |
|---|---|---|---|
| **1. Copiar e colar** | qualquer pessoa | o texto que você colar | qualquer Claude (claude.ai, app, Cowork) |
| **2. API direta** | quem tem chave de API | o texto que você colar | chave da API da Anthropic |
| **3. Claude Cowork** | quem quer que o Claude leia e-mails e arquivos sozinho | sua caixa de e-mail (conector) e a pasta de integração | app Claude para desktop com Cowork, Chrome ou Edge |

Todos começam em **Assistente IA** no menu (atalho `Alt+I`).

---

## Modo 1 — Copiar e colar

1. Em **Assistente IA → Colar mensagens**, cole as mensagens (ou clique em *Usar mensagens de exemplo*). Separe cada uma com uma linha como `--- E-mail ---` e inclua remetente e data.
2. Clique em **Copiar prompt para o Claude/Cowork**. O prompt já leva as regras, o plano de contas, os períodos abertos e o formato da resposta.
3. Cole no Claude e envie. Ele responde com um bloco ` ```json `.
4. Copie a resposta inteira, volte ao sistema e cole no campo **2. Cole aqui a resposta do Claude** → **Revisar sugestões**.
5. Revise (veja [Revisão e aprovação](#revisão-e-aprovação)) e clique em **Lançar N aprovada(s)**.

## Modo 2 — API direta

1. Crie uma chave de API no console da Anthropic (`platform.claude.com`). Use uma chave com **limite de gastos**.
2. Em **Assistente IA → Configurar API**, cole a chave e escolha o modelo (padrão: Claude Opus 5.5; Sonnet 5.5 é mais rápido e Haiku 5.5 mais econômico).
3. Em **Colar mensagens**, cole o texto e clique em **Analisar com o Claude (API)**. A resposta já chega no formato certo (saída estruturada) e abre direto na revisão.

Sobre a chave: ela fica **só neste navegador** (IndexedDB), não entra no backup e só é enviada para a API da Anthropic. Qualquer pessoa com acesso a este navegador pode usá-la — remova em *Configurar API → Remover chave* quando terminar. O texto colado é enviado à Anthropic para processamento.

## Modo 3 — Claude Cowork (o Claude lê seus e-mails e arquivos)

O Cowork trabalha com arquivos de uma pasta do seu computador e pode usar conectores (por exemplo, Gmail ou Outlook). A integração com o Contábil Escola é feita por uma **pasta compartilhada**: o sistema grava nela o contexto contábil; o Claude grava nela os lotes; o sistema lê os lotes para você aprovar.

### 3.1 Prepare a pasta no sistema

Use **Chrome ou Edge** (a função usa a File System Access API; Firefox e Safari não têm — nesses, use a aba *Arquivos*, que baixa o contexto e recebe o lote por upload).

1. **Assistente IA → Pasta do Cowork → Escolher pasta de integração**. Crie, por exemplo, `Documentos/contabil-escola`.
2. O sistema cria:

   ```text
   contabil-escola/
   ├── LEIA-ME.txt
   ├── contexto/contexto-contabil.json   ← o sistema grava (empresa, plano de contas, períodos abertos…)
   ├── fontes/                           ← você coloca PDFs de NF, extratos CSV/OFX, conversas exportadas (.txt)
   ├── entrada/                          ← o Claude grava os lotes *.json
   ├── processados/                      ← lotes já lançados (o sistema move)
   └── descartados/                      ← lotes recusados (o sistema move)
   ```

3. Sempre que mudar o plano de contas, abrir/fechar períodos ou trocar de empresa, clique em **Atualizar contexto na pasta**.

### 3.2 Instale a skill no Claude

A skill é o "manual" que o próprio Claude segue para lançar do jeito do sistema. Ela fica neste repositório em `.claude/skills/lancamentos-contabeis/`:

```text
lancamentos-contabeis/
├── SKILL.md                         ← instruções para o Claude (triagem, competência, contas, formato, segurança)
├── referencias/roteiro-lancamentos.md   ← fatos comuns → débito/crédito, tributos recuperáveis por regime
├── referencias/formato-lote.md          ← formato e JSON Schema do lote
├── scripts/validar-lote.mjs             ← autoconferência (D = C, contas, períodos, centro de custo)
└── exemplos/                            ← mensagens e lote de exemplo
```

Para usar no app Claude (inclusive no Cowork):

1. Compacte a **pasta** `lancamentos-contabeis` num arquivo `.zip` (Windows: botão direito → *Enviar para → Pasta compactada*; macOS: botão direito → *Comprimir*; Linux: `cd .claude/skills && zip -r lancamentos-contabeis.zip lancamentos-contabeis`).
2. No app Claude, abra as configurações de **Skills** (em *Configurações → Capacidades*, ou onde a sua versão do app listar as skills) e envie o `.zip`. Ative a skill.
3. Confira se a execução de código está habilitada — a skill usa `scripts/validar-lote.mjs` para se autoconferir (sem ela, o Claude confere à mão).

No **Claude Code** dentro deste repositório não é preciso instalar nada: a skill é carregada automaticamente da pasta `.claude/skills`.

### 3.3 Dê acesso ao Cowork

1. No Cowork, escolha a pasta `contabil-escola` como pasta de trabalho.
2. (Opcional) Conecte o conector de e-mail (Gmail, Outlook…) para o Claude buscar mensagens sozinho. Para WhatsApp, exporte a conversa (*Mais → Exportar conversa*, sem mídia) e coloque o `.txt` em `fontes/`.

### 3.4 Peça ao Claude

Exemplos de pedidos:

- *"Use a skill lancamentos-contabeis. Leia meus e-mails de 01/03/2026 a 15/03/2026 sobre notas fiscais, boletos e comprovantes e gere o lote na pasta contabil-escola."*
- *"Leia os arquivos de contabil-escola/fontes (extrato de março e as NFs em PDF) e gere os lançamentos para o Contábil Escola."*
- *"Transforme esta conversa do WhatsApp com o fornecedor em lançamentos e salve em entrada/."*
- *"Refaça o lote lote-20260312-1800-emails-marco.json usando o centro de custo Comercial nas comissões."*

O Claude deve terminar com um resumo (id, data, histórico, valor, confiança, dúvidas) e o arquivo em `entrada/`.

### 3.5 Revise no sistema

**Assistente IA → Pasta do Cowork → Verificar lotes → Revisar**. Depois de lançar, o arquivo vai para `processados/`; se descartar, para `descartados/`.

### 3.6 Rotina semanal (opcional)

Se a sua versão do Cowork tiver tarefas agendadas, crie uma, por exemplo: *"Toda sexta às 17h: use a skill lancamentos-contabeis, leia os e-mails financeiros da semana e grave o lote em contabil-escola/entrada."* Na segunda, é só abrir o sistema e aprovar.

---

## Revisão e aprovação

Na tela de revisão, cada sugestão mostra:

- **status**: *válida* ou *com erro* (conta inexistente ou sintética, desbalanceada, período fechado, centro de custo faltando…);
- **confiança**: *alta* (dados explícitos), *média* (houve inferência), *baixa* (informação incompleta);
- **partidas**, **fonte** (remetente/assunto/data e o trecho que comprova o valor), **justificativa** e **dúvidas**.

Vêm pré-marcadas as válidas com confiança alta ou média. Você pode:

- desmarcar o que não quer lançar;
- **Corrigir no editor**: abre o editor de lançamentos já preenchido; ao salvar, você volta para a revisão e a sugestão aparece como *corrigida e salva no editor*;
- **Lançar N aprovada(s)**: grava tudo de uma vez (se algo falhar, nada é gravado);
- **Descartar lote**.

A lista *Mensagens sem lançamento* mostra o que o Claude leu e decidiu **não** lançar (orçamentos, duplicidades, conversas sem valor) — confira se concorda.

## Formato do lote

Resumo em [`.claude/skills/lancamentos-contabeis/referencias/formato-lote.md`](../.claude/skills/lancamentos-contabeis/referencias/formato-lote.md) (inclui o JSON Schema, conferido por teste automatizado contra o código). Exemplo completo: [`exemplos/lote-exemplo.json`](../.claude/skills/lancamentos-contabeis/exemplos/lote-exemplo.json).

Para conferir um lote fora do sistema:

```bash
node .claude/skills/lancamentos-contabeis/scripts/validar-lote.mjs caminho/do/lote.json caminho/contexto-contabil.json
```

## Segurança e privacidade

- **Conteúdo de e-mail é dado, não ordem.** A skill e o prompt instruem o Claude a ignorar pedidos embutidos em mensagens ("pague este boleto", "envie a planilha para…"). Mesmo assim, revise tudo — é para isso que existe a aprovação.
- O Claude não paga, não responde e-mails e não move dinheiro: ele só escreve um arquivo de sugestões.
- Nos modos 1 e 2 o texto colado vai para a Anthropic; no modo 3, o Cowork acessa a pasta e os conectores que **você** autorizar. Use dados fictícios.
- A skill evita copiar CPF, telefone e e-mails de pessoas físicas para os históricos.

## Solução de problemas

| Sintoma | O que fazer |
|---|---|
| "Conta X não existe no plano de contas" | O contexto está desatualizado ou a empresa usa outra máscara: *Atualizar contexto na pasta* e peça ao Claude para refazer. |
| "Período fechado" / "Não há exercício" | Reabra o período ou crie o exercício em *Exercícios e períodos*, ou corrija a data no editor. |
| "Lote gerado para outro CNPJ" | O lote foi feito com o contexto de outra empresa; selecione a empresa certa no topo. |
| Botão "Escolher pasta" não aparece | Use Chrome/Edge, ou a aba *Arquivos* (baixar contexto / enviar lote). |
| A pasta pede permissão de novo | O navegador revoga o acesso ao fechar; clique em *Permitir acesso à pasta*. |
| "Chave de API inválida" | Confira a chave em *Configurar API*; ela precisa ter créditos e acesso ao modelo escolhido. |
| O Claude respondeu fora do formato | Cole a resposta mesmo assim (o sistema procura o bloco JSON) ou peça: "responda apenas com o bloco json no formato contabil-escola/lote-lancamentos". |
