// =============================================================================
// Nome por extenso de uma fonte
// =============================================================================
// A abreviação de fonte ("XPHB", "PSK") é o que o dado carrega e o que os cards
// mostram, mas ela não diz nada a um jogador novo. Este módulo resolve a
// abreviação para o nome por extenso ("Player's Handbook (2024)", "Plane Shift:
// Kaladesh"), a partir do mapa GERADO `sourceNamesData.js` (npm run gen:sources).
//
// Puro, sem db: o mapa é estático. Um source desconhecido devolve a própria
// abreviação (nunca um rótulo vazio).
// -----------------------------------------------------------------------------

import { SOURCE_NAMES } from './sourceNamesData';

/**
 * Nome por extenso de uma fonte, ou a própria abreviação se não houver mapa.
 * @param {string} source  abreviação ("XPHB")
 * @returns {string}
 */
export function sourceName(source) {
  if (!source) return '';
  return SOURCE_NAMES[source] ?? source;
}

/** A fonte tem um nome por extenso conhecido (diferente da abreviação)? */
export function hasSourceName(source) {
  const full = SOURCE_NAMES[source];
  return !!full && full !== source;
}
