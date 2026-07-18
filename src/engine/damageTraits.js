// =============================================================================
// damageTraits - resistências/imunidades/vulnerabilidades a dano (TC-0014)
// =============================================================================
// Puro: sem rede/DOM. Junta os traços de dano do personagem de três fontes:
//
//  1. GRANTS fixos estruturados - entradas string nos campos `resist`/`immune`/
//     `vulnerable` da raça resolvida (linhagem inclusa - a variante do Dragonborn
//     sobrescreve o `resist` com o tipo da ancestralidade) e dos talentos tomados
//     (Boon of Fate…).
//  2. ESCOLHAS do jogador - picks kind 'resist'/'immune'/'vulnerable' nos
//     choice-bags (espécie, talento de origem, sub-bags de feat em slots de
//     classe) - o lado escolhido do mesmo campo (`{choose:{from,count}}`,
//     ex: Boon of Energy Resistance), parseado por engine/choices.
//  3. ITENS equipados - `resist`/`immune`/`vulnerable` do item resolvido
//     (Armor of Resistance, variantes geradas), contando só quando equipado e,
//     se o item exige sintonização, sintonizado.
//
// Entradas OBJETO sem `choose` (condicionais em prosa, ex: resistência só
// contra ataques não-mágicos) ficam no texto do traço - não inventamos um
// traço incondicional que o dado não afirma.
// -----------------------------------------------------------------------------

import { resolveRaceObj, resolveFeat } from './resolve';
import { collectChoicePicks } from './choices';
import { collectFeatIds } from './proficiency';

/** Os três campos estruturados, na ordem de exibição. */
export const DAMAGE_TRAIT_KINDS = ['resist', 'immune', 'vulnerable'];

/** Empurra os grants FIXOS (strings) de um campo de traço de dano. */
function fixedFromField(field, add) {
  for (const entry of field ?? []) {
    if (typeof entry === 'string') add(entry);
    // `{choose}` é escolha (parseChoices); outros objetos são condicionais em prosa.
  }
}

/** Coleta os picks escolhidos de um kind em todos os choice-bags do personagem. */
function chosenPicks(character, kind, add) {
  for (const p of collectChoicePicks(character?.origin?.choices, kind)) add(p);
  for (const p of collectChoicePicks(character?.species?.choices, kind)) add(p);
  for (const p of collectChoicePicks(character?.origin?.originFeat?.choices, kind)) add(p);
  for (const cls of character?.classes ?? []) {
    for (const p of collectChoicePicks(cls.choices, kind)) add(p);
  }
}

/**
 * Deriva os traços de dano do personagem. Os do PRÓPRIO personagem (raça +
 * talentos + escolhas) saem nas listas principais - é o que o export escreve em
 * `traits.dr/di/dv` do ator. Os de ITENS equipados (e sintonizados, quando o
 * item o exige) saem à parte em `fromItems` (dedupados contra os do
 * personagem): a ficha os EXIBE juntos, mas no Foundry o item carrega o próprio
 * Active Effect - o ator não deve duplicá-los.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @param {object[]} [inventoryEntries]  entradas já resolvidas de deriveInventory
 *   (com `raw`/`equipped`/`attuned`/`required`).
 * @returns {{ resist: string[], immune: string[], vulnerable: string[],
 *             fromItems: { resist: string[], immune: string[], vulnerable: string[] } }}
 */
export function deriveDamageTraits(character, db, inventoryEntries = []) {
  const out = { resist: [], immune: [], vulnerable: [], fromItems: { resist: [], immune: [], vulnerable: [] } };
  const seen = { resist: new Set(), immune: new Set(), vulnerable: new Set() };
  const adder = (kind, list) => (value) => {
    const key = String(value).toLowerCase();
    if (!seen[kind].has(key)) {
      seen[kind].add(key);
      list.push(key);
    }
  };

  const race = character?.species
    ? resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage)
    : null;
  const feats = collectFeatIds(character ?? {})
    .map((id) => resolveFeat(db, id))
    .filter(Boolean);
  const activeItems = inventoryEntries.filter(
    (e) => e?.raw && e.equipped && (!e.required || e.attuned),
  );

  for (const kind of DAMAGE_TRAIT_KINDS) {
    const add = adder(kind, out[kind]);
    fixedFromField(race?.[kind], add);
    for (const feat of feats) fixedFromField(feat[kind], add);
    chosenPicks(character, kind, add);
    const addItem = adder(kind, out.fromItems[kind]);
    for (const e of activeItems) fixedFromField(e.raw[kind], addItem);
  }
  return out;
}
