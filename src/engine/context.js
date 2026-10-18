// =============================================================================
// context: monta o DeriveContext a partir do compêndio
// =============================================================================
// O QUE FAZ
//   Dado o personagem e os dados de classe do 5etools, descobre o dado de vida de
//   cada classe e os saves proficientes.
//
// FUNÇÕES
//   buildContext(character, classDataById): o contexto de derivação.
//
// DECISÕES E ARMADILHAS
//   - Regra de multiclasse: os saving throws vêm SÓ da classe original.
// -----------------------------------------------------------------------------

import { parseClass } from './classData';

/**
 * O DeriveContext (dados de vida e saves) a partir das classes do 5etools.
 * @param {import('../schema/character').Character} character
 * @param {Record<string, object>} classDataById
 * @returns {import('./index').DeriveContext}
 */
export function buildContext(character, classDataById) {
  /** @type {Record<string, number>} */
  const hitDieMax = {};
  for (const cls of character.classes ?? []) {
    const parsed = parseClass(classDataById[cls.classId]);
    if (parsed) hitDieMax[cls.classId] = parsed.hitDieMax;
  }

  const original =
    (character.classes ?? []).find((c) => c.isOriginalClass) ??
    (character.classes ?? [])[0];
  const originalParsed = original ? parseClass(classDataById[original.classId]) : null;
  const proficientSaves = originalParsed?.proficientSaves ?? [];

  return { hitDieMax, proficientSaves };
}
