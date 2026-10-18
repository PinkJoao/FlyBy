// =============================================================================
// attunement: o limite e os pré-requisitos de atunement (Fase B1)
// =============================================================================
// O QUE FAZ
//   No máximo 3 itens atunados por vez. Features que aumentam o limite (certas
//   subclasses de Artífice) ainda não são derivadas.
//
// FUNÇÕES
//   unmetAttunement(attunedCount, raw): o motivo pelo qual atunar violaria o
//     limite ou o pré-requisito, ou null.
//
// DECISÕES E ARMADILHAS
//   - Avisa, não bloqueia: o chamador pergunta "atunar mesmo assim?" pelo confirm
//     in-app, no mesmo padrão de unmetMulticlassReqs e prereqStatus.
// -----------------------------------------------------------------------------

import { attunementInfo } from './items';

export const ATTUNEMENT_MAX = 3;

/**
 * Por que atunar este item violaria o limite ou o pré-requisito, ou null.
 * @param {number} attunedCount
 * @param {object|null} raw
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
