// =============================================================================
// Banco local (Dexie / IndexedDB)
// =============================================================================
// Uma única instância Dexie com três tabelas:
//
//   kv          → pares chave-valor de controle (ex: timestamp do cache).
//   compendium  → o dataset do 5etools guardado POR ARQUIVO (uma linha por
//                 arquivo: { key: 'races', data: {...} }). Guardar em linhas
//                 (em vez de um blob único) deixa a porta aberta para leitura
//                 parcial/lazy no mobile sem segurar tudo na memória.
//   characters  → personagens do builder, indexados por id e por updatedAt.
//
// Escolhemos Dexie (em vez de localforage) visando robustez e compatibilidade
// mobile de longo prazo: queries indexadas e leitura seletiva quando preciso.
// -----------------------------------------------------------------------------

import Dexie from 'dexie';

// Nome próprio (não 'compendium'/'5e-character-sheet') para não colidir com
// bancos IndexedDB antigos que o localforage tenha criado antes da migração.
export const db = new Dexie('builder5e');

db.version(1).stores({
  kv: 'key',
  compendium: 'key',
  characters: 'id, meta.updatedAt',
});

export default db;
