// =============================================================================
// damageTraits: resistências, imunidades e vulnerabilidades a dano (TC-0014)
// =============================================================================
// O QUE FAZ
//   Junta os traços de dano do personagem de quatro fontes:
//     1. Grants fixos: strings nos campos `resist`, `immune` e `vulnerable` da
//        raça resolvida (linhagem inclusa: o Dragonborn troca o `resist` pela
//        ancestralidade) e dos talentos tomados.
//     2. Escolhas do jogador: picks desses kinds nos choice-bags, o lado
//        `{choose}` do mesmo campo (Boon of Energy Resistance).
//     3. Grants de SUBCLASSE em prosa (subclassGrants): resistência ou imunidade
//        PERMANENTE (Radiant Soul, Soul of the Forge), inclusive as que dependem de
//        outra escolha (o genie kind, o ambiente do Storm Herald).
//     4. Itens: os mesmos campos no item resolvido, contando só quando equipado e,
//        se o item exige, atunado.
//
// FUNÇÕES
//   fixedFromField(field, add): os grants fixos de um campo.
//   chosenPicks(character, kind, add): os picks de um kind em todos os bags.
//   deriveDamageTraits(character, db, inventoryEntries): { resist, immune,
//     vulnerable, fromItems }.
//
// DECISÕES E ARMADILHAS
//   - Entrada OBJETO sem `choose` é condicional em prosa (só contra ataques
//     não mágicos) e fica no texto: nunca se inventa um traço incondicional.
//   - Os traços de ITEM saem à parte, em `fromItems`, deduplicados contra os do
//     personagem. A ficha os exibe juntos, mas no Foundry o item carrega o próprio
//     Active Effect, e o ator não pode duplicá-los em `traits.dr/di/dv`.
//   - Subclasse só concede `resist` e `immune`: nenhuma concede vulnerabilidade
//     permanente (a varredura está no cabeçalho do subclassGrants).
// -----------------------------------------------------------------------------

import { resolveRaceObj, resolveFeat } from './resolve';
import { collectChoicePicks } from './choices';
import { collectFeatIds } from './proficiency';
import { deriveSubclassGrants } from './subclassGrants';

export const DAMAGE_TRAIT_KINDS = ['resist', 'immune', 'vulnerable'];

/** Os grants fixos (strings) de um campo de traço de dano. */
function fixedFromField(field, add) {
  for (const entry of field ?? []) {
    if (typeof entry === 'string') add(entry);
  }
}

/** Os picks de um kind em todos os choice-bags do personagem. */
function chosenPicks(character, kind, add) {
  for (const p of collectChoicePicks(character?.origin?.choices, kind)) add(p);
  for (const p of collectChoicePicks(character?.species?.choices, kind)) add(p);
  for (const p of collectChoicePicks(character?.origin?.originFeat?.choices, kind)) add(p);
  for (const cls of character?.classes ?? []) {
    for (const p of collectChoicePicks(cls.choices, kind)) add(p);
  }
}

/**
 * Os traços de dano do personagem, com os de itens à parte.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @param {object[]} [inventoryEntries]
 * @returns {{ resist: string[], immune: string[], vulnerable: string[],
 *   fromItems: { resist: string[], immune: string[], vulnerable: string[] } }}
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
  const subclassGrants = deriveSubclassGrants(character, db);
  const activeItems = inventoryEntries.filter(
    (e) => e?.raw && e.equipped && (!e.required || e.attuned),
  );

  for (const kind of DAMAGE_TRAIT_KINDS) {
    const add = adder(kind, out[kind]);
    fixedFromField(race?.[kind], add);
    for (const feat of feats) fixedFromField(feat[kind], add);
    for (const v of subclassGrants[kind] ?? []) add(v);
    chosenPicks(character, kind, add);
    const addItem = adder(kind, out.fromItems[kind]);
    for (const e of activeItems) fixedFromField(e.raw[kind], addItem);
  }
  return out;
}
