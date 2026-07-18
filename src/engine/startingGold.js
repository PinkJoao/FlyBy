// =============================================================================
// startingGold - ouro inicial padrão (background + classe original)
// =============================================================================
// Regra 2024 (XPHB): o personagem começa com 50 GP do background + a alternativa
// "só ouro" do equipamento inicial da CLASSE (Cleric 110, Fighter 155, Wizard
// 55…). O valor da classe está na PROSA do `startingEquipment.entries` (a última
// opção "(X) N GP", que é só ouro), então o extraímos por regex.
//
// Puro: sem rede/DOM. `seedStartingGold` só age quando a carteira ainda está no
// padrão (50 GP, nada gasto/adicionado) e há uma classe original - assim nunca
// sobrescreve um saldo que o jogador já mexeu.
// -----------------------------------------------------------------------------

import { resolveClassObj } from './resolve';

/** Ouro do background (fixo na origem custom 2024). */
export const BACKGROUND_STARTING_GOLD = 50;

/**
 * Ouro da alternativa "só ouro" do equipamento inicial da classe (a última opção
 * do texto, ex.: "…; or (B) 110 GP" → 110). 0 se não houver/parsear.
 * @param {object|null} classObj  objeto cru da classe (5etools)
 * @returns {number}
 */
export function classStartingGold(classObj) {
  const entry = classObj?.startingEquipment?.entries?.[0];
  if (typeof entry !== 'string') return 0;
  const m = entry.match(/\([A-Z]\)\s*([\d,]+)\s*GP\s*$/i);
  return m ? Number(m[1].replace(/,/g, '')) : 0;
}

/** A carteira ainda está no padrão do personagem novo (só os 50 do background)? */
function isPristine(currency) {
  const c = currency ?? {};
  return (c.pp || 0) === 0 && (c.gp || 0) === BACKGROUND_STARTING_GOLD
    && (c.ep || 0) === 0 && (c.sp || 0) === 0 && (c.cp || 0) === 0;
}

/**
 * Se a carteira está intocada (50 GP) e o inventário vazio, e há uma classe
 * ORIGINAL definida, devolve a carteira com o ouro inicial da classe somado.
 * Senão `null` (não mexe). Idempotente: depois de somar, a carteira deixa de
 * estar "no padrão", então não soma de novo.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {object|null}  nova carteira, ou null
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
