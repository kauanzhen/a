# Contábil Escola — notas para o Claude

Software de contabilidade educacional (pt-BR, dados fictícios) que roda só no navegador. React + Vite + TypeScript, Dexie (IndexedDB), SheetJS, Vitest. Construído em fases (ver README); a Fase 1 está pronta.

## Comandos
- `npm test` — Vitest (testes em `src/**/*.test.ts`, banco simulado com `fake-indexeddb` via `src/test/ambiente.ts`)
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — typecheck + build

## Convenções
- Dinheiro sempre em **centavos inteiros** (`src/lib/money.ts`); datas como `AAAA-MM-DD` (`src/lib/date.ts`). Nunca use float para somar valores.
- Um módulo por pasta em `src/modules/`. Regras de negócio puras (testáveis) separadas dos serviços que gravam no banco; telas `*Page.tsx` chamam os serviços.
- Toda gravação acontece em `db.transaction(...)` incluindo `db.auditoria` e chamando `registrarAuditoria`.
- Período fechado bloqueia criar/alterar/excluir lançamentos (`exigirPeriodoAberto`).
- Textos da interface, nomes de funções e comentários em português, no estilo do código existente.
- Premissas fiscais/contábeis novas vão para `PREMISSAS.md` e, se possível, ficam configuráveis (tabelas fiscais).
- Novas tabelas no Dexie exigem nova `version()` em `src/db/db.ts` e atualizam `VERSAO_ESQUEMA` (o backup depende disso).

## Fazer lançamentos a partir de mensagens/e-mails
Use a skill `.claude/skills/lancamentos-contabeis/` (SKILL.md). Ela gera o lote JSON `contabil-escola/lote-lancamentos`, que o usuário importa e aprova em **Assistente IA**. O schema em `referencias/formato-lote.md` é testado contra `SCHEMA_LOTE` (`src/modules/assistenteIA/formatoLote.ts`) — se mudar um, mude o outro.
