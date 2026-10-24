# Contábil Escola

Software de contabilidade **educacional** que roda 100% no navegador, seguindo a legislação e as normas contábeis brasileiras (Lei 6.404/76, CPCs, ITG 1000, NBC TG). **Todos os dados, empresas, pessoas e documentos são fictícios** — nada aqui tem valor fiscal.

Stack: React + Vite + TypeScript · IndexedDB via Dexie.js · SheetJS (Excel) · Vitest. Sem backend: os dados ficam no navegador e podem ser salvos/restaurados por backup JSON.

## Como rodar

Requer Node.js 20 ou mais novo.

```bash
npm install
npm run dev        # abre em http://localhost:5173
```

Outros comandos:

```bash
npm test           # testes unitários (Vitest)
npm run typecheck  # checagem de tipos
npm run build      # build de produção em dist/ (abre com qualquer servidor estático)
npm run preview    # serve o build em http://localhost:4173
```

Na primeira abertura, clique em **Carregar empresa de exemplo** (Comércio Exemplo Ltda, Lucro Presumido, com lançamentos de janeiro/2026) ou cadastre a sua empresa fictícia.

## Fase 1 — o que já funciona

| Módulo | Destaques |
|---|---|
| **Empresa e configurações** | Várias empresas; CNPJ com máscara e DV (numérico e **alfanumérico**), gerador de CNPJ fictício; CNAE; regime (Simples, Presumido, Real); exercício social com 12 períodos mensais; fechar/reabrir período (fechado bloqueia criar, alterar e excluir). |
| **Tabelas fiscais** | INSS, IRRF (com a redução da Lei 15.270/2025), salário mínimo, encargos da folha e alíquotas do Presumido/Real, com data de vigência, editáveis e marcadas "verificar vigência". |
| **Plano de contas** | Plano padrão (Lei 6.404) com 225 contas; máscara configurável (troca converte todos os códigos); sintéticas × analíticas; natureza, nível, grupo, conta referencial (ilustrativa), exigência de centro de custo, ativa/inativa, código reduzido; importação/exportação Excel; não exclui conta com movimento. |
| **Lançamentos** | Partidas dobradas simples e compostas (só salva com D = C); lote, documento, histórico padrão + complemento, centro de custo por partida; históricos padrão; lançamentos-modelo (inclusive recorrentes, gerando vários meses); estorno e cópia; trilha de auditoria (quem, quando, o que mudou); **modo didático** que explica o efeito no patrimônio e classifica o fato (permutativo, modificativo, misto). Atalhos de teclado. |
| **Importação Excel** | Planilha-modelo (.xlsx) com abas de exemplo, instruções e o plano de contas; formatos "uma linha por lançamento" e "uma linha por partida"; mapeamento de colunas; pré-visualização com erros por linha e por lote (inclui **lote desbalanceado com as linhas indicadas**); importa só os lotes válidos numa única transação; desfazer o lote inteiro. Aceita .xlsx, .xls, .ods e .csv. |
| **Assistente IA** | Transforma mensagens, e-mails, extratos e documentos em **lançamentos sugeridos** para você aprovar: copiar/colar em qualquer Claude, chamada direta à API do Claude, ou **integração com o Claude Cowork** por pasta compartilhada. Inclui a skill `lancamentos-contabeis` (o manual que o Claude segue). Veja [docs/MANUAL-IA.md](docs/MANUAL-IA.md). |
| **Sistema** | Backup e restauração completos em JSON; tema claro/escuro; layout responsivo; trilha de auditoria pesquisável. |

Relatórios e demonstrações (Fase 2), folha (Fase 3), estoque e NF fictícias (Fase 4) e funções adicionais/dashboard (Fase 5) aparecem no menu como "em breve".

## O que testar nesta fase

1. **Empresa**: cadastre uma empresa com *Gerar fictício* no CNPJ; teste um CNPJ com DV errado; teste o CNPJ alfanumérico `12.ABC.345/01DE-35`.
2. **Plano de contas**: filtre por grupo/nível; crie uma subconta com *+ Sub*; tente excluir uma conta com movimento (bloqueado) e inative-a; exporte para Excel, altere e reimporte.
3. **Máscara**: em *Empresas → Editar*, troque `9.9.9.99.9999` por `9.9.99.99.99999` e veja os códigos convertidos.
4. **Lançamentos**: `Alt+L` para novo; digite o código reduzido da conta e `Enter`; deixe desbalanceado e tente salvar; use `Alt+B` para balancear; faça um lançamento composto (3+ partidas); veja o modo didático; estorne e copie.
5. **Períodos**: feche janeiro em *Exercícios e períodos* e tente lançar/alterar/excluir em janeiro.
6. **Importação**: baixe a planilha-modelo, crie um lote desbalanceado e uma conta inexistente, importe, veja os erros destacados, importe só os válidos e depois desfaça.
7. **Assistente IA**: *Colar mensagens → Usar mensagens de exemplo → Copiar prompt*, cole no Claude, traga a resposta e aprove; teste *Corrigir no editor*. Com Chrome/Edge, teste a *Pasta do Cowork*.
8. **Backup**: baixe o backup, apague tudo em *Configurações* e restaure.
9. **Auditoria**: veja as alterações com o "de/para" de cada campo.
10. **Tema e celular**: alterne o tema e abra no celular (ou reduza a janela).

## Estrutura

```text
src/
├── db/                   esquema Dexie, tipos, auditoria, backup
├── lib/                  moeda (centavos), datas, CPF/CNPJ, máscara de contas
├── components/           layout, campos (moeda, data), seletor de conta
├── hooks/                estado global (empresa atual, usuário, tema, avisos)
└── modules/              um módulo por pasta
    ├── empresa/          empresas, exercícios e períodos
    ├── tabelasFiscais/   INSS, IRRF, salário mínimo, alíquotas
    ├── planoContas/      plano padrão, cadastro, importação
    ├── centrosCusto/
    ├── lancamentos/      partidas dobradas, modo didático, modelos, históricos
    ├── importacao/       planilhas, mapeamento, validação, transação
    ├── assistenteIA/     formato do lote, contexto, API do Claude, pasta do Cowork
    ├── auditoria/
    ├── configuracoes/
    └── inicio/
.claude/skills/lancamentos-contabeis/   skill do Claude (Cowork / Claude Code)
docs/MANUAL-IA.md                       manual do assistente IA
PREMISSAS.md                            premissas contábeis, fiscais e técnicas
```

## Notas técnicas

- **Valores em centavos** (inteiros) em todo o sistema; formatação `R$ 1.234,56`; datas guardadas como `AAAA-MM-DD` e exibidas `dd/mm/aaaa`.
- **SheetJS**: o pacote `xlsx` do npm parou na 0.18.5 (com vulnerabilidades conhecidas); este projeto usa a 0.20.3 pelo espelho `@e965/xlsx` (alias `xlsx` no `package.json`). Para usar a distribuição oficial: `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
- A integração por pasta usa a File System Access API (Chrome/Edge). Nos demais navegadores há o modo de baixar/enviar arquivo.
- Premissas e interpretações adotadas estão em [PREMISSAS.md](PREMISSAS.md).
