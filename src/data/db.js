// =============================================================================
// db: o banco local (Dexie e IndexedDB)
// =============================================================================
// O QUE FAZ
//   Uma única instância Dexie com quatro tabelas:
//     kv: pares chave-valor de controle (o timestamp do cache, por exemplo).
//     compendium: o dataset do 5etools POR ARQUIVO ({ key: 'races', data }). Em
//       linhas, e não num blob único, para deixar aberta a leitura parcial no
//       mobile sem segurar tudo na memória.
//     characters: os personagens, indexados por id e por updatedAt.
//     play: o documento de jogo de cada personagem (engine/playState), pela
//       chave characterId; desde a versão 2.
//
// DECISÕES E ARMADILHAS
//   - O estado de jogo mora FORA do personagem (docs/PLAY-MODE-PLAN.md 3.3): o
//     personagem segue só com decisões, o builder não regrava o log a cada
//     edição e o export não precisa filtrar nada.
//   - A versão 2 só DECLARA a tabela nova; o Dexie mantém as da versão 1, e um
//     banco antigo sobe sem migração de dados.
//   - Dexie, e não localforage, pela robustez e compatibilidade mobile de longo
//     prazo: queries indexadas e leitura seletiva.
//   - O nome do banco é próprio ('builder5e') para não colidir com bancos antigos
//     que o localforage criou antes da migração.
// -----------------------------------------------------------------------------

import Dexie from 'dexie';

// ATENÇÃO: o nome do banco é a chave dos dados salvos de cada usuário; renomear perde tudo.
export const db = new Dexie('builder5e');

db.version(1).stores({
  kv: 'key',
  compendium: 'key',
  characters: 'id, meta.updatedAt',
});

db.version(2).stores({
  play: 'characterId',
});

export default db;
