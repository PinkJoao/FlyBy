// =============================================================================
// attunement - limite e pré-requisitos de atunement (Fase B1)
// =============================================================================
// Regra padrão: no máx 3 itens atunados por vez (não deriva de features que
// aumentam o limite - ex: certas subclasses de Artífice - fica pra depois).
// -----------------------------------------------------------------------------

import { attunementInfo } from './items';

export const ATTUNEMENT_MAX = 3;

/**
 * Motivo pelo qual atunar este item violaria o limite/pré-requisito, ou `null`
 * se não há problema. Mesmo padrão de aviso já usado em `unmetMulticlassReqs`/
 * `prereqStatus`: o chamador decide se pergunta "atunar mesmo assim?" via o
 * diálogo in-app `confirm` (components/common/dialog), não bloqueia.
 * @param {number} attunedCount  quantos itens JÁ estão atunados (sem contar este)
 * @param {object|null} raw      objeto cru do item (de resolveItemObj)
 * @returns {string|null}
 */
export function unmetAttunement(attunedCount, raw) {
  const info = attunementInfo(raw);
  if (!info.required) return null;
  if (attunedCount >= ATTUNEMENT_MAX) {
    return `Already attuned to ${ATTUNEMENT_MAX} items (the maximum)`;
  }
  if (info.prereqText) {
    return `Requires attunement ${info.prereqText} - can't be checked automatically`;
  }
  return null;
}
