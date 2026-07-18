// =============================================================================
// buildContext - monta o DeriveContext a partir do compêndio
// =============================================================================
// Substitui a injeção manual: dado o personagem + os dados de classe do 5etools,
// descobre dado de vida por classe e os saves proficientes. Aplica a regra de
// multiclasse: saving throws vêm SÓ da classe original (a primeira/inicial).
// -----------------------------------------------------------------------------

import { parseClass } from './classData';

/**
 * @param {import('../schema/character').Character} character
 * @param {Record<string, object>} classDataById  classId → objeto de classe 5etools
 *        (ex: { fighter: db['class-fighter'].class[0] }).
 * @returns {import('./index').DeriveContext}
 */
export function buildContext(character, classDataById) {
  /** @type {Record<string, number>} */
  const hitDieMax = {};
  for (const cls of character.classes ?? []) {
    const parsed = parseClass(classDataById[cls.classId]);
    if (parsed) hitDieMax[cls.classId] = parsed.hitDieMax;
  }

  // Regra de multiclasse: saves só da classe original.
  const original =
    (character.classes ?? []).find((c) => c.isOriginalClass) ??
    (character.classes ?? [])[0];
  const originalParsed = original ? parseClass(classDataById[original.classId]) : null;
  const proficientSaves = originalParsed?.proficientSaves ?? [];

  return { hitDieMax, proficientSaves };
}
