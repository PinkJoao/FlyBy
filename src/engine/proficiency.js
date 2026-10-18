// =============================================================================
// proficiency: perícias, salvaguardas, ferramentas e idiomas
// =============================================================================
// O QUE FAZ
//   Códigos de perícia na convenção Foundry e 5etools (acr, ath, prc). O nível de
//   proficiência é 0 (nenhum), 1 (proficiente) ou 2 (expertise). Junta o que vem
//   das DECISÕES; o que é fixo de classe e espécie entra pela derivação.
//
// FUNÇÕES
//   profValueBonus(mod, profBonus, level): o bônus total.
//   collectSkillProficiencies(character): o nível de cada perícia, dos choice-bags
//     (origem, espécie, talentos, classes) e da Expertise.
//   collectToolProficiencies(character): as ferramentas, deduplicadas.
//   collectLanguages(character, grantedLanguages): os idiomas conhecidos.
//   collectOptionalFeatureIds(character), collectFeatIds(character): ids do que
//     foi escolhido.
//   collectOwned(character, grantedLanguages): tudo que a ficha já possui, para o
//     ChoiceList não oferecer de novo.
//   skillBonus(character, skill, profBonus, skillProfs, scores), saveBonus(
//     character, ability, profBonus, proficientSaves, scores): os bônus.
//
// DECISÕES E ARMADILHAS
//   - Todo personagem sabe Common (as raças 2024 deixaram de conceder; foi para o
//     background). Tokens que não são línguas ("other", "anyStandard") saem, e o
//     caixa é normalizado.
//   - collectOwned: ferramentas e idiomas em minúsculas, perícias em código,
//     talentos por id; inclui as perícias já com expertise, para o seletor de
//     Expertise.
//   - skillBonus e saveBonus aceitam os scores FINAIS já computados, para não
//     perder os boosts derivados (o +1 fixo de um talento).
// -----------------------------------------------------------------------------

import { abilityModifier } from './math';
import { finalScores } from './abilities';
import { collectChoicePicks, titleCase } from './choices';

const LANGUAGE_TOKENS = new Set(['other', 'any', 'anystandard', 'anyexotic', 'anyrare']);

export const SKILL_ABILITY = {
  acr: 'dex',
  ani: 'wis',
  arc: 'int',
  ath: 'str',
  dec: 'cha',
  his: 'int',
  ins: 'wis',
  itm: 'cha',
  inv: 'int',
  med: 'wis',
  nat: 'int',
  prc: 'wis',
  prf: 'cha',
  per: 'cha',
  rel: 'int',
  slt: 'dex',
  ste: 'dex',
  sur: 'wis',
};

/**
 * O bônus total pelo mod, pelo bônus de proficiência e pelo nível (0, 1, 2).
 * @param {number} mod
 * @param {number} profBonus
 * @param {0|1|2} level
 * @returns {number}
 */
export function profValueBonus(mod, profBonus, level) {
  return mod + profBonus * level;
}

/**
 * O nível de proficiência de cada perícia, pelas decisões.
 * @param {import('../schema/character').Character} character
 * @returns {Record<string, 0|1|2>}
 */
export function collectSkillProficiencies(character) {
  /** @type {Record<string, 0|1|2>} */
  const out = {};
  const mark = (skill, level) => {
    out[skill] = Math.max(out[skill] ?? 0, level);
  };

  for (const s of character.origin?.skillProficiencies ?? []) mark(s, 1);
  for (const s of collectChoicePicks(character.origin?.choices, 'skill')) mark(s, 1);
  for (const s of collectChoicePicks(character.species?.choices, 'skill')) mark(s, 1);
  for (const s of collectChoicePicks(character.origin?.originFeat?.choices, 'skill')) mark(s, 1);
  for (const cls of character.classes ?? []) {
    for (const s of collectChoicePicks(cls.choices, 'skill')) mark(s, 1);
    for (const s of collectChoicePicks(cls.choices, 'expertise')) mark(s, 2);
  }

  return out;
}

/**
 * Todas as proficiências de ferramenta, deduplicadas.
 * @param {import('../schema/character').Character} character
 * @returns {string[]}
 */
