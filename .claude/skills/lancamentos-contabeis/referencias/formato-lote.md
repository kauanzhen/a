# Formato do lote de lançamentos sugeridos

Identificador: `contabil-escola/lote-lancamentos`, versão `1`. É o arquivo que o Claude entrega (em `entrada/` da pasta de integração ou num bloco ```json no chat) e que o Contábil Escola valida e mostra para aprovação.

## Estrutura

```text
{
  "formato": "contabil-escola/lote-lancamentos",   // recomendado
  "versao": 1,                                      // recomendado
  "empresaCnpj": "EX.EMP.LO0/0001-54",              // do contexto; o sistema avisa se não bater
  "geradoPor": "Claude (Cowork)",                   // opcional
  "geradoEm": "2026-03-12T18:00:00.000Z",           // opcional, ISO 8601
  "lancamentos": [ ...LancamentoIA ],               // obrigatório (pode ser [])
  "naoLancados": [ { "referencia": "...", "motivo": "..." } ]   // obrigatório (pode ser [])
}
```

Cada **lançamento**:

| Campo | Tipo | Regra |
|---|---|---|
| `id` | texto | Único no lote: `L1`, `L2`… |
| `data` | texto | `AAAA-MM-DD`, data do fato gerador, num período aberto |
| `documento` | texto | NF nº, boleto, recibo, "Extrato" — ou `""` |
| `historico` | texto | Claro, em português, sem dados pessoais desnecessários |
| `partidas` | lista | ≥ 2, com pelo menos um `D` e um `C`; soma D = soma C |
| `partidas[].conta` | texto | Código de classificação de conta **analítica** ativa do contexto (o código reduzido também é aceito) |
| `partidas[].tipo` | `"D"` \| `"C"` | Débito ou crédito |
| `partidas[].valor` | número | Reais, positivo, até 2 casas (ex.: `45.9`, `3500.0`) |
| `partidas[].centroCusto` | texto | Código do centro de custo (obrigatório se a conta exige) ou `""` |
| `partidas[].historico` | texto | Histórico próprio da partida ou `""` |
| `origem.tipo` | texto | `email`, `mensagem`, `documento`, `extrato` ou `outro` |
| `origem.referencia` | texto | Remetente/assunto/data ou nome do arquivo |
| `origem.trecho` | texto | Trecho curto (até ~200 caracteres) que comprova o fato |
| `confianca` | texto | `alta`, `media` ou `baixa` |
| `justificativa` | texto | Por que essas contas/esse regime |
| `duvidas` | lista de textos | Perguntas para o usuário; `[]` se não houver |

## Como o sistema usa o lote

1. Lê o JSON (aceita o JSON puro ou dentro de um bloco ```json).
2. Converte cada lançamento em linhas "uma por partida" e aplica as **mesmas validações da importação Excel**: conta existente, analítica e ativa; centro de custo; data em período aberto; valor positivo; D = C.
3. Mostra cada sugestão com a fonte, a justificativa, as dúvidas e os erros. Vêm pré-marcadas as válidas com confiança alta ou média.
4. O usuário aprova, corrige no editor ou descarta. Os aprovados são gravados numa única operação com origem **"Assistente IA"** e uma observação com a fonte — e podem ser desfeitos em Importação Excel → Histórico.

## JSON Schema (usado também nas saídas estruturadas da API)

Este bloco é conferido por teste automatizado contra o código do sistema (`src/modules/assistenteIA/formatoLote.ts`).

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "lancamentos",
    "naoLancados"
  ],
  "properties": {
    "lancamentos": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "id",
          "data",
          "documento",
          "historico",
          "partidas",
          "origem",
          "confianca",
          "justificativa",
          "duvidas"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "Identificador do lançamento dentro do lote, ex.: \"L1\"."
          },
          "data": {
            "type": "string",
            "description": "Data do fato contábil no formato AAAA-MM-DD."
          },
          "documento": {
            "type": "string",
            "description": "Número do documento (NF, boleto, recibo) ou \"\" se não houver."
          },
          "historico": {
            "type": "string",
            "description": "Histórico claro em português, ex.: \"Pagamento de aluguel ref. 03/2026\"."
          },
          "partidas": {
            "type": "array",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "conta",
                "tipo",
                "valor",
                "centroCusto",
                "historico"
              ],
              "properties": {
                "conta": {
                  "type": "string",
                  "description": "Código de classificação de uma conta ANALÍTICA do contexto, ex.: \"1.1.1.02.0001\"."
                },
                "tipo": {
                  "type": "string",
                  "enum": [
                    "D",
                    "C"
                  ]
                },
                "valor": {
                  "type": "number",
                  "description": "Valor em reais, positivo, com até 2 casas decimais."
                },
                "centroCusto": {
                  "type": "string",
                  "description": "Código do centro de custo, ou \"\" se não se aplica."
                },
                "historico": {
                  "type": "string",
                  "description": "Histórico próprio da partida, ou \"\" para usar o do lançamento."
                }
              }
            }
          },
          "origem": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "tipo",
              "referencia",
              "trecho"
            ],
            "properties": {
              "tipo": {
                "type": "string",
                "enum": [
                  "email",
                  "mensagem",
                  "documento",
                  "extrato",
                  "outro"
                ]
              },
              "referencia": {
                "type": "string",
                "description": "Remetente/assunto/data ou nome do arquivo de onde o fato foi tirado."
              },
              "trecho": {
                "type": "string",
                "description": "Trecho curto (até 200 caracteres) que comprova o fato."
              }
            }
          },
          "confianca": {
            "type": "string",
            "enum": [
              "alta",
              "media",
              "baixa"
            ]
          },
          "justificativa": {
            "type": "string",
            "description": "Por que estas contas e este regime (competência/caixa)."
          },
          "duvidas": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Pontos que o usuário precisa confirmar."
          }
        }
      }
    },
    "naoLancados": {
      "type": "array",
      "description": "Mensagens que não geraram lançamento (sem fato contábil ou sem informação suficiente).",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "referencia",
          "motivo"
        ],
        "properties": {
          "referencia": {
            "type": "string"
          },
          "motivo": {
            "type": "string"
          }
        }
      }
    }
  }
}
```
