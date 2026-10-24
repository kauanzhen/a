# Roteiro de lançamentos — fatos comuns

Códigos do **plano de contas padrão** do Contábil Escola (máscara `9.9.9.99.9999`). Se o contexto da empresa tiver outra máscara ou contas próprias, **use os códigos do contexto** — procure pelo nome. "Banco" = `1.1.1.02.0001 Banco Exemplo S.A. - C/C` quando a mensagem não indicar outro.

Convenção: **D** = débito, **C** = crédito. Valores sempre positivos.

## Capital e sócios

| Fato | Débito | Crédito |
|---|---|---|
| Subscrição do capital (contrato social) | 2.3.1.01.0002 (-) Capital a Integralizar | 2.3.1.01.0001 Capital Subscrito |
| Integralização em dinheiro (após subscrição) | 1.1.1.02.0001 Banco | 2.3.1.01.0002 (-) Capital a Integralizar |
| Integralização direta, sem subscrição lançada | 1.1.1.02.0001 Banco | 2.3.1.01.0001 Capital Subscrito |
| Empréstimo do sócio para a empresa | Banco | 2.2.1.02.0001 Empréstimos de Sócios |
| Lucros distribuídos (declarados) | 2.3.4.01.0001 Lucros ou Prejuízos Acumulados | 2.1.5.01.0004 Lucros e Dividendos a Pagar |

## Caixa, bancos e aplicações

| Fato | Débito | Crédito |
|---|---|---|
| Saque para o caixa | 1.1.1.01.0001 Caixa Geral | Banco |
| Depósito do caixa no banco | Banco | 1.1.1.01.0001 Caixa Geral |
| Tarifa bancária | 5.2.1.01.0002 Tarifas Bancárias | Banco |
| IOF | 5.2.1.01.0004 IOF | Banco |
| Juros/multa por atraso pagos | 5.2.1.01.0005 Multas e Juros de Mora (ou 5.2.1.01.0001 Juros Passivos) | Banco |
| Aplicação financeira | 1.1.1.03.0001 Aplicação CDB | Banco |
| Rendimento de aplicação (bruto) | 1.1.1.03.0001 Aplicação CDB | 3.3.1.01.0002 Rendimentos de Aplicações |
| IR retido sobre o rendimento | 1.1.2.03.0005 IRRF a Compensar | 1.1.1.03.0001 Aplicação CDB |

## Compras

A parte recuperável dos tributos depende do regime (veja o fim deste arquivo).

| Fato | Débito | Crédito |
|---|---|---|
| Mercadoria para revenda, a prazo — Simples Nacional | 1.1.3.01.0001 Mercadorias (valor total da NF) | 2.1.1.01.0001 Fornecedores |
| Mercadoria para revenda, a prazo — Lucro Presumido | 1.1.3.01.0001 Mercadorias (total − ICMS) **e** 1.1.2.03.0001 ICMS a Recuperar (ICMS destacado) | 2.1.1.01.0001 Fornecedores (total) |
| Mercadoria para revenda, a prazo — Lucro Real | Mercadorias (total − ICMS − PIS − COFINS) **e** ICMS a Recuperar **e** 1.1.2.03.0003 PIS a Recuperar **e** 1.1.2.03.0004 COFINS a Recuperar | Fornecedores (total) |
| Mercadoria à vista | (mesmos débitos) | Banco ou Caixa |
| Frete/seguro na compra | soma ao custo de 1.1.3.01.0001 Mercadorias | Banco/Fornecedores |
| Material de uso e consumo / escritório | 5.1.2.01.0005 Material de Escritório ou 5.1.2.01.0011 Limpeza e Consumo (ICMS **não** é recuperável) | Banco/Fornecedores |
| Bem do imobilizado (móveis, computador, veículo) | 1.2.3.01.0004 / 0006 / 0005 … | Banco/Fornecedores |
| Pagamento a fornecedor | 2.1.1.01.0001 Fornecedores | Banco |
| … com juros por atraso | Fornecedores **e** 5.2.1.01.0005 Multas e Juros de Mora | Banco |
| … com desconto obtido | Fornecedores | Banco **e** 3.3.1.01.0003 Descontos Obtidos |
| Adiantamento a fornecedor | 1.1.2.02.0001 Adiantamentos a Fornecedores | Banco |

## Vendas e serviços

| Fato | Débito | Crédito |
|---|---|---|
| Venda de mercadoria à vista | Caixa ou Banco | 3.1.1.01.0001 Vendas de Mercadorias |
| Venda a prazo | 1.1.2.01.0001 Clientes Nacionais | 3.1.1.01.0001 Vendas |
| ICMS destacado na venda (não Simples) | 3.2.1.02.0001 (-) ICMS sobre Vendas | 2.1.3.01.0001 ICMS a Recolher |
| Custo da mercadoria vendida (se o custo for conhecido) | 4.1.1.01.0001 CMV | 1.1.3.01.0001 Mercadorias |
| Recebimento de cliente | Banco ou Caixa | 1.1.2.01.0001 Clientes |
| … com juros recebidos | Banco | Clientes **e** 3.3.1.01.0001 Juros Ativos |
| … com desconto concedido | Banco **e** 5.2.1.01.0003 Descontos Concedidos | Clientes |
| Devolução de venda | 3.2.1.01.0001 (-) Devoluções de Vendas | Clientes ou Banco (e estorne ICMS e CMV proporcionais) |
| Adiantamento recebido de cliente | Banco | 2.1.5.01.0003 Adiantamentos de Clientes |
| Prestação de serviço | Clientes ou Banco | 3.1.1.02.0001 Receita de Serviços |
| ISS sobre serviços | 3.2.1.02.0004 (-) ISS sobre Serviços | 2.1.3.01.0008 ISS a Recolher |

