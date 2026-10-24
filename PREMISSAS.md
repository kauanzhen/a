# Premissas adotadas

Quando houve dúvida de regra contábil, fiscal ou técnica, adotamos a interpretação mais comum, registramos aqui e, sempre que possível, deixamos a regra configurável. **Uso educacional: confira as normas vigentes antes de aplicar qualquer valor fora deste software.**

## Técnicas

1. **Moeda em centavos.** Todo valor monetário é um inteiro em centavos. Arredondamento: "meio para cima" simétrico (1,005 → 1,01; −0,5 → −1), após limpar o ruído binário com `toPrecision(15)`. Percentuais são aplicados sobre centavos e arredondados ao centavo.
2. **Leitura de valores digitados/importados.** `1.234,56`, `1234,56`, `R$ 1.234,56`, `1234.56` e `1,234.56` são aceitos. Com vírgula e ponto juntos, o separador que aparece por último é o decimal. Só com ponto: um único ponto seguido de exatamente 3 dígitos é milhar (`1.234` = 1234); senão é decimal (`1234.5`). Valores entre parênteses são negativos.
3. **Datas** são guardadas como texto `AAAA-MM-DD` (sem fuso). Ano com 2 dígitos é 20xx. Datas de Excel (número de série, sistema 1900) são convertidas. CSV é lido como texto para não trocar dia/mês.
4. **CNPJ alfanumérico** (IN RFB 2.229/2024, a partir de julho/2026): as 12 primeiras posições aceitam A–Z e 0–9; DV continua numérico, calculado com o valor ASCII − 48 de cada caractere e os pesos tradicionais. O CNPJ da empresa de exemplo (`EX.EMP.LO0/0001-54`) é alfanumérico e inventado justamente para não coincidir com empresa real. O gerador de CNPJ fictício produz CNPJs numéricos com DV válido — podem coincidir por acaso com um real; use só para estudo.
5. **Usuário**: não há login. O nome informado em *Configurações* é o que aparece na trilha de auditoria.
6. **Backup** inclui todas as tabelas, exceto configurações locais (chave de API e pasta de integração). A restauração substitui tudo numa única transação.

## Plano de contas

7. Estrutura baseada no art. 178 da Lei 6.404/76: 1 Ativo (Circulante; Não Circulante: Realizável a LP, Investimentos, Imobilizado, Intangível), 2 Passivo e PL (2.1 Circulante, 2.2 Não Circulante, **2.3 Patrimônio Líquido**), 3 Receitas (inclui 3.2 Deduções), 4 Custos, 5 Despesas (inclui 5.4 IRPJ/CSLL).
8. **Grupo** da conta: herdado da conta-mãe; na raiz 2, o subgrupo 2.3 é o PL. É o grupo (e não a natureza) que define o efeito no patrimônio — assim as redutoras funcionam corretamente no modo didático.
9. **Contas redutoras** são as que começam com "(-)"; a natureza sugerida é invertida (ex.: Depreciação Acumulada é credora dentro do Ativo).
10. **Analíticas** são as do último nível no plano padrão; só elas recebem lançamentos e têm **código reduzido** (sequencial automático, editável).
11. **Conta referencial** do SPED ECD: os códigos do plano padrão são **ilustrativos** (derivados do próprio código, no formato X.XX.XX.XX.XX). Antes de qualquer uso real, mapeie com a tabela oficial do Plano de Contas Referencial vigente.
12. **Troca de máscara**: converte os códigos segmento a segmento preservando o valor numérico (ex.: `1.1.1.01.0001` → `1.1.01.01.00001`). Se algum código não couber, nada é alterado. O plano padrão exige máscara com pelo menos 5 níveis.
13. **Exclusão** de conta é bloqueada se houver lançamento, subconta ou uso em lançamento-modelo — a alternativa é inativar.

## Escrituração

14. **Exercício social** de até 12 meses, dividido em períodos mensais. Lançar exige que a data esteja num período **existente e aberto**; datas sem exercício são rejeitadas. Período fechado bloqueia criar, alterar e excluir lançamentos e desfazer importações. A reabertura é permitida (é um sistema de estudo) e fica registrada na auditoria.
15. **Estorno** gera um novo lançamento com D/C invertidos ligado ao original; o original não pode mais ser alterado. Não se estorna um estorno (exclua-o, se necessário).
16. **Lote**: em branco, assume o número do lançamento. O número do lançamento é sequencial por empresa.
17. **Centro de custo** é por partida. No formato de importação "uma linha por lançamento", o centro de custo informado é aplicado às partidas em contas de resultado ou que exigem centro de custo.
18. **Modo didático** — classificação dos fatos: *permutativo* quando o PL não muda; *modificativo* quando o PL muda por receita/custo/despesa e todo o movimento patrimonial é a contrapartida; *misto* quando há também permuta (ex.: recebimento com juros); variações do PL sem passar pelo resultado (integralização de capital, reservas) são mostradas como "variação direta do PL".

