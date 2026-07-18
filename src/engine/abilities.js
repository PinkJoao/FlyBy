// =============================================================================
// Habilidades - scores finais a partir das DECISÕES
// =============================================================================
// Score final = base + soma de todos os boosts escolhidos (origem, espécie,
// ASIs de classe, e ASI embutido em talentos). Sem cache, sem compêndio:
// trabalha só com o que o personagem registra.
// -----------------------------------------------------------------------------

import { ABILITIES } from '../schema/character';
import { abilityModifier } from './math';
import { collectAbilityPicks } from './choices';

/**
 * Coleta todos os boosts de atributo registrados no personagem.
 *
 * `extra` traz boosts DERIVADOS que dependem do compêndio e por isso não podem
 * ser lidos só do choice-bag - hoje, os aumentos de atributo FIXOS embutidos em
 * talentos escolhidos (ex: Great Weapon Master XPHB → `ability:[{str:1}]`, que
 * não é uma escolha do usuário). Ver resolve.deriveFeatAbilityBoosts.
 * @param {import('../schema/character').Character} character
 * @param {import('../schema/character').AbilityBoost[]} [extra]
 * @returns {import('../schema/character').AbilityBoost[]}
 */
export function collectAbilityBoosts(character, extra = []) {
  /** @type {import('../schema/character').AbilityBoost[]} */
  const boosts = [];

  // Origem custom
  if (character.origin?.abilityBoosts) boosts.push(...character.origin.abilityBoosts);
  // ASI embutido no talento de origem
  const originFeatBoosts = character.origin?.originFeat?.choices?.abilityBoosts;
  if (Array.isArray(originFeatBoosts)) boosts.push(...originFeatBoosts);

  // Espécie (linhagem 2024 normalmente não dá boost, mas o campo existe p/ legado)
  const speciesBoosts = character.species?.choices?.abilityBoosts;
  if (Array.isArray(speciesBoosts)) boosts.push(...speciesBoosts);

  // Choice-bags (recursivo): ASIs de classe e talentos com ASI embutido - o
  // collectAbilityPicks desce nos sub-bags (feat escolhido num slot de ASI etc.).
  for (const cls of character.classes ?? []) boosts.push(...collectAbilityPicks(cls.choices));
  boosts.push(...collectAbilityPicks(character.species?.choices));
  boosts.push(...collectAbilityPicks(character.origin?.originFeat?.choices));
  boosts.push(...collectAbilityPicks(character.origin?.choices));

  // Boosts fixos derivados do compêndio (feats com ability fixa).
  if (Array.isArray(extra) && extra.length) boosts.push(...extra);

  return boosts;
}

// Teto padrão de um atributo (RAW 2024): talentos e ASIs param em 20. Só os Epic
// Boons chegam a 30, e o 5etools codifica esse teto explícito (`max`) - ausente = 20.
const DEFAULT_ABILITY_CAP = 20;

/**
 * Scores finais (base + boosts), RESPEITANDO o teto de cada aumento (TC-0022).
 *
 * Cada boost carrega o seu teto (`max`): talentos/ASIs comuns 20, Epic Boons 30
 * (`max: undefined` = 20). Os boosts são aplicados um a um, do menor teto para o
 * maior, sem nunca ultrapassar o próprio teto nem REBAIXAR um score já acima dele
 * (bases altas ajustadas à mão são preservadas). Aplicar os de teto 20 antes dos
 * de teto 30 é o que deixa um Epic Boon subir de 20 p/ 21 enquanto um feat comum
 * empacado em 20 apenas desperdiça o ponto - fiel ao "to a maximum of 20/30".
 * @param {import('../schema/character').Character} character
 * @param {import('../schema/character').AbilityBoost[]} [extra]  boosts derivados (ver acima).
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
      if (out[ability] >= cap) continue; // já no teto: o aumento é desperdiçado
      out[ability] = Math.min(out[ability] + amount, cap);
    }
  }
  return out;
}

/**
 * Modificadores finais de cada habilidade.
 * @param {import('../schema/character').Character} character
 * @param {import('../schema/character').AbilityBoost[]} [extra]  boosts derivados (ver acima).
 * @returns {Record<import('../schema/character').Ability, number>}
 */
export function abilityModifiers(character, extra = []) {
  const scores = finalScores(character, extra);
  /** @type {Record<string, number>} */
  const mods = {};
  for (const a of ABILITIES) mods[a] = abilityModifier(scores[a]);
  return mods;
}