PIS/COFINS sobre o faturamento e o DAS do Simples normalmente são apurados **no fim do mês** (a Fase 5 do sistema automatiza). Só lance se a mensagem trouxer o valor apurado:

| Fato | Débito | Crédito |
|---|---|---|
| PIS/COFINS apurados (Presumido 0,65%/3%; Real 1,65%/7,6% menos créditos) | 3.2.1.02.0002 (-) PIS / 3.2.1.02.0003 (-) COFINS | 2.1.3.01.0003 PIS / 2.1.3.01.0004 COFINS a Recolher |
| DAS apurado (Simples Nacional) | 3.2.1.02.0005 (-) Simples Nacional sobre Receita | 2.1.3.01.0009 Simples Nacional a Recolher |

## Despesas do dia a dia

| Fato | Débito | Crédito |
|---|---|---|
| Aluguel do mês, pago | 5.1.2.01.0001 Aluguéis | Banco |
| Aluguel do mês, a pagar (vence depois) | 5.1.2.01.0001 Aluguéis | 2.1.5.01.0001 Aluguéis a Pagar |
| Pagamento do aluguel provisionado | 2.1.5.01.0001 Aluguéis a Pagar | Banco |
| Energia / água / telefone e internet | 5.1.2.01.0002 / 0003 / 0004 | Banco (ou 2.1.5.01.0002 Contas de Consumo a Pagar) |
| Honorários contábeis | 5.1.2.01.0006 Honorários Contábeis | Banco |
| Manutenção e reparos | 5.1.2.01.0008 | Banco |
| Seguro anual pago antecipadamente | 1.1.4.01.0001 Seguros a Apropriar | Banco |
| Apropriação mensal do seguro | 5.1.2.01.0007 Seguros | 1.1.4.01.0001 Seguros a Apropriar |
| Propaganda | 5.1.3.01.0002 Propaganda e Publicidade | Banco |
| Comissão de vendedor | 5.1.3.01.0001 Comissões sobre Vendas | Banco |
| Frete sobre vendas | 5.1.3.01.0003 Fretes sobre Vendas | Banco |
| IPTU / IPVA / taxas | 5.1.4.01.0001 / 5.1.4.01.0002 | Banco |
| Depreciação mensal | 5.1.2.01.0009 Depreciação | 1.2.3.02.000x (-) Depreciação Acumulada do bem |

## Pessoal (simplificado — a Fase 3 calcula a folha completa)

As contas de despesa com pessoal **exigem centro de custo**.

| Fato | Débito | Crédito |
|---|---|---|
| Folha do mês (salário bruto) | 5.1.1.01.0001 Salários e Ordenados (CC) | 2.1.2.01.0001 Salários a Pagar (líquido) **e** 2.1.2.02.0001 INSS a Recolher (retido) **e** 2.1.3.01.0007 IRRF a Recolher (retido) |
| FGTS do mês (8%) | 5.1.1.02.0002 FGTS (CC) | 2.1.2.02.0002 FGTS a Recolher |
| INSS patronal (fora do Simples) | 5.1.1.02.0001 INSS Patronal (CC) | 2.1.2.02.0001 INSS a Recolher |
| Pagamento dos salários | 2.1.2.01.0001 Salários a Pagar | Banco |
| Provisão de férias / 13º | 5.1.1.01.0004 Férias / 5.1.1.01.0005 13º (CC) | 2.1.2.03.0001 / 2.1.2.03.0002 |
| Pró-labore | 5.1.1.01.0006 Pró-Labore (CC) | 2.1.2.01.0002 Pró-Labore a Pagar (líquido) **e** INSS a Recolher (11% retido) |
| Vale-transporte comprado | 5.1.1.03.0001 Vale-Transporte (CC) | Banco |

## Tributos e empréstimos

| Fato | Débito | Crédito |
|---|---|---|
| Pagamento de guia (DAS, ICMS, PIS, COFINS, IRPJ, CSLL, INSS, FGTS, IRRF, ISS) | a conta "… a Recolher" correspondente (2.1.3.01.000x ou 2.1.2.02.000x) | Banco |
| … paga com atraso | "… a Recolher" **e** 5.2.1.01.0005 Multas e Juros de Mora | Banco |
| Empréstimo bancário creditado (até 12 meses) | Banco | 2.1.4.01.0001 Empréstimos - Curto Prazo |
| Empréstimo bancário (parcelas além de 12 meses) | Banco | 2.2.1.01.0001 Empréstimos - Longo Prazo (parte LP) |
| Pagamento de parcela | Empréstimos (principal) **e** 5.2.1.01.0001 Juros Passivos (juros) | Banco |

## Tributos recuperáveis por regime (resumo didático)

| Regime | ICMS na compra de revenda | PIS/COFINS na compra | IPI (comércio) |
|---|---|---|---|
| Simples Nacional | não recupera — vai para o custo | não recupera | custo |
| Lucro Presumido | recupera (se contribuinte do ICMS) | não recupera (regime cumulativo) | custo |
| Lucro Real | recupera | recupera (não cumulativo, 1,65% e 7,6% sobre a base permitida) | custo (comércio não contribuinte) |

Na dúvida sobre um tratamento tributário, **não invente**: use a regra mais comum, marque `confianca: "media"` e escreva a dúvida em `duvidas`.
