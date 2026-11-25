// =============================================================================
// math: a matemática base das regras (5e 2024)
// =============================================================================
// FUNÇÕES
//   abilityModifier(score): floor((score - 10) / 2).
//   proficiencyBonus(totalLevel): ceil(nível / 4) + 1 (de +2 a +6).
//   formatBonus(n): 5 vira "+5"; negativo usa o sinal de menos tipográfico.
// -----------------------------------------------------------------------------

/**
 * Modificador de uma habilidade.
 * @param {number} score
 * @returns {number}
 */
export function abilityModifier(score) {
  return Math.floor((score - 10) / 2);
}

/**
 * Bônus de proficiência pelo nível TOTAL.
 * @param {number} totalLevel
 * @returns {number}
 */
export function proficiencyBonus(totalLevel) {
  if (totalLevel < 1) return 2;
  return Math.ceil(totalLevel / 4) + 1;
}

/** Formata um bônus com sinal. */
export function formatBonus(n) {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}
