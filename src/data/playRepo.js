// =============================================================================
// playRepo: o repositório dos documentos de jogo (Dexie)
// =============================================================================
// O QUE FAZ
//   Lê e grava na tabela `play` (db.js) o documento de jogo de um personagem: o
//   log de eventos com o cursor e o baseline (engine/playState). Um personagem
//   que nunca jogou recebe um documento descansado.
//
// FUNÇÕES
//   getPlay(characterId): o documento, normalizado, ou um novo.
//   savePlay(doc, opts): compacta pela janela do histórico e grava; devolve o
//     documento gravado e quantos eventos foram dobrados.
//   removePlay(characterId): apaga o documento.
//
// DECISÕES E ARMADILHAS
//   - A janela roda AO GRAVAR (docs/PLAY-MODE-PLAN.md 3.3): quem chama não
//     precisa lembrar de compactar, e o banco nunca guarda mais que a janela
//     mais o ramo refazível. Quem chama deve seguir com o documento DEVOLVIDO.
//   - Apagar o personagem apaga o documento (characterRepo.removeCharacter);
//     duplicar não copia: a cópia começa descansada.
// -----------------------------------------------------------------------------

import db from './db';
import { normalizePlayDoc, compactPlayDoc, HISTORY_LIMITS } from '../engine/playState';

/**
 * O documento de jogo de um personagem, normalizado, ou um novo.
 * @param {string} characterId
 */
export async function getPlay(characterId) {
  const raw = await db.play.get(characterId);
  return normalizePlayDoc(raw, characterId);
}

/**
 * Compacta pela janela e grava.
 * @param {object} doc
 * @param {{ limits?: { maxEvents?: number, maxAgeDays?: number }, now?: Date }} [opts]
 * @returns {Promise<{ doc: object, folded: number }>}
 */
export async function savePlay(doc, { limits = HISTORY_LIMITS, now = new Date() } = {}) {
  const result = compactPlayDoc(doc, limits, now);
  await db.play.put(result.doc);
  return result;
}

/**
 * Apaga o documento de jogo de um personagem.
 * @param {string} characterId
 */
export async function removePlay(characterId) {
  await db.play.delete(characterId);
}
