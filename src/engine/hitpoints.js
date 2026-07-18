// =============================================================================
// Pontos de vida - cálculo padrão (fixo)
// =============================================================================
// Regra padrão do 5e (sem rolar): no 1º nível do PERSONAGEM (nível 1 da classe
// ORIGINAL) ganha-se o MÁXIMO do dado; nos demais níveis, a MÉDIA (dado/2 + 1).
// Soma-se o modificador de Constituição em cada nível. Um valor rolado explícito
// (número em cls.hitPoints[nível]) sobrepõe o padrão.
// -----------------------------------------------------------------------------

import { abilityModifier } from './math';
import { finalScores } from './abilities';

/** HP base de UM nível (sem CON). */
function levelHp(die, isCharLevel1, rolled) {
  if (typeof rolled === 'number') return rolled; // rolagem manual
  if (isCharLevel1) return die; // nível 1 do personagem: máximo
  return die > 0 ? die / 2 + 1 : 0; // demais: média
}

/**
 * HP por classe: { classId, level, hitDie, hp }. hp já inclui o CON de cada nível.
 * @param {import('../schema/character').Character} character
 * @param {Record<string, number>} hitDieMax  classId → faces do dado.
 * @param {import('../schema/character').AbilityScores} [scores]  scores finais já
 *   computados (incl. boosts derivados como ability fixa de talentos, ex: +CON).
 */
export function hpBreakdown(character, hitDieMax, scores) {
  const conMod = abilityModifier((scores ?? finalScores(character)).con);
  return (character.classes ?? []).map((cls) => {
    const die = hitDieMax[cls.classId] ?? 0;
    let base = 0; // só os dados de vida (sem CON) - o "HP base"
    for (let lvl = 1; lvl <= cls.level; lvl++) {
      const isCharLevel1 = cls.isOriginalClass && lvl === 1;
      base += levelHp(die, isCharLevel1, cls.hitPoints?.[lvl]);
    }
    const con = conMod * cls.level; // contribuição da Constituição
    return { classId: cls.classId, level: cls.level, hitDie: die, subclassId: cls.subclassId, base, con, hp: base + con };
  });
}

/**
 * HP máximo total.
 * @param {import('../schema/character').Character} character
 * @param {Record<string, number>} hitDieMax
 * @returns {number}
 */
export function maxHp(character, hitDieMax) {
  return hpBreakdown(character, hitDieMax).reduce((sum, c) => sum + c.hp, 0);
}
