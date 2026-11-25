// =============================================================================
// hpBonuses: os aumentos de HP máximo de talentos, raça e subclasse
// =============================================================================
// O QUE FAZ
//   Esses aumentos existem só em PROSA ("Your Hit Point maximum increases by"),
//   então um REGISTRO CURADO, levantado varrendo feats, races e class-*.json
//   (2026-07-17). O conjunto é FECHADO e pequeno:
//     Tough (PHB, XPHB): +2 por nível de PERSONAGEM.
//     Boon of Fortitude (XPHB): +40 fixo.
//     Dwarven Toughness: +1 por nível de personagem.
//     Draconic Resilience: +1 por nível de FEITICEIRO (a PHB diz "1 for each
//       sorcerer level", a XPHB "+3 no 3, +1 a cada nível"; as duas dão o mesmo).
//
// FUNÇÕES
//   deriveHpBonus(character, db): { total, perLevelRate, flat }.
//
// DECISÕES E ARMADILHAS
//   - O split importa para o EXPORT: a taxa por nível de personagem vai em
//     `hp.bonuses.level` (nativo, sobrevive ao level-up no Foundry); o resto (fixo
//     e por nível de classe, que o Foundry não expressa) vai como número em
//     `hp.bonuses.overall`, e o IMPORT subtrai a parte derivável para reconstruir o
//     ajuste manual (hpBonus).
//   - RACE_HP_PER_LEVEL é keyed pela raça RESOLVIDA. Desde o swap do DDL-0063 o
//     Dwarven Toughness é a opção Hill do Dwarf, e a Mountain o troca pelo Dwarven
//     Armor Training: a chave é a da LINHAGEM. Quem acrescentar uma espécie ao
//     SWAP_LINEAGES migra junto a chave de todo registro keyed por raça (este, o
//     NATURAL_ARMOR).
//   - O Hill Dwarf PHB e o Stensia PSI vivem em `subrace`, que o app não oferece.
// -----------------------------------------------------------------------------

import { resolveFeat, resolveRaceObj, resolveSubclassObj } from './resolve';
import { collectFeatIds } from './proficiency';
import { totalLevel } from '../schema/character';

const FEAT_HP = {
  tough: { perLevel: 2 },
  'boon of fortitude': { flat: 40 },
};

// ATENÇÃO: chave pela raça RESOLVIDA; traço que virou opção de linhagem usa a chave da linhagem.
export const RACE_HP_PER_LEVEL = {
  'Dwarf; Hill Lineage|PHB': 1,
  'Dwarf (Kaladesh)|PSK': 1,
};

const SUBCLASS_HP_PER_CLASS_LEVEL = {
  'sorcerer|draconic': 1,
};

/**
 * Os aumentos de HP máximo derivados do compêndio.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {{ total:number, perLevelRate:number, flat:number }}
 */
export function deriveHpBonus(character, db) {
  const level = totalLevel(character ?? {});
  let perLevelRate = 0;
  let flat = 0;

  for (const id of collectFeatIds(character ?? {})) {
    const feat = resolveFeat(db, id);
    const eff = feat ? FEAT_HP[feat.name.toLowerCase()] : null;
    if (!eff) continue;
    perLevelRate += eff.perLevel ?? 0;
    flat += eff.flat ?? 0;
  }

  if (character?.species) {
    const race = resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage);
    if (race) perLevelRate += RACE_HP_PER_LEVEL[`${race.name}|${race.source}`] ?? 0;
  }

  for (const cls of character?.classes ?? []) {
    if (!cls.classId || !cls.subclassId) continue;
    const subObj = resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource);
    if (!subObj) continue;
    const rate = SUBCLASS_HP_PER_CLASS_LEVEL[`${cls.classId.toLowerCase()}|${(subObj.shortName ?? '').toLowerCase()}`];
    if (rate) flat += rate * (cls.level ?? 0);
  }

  return { total: perLevelRate * level + flat, perLevelRate, flat };
}
