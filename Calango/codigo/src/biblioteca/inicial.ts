// Biblioteca inicial de cláusulas, criada a partir dos modelos do escritório
// (pasta Calango/modelos/), separando cada cláusula e parágrafo em blocos
// reaproveitáveis e CORRIGINDO os erros apontados na seção 13 da especificação
// (numeração, texto de unipessoal em contrato com vários sócios, "R$ R$",
// "CPF º", termos de empresário individual, cidade e órgão fixos, hyperlinks).
//
// Na primeira vez que uma pasta de dados é usada, estes blocos são gravados em
// clausulas/ (um arquivo por cláusula). Depois disso, a versão que vale é a da
// pasta de dados (que o usuário pode editar).

import { regrasPadrao, type Clausula, type RegrasClausula, type TipoBloco } from '../motor/clausula';

interface Def {
  id: string;
  titulo_interno: string;
  titulo_secao?: string;
  tipo_bloco: TipoBloco;
  tags: string[];
  documentos: string[];
  natureza?: Clausula['natureza'];
  regras?: Partial<RegrasClausula>;
  corpo: string[];
  observacoes?: string;
}

const NORMAL = ['abertura', 'consolidacao'];

const DEFINICOES: Def[] = [
  // ---------------- Componentes ----------------
  {
    id: 'qualificacao-pessoa-fisica',
    titulo_interno: 'Qualificação de pessoa física (componente)',
    tipo_bloco: 'texto',
    tags: ['componente', 'qualificação'],
    documentos: [],
    natureza: 'fixa',
    corpo: [
      '{{pessoa.nome}}, {{pessoa.nacionalidade}}, {{pessoa.maioridade}}, natural de {{pessoa.naturalidade}}, {nascido|nascida : pessoa} em {{pessoa.data_nascimento}}, {{pessoa.estado_civil}}, {{pessoa.profissao}}[se pessoa.registro_conselho] - {{pessoa.registro_conselho}}[fim], {portador|portadora : pessoa} da cédula de identidade RG nº {{pessoa.rg}} {{pessoa.rg_orgao_uf}}, {inscrito|inscrita : pessoa} no CPF nº {{pessoa.cpf}}, {residente e domiciliado|residente e domiciliada : pessoa} {{pessoa.no_endereco}}',
    ],
    observacoes:
      'Usado por {{socio.qualificacao}}, {{administrador.qualificacao}} e {{pessoa.qualificacao}}. Alterar aqui muda a qualificação em todos os documentos.',
  },

  // ---------------- Abertura: título, preâmbulo ----------------
  {
    id: 'titulo-abertura',
    titulo_interno: 'Título — contrato social de abertura',
    tipo_bloco: 'texto',
    tags: ['título', 'obrigatória'],
    documentos: ['abertura'],
    natureza: 'fixa',
    regras: { obrigatoria: true },
    corpo: ['CONTRATO SOCIAL DE SOCIEDADE LIMITADA[se unipessoal] UNIPESSOAL[fim]', '{{empresa.razao_social}}'],
  },
  {
    id: 'preambulo-abertura',
    titulo_interno: 'Preâmbulo — qualificação dos sócios e constituição',
    tipo_bloco: 'texto',
    tags: ['preâmbulo', 'qualificação', 'obrigatória'],
    documentos: ['abertura'],
    natureza: 'fixa',
    regras: { obrigatoria: true },
    corpo: [
      '[para cada socio em socios separador=";" ultimo=" e" final="."]',
      '{Sr.|Sra. : socio} {{socio.qualificacao}}',
      '[fim]',
      '[se unipessoal]',
      'Resolve constituir uma sociedade limitada unipessoal, mediante as condições e cláusulas seguintes:',
      '[senão]',
      'Resolvem, em comum acordo, constituir uma sociedade limitada, mediante as condições e cláusulas seguintes:',
      '[fim]',
    ],
  },

  // ---------------- Corpo ----------------
  {
    id: 'denominacao',
    titulo_interno: 'Denominação (nome empresarial)',
    titulo_secao: 'DA DENOMINAÇÃO',
    tipo_bloco: 'clausula',
    tags: ['denominação', 'obrigatória'],
    documentos: NORMAL,
    regras: { obrigatoria: true },
    corpo: ['A sociedade adotará o seguinte nome empresarial: {{empresa.razao_social}}.'],
  },
  {
    id: 'sede',
    titulo_interno: 'Sede',
    titulo_secao: 'DA SEDE',
    tipo_bloco: 'clausula',
    tags: ['sede', 'endereço', 'obrigatória'],
    documentos: NORMAL,
    regras: { obrigatoria: true },
    corpo: ['A sociedade terá sua sede no seguinte endereço: {{sede.endereco_completo}}.'],
  },
  {
    id: 'duracao',
    titulo_interno: 'Início das atividades e prazo de duração',
    titulo_secao: 'DA DURAÇÃO',
    tipo_bloco: 'clausula',
    tags: ['duração', 'obrigatória'],
    documentos: NORMAL,
    regras: { obrigatoria: true },
    corpo: [
      'A empresa iniciará suas atividades a partir de {{empresa.data_inicio_atividades}} e seu prazo de duração é [se prazo = determinado]determinado, encerrando-se em {{empresa.prazo_data}}[senão]por tempo indeterminado[fim].',
    ],
  },
  {
    id: 'objeto-social',
    titulo_interno: 'Objeto social e CNAEs',
    titulo_secao: 'DO OBJETO SOCIAL',
    tipo_bloco: 'clausula',
    tags: ['objeto', 'cnae', 'obrigatória'],
    documentos: NORMAL,
    regras: { obrigatoria: true },
    corpo: [
      '[se objeto.forma = lista]',
      'A sociedade empresária limitada[se unipessoal] unipessoal[fim] tem como objeto social:',
      '[para cada item em objeto_itens separador=";" final="."]',
      '- {{item.texto}}',
      '[fim]',
      '[senão]',
      'A sociedade empresária limitada[se unipessoal] unipessoal[fim] tem como objeto social: {{empresa.objeto_social}}.',
      '[fim]',
      'Codificação das Atividades Econômicas:',
      '[tabela]',
      'CNAE | DESCRIÇÃO | TIPO',
      '[para cada cnae em cnaes]',
      '{{cnae.codigo}} | {{cnae.descricao}} | {{cnae.tipo}}',
      '[fim]',
      '[fim]',
    ],
  },
  {
    id: 'capital-social',
    titulo_interno: 'Capital social e quadro societário (classe única ou classes distintas)',
    titulo_secao: 'DO CAPITAL SOCIAL',
    tipo_bloco: 'clausula',
    tags: ['capital', 'quotas', 'obrigatória'],
    documentos: NORMAL,
    regras: { obrigatoria: true },
    corpo: [
      'O capital social é de {{capital.valor_por_extenso}}, dividido em {{capital.quotas_por_extenso}}[se classe_unica] no valor de {{capital.valor_quota_por_extenso}} cada uma[fim], [se capital.integralizacao = a_prazo]totalmente subscritas neste ato, que serão integralizadas em moeda corrente do País até {{capital.integralizacao_data}}[senão se capital.integralizacao = bens]totalmente subscritas e integralizadas, neste ato, mediante a conferência dos seguintes bens: {{capital.bens_descricao}}[senão]totalmente subscritas e integralizadas, neste ato, em moeda corrente do País[fim], distribuído da seguinte forma:',
      '[se classes_distintas]',
      'As quotas estão divididas nas seguintes classes:',
      '[para cada classe em classes]',
      '- **{{classe.nome}}**: {{classe.quotas_por_extenso}}, no valor unitário de {{classe.valor_quota_por_extenso}}[se classe.voto = pleno], com direito a voto pleno[fim][se classe.voto = restrito], com direito a voto restrito às seguintes matérias: {{classe.voto_materias}}[fim][se classe.voto = sem_voto], sem direito a voto[fim][se classe.preferencia_lucros], com preferência na distribuição de lucros ({{classe.preferencia}})[fim][se classe.prioridade_reembolso], com prioridade no reembolso do capital em caso de liquidação da sociedade[fim][se classe.elege_administrador], com direito de eleger, em separado, administrador da sociedade[fim][se ultimo].[senão];[fim]',
      '[fim]',
      '[tabela]',
      'SÓCIO | [para cada classe em classes] QUOTAS {{classe.nome}} | TOTAL DE QUOTAS | PERCENTUAL | VALOR (R$)',
      '[para cada socio em socios]',
      '{{socio.nome_simples}} | [para cada classe em classes] {{socio.quotas_na_classe}} | {{socio.quotas}} | {{socio.percentual}} | {{socio.valor}}',
      '[fim]',
      '**TOTAL** | [para cada classe em classes] **{{classe.quotas}}** | **{{capital.quotas}}** | **100%** | **{{capital.valor}}**',
      '[fim]',
      '[senão]',
      '[tabela]',
      'SÓCIO | PERCENTUAL | QUOTAS | VALOR (R$)',
      '[para cada socio em socios]',
      '{{socio.nome_simples}} | {{socio.percentual}} | {{socio.quotas}} | {{socio.valor}}',
      '[fim]',
      '**TOTAL** | **100%** | **{{capital.quotas}}** | **{{capital.valor}}**',
      '[fim]',
      '[fim]',
    ],
    observacoes: 'Com classes distintas, a redação dos direitos de cada classe deve ser revisada por advogado.',
  },
  {
    id: 'paragrafo-responsabilidade-quotas',
    titulo_interno: 'Parágrafo — responsabilidade limitada ao valor das quotas',
    tipo_bloco: 'paragrafo',
    tags: ['capital', 'responsabilidade'],
    documentos: NORMAL,
    regras: { requer: ['capital-social'] },
    corpo: [
      'A responsabilidade {do sócio|da sócia|dos sócios|das sócias : socios} é restrita ao valor de suas quotas, não havendo responsabilidade solidária pelas obrigações sociais, respondendo, no entanto, pela integralização do capital social.',
    ],
  },
  {
    id: 'paragrafo-quotas-indivisiveis',
    titulo_interno: 'Parágrafo — quotas indivisíveis e cessão',
    tipo_bloco: 'paragrafo',
    tags: ['capital', 'quotas', 'cessão'],
    documentos: NORMAL,
    regras: { requer: ['capital-social'] },
    corpo: ['As quotas são indivisíveis, podendo ser cedidas ou transferidas a terceiros, mediante alteração contratual pertinente.'],
  },
  {
    id: 'paragrafo-aumento-capital',
    titulo_interno: 'Parágrafo — aumento do capital',
    tipo_bloco: 'paragrafo',
    tags: ['capital', 'aumento'],
    documentos: NORMAL,
    regras: { requer: ['capital-social'] },
    corpo: [
      'O capital social poderá ser aumentado uma ou mais vezes, mediante a emissão de novas quotas a serem realizadas em moeda corrente e legal do País ou pela incorporação de bens passíveis de avaliação pecuniária, ou através da apropriação de reservas inscritas na contabilidade social ou ainda por qualquer forma juridicamente aceita.',
    ],
  },
  {
    id: 'paragrafo-permanencia-unipessoal',
    titulo_interno: 'Parágrafo — sócio único detém 100% e a sociedade permanece unipessoal',
    tipo_bloco: 'paragrafo',
    tags: ['capital', 'unipessoal'],
    documentos: ['abertura', 'consolidacao', 'transformacao'],
    regras: { requer: ['capital-social'], condicao_de_exibicao: 'unipessoal' },
    corpo: [
      '{O sócio|A sócia : socios} é {detentor|detentora : socios} de 100% (cem por cento) do capital social e decide que a sociedade permanecerá unipessoal.',
    ],
    observacoes: 'Vem do modelo de transformação de EI em LTDA unipessoal. Opcional.',
  },
  {
    id: 'enquadramento',
    titulo_interno: 'Enquadramento como ME ou EPP',
    titulo_secao: 'DO ENQUADRAMENTO',
    tipo_bloco: 'clausula',
    tags: ['enquadramento', 'ME', 'EPP'],
    documentos: NORMAL,
    regras: { condicao_de_exibicao: 'enquadramento != nenhum' },
    corpo: [
      '{O sócio declara|A sócia declara|Os sócios declaram|As sócias declaram : socios} que a sociedade se enquadra como {{empresa.enquadramento}}, nos termos da Lei Complementar nº 123, de 14 de dezembro de 2006, e que não se enquadra em qualquer das hipóteses de exclusão relacionadas no § 4º do art. 3º da mencionada lei (art. 3º, [se enquadramento = EPP]II[senão]I[fim], da LC nº 123/2006).',
    ],
  },
  {
    id: 'administracao',
    titulo_interno: 'Administração e poderes do administrador',
    titulo_secao: 'DA ADMINISTRAÇÃO',
    tipo_bloco: 'clausula',
    tags: ['administração', 'obrigatória'],
    documentos: NORMAL,
    regras: { obrigatoria: true },
    corpo: [
      'A administração da sociedade caberá {ao|à|aos|às : administradores} [se administradores_todos_socios]{sócio|sócia|sócios|sócias : administradores}[senão]{administrador|administradora|administradores|administradoras : administradores}[fim] {{administradores.nomes}}[se varios_administradores], que a exercerão [se administracao.forma = conjunta]em conjunto[senão se administracao.forma = indistinta]indistintamente[senão]isoladamente[fim][fim], com os poderes e atribuições de:',
      '- representar a sociedade em juízo e/ou fora dele, ativa ou passivamente, perante terceiros, quaisquer repartições públicas, autoridades federais, estaduais ou municipais, bem como autarquias, sociedades de economia mista e entidades paraestatais;',
      '- assinar quaisquer documentos que importem em responsabilidade ou obrigação da sociedade, inclusive cheques, escrituras, títulos de dívidas, cambiais, ordens de pagamento e outros.',
    ],
  },
  {
    id: 'paragrafo-administrador-nao-socio',
    titulo_interno: 'Parágrafo — qualificação do administrador não sócio',
    tipo_bloco: 'paragrafo',
    tags: ['administração', 'não sócio'],
    documentos: NORMAL,
    regras: { requer: ['administracao'], condicao_de_exibicao: 'tem_administrador_nao_socio' },
    corpo: [
      '[para cada administrador em administradores_nao_socios separador="; " ultimo="; e "]{{administrador.qualificacao}}[fim], {fica designado|fica designada|ficam designados|ficam designadas : administradores_nao_socios} {administrador não sócio|administradora não sócia|administradores não sócios|administradoras não sócias : administradores_nao_socios} da sociedade.',
    ],
    observacoes: 'Bloco NOVO (não existe nos modelos do escritório). Revisar a redação antes de usar em registro.',
  },
  {
    id: 'pro-labore',
    titulo_interno: 'Pró-labore',
    tipo_bloco: 'clausula',
    tags: ['administração', 'pró-labore'],
    documentos: NORMAL,
    regras: { condicao_de_exibicao: 'tem_pro_labore' },
    corpo: [
      '{O sócio|A sócia|Os sócios|As sócias : pro_labore} {{pro_labore.nomes}} {poderá|poderá|poderão|poderão : pro_labore} retirar mensalmente uma determinada importância a título de pró-labore, e essa retirada poderá ser alterada, elevada ou reduzida mediante simples entendimento {do sócio|da sócia|dos sócios|das sócias : socios}, desde que atendidos os limites e as possibilidades financeiras da sociedade.',
    ],
  },
  {
    id: 'exercicio-social',
    titulo_interno: 'Exercício social, balanço e resultados',
    titulo_secao: 'DO EXERCÍCIO SOCIAL E DO BALANÇO PATRIMONIAL',
    tipo_bloco: 'clausula',
    tags: ['exercício social', 'balanço', 'lucros', 'obrigatória'],
    documentos: NORMAL,
    regras: { obrigatoria: true },
    corpo: [
      'O exercício social terá início em {{exercicio.inicio}} e terminará em {{exercicio.fim}}. Ao término de cada exercício social, em {{exercicio.fim}}, será procedido à elaboração do inventário, do balanço patrimonial e do balanço de resultado econômico, cabendo {ao sócio único|à sócia única|aos sócios, na proporção de suas quotas,|às sócias, na proporção de suas quotas, : socios} os lucros ou perdas apurados.',
    ],
  },
  {
    id: 'paragrafo-balancos-intermediarios',
    titulo_interno: 'Parágrafo — balanços intermediários e distribuição de resultados',
    tipo_bloco: 'paragrafo',
    tags: ['exercício social', 'balanço', 'lucros'],
    documentos: NORMAL,
    regras: { requer: ['exercicio-social'] },
    corpo: [
      'Fica a sociedade empresária limitada[se unipessoal] unipessoal[fim] autorizada a levantar balanços ou balancetes intermediários em qualquer período do ano-calendário, observadas as disposições legais, podendo, inclusive, distribuir os resultados, se houver e se for de interesse {do sócio|da sócia|dos sócios|das sócias : socios}, inclusive a obrigação da reposição dos lucros, se os mesmos forem distribuídos com prejuízo do capital. Os lucros líquidos ou prejuízos apurados serão distribuídos {ao sócio|à sócia|aos sócios|às sócias : socios} proporcionalmente à {sua participação|sua participação|participação de cada um|participação de cada uma : socios} no capital social.',
    ],
  },
  {
    id: 'desimpedimento',
    titulo_interno: 'Declaração de desimpedimento dos administradores',
    titulo_secao: 'DO DESIMPEDIMENTO',
    tipo_bloco: 'clausula',
    tags: ['administração', 'desimpedimento', 'obrigatória'],
    documentos: NORMAL,
    regras: { obrigatoria: true, requer: ['administracao'] },
    corpo: [
      '{O administrador|A administradora|Os administradores|As administradoras : administradores} {{administradores.nomes}} {declara|declara|declaram|declaram : administradores}, sob as penas da lei, não {estar incurso|estar incursa|estarem incursos|estarem incursas : administradores} em nenhum dos crimes previstos em lei que {o impeça|a impeça|os impeça|as impeça : administradores} de exercer a administração da sociedade em virtude de condenação criminal, nem {está sendo processado|está sendo processada|estão sendo processados|estão sendo processadas : administradores} nem {condenado|condenada|condenados|condenadas : administradores} em crime falimentar, de prevaricação, peita ou suborno, concussão, peculato, contra o sistema financeiro nacional, contra as normas de defesa da concorrência, contra as relações de consumo e a fé pública ou a propriedade.',
    ],
  },
  {
    id: 'filiais',
    titulo_interno: 'Abertura e encerramento de filiais',
    tipo_bloco: 'clausula',
    tags: ['filiais'],
    documentos: NORMAL,
    corpo: [
      'Esta sociedade poderá, a qualquer tempo, abrir e encerrar filiais, agências e escritórios, em qualquer parte do território nacional ou no exterior, mediante alteração contratual assinada {pelo sócio único|pela sócia única|pelos sócios|pelas sócias : socios}.',
    ],
  },
  {
    id: 'falecimento',
    titulo_interno: 'Falecimento ou interdição de sócio',
    titulo_secao: 'DO FALECIMENTO',
    tipo_bloco: 'clausula',
    tags: ['falecimento', 'sucessão'],
    documentos: NORMAL,
    corpo: [
      'Falecendo ou {interditado o sócio único|interditada a sócia única|interditado qualquer um dos sócios|interditada qualquer uma das sócias : socios}, a empresa continuará suas atividades com os herdeiros, sucessores e/ou sucessores do incapaz. Não sendo possível ou inexistindo interesse destes, o valor de seus haveres será apurado e liquidado com base na situação patrimonial da empresa, à data da resolução, verificada em balanço especialmente levantado.',
    ],
    observacoes: 'O trecho "herdeiros, sucessores e/ou sucessores do incapaz" foi mantido como no modelo — ver lista de pontos a decidir.',
  },
  {
    id: 'foro',
    titulo_interno: 'Foro',
    titulo_secao: 'DO FORO',
    tipo_bloco: 'clausula',
    tags: ['foro', 'obrigatória'],
    documentos: NORMAL,
    regras: { obrigatoria: true },
    corpo: [
      'Fica eleito o foro da cidade de {{foro.cidade_uf}} para o exercício e o cumprimento dos direitos e obrigações resultantes deste ato constitutivo.',
    ],
  },

  // ---------------- Fechamento e assinaturas ----------------
  {
    id: 'fechamento-abertura',
    titulo_interno: 'Fechamento — arquivamento, local e data',
    tipo_bloco: 'texto',
    tags: ['fechamento', 'obrigatória'],
    documentos: ['abertura'],
    natureza: 'fixa',
    regras: { obrigatoria: true },
    corpo: [
      'E por {estar|estar|estarem|estarem : socios} assim {justo e contratado|justa e contratada|justos e contratados|justas e contratadas : socios}, {assina|assina|assinam|assinam : socios} o presente instrumento para ser arquivado na {{empresa.junta_comercial}}.',
      '{{ato.local_e_data}}.',
    ],
  },
  {
    id: 'assinaturas-socios',
    titulo_interno: 'Assinaturas dos sócios (e do administrador não sócio)',
    tipo_bloco: 'texto',
    tags: ['assinaturas', 'obrigatória'],
    documentos: ['abertura', 'alteracao', 'distrato'],
    natureza: 'fixa',
    regras: { obrigatoria: true },
    corpo: [
      '[para cada socio em socios]',
      '[assinatura]',
      '{{socio.nome}}',
      'CPF: {{socio.cpf}}',
      '[fim]',
      '[para cada administrador em administradores_nao_socios]',
      '[assinatura]',
      '{{administrador.nome}}',
      '{Administrador não sócio|Administradora não sócia : administrador}',
      'CPF: {{administrador.cpf}}',
      '[fim]',
    ],
  },
];

/** Cria as cláusulas da biblioteca inicial (data de criação = agora). */
export function bibliotecaInicial(agora = new Date().toISOString()): Clausula[] {
  return DEFINICOES.map((d) => ({
    formato: 'calango/clausula',
    versao_formato: 1,
    id: d.id,
    titulo_interno: d.titulo_interno,
    titulo_secao: d.titulo_secao ?? '',
    tipo_bloco: d.tipo_bloco,
    tags: d.tags,
    documentos: d.documentos,
    tipo_societario: ['ltda'],
    natureza: d.natureza ?? 'normal',
    regras: { ...regrasPadrao(), ...(d.regras ?? {}) },
    corpo: d.corpo.join('\n'),
    observacoes: d.observacoes ?? '',
    campos_exigidos: [],
    versao: 1,
    historico: [],
    arquivada: false,
    origem: 'biblioteca-inicial',
    criada_em: agora,
    atualizada_em: agora,
  }));
}
