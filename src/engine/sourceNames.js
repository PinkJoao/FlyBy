// =============================================================================
// sourceNames: o nome por extenso de uma fonte
// =============================================================================
// O QUE FAZ
//   A abreviação ("XPHB", "PSK") é o que o dado carrega e os cards mostram, mas não
//   diz nada a um jogador novo. Daqui sai o nome por extenso ("Player's Handbook
//   (2024)", "Plane Shift: Kaladesh"), a partir do mapa GERADO sourceNamesData.js
//   (`npm run gen:sources`, DDL-0065). Puro e sem db.
//
// FUNÇÕES
//   sourceName(source): o nome por extenso, ou a própria abreviação (nunca vazio).
//   hasSourceName(source): existe um nome diferente da abreviação?
// -----------------------------------------------------------------------------

import { SOURCE_NAMES } from './sourceNamesData';

/**
 * O nome por extenso de uma fonte, ou a própria abreviação.
 * @param {string} source
 * @returns {string}
 */
export function sourceName(source) {
  if (!source) return '';
  return SOURCE_NAMES[source] ?? source;
}

/** A fonte tem um nome por extenso conhecido? */
export function hasSourceName(source) {
  const full = SOURCE_NAMES[source];
  return !!full && full !== source;
}
