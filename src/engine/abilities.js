// =============================================================================
// abilities: os scores finais de atributo, a partir das decisões
// =============================================================================
// O QUE FAZ
//   Score final = base + todos os boosts escolhidos (origem, espécie, ASIs de
//   classe, ASI embutido em talentos). Sem cache e sem compêndio: trabalha só com
//   o que o personagem registra, mais os boosts DERIVADOS que o chamador passa em
//   `extra` (os aumentos FIXOS de talento, como o +1 Str do Great Weapon Master;
//   ver resolve.deriveFeatAbilityBoosts).
//
// FUNÇÕES
//   collectAbilityBoosts(character, extra): todos os boosts (origem, espécie,
//     choice-bags recursivos e os derivados).
//   finalScores(character, extra): base + boosts, respeitando o teto de cada um.
//   abilityModifiers(character, extra): os modificadores finais.
//
// DECISÕES E ARMADILHAS
//   - Teto por aumento (TC-0022): talentos e ASIs param em 20; só os Epic Boons
//     chegam a 30, e o 5etools codifica esse teto em `max` (ausente é 20).
//   - Os boosts são aplicados do menor teto para o maior, sem passar do próprio
//     teto e sem REBAIXAR um score já acima dele (base ajustada à mão fica). É o
//     que deixa um Epic Boon subir de 20 para 21 enquanto um talento comum, preso
//     em 20, só desperdiça o ponto: fiel ao "to a maximum of 20/30".
//   - Espécie 2024 normalmente não dá boost; o campo existe para o legado.
// -----------------------------------------------------------------------------

import { ABILITIES } from '../schema/character';
import { abilityModifier } from './math';
import { collectAbilityPicks } from './choices';

/**
 * Todos os boosts de atributo do personagem, mais os derivados em `extra`.
 * @param {import('../schema/character').Character} character
 * @param {import('../schema/character').AbilityBoost[]} [extra]
 * @returns {import('../schema/character').AbilityBoost[]}
 */
export function collectAbilityBoosts(character, extra = []) {
  /** @type {import('../schema/character').AbilityBoost[]} */
  const boosts = [];

  if (character.origin?.abilityBoosts) boosts.push(...character.origin.abilityBoosts);
  const originFeatBoosts = character.origin?.originFeat?.choices?.abilityBoosts;
  if (Array.isArray(originFeatBoosts)) boosts.push(...originFeatBoosts);

  const speciesBoosts = character.species?.choices?.abilityBoosts;
  if (Array.isArray(speciesBoosts)) boosts.push(...speciesBoosts);

  for (const cls of character.classes ?? []) boosts.push(...collectAbilityPicks(cls.choices));
  boosts.push(...collectAbilityPicks(character.species?.choices));
  boosts.push(...collectAbilityPicks(character.origin?.originFeat?.choices));
  boosts.push(...collectAbilityPicks(character.origin?.choices));

  if (Array.isArray(extra) && extra.length) boosts.push(...extra);

  return boosts;
}

const DEFAULT_ABILITY_CAP = 20;

/**
 * Scores finais (base + boosts), respeitando o teto de cada aumento.
 * @param {import('../schema/character').Character} character
 * @param {import('../schema/character').AbilityBoost[]} [extra]
 * @returns {import('../schema/character').AbilityScores}
 */
export function finalScores(character, extra = []) {
  const out = { ...character.scores };
  /** @type {Record<string, {amount:number, max?:number}[]>} */
  const byAbility = {};
  for (const boost of collectAbilityBoosts(character, extra)) {
    if (!(boost.ability in out)) continue;
    (byAbility[boost.ability] ??= []).push(boost);
  }
  for (const [ability, boosts] of Object.entries(byAbility)) {
    boosts.sort((a, b) => (a.max ?? DEFAULT_ABILITY_CAP) - (b.max ?? DEFAULT_ABILITY_CAP));
    for (const { amount, max } of boosts) {
      const cap = max ?? DEFAULT_ABILITY_CAP;
      if (out[ability] >= cap) continue;
      out[ability] = Math.min(out[ability] + amount, cap);
    }
  }
  return out;
}

/**
 * Os modificadores finais de cada habilidade.
 * @param {import('../schema/character').Character} character
 * @param {import('../schema/character').AbilityBoost[]} [extra]
 * @returns {Record<import('../schema/character').Ability, number>}
 */
export function abilityModifiers(character, extra = []) {
  const scores = finalScores(character, extra);
  /** @type {Record<string, number>} */
  const mods = {};
  for (const a of ABILITIES) mods[a] = abilityModifier(scores[a]);
  return mods;
}
