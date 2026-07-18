// =============================================================================
// Proficiências - perícias e resistências (saves)
// =============================================================================
// Códigos de perícia seguem a convenção Foundry/5etools (acr, ath, prc...).
// O nível de proficiência é 0 (nenhum), 1 (proficiente) ou 2 (expertise).
// -----------------------------------------------------------------------------

import { abilityModifier } from './math';
import { finalScores } from './abilities';
import { collectChoicePicks, titleCase } from './choices';

// Tokens de idioma que NÃO são línguas reais (escolha/discrição do mestre).
const LANGUAGE_TOKENS = new Set(['other', 'any', 'anystandard', 'anyexotic', 'anyrare']);

/** Perícia → habilidade padrão (regras 2024). */
export const SKILL_ABILITY = {
  acr: 'dex', // Acrobatics
  ani: 'wis', // Animal Handling
  arc: 'int', // Arcana
  ath: 'str', // Athletics
  dec: 'cha', // Deception
  his: 'int', // History
  ins: 'wis', // Insight
  itm: 'cha', // Intimidation
  inv: 'int', // Investigation
  med: 'wis', // Medicine
  nat: 'int', // Nature
  prc: 'wis', // Perception
  prf: 'cha', // Performance
  per: 'cha', // Persuasion
  rel: 'int', // Religion
  slt: 'dex', // Sleight of Hand
  ste: 'dex', // Stealth
  sur: 'wis', // Survival
};

/**
 * Bônus total dado o modificador, o bônus de proficiência e o nível (0/1/2).
 * @param {number} mod
 * @param {number} profBonus
 * @param {0|1|2} level
 * @returns {number}
 */
export function profValueBonus(mod, profBonus, level) {
  return mod + profBonus * level;
}

/**
 * Coleta o nível de proficiência de cada perícia a partir das DECISÕES do
 * personagem (origem custom + escolhas de classe). Proficiências fixas vindas
 * de espécie/classe (não escolhidas) entram pelo expander, na Fase 3b.
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
  // Escolhas (choice-bag genérico, recursivo): origem (Background), espécie e
  // talento de origem - inclusive perícias de uma feature dentro de outra escolha.
  for (const s of collectChoicePicks(character.origin?.choices, 'skill')) mark(s, 1);
  for (const s of collectChoicePicks(character.species?.choices, 'skill')) mark(s, 1);
  for (const s of collectChoicePicks(character.origin?.originFeat?.choices, 'skill')) mark(s, 1);
  // Escolhas de classe (choice-bag por classe): perícias de nível 1 etc.
  for (const cls of character.classes ?? []) {
    for (const s of collectChoicePicks(cls.choices, 'skill')) mark(s, 1);
    // Expertise (Rogue/Bard/Ranger): eleva perícias já proficientes ao nível 2.
    for (const s of collectChoicePicks(cls.choices, 'expertise')) mark(s, 2);
  }

  return out;
}

/**
 * Coleta TODAS as proficiências de ferramenta: origem (Background) + escolhas
 * (espécie/talento, recursivo). Dedup por nome.
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
 * Coleta TODOS os idiomas conhecidos. Regra de ouro: TODO personagem sabe
 * Common (raças 2024 deixaram de conceder; passou p/ background). Junta também
 * os idiomas FIXOS da raça (grantedLanguages), a origem e as escolhas. Normaliza
 * o caixa (ex: "elvish" → "Elvish") e descarta tokens ("other", "anyStandard"…).
 * @param {import('../schema/character').Character} character
 * @param {string[]} [grantedLanguages]  idiomas fixos da espécie (do db).
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

/** Ids ("Nome|Fonte") de todas as optional features escolhidas (invocations,
 * metamagic, maneuvers, infusions, pact boons…) nas classes. */
export function collectOptionalFeatureIds(character) {
  const out = [];
  for (const cls of character.classes ?? []) {
    out.push(...collectChoicePicks(cls.choices, 'optionalfeature'));
  }
  return out;
}

/** Ids de TODOS os talentos já tomados (origem + escolhas + classe). */
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
 * Tudo que o personagem JÁ POSSUI, por tipo - para o ChoiceList não deixar
 * escolher a mesma coisa duas vezes (dedup pela ficha inteira). tools/languages
 * em minúsculas (comparação case-insensitive); skills em código; feats por id.
 * @param {import('../schema/character').Character} character
 * @param {string[]} [grantedLanguages]  idiomas fixos da raça (do db).
 */
export function collectOwned(character, grantedLanguages = []) {
  const skillProfs = collectSkillProficiencies(character);
  return {
    skills: new Set(Object.keys(skillProfs)),
    // Perícias já com expertise (nível 2) - dedup das escolhas de Expertise.
    expertise: new Set(Object.keys(skillProfs).filter((s) => skillProfs[s] === 2)),
    tools: new Set(collectToolProficiencies(character).map((t) => t.toLowerCase())),
    languages: new Set(collectLanguages(character, grantedLanguages).map((l) => l.toLowerCase())),
    feats: new Set(collectFeatIds(character)),
  };
}

/**
 * Bônus de uma perícia para o personagem.
 * @param {import('../schema/character').Character} character
 * @param {string} skill  código (ex: 'ath')
 * @param {number} profBonus
 * @param {Record<string, 0|1|2>} [skillProfs]  opcional (evita recomputar)
 * @param {import('../schema/character').AbilityScores} [scores]  scores finais já
 *   computados (incl. boosts derivados como ability fixa de talentos); evita
 *   recomputar e perder esses boosts.
 * @returns {number}
 */
export function skillBonus(character, skill, profBonus, skillProfs, scores) {
  const profs = skillProfs ?? collectSkillProficiencies(character);
  const ability = SKILL_ABILITY[skill];
  const mod = abilityModifier((scores ?? finalScores(character))[ability]);
  return profValueBonus(mod, profBonus, profs[skill] ?? 0);
}

/**
 * Bônus de save de uma habilidade.
 * @param {import('../schema/character').Character} character
 * @param {import('../schema/character').Ability} ability
 * @param {number} profBonus
 * @param {Set<string>|string[]} proficientSaves  habilidades com save proficiente
 * @param {import('../schema/character').AbilityScores} [scores]  scores finais já
 *   computados (incl. boosts derivados como ability fixa de talentos).
 * @returns {number}
 */
export function saveBonus(character, ability, profBonus, proficientSaves, scores) {
  const set = proficientSaves instanceof Set ? proficientSaves : new Set(proficientSaves);
  const mod = abilityModifier((scores ?? finalScores(character))[ability]);
  return mod + (set.has(ability) ? profBonus : 0);
}
