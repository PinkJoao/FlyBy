// =============================================================================
// Matemática base de regras (5e 2024)
// =============================================================================
// Funções puras, sem dependência de dados externos. Fundação do engine.
// -----------------------------------------------------------------------------

/**
 * Modificador de uma habilidade: floor((score - 10) / 2).
 * @param {number} score
 * @returns {number}
 */
export function abilityModifier(score) {
  return Math.floor((score - 10) / 2);
}

/**
 * Bônus de proficiência pelo nível TOTAL do personagem: ceil(level/4) + 1.
 * (Lv 1-4 = +2, 5-8 = +3, ... 17-20 = +6.)
 * @param {number} totalLevel
 * @returns {number}
 */
export function proficiencyBonus(totalLevel) {
  if (totalLevel < 1) return 2;
  return Math.ceil(totalLevel / 4) + 1;
}

/** Formata um bônus com sinal, ex: 5 → "+5", -1 → "−1". */
export function formatBonus(n) {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}