export function collectToolProficiencies(character) {
  const out = new Set();
  for (const t of character.origin?.toolProficiencies ?? []) out.add(t);
  for (const t of collectChoicePicks(character.origin?.choices, 'tool')) out.add(t);
  for (const t of collectChoicePicks(character.species?.choices, 'tool')) out.add(t);
  for (const t of collectChoicePicks(character.origin?.originFeat?.choices, 'tool')) out.add(t);
  for (const cls of character.classes ?? []) {
    for (const t of collectChoicePicks(cls.choices, 'tool')) out.add(t);
  }
  return [...out];
}

/**
 * Todos os idiomas conhecidos (sempre com Common).
 * @param {import('../schema/character').Character} character
 * @param {string[]} [grantedLanguages]
 * @returns {string[]}
 */
export function collectLanguages(character, grantedLanguages = []) {
  const out = new Set(['Common']);
  const add = (l) => {
    if (l && !LANGUAGE_TOKENS.has(String(l).toLowerCase())) out.add(titleCase(l));
  };
  for (const l of grantedLanguages) add(l);
  for (const l of character.origin?.languages ?? []) add(l);
  for (const l of collectChoicePicks(character.origin?.choices, 'language')) add(l);
  for (const l of collectChoicePicks(character.species?.choices, 'language')) add(l);
  for (const l of collectChoicePicks(character.origin?.originFeat?.choices, 'language')) add(l);
  for (const cls of character.classes ?? []) {
    for (const l of collectChoicePicks(cls.choices, 'language')) add(l);
  }
  return [...out];
}

/** Ids das optional features escolhidas nas classes. */
export function collectOptionalFeatureIds(character) {
  const out = [];
  for (const cls of character.classes ?? []) {
    out.push(...collectChoicePicks(cls.choices, 'optionalfeature'));
  }
  return out;
}

/** Ids de todos os talentos tomados. */
export function collectFeatIds(character) {
  const out = [];
  const of = character.origin?.originFeat;
  if (of?.id) out.push(`${of.id}|${of.source}`);
  out.push(...collectChoicePicks(character.species?.choices, 'feat'));
  out.push(...collectChoicePicks(character.origin?.originFeat?.choices, 'feat'));
  for (const cls of character.classes ?? []) {
    out.push(...collectChoicePicks(cls.choices, 'feat'));
  }
  return out;
}

/**
 * Tudo que o personagem já possui, por tipo.
 * @param {import('../schema/character').Character} character
 * @param {string[]} [grantedLanguages]
 */
export function collectOwned(character, grantedLanguages = []) {
  const skillProfs = collectSkillProficiencies(character);
  return {
    skills: new Set(Object.keys(skillProfs)),
    expertise: new Set(Object.keys(skillProfs).filter((s) => skillProfs[s] === 2)),
    tools: new Set(collectToolProficiencies(character).map((t) => t.toLowerCase())),
    languages: new Set(collectLanguages(character, grantedLanguages).map((l) => l.toLowerCase())),
    feats: new Set(collectFeatIds(character)),
  };
}

/**
 * O bônus de uma perícia.
 * @param {import('../schema/character').Character} character
 * @param {string} skill
 * @param {number} profBonus
 * @param {Record<string, 0|1|2>} [skillProfs]
 * @param {import('../schema/character').AbilityScores} [scores]
 * @returns {number}
 */
export function skillBonus(character, skill, profBonus, skillProfs, scores) {
  const profs = skillProfs ?? collectSkillProficiencies(character);
  const ability = SKILL_ABILITY[skill];
  const mod = abilityModifier((scores ?? finalScores(character))[ability]);
  return profValueBonus(mod, profBonus, profs[skill] ?? 0);
}

/**
 * O bônus de save de uma habilidade.
 * @param {import('../schema/character').Character} character
 * @param {import('../schema/character').Ability} ability
 * @param {number} profBonus
 * @param {Set<string>|string[]} proficientSaves
 * @param {import('../schema/character').AbilityScores} [scores]
 * @returns {number}
 */
export function saveBonus(character, ability, profBonus, proficientSaves, scores) {
  const set = proficientSaves instanceof Set ? proficientSaves : new Set(proficientSaves);
  const mod = abilityModifier((scores ?? finalScores(character))[ability]);
  return mod + (set.has(ability) ? profBonus : 0);
}
