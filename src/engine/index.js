// =============================================================================
// Engine - ponto de entrada da derivação do personagem
// =============================================================================
// Junta as peças puras num resumo derivado. Recebe um contexto com os dados que
// vêm do compêndio (dados de vida por classe, saves por classe, etc.); na Fase
// 3b o expander preencherá esse contexto a partir do 5etools.
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
 * @property {Record<string, number>} [hitDieMax]      classId → valor máx. do dado.
 * @property {Set<string>|string[]} [proficientSaves]  saves proficientes (do expander).
 */

/**
 * Deriva o estado completo (computado) de um personagem.
 * @param {import('../schema/character').Character} character
 * @param {DeriveContext} [ctx]
 */
/** Dedup preservando ordem, case-insensitive (p/ ferramentas de fontes várias). */
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

export function deriveCharacter(character, ctx = {}) {
  const level = totalLevel(character);
  const profBonus = proficiencyBonus(level);
  // Boosts derivados do compêndio (ex: ability fixa de talentos como GWM +1 Str),
  // fornecidos pelo resolve; ausentes na derivação pura (sem db).
  const extra = ctx.extraAbilityBoosts ?? [];
  const scores = finalScores(character, extra);
  const mods = abilityModifiers(character, extra);

  const skillProfs = collectSkillProficiencies(character);
  // Perícias FIXAS de classe/espécie (automáticas) entram como proficientes (nv1),
  // sem sobrescrever expertise (nv2) já marcada por escolha. Grants fixos de
  // EXPERTISE (Rogue Scout, PDK Royal Envoy - TC-0012) marcam nível 2 direto.
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

  // Breakdown por classe (Level / Hit Points expansíveis) - inclui hp por classe.
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
    // HP máximo = soma por classe + ajuste manual do jogador (hpBonus, ± no card)
    // + aumentos derivados de feats/raça/subclasse (Tough, Dwarven Toughness,
    // Draconic Resilience - ctx.extraMaxHp, ver engine/hpBonuses).
    maxHp: hasHitDie
      ? classBreakdown.reduce((s, c) => s + c.hp, 0) + (character.hpBonus ?? 0) + (ctx.extraMaxHp ?? 0)
      : null,
    skills,
    saves,
    proficientSaves,
    // Ferramentas: escolhas + fixas de classe/espécie (dedup case-insensitive).
    tools: dedupeCI([...collectToolProficiencies(character), ...(ctx.grantedTools ?? [])]),
    languages: collectLanguages(character, ctx.grantedLanguages ?? []),
    armor: dedupeCI(ctx.armor ?? []),
    weapons: dedupeCI(ctx.weapons ?? []),
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
