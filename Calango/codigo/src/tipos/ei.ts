// Definição do Empresário Individual (cadastro mínimo: titular e firma).
// Usado nas transformações EI ↔ LTDA. O titular fica no quadro como único
// "membro", sem quotas.

import { QUOTA } from '../gramatica/extenso';
import type { DefinicaoTipoSocietario } from './definicoes';

export const EI: DefinicaoTipoSocietario = {
  id: 'ei',
  nome: 'Empresário Individual',
  sigla: 'EI',
  sufixos_nome: [],
  participacao: QUOTA,
  vocabulario: {
    membro: ['titular', 'titular', 'titulares', 'titulares'],
    participacao: ['quota', 'quota', 'quotas', 'quotas'],
    ato_constitutivo: ['instrumento de inscrição de empresário individual'],
    entidade: ['empresa'],
    tipo: ['empresário individual'],
  },
  bloco_qualificacao_pessoa_fisica: 'qualificacao-pessoa-fisica',
  documentos: ['transformacao_ei_ltda'],
  max_membros: 1,
  campos_cadastro: [
    'empresa.razao_social',
    'empresa.cnpj',
    'empresa.nire',
    'empresa.data_registro',
    'empresa.junta_uf',
    'empresa.sede',
    'empresa.data_inicio_atividades',
    'empresa.objeto_social',
    'empresa.cnaes',
    'empresa.enquadramento',
    'socios',
    'pessoa.nome',
    'pessoa.genero',
    'pessoa.nacionalidade',
    'pessoa.maioridade',
    'pessoa.naturalidade',
    'pessoa.data_nascimento',
    'pessoa.estado_civil',
    'pessoa.profissao',
    'pessoa.registro_conselho',
    'pessoa.rg',
    'pessoa.cpf',
    'pessoa.endereco',
    'capital.valor',
    'fechamento.foro',
  ],
};
