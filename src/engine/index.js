// =============================================================================
// index: o ponto de entrada da derivação pura
// =============================================================================
// O QUE FAZ
//   Junta as peças puras num resumo derivado: atributos, perícias, saves, HP,
//   proficiências. Recebe um contexto com o que vem do compêndio (dados de vida,
//   saves, boosts e grants derivados); com o db, quem o preenche é o resolve.
//
// FUNÇÕES
//   dedupeCI(list): dedup case-insensitive, preservando a ordem.
//   deriveCharacter(character, ctx): o estado completo computado.
//
// DECISÕES E ARMADILHAS
//   - Perícias FIXAS de classe e espécie entram como proficientes sem rebaixar
//     uma expertise já escolhida; grants fixos de EXPERTISE (Scout, Royal Envoy,
//     TC-0012) marcam expertise direto.
//   - HP máximo = soma por classe + ajuste manual (hpBonus) + aumentos derivados
//     (ctx.extraMaxHp, ver hpBonuses).
//   - `weaponNames` não aparece na ficha (lá vale a frase, em `weapons`): existe
//     para o export enumerar as armas de uma regra condicional (TC-0078).
// -----------------------------------------------------------------------------

import { ABILITIES, totalLevel } from '../schema/character';
import { proficiencyBonus } from './math';
import { finalScores, abilityModifiers } from './abilities';
import { hpBreakdown } from './hitpoints';
import {
  collectSkillProficiencies,
  collectToolProficiencies,
  collectLanguages,
  skillBonus,
  saveBonus,
  SKILL_ABILITY,
} from './proficiency';

/**
 * @typedef {Object} DeriveContext
 * @property {Record<string, number>} [hitDieMax]
 * @property {Set<string>|string[]} [proficientSaves]
 */

/** Dedup case-insensitive, preservando a ordem. */
function dedupeCI(list) {
  const seen = new Set();
  const out = [];
  for (const x of list) {
    const k = String(x).toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

/**
 * O estado completo computado de um personagem.
 * @param {import('../schema/character').Character} character
 * @param {DeriveContext} [ctx]
 */
export function deriveCharacter(character, ctx = {}) {
  const level = totalLevel(character);
  const profBonus = proficiencyBonus(level);
  const extra = ctx.extraAbilityBoosts ?? [];
  const scores = finalScores(character, extra);
  const mods = abilityModifiers(character, extra);

  const skillProfs = collectSkillProficiencies(character);
  for (const s of ctx.grantedSkills ?? []) skillProfs[s] = Math.max(skillProfs[s] ?? 0, 1);
  for (const s of ctx.expertiseSkills ?? []) skillProfs[s] = 2;
  const proficientSaves = [...new Set(ctx.proficientSaves ?? [])];

  const skills = {};
  for (const skill of Object.keys(SKILL_ABILITY)) {
    skills[skill] = {
      ability: SKILL_ABILITY[skill],
      proficiency: skillProfs[skill] ?? 0,
      bonus: skillBonus(character, skill, profBonus, skillProfs, scores),
    };
  }

  const saves = {};
  for (const a of ABILITIES) {
    saves[a] = saveBonus(character, a, profBonus, proficientSaves, scores);
  }

  const hasHitDie = ctx.hitDieMax && Object.keys(ctx.hitDieMax).length > 0;
  const classBreakdown = hasHitDie
    ? hpBreakdown(character, ctx.hitDieMax, scores)
    : (character.classes ?? []).map((c) => ({
        classId: c.classId,
        level: c.level,
        hitDie: null,
        subclassId: c.subclassId,
        hp: 0,
      }));

  return {
    level,
    proficiencyBonus: profBonus,
    scores,
    modifiers: mods,
    maxHp: hasHitDie
      ? classBreakdown.reduce((s, c) => s + c.hp, 0) + (character.hpBonus ?? 0) + (ctx.extraMaxHp ?? 0)
      : null,
    skills,
    saves,
    proficientSaves,
    tools: dedupeCI([...collectToolProficiencies(character), ...(ctx.grantedTools ?? [])]),
    languages: collectLanguages(character, ctx.grantedLanguages ?? []),
    armor: dedupeCI(ctx.armor ?? []),
    weapons: dedupeCI(ctx.weapons ?? []),
    weaponNames: dedupeCI(ctx.weaponNames ?? []),
    classBreakdown,
  };
}

export * from './math';
export * from './abilities';
export * from './armorClass';
export * from './hitpoints';
export * from './proficiency';
export * from './classData';
export * from './subclassData';
export * from './speciesData';
export * from './context';
export * from './expander';
export * from './resolve';
export * from './choices';
