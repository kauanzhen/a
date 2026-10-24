import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { criarEmpresa, empresaVazia } from '../modules/empresa/empresaService';

export async function limparBanco() {
  await db.open();
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
}

/** Cria uma empresa de teste com plano padrão e exercício 2026 aberto. */
export async function criarEmpresaTeste(ano = 2026, cnpj = '11.222.333/0001-81'): Promise<number> {
  return criarEmpresa(
    {
      ...empresaVazia(),
      razaoSocial: 'Empresa Teste Ltda',
      cnpj,
      cnae: '4789099',
    },
    { carregarPlanoPadrao: true, anoExercicio: ano },
  );
}

export async function contaPorCodigo(empresaId: number, codigo: string) {
  const c = await db.contas.where('[empresaId+codigo]').equals([empresaId, codigo]).first();
  if (!c) throw new Error(`conta ${codigo} não encontrada no teste`);
  return c;
}
