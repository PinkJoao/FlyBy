// =============================================================================
// Repositório de personagens (Dexie)
// =============================================================================
// CRUD na tabela `characters` (ver db.js). Dexie dá índice por id e ordenação
// por updatedAt de graça. migrate() é aplicado em toda leitura.
// -----------------------------------------------------------------------------

import db from './db';
import { migrate, makeId, createCharacter } from '../schema/character';
import { isFoundryActor, foundryToCharacter } from '../engine/foundryImport';

/**
 * Lista todos os personagens (mais recentes primeiro), migrados.
 * @returns {Promise<import('../schema/character').Character[]>}
 */
export async function listCharacters() {
  const rows = await db.characters.orderBy('meta.updatedAt').reverse().toArray();
  return rows.map(migrate);
}

/**
 * @param {string} id
 * @returns {Promise<import('../schema/character').Character|null>}
 */
export async function getCharacter(id) {
  const raw = await db.characters.get(id);
  return raw ? migrate(raw) : null;
}

/**
 * Salva (cria ou atualiza) um personagem, carimbando updatedAt.
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

/** @param {string} id */
export async function removeCharacter(id) {
  await db.characters.delete(id);
}

/**
 * Duplica um personagem (novo id, nome com "(cópia)", datas novas).
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
 * Importa um personagem a partir de JSON. O formato de interchange é o ATOR do
 * Foundry (dnd5e) - DDL-0005: convertemos via foundryToCharacter. Um JSON no
 * formato antigo do builder (`.builder.json`) ainda é aceito (migrate) p/ backups.
 * Gera um id novo para não colidir com um existente.
 * @param {unknown} raw
 * @param {object} [db5e]  compêndio 5etools (p/ reverter chaves na conversão)
 * @returns {Promise<import('../schema/character').Character>}
 */
export async function importCharacter(raw, db5e) {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid character file.');
  // Ator do Foundry → converte nas decisões do builder (foundryImport).
  const source = isFoundryActor(raw) ? foundryToCharacter(raw, db5e) : raw;
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
