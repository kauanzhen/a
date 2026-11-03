# Calango — notas para o Claude

Gerador de atos societários (LTDA) que roda só no navegador (Edge), aberto direto do disco/rede (`file://`), sem servidor. Especificação: `ESPECIFICACAO_CALANGO.md` (trabalhar **uma fase por vez** e parar para aprovação). Relatório da fase atual: `FASE-1.md`. Guia do usuário: `LEIA-ME.md`. O usuário não é programador: explique em português simples e pergunte antes de decisões estruturais fora da especificação.

## Comandos (em `codigo/`)
- `npm test` — Vitest (`src/**/*.test.ts`)
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — typecheck + gera **`../sistema/index.html`** (arquivo único, tudo embutido; é o que o usuário abre). Sempre recompilar e versionar o `sistema/index.html` junto com mudanças no código.
- `npm run test:navegador` — build + teste Playwright do fluxo completo (precisa de `LANG=C.UTF-8` neste ambiente para nomes de arquivo com acento).

## Estrutura (`codigo/src/`)
- `lib/` dinheiro (sempre **centavos inteiros**), datas (`AAAA-MM-DD`), texto.
- `gramatica/` extenso, ordinais, concordância/estado civil — puro, testado.
- `dados/` modelo de dados (`tipos.ts`), quotas, validação, catálogo de campos do formulário, exemplos.
- `tipos/` **tipos societários e documentos como dados** (`ltda.ts`, `registro.ts`). Nada de "LTDA" fixo no motor.
- `motor/` sintaxe das cláusulas (`sintaxe.ts`), condições (`expressao.ts`), catálogo de variáveis/listas/condições (`catalogo.ts`), avaliador, campos exigidos (derivados), montagem com numeração automática.
- `biblioteca/` biblioteca inicial (a partir de `modelos/`) e regras de edição/versões.
- `armazenamento/` File System Access API, repositório (backup em `backups/AAAA-MM-DD`, conflito por data de modificação, 30 dias), exportação/importação, configurações.
- `docx/` geração com docx.js (estilos nomeados, numeração como texto, cabeçalho/rodapé).
- `servicos/` regras dos atos (seleção padrão, revisão/pendências, gerado/registrado).
- `interface/` React (telas em `telas/`, componentes em `componentes/`).

## Convenções
- Código, comentários, telas e mensagens em pt-BR; mensagens de erro dizem o que aconteceu e o que fazer.
- Arquivos gravados usam snake_case (como na especificação); código usa camelCase.
- Toda gravação passa pelo `Repositorio` (backup + conferência de conflito). Nunca apagar sem confirmação.
- O cadastro vigente só muda quando o ato é marcado como `registrado`.
- Nova variável/condição/lista: declarar em `motor/catalogo.ts` com os `campos` de que depende (o formulário é montado a partir disso).
- Alterou o texto de uma cláusula da biblioteca inicial? Rode os testes de aceite (`src/biblioteca/biblioteca.test.ts`). A biblioteca inicial só é gravada em pastas de dados novas; pastas existentes mantêm as cláusulas do usuário.
- Formulários: alterações devem partir do valor mais recente (ref `atual` em `FormularioDados`, atualizadores em `PessoaForm`), para duas mudanças seguidas não se apagarem.
