// =============================================================================
// hitpoints: os pontos de vida, pelo cálculo padrão
// =============================================================================
// O QUE FAZ
//   Regra padrão do 5e, sem rolar: no 1º nível do PERSONAGEM (o 1 da classe
//   ORIGINAL) ganha-se o MÁXIMO do dado; nos outros, a MÉDIA (dado/2 + 1). Soma-se
//   o modificador de CON em cada nível. Um valor rolado em `hitPoints[nível]`
//   sobrepõe o padrão.
//
// FUNÇÕES
//   levelHp(die, isCharLevel1, rolled): o HP base de um nível, sem CON.
//   hpBreakdown(character, hitDieMax, scores): { classId, level, hitDie, hp } por
//     classe, com o CON de cada nível já somado.
//   maxHp(character, hitDieMax): o HP máximo total.
//
// DECISÕES E ARMADILHAS
//   - hpBreakdown aceita os scores FINAIS já computados, porque um talento pode
//     dar CON fixo e mudar o HP.
// -----------------------------------------------------------------------------

import { abilityModifier } from './math';
import { finalScores } from './abilities';

/** O HP base de um nível, sem CON. */
function levelHp(die, isCharLevel1, rolled) {
  if (typeof rolled === 'number') return rolled;
  if (isCharLevel1) return die;
  return die > 0 ? die / 2 + 1 : 0;
}

/**
 * O HP por classe, já com o CON de cada nível.
 * @param {import('../schema/character').Character} character
 * @param {Record<string, number>} hitDieMax
 * @param {import('../schema/character').AbilityScores} [scores]
 */
export function hpBreakdown(character, hitDieMax, scores) {
  const conMod = abilityModifier((scores ?? finalScores(character)).con);
  return (character.classes ?? []).map((cls) => {
    const die = hitDieMax[cls.classId] ?? 0;
    let base = 0;
    for (let lvl = 1; lvl <= cls.level; lvl++) {
      const isCharLevel1 = cls.isOriginalClass && lvl === 1;
      base += levelHp(die, isCharLevel1, cls.hitPoints?.[lvl]);
    }
    const con = conMod * cls.level;
    return { classId: cls.classId, level: cls.level, hitDie: die, subclassId: cls.subclassId, base, con, hp: base + con };
  });
}

/**
 * O HP máximo total.
 * @param {import('../schema/character').Character} character
 * @param {Record<string, number>} hitDieMax
 * @returns {number}
 */
export function maxHp(character, hitDieMax) {
  return hpBreakdown(character, hitDieMax).reduce((sum, c) => sum + c.hp, 0);
}
