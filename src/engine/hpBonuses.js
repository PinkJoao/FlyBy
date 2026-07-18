// =============================================================================
// hpBonuses - aumentos de HP MÁXIMO concedidos por feats/raça/subclasse
// =============================================================================
// Puro: sem rede/DOM. Esses aumentos existem só em PROSA ("Your Hit Point
// maximum increases by…"), então mantemos um REGISTRO CURADO - levantado por
// varredura completa de feats.json + races.json + class-*.json com as tags
// {@variantrule} removidas (2026-07-17). O conjunto é FECHADO e pequeno:
//
//   Feats:  Tough (PHB/XPHB)            +2 × nível de PERSONAGEM
//           Boon of Fortitude (XPHB)    +40 fixo
//   Raça:   Dwarven Toughness           +1 × nível de personagem
//           (Dwarf XPHB; Dwarf (Kaladesh) PSK; o Hill Dwarf PHB e o Stensia
//           PSI vivem em `subrace`, que o app não oferece - documentado)
//   Subcl.: Draconic Resilience         +1 × nível de FEITICEIRO (PHB nível 1
//           "increases by 1 for each sorcerer level"; XPHB nível 3 "+3, +1 a
//           cada nível seguinte" - ambas equivalem a 1×nível da classe)
//
// O split perLevel/flat importa para o EXPORT Foundry: taxas por nível de
// personagem vão em `hp.bonuses.level` (nativo, sobrevive a level-up no
// Foundry); o resto (fixo + por-nível-de-classe, que o Foundry não expressa)
// vai como número concreto em `hp.bonuses.overall` - e o IMPORT subtrai a
// parte derivável ao reconstruir o ajuste manual do jogador (hpBonus).
// -----------------------------------------------------------------------------

import { resolveFeat, resolveRaceObj, resolveSubclassObj } from './resolve';
import { collectFeatIds } from './proficiency';
import { totalLevel } from '../schema/character';

/** Nome do feat (minúsculo) → efeito. `perLevel` escala com o nível de
 * personagem; `flat` é fixo. */
const FEAT_HP = {
  tough: { perLevel: 2 },
  'boon of fortitude': { flat: 40 },
};

/** `Nome|FONTE` da raça RESOLVIDA (linhagem inclusa) → taxa por nível. */
const RACE_HP_PER_LEVEL = {
  'Dwarf|XPHB': 1,
  'Dwarf (Kaladesh)|PSK': 1,
};

/** `classId|shortName minúsculo` → taxa por nível DA CLASSE. */
const SUBCLASS_HP_PER_CLASS_LEVEL = {
  'sorcerer|draconic': 1,
};

/**
 * Aumentos de HP máximo derivados do compêndio (fora o ajuste manual hpBonus).
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {{ total:number, perLevelRate:number, flat:number }}
 *   perLevelRate: soma das taxas por nível de PERSONAGEM (Tough, raça);
 *   flat: parte fixa + as taxas por nível de CLASSE já multiplicadas.
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