## Importação Excel

19. Um lote só é importado se **todas** as suas linhas forem válidas, tiverem a mesma data e D = C. Lotes inválidos são rejeitados inteiros; os válidos entram numa única transação.
20. **Localização da conta**: com separadores (`1.1.1.01.0001`) → código; só dígitos com o total de dígitos da máscara (`111010001`) → código sem pontos; número curto → código reduzido.
21. **Desfazer importação** exclui todos os lançamentos do lote; é bloqueado se algum estiver em período fechado ou tiver sido estornado.

## Tabelas fiscais (todas marcadas "verificar vigência")

22. **Salário mínimo**: 2025 = R$ 1.518,00 (Decreto 12.342/2024); 2026 = R$ 1.621,00.
23. **INSS do empregado** (progressivo por faixas): 2025 — até 1.518,00 (7,5%), 2.793,88 (9%), 4.190,83 (12%), 8.157,41 (14%). 2026 — até 1.621,00 (7,5%), 2.902,84 (9%), 4.354,27 (12%), 8.475,55 (14%), valores coerentes com reajuste de 3,9% sobre 2025.
24. **IRRF mensal** a partir de maio/2025: isento até 2.428,80; 7,5% até 2.826,65 (dedução 182,16); 15% até 3.751,05 (394,16); 22,5% até 4.664,68 (675,49); 27,5% acima (908,73). Dependente 189,59; desconto simplificado 607,20 (usar o mais vantajoso entre deduções legais e o simplificado).
25. **IRRF 2026 — redução da Lei 15.270/2025**: rendimentos tributáveis mensais até R$ 5.000,00 têm redução de até R$ 312,89 (imposto zerado); de R$ 5.000,01 a R$ 7.350,00, redução = R$ 978,62 − 0,133145 × rendimentos; acima, sem redução. **Premissa**: "rendimentos tributáveis" = rendimento tributável bruto do mês (antes das deduções); a redução é limitada ao imposto calculado. Parâmetros editáveis. (Usado na Fase 3.)
26. **Encargos da folha** (fora do Simples): FGTS 8%, INSS patronal 20%, RAT 2% × FAP 1,0, terceiros 5,8% (FPAS 515), VT até 6%, HE 50%/100%, adicional noturno 20%, insalubridade 10/20/40% do salário mínimo, periculosidade 30%, divisor 220 h.
27. **Lucro Presumido (comércio)**: PIS 0,65% e COFINS 3% cumulativos; presunção IRPJ 8% e CSLL 12%; IRPJ 15% + adicional 10% sobre o que exceder R$ 20.000/mês; CSLL 9%. Atenção à LC 224/2025, que aumenta as presunções para receitas acima de R$ 5 milhões/ano — não aplicada por padrão. **Lucro Real**: PIS 1,65% e COFINS 7,6% não cumulativos.

## Assistente IA

28. O assistente apenas **sugere**: as sugestões passam pelo mesmo validador da importação Excel e o usuário aprova uma a uma. Vêm pré-aprovadas as válidas com confiança alta ou média. Os aprovados são gravados com origem "Assistente IA" e uma observação com a fonte e a justificativa, e podem ser desfeitos em bloco.
29. Conteúdo de mensagens e e-mails é tratado como **dado**: o prompt e a skill mandam ignorar instruções embutidas.
30. Modo API: chamada direta do navegador com a chave do usuário (`dangerouslyAllowBrowser`), modelo padrão `claude-opus-5-5`, saída estruturada com o JSON Schema do lote e fallback automático do servidor em caso de recusa por política. A chave fica só no IndexedDB do navegador e não vai para o backup.
31. Recuperabilidade de tributos na compra (usada pela skill): Simples não recupera ICMS/PIS/COFINS; Presumido recupera ICMS (se contribuinte) e não PIS/COFINS; Real recupera ICMS e PIS/COFINS não cumulativos. Comércio não contribuinte de IPI incorpora o IPI ao custo.
