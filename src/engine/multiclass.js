// =============================================================================
// multiclass: os requisitos de atributo de multiclasse (2024)
// =============================================================================
// O QUE FAZ
//   Para ter mais de uma classe, o personagem cumpre o requisito de TODAS as que
//   tem: o da que entra e o das que já possui ("para entrar e para sair").
//
// FUNÇÕES
//   multiclassRequirements(db, classId): os requisitos de uma classe.
//   meetsRequirement(req, scores): cumpre? (chaves simples são E; `or` é OU).
//   requirementText(req): "Str 13 & Cha 13" ou "Str 13 or Dex 13".
//   unmetMulticlassReqs(db, character, newClassId, editingIndex): o que falha se
//     o slot editado virar `newClassId`.
//
// DECISÕES E ARMADILHAS
//   - Os requisitos vivem no dado PHB; a XPHB resolvida traz `requirements:
//     null`, então as fontes são varridas até achar.
//   - O slot editado é ignorado: TROCAR a classe única não é multiclasse, e uma
//     build de uma classe só não tem requisito.
// -----------------------------------------------------------------------------

import { finalScores } from './abilities';

const ABILITY_ABBR = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };

/** Os requisitos de multiclasse de uma classe. */
export function multiclassRequirements(db, classId) {
  const list = db?.[`class-${classId}`]?.class ?? [];
  for (const c of list) {
    if (c.multiclassing?.requirements) return c.multiclassing.requirements;
  }
  return null;
}

/** O personagem cumpre o requisito? */
export function meetsRequirement(req, scores) {
  if (!req) return true;
  for (const [key, value] of Object.entries(req)) {
    if (key === 'or') {
      const anyOk = (value ?? []).some((group) =>
        Object.entries(group).some(([a, min]) => (scores[a] ?? 0) >= min)
      );
      if (!anyOk) return false;
    } else if ((scores[key] ?? 0) < value) {
      return false;
    }
  }
  return true;
}

/** O texto do requisito. */
export function requirementText(req) {
  if (!req) return '';
  const parts = [];
  for (const [key, value] of Object.entries(req)) {
    if (key === 'or') {
      const alts = (value ?? []).flatMap((group) =>
        Object.entries(group).map(([a, min]) => `${ABILITY_ABBR[a] ?? a} ${min}`)
      );
      parts.push(alts.join(' or '));
    } else {
      parts.push(`${ABILITY_ABBR[key] ?? key} ${value}`);
    }
  }
  return parts.join(' & ');
}

/**
 * Os requisitos que falham se o slot `editingIndex` virar `newClassId`.
 * @param {number} [editingIndex]
 * @returns {{classId:string, text:string}[]}
 */
export function unmetMulticlassReqs(db, character, newClassId, editingIndex = -1) {
  const others = (character.classes ?? [])
    .filter((_, i) => i !== editingIndex)
    .map((c) => c.classId)
    .filter((id) => id && id !== newClassId);
  const classIds = [...new Set([newClassId, ...others])];
  if (classIds.length < 2) return [];

  const scores = finalScores(character);
  const unmet = [];
  for (const id of classIds) {
    const req = multiclassRequirements(db, id);
    if (req && !meetsRequirement(req, scores)) {
      unmet.push({ classId: id, text: requirementText(req) });
    }
  }
  return unmet;
}
