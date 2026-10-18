// =============================================================================
// characterRepo: o repositório de personagens (Dexie)
// =============================================================================
// O QUE FAZ
//   CRUD na tabela `characters` (db.js). O Dexie dá índice por id e ordenação por
//   updatedAt. O migrate() do schema roda em toda leitura.
//
// FUNÇÕES
//   listCharacters(): todos, mais recentes primeiro, migrados.
//   getCharacter(id), saveCharacter(character), removeCharacter(id): o CRUD;
//     salvar carimba updatedAt.
//   duplicateCharacter(id): cópia com id novo, "(cópia)" no nome e datas novas.
//   importCharacter(raw, db5e, out): importa um JSON com id novo.
//
// DECISÕES E ARMADILHAS
//   - O formato de troca é o ATOR do Foundry (DDL-0005), convertido por
//     foundryToCharacter (foundryImport). Um `.builder.json` antigo ainda entra,
//     via migrate, para backups. Os avisos da conversão (o que o ator trazia e o
//     nosso modelo não guarda) saem em `out.warnings` para o chamador mostrar.
// -----------------------------------------------------------------------------

import db from './db';
import { migrate, makeId, createCharacter } from '../schema/character';
import { isFoundryActor, foundryToCharacter } from '../engine/foundryImport';

/**
 * Todos os personagens, mais recentes primeiro, migrados.
 * @returns {Promise<import('../schema/character').Character[]>}
 */
export async function listCharacters() {
  const rows = await db.characters.orderBy('meta.updatedAt').reverse().toArray();
  return rows.map(migrate);
}

/**
 * Um personagem pelo id, migrado.
 * @param {string} id
 * @returns {Promise<import('../schema/character').Character|null>}
 */
export async function getCharacter(id) {
  const raw = await db.characters.get(id);
  return raw ? migrate(raw) : null;
}

/**
 * Cria ou atualiza um personagem, carimbando updatedAt.
 * @param {import('../schema/character').Character} character
 * @returns {Promise<import('../schema/character').Character>}
 */
export async function saveCharacter(character) {
  const stamped = {
    ...character,
    meta: { ...character.meta, updatedAt: new Date().toISOString() },
  };
  await db.characters.put(stamped);
  return stamped;
}

/**
 * Remove um personagem.
 * @param {string} id
 */
export async function removeCharacter(id) {
  await db.characters.delete(id);
}

/**
 * Duplica um personagem (id novo, "(cópia)", datas novas).
 * @param {string} id
 * @returns {Promise<import('../schema/character').Character|null>}
 */
export async function duplicateCharacter(id) {
  const original = await getCharacter(id);
  if (!original) return null;
  const now = new Date().toISOString();
  const copy = {
    ...structuredClone(original),
    id: makeId(),
    meta: {
      ...original.meta,
      name: `${original.meta.name} (copy)`,
      createdAt: now,
      updatedAt: now,
    },
  };
  await db.characters.put(copy);
  return copy;
}

/**
 * Importa um ator Foundry (ou um backup antigo) com id novo.
 * @param {unknown} raw
 * @param {object} [db5e]
 * @param {{warnings?: string[]}} [out]
 * @returns {Promise<import('../schema/character').Character>}
 */
export async function importCharacter(raw, db5e, out = null) {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid character file.');
  const source = isFoundryActor(raw) ? foundryToCharacter(raw, db5e, out) : raw;
  const migrated = migrate(source);
  const now = new Date().toISOString();
  const imported = {
    ...migrated,
    id: makeId(),
    meta: {
      ...createCharacter().meta,
      ...migrated.meta,
      createdAt: now,
      updatedAt: now,
    },
  };
  await db.characters.put(imported);
  return imported;
}
