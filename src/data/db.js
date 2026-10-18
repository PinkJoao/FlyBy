// =============================================================================
// db: o banco local (Dexie e IndexedDB)
// =============================================================================
// O QUE FAZ
//   Uma única instância Dexie com três tabelas:
//     kv: pares chave-valor de controle (o timestamp do cache, por exemplo).
//     compendium: o dataset do 5etools POR ARQUIVO ({ key: 'races', data }). Em
//       linhas, e não num blob único, para deixar aberta a leitura parcial no
//       mobile sem segurar tudo na memória.
//     characters: os personagens, indexados por id e por updatedAt.
//
// DECISÕES E ARMADILHAS
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

export default db;
