// Configurações do escritório (arquivo configuracoes.json na pasta de dados).

export type Alinhamento = 'esquerda' | 'centro' | 'direita';

export interface Configuracoes {
  formato: 'calango/configuracoes';
  versao_formato: 1;
  pagina: {
    margem_superior_cm: number;
    margem_inferior_cm: number;
    margem_esquerda_cm: number;
    margem_direita_cm: number;
    fonte: string;
    tamanho_pt: number;
    /** 1 = simples; 1.15; 1.5; 2 = duplo */
    espacamento_linhas: number;
    espaco_apos_paragrafo_pt: number;
  };
  cabecalho: {
    texto: string;
    alinhamento: Alinhamento;
    /** Nome do arquivo dentro de imagens/ (vazio = sem imagem). */
    imagem: string;
    ocultar_primeira_pagina: boolean;
  };
  rodape: {
    /**
     * Texto livre com campos: {pagina}, {total_paginas}, {razao_social},
     * {cnpj}, {nire}, {titulo_ato}. Trechos entre [colchetes] somem quando um
     * campo dentro deles está vazio. Use "|" para quebrar linha.
     */
    texto: string;
    alinhamento: Alinhamento;
  };
  padroes: {
    cidade: string;
    uf: string;
  };
  /** Fase 4 (captura de dados por IA) — ainda sem uso. */
  ia: { provedor: '' | 'claude' | 'gemini'; modelo: string; chave: string };
}

export function configuracoesPadrao(): Configuracoes {
  return {
    formato: 'calango/configuracoes',
    versao_formato: 1,
    pagina: {
      margem_superior_cm: 2,
      margem_inferior_cm: 2,
      margem_esquerda_cm: 3,
      margem_direita_cm: 3,
      fonte: 'Arial',
      tamanho_pt: 11,
      espacamento_linhas: 1.15,
      espaco_apos_paragrafo_pt: 8,
    },
    cabecalho: { texto: '', alinhamento: 'centro', imagem: '', ocultar_primeira_pagina: false },
    rodape: {
      texto: '{razao_social}[ — CNPJ {cnpj}] — Página {pagina} de {total_paginas}',
      alinhamento: 'centro',
    },
    padroes: { cidade: '', uf: '' },
    ia: { provedor: '', modelo: '', chave: '' },
  };
}

/** Completa um arquivo antigo/incompleto com os valores padrão. */
export function normalizarConfiguracoes(c: Partial<Configuracoes> | null | undefined): Configuracoes {
  const p = configuracoesPadrao();
  if (!c) return p;
  return {
    ...p,
    ...c,
    formato: 'calango/configuracoes',
    versao_formato: 1,
    pagina: { ...p.pagina, ...(c.pagina ?? {}) },
    cabecalho: { ...p.cabecalho, ...(c.cabecalho ?? {}) },
    rodape: { ...p.rodape, ...(c.rodape ?? {}) },
    padroes: { ...p.padroes, ...(c.padroes ?? {}) },
    ia: { ...p.ia, ...(c.ia ?? {}) },
  };
}

export interface CamposRodape {
  razao_social: string;
  cnpj: string;
  nire: string;
  titulo_ato: string;
}

export type PedacoRodape = { tipo: 'texto'; texto: string } | { tipo: 'pagina' } | { tipo: 'total_paginas' };

/**
 * Interpreta o texto do rodapé: devolve as linhas, cada uma com pedaços de
 * texto e de número de página. Trechos [entre colchetes] com campo vazio somem.
 */
export function interpretarRodape(texto: string, campos: CamposRodape): PedacoRodape[][] {
  const valor = (nome: string): string | null => {
    if (nome === 'pagina' || nome === 'total_paginas') return '§';
    if (nome in campos) return (campos as unknown as Record<string, string>)[nome] ?? '';
    return null;
  };
  // 1) remove trechos opcionais com campo vazio
  const semVazios = texto.replace(/\[([^\]]*)\]/g, (_m, dentro: string) => {
    const nomes = [...dentro.matchAll(/\{(\w+)\}/g)].map((x) => x[1]);
    return nomes.some((n) => !(valor(n) ?? '').trim()) ? '' : dentro;
  });
  // 2) divide em linhas e em pedaços
  return semVazios.split('|').map((linha) => {
    const r: PedacoRodape[] = [];
    let ultimo = 0;
    for (const m of linha.matchAll(/\{(\w+)\}/g)) {
      if (m.index! > ultimo) r.push({ tipo: 'texto', texto: linha.slice(ultimo, m.index) });
      const nome = m[1];
      if (nome === 'pagina') r.push({ tipo: 'pagina' });
      else if (nome === 'total_paginas') r.push({ tipo: 'total_paginas' });
      else r.push({ tipo: 'texto', texto: valor(nome) ?? m[0] });
      ultimo = m.index! + m[0].length;
    }
    if (ultimo < linha.length) r.push({ tipo: 'texto', texto: linha.slice(ultimo) });
    // junta textos vizinhos
    for (let i = r.length - 1; i > 0; i--) {
      const a = r[i - 1];
      const b = r[i];
      if (a.tipo === 'texto' && b.tipo === 'texto') {
        r[i - 1] = { tipo: 'texto', texto: a.texto + b.texto };
        r.splice(i, 1);
      }
    }
    // apara espaços das pontas
    if (r[0]?.tipo === 'texto') r[0] = { tipo: 'texto', texto: r[0].texto.trimStart() };
    const u = r[r.length - 1];
    if (u?.tipo === 'texto') r[r.length - 1] = { tipo: 'texto', texto: u.texto.trimEnd() };
    return r.filter((x) => x.tipo !== 'texto' || x.texto !== '');
  });
}
