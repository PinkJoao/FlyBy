// =============================================================================
// srdNames: o outro nome de uma entrada, entre o compêndio completo e o SRD
// =============================================================================
// O QUE FAZ
//   O SRD 5.2 publica 35 entradas com outro nome ("Tasha's Hideous Laughter" ->
//   "Hideous Laughter", "Heward's Handy Haversack" -> "Handy Haversack"). Uma
//   ficha guarda o NOME da decisão, então a feita com o compêndio completo não
//   acharia a magia no modo SRD, e a feita no SRD não acharia o item no completo.
//   Os resolvedores (spells.js, items.js) perguntam aqui o outro nome quando o
//   exato falha. O mapa é GERADO junto do pacote (srdRenamesData.js).
//
// FUNÇÕES
//   alternateNames(name): os outros nomes da mesma entrada, nos dois sentidos.
//
// DECISÕES E ARMADILHAS
//   - Só depois do casamento exato, e só nome: a fonte da entrada não muda entre
//     os dois (a magia segue XPHB, o item segue XDMG).
// -----------------------------------------------------------------------------

import { SRD_RENAMES } from './srdRenamesData';

const REVERSE = new Map();
for (const [old, srd] of Object.entries(SRD_RENAMES)) {
  const key = srd.toLowerCase();
  REVERSE.set(key, [...(REVERSE.get(key) ?? []), old]);
}

/** Os outros nomes da mesma entrada (minúsculos), nos dois sentidos. */
export function alternateNames(name) {
  const lc = String(name ?? '').trim().toLowerCase().replace(/’/g, "'");
  if (!lc) return [];
  const out = [];
  if (SRD_RENAMES[lc]) out.push(SRD_RENAMES[lc].toLowerCase());
  for (const old of REVERSE.get(lc) ?? []) out.push(old);
  return out;
}
