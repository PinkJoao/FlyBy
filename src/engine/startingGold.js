// =============================================================================
// startingGold: o ouro inicial padrão (background e classe original)
// =============================================================================
// O QUE FAZ
//   Regra 2024: 50 GP do background mais a alternativa "só ouro" do equipamento
//   inicial da CLASSE (Cleric 110, Fighter 155, Wizard 55). O valor da classe está
//   na PROSA do `startingEquipment.entries` (a última opção "(X) N GP") e sai por
//   regex.
//
// FUNÇÕES
//   classStartingGold(classObj): o ouro da opção só de ouro, ou 0.
//   isPristine(currency): a carteira ainda é só os 50 do background?
//   seedStartingGold(character, db): a carteira com o ouro da classe somado, ou
//     null.
//
// DECISÕES E ARMADILHAS
//   - seedStartingGold só age com a carteira intocada, o inventário vazio e uma
//     classe original; nunca sobrescreve um saldo mexido. É idempotente: depois de
//     somar, a carteira deixa de estar no padrão.
// -----------------------------------------------------------------------------

import { resolveClassObj } from './resolve';

export const BACKGROUND_STARTING_GOLD = 50;

/**
 * O ouro da alternativa só de ouro da classe (0 se não houver).
 * @param {object|null} classObj
 * @returns {number}
 */
export function classStartingGold(classObj) {
  const entry = classObj?.startingEquipment?.entries?.[0];
  if (typeof entry !== 'string') return 0;
  const m = entry.match(/\([A-Z]\)\s*([\d,]+)\s*GP\s*$/i);
  return m ? Number(m[1].replace(/,/g, '')) : 0;
}

/** A carteira ainda está no padrão do personagem novo? */
function isPristine(currency) {
  const c = currency ?? {};
  return (c.pp || 0) === 0 && (c.gp || 0) === BACKGROUND_STARTING_GOLD
    && (c.ep || 0) === 0 && (c.sp || 0) === 0 && (c.cp || 0) === 0;
}

/**
 * A carteira com o ouro inicial da classe, ou null para não mexer.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {object|null}
 */
export function seedStartingGold(character, db) {
  if (!isPristine(character?.currency)) return null;
  if ((character?.inventory?.length ?? 0) > 0) return null;
  const orig = (character?.classes ?? []).find((c) => c.isOriginalClass && c.classId);
  if (!orig) return null;
  const gold = classStartingGold(resolveClassObj(db, orig.classId, orig.source));
  if (!gold) return null;
  return { ...character.currency, gp: BACKGROUND_STARTING_GOLD + gold };
}
