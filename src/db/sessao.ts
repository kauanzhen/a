/**
 * Estado da sessão usado pelos serviços (fora do React):
 * o nome do usuário que aparece na trilha de auditoria.
 */
let usuarioAtual = 'Estudante';

export function definirUsuarioAtual(nome: string) {
  usuarioAtual = nome.trim() || 'Estudante';
}

export function obterUsuarioAtual(): string {
  return usuarioAtual;
}
