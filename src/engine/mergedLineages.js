// =============================================================================
// Reimpressão de cenário FUNDIDA na espécie mainstream: as linhagens juntas, uma
// entrada só (DDL-0066)
// =============================================================================
// "Lorwyn: First Light" (LFL, 2025) reimprime espécies mainstream em `_copy`,
// trocando/acrescentando as linhagens do cenário. O resultado eram DUAS entradas
// de mesmo nome no seletor:
//   - Elf|XPHB  (Drow/High/Wood)   +   Elf|LFL   (Lorwyn/Shadowmoor, no LUGAR das
//     três) - o LFL SUBSTITUI o traço "Elven Lineage".
//   - Fairy|MPMM (sem linhagem)    +   Faerie|LFL (ACRESCENTA Lorwyn/Shadowmoor).
//
// Ao contrário do Plane Shift (engine/settingSpecies.js), o LFL é conteúdo
// OFICIAL e ATUAL, no formato 2024, e cada linhagem dele é uma sub-espécie
// legítima com lore e arte próprias (races/LFL/Elf (Lorwyn).webp etc.). Então em
// vez de esconder atrás de um filtro, FUNDIMOS: as `_versions` do LFL viram mais
// linhagens da base mainstream, e a entrada LFL some do seletor. Uma "Elf" só,
// que oferece Drow/High/Wood/Lorwyn/Shadowmoor; um "Fairy" só, que ganha as
// linhagens de Lorwyn.
//
// A LORE e a IMAGEM do LFL não se perdem: cada descritor de versão declara
// `source: 'LFL'`, então a variante fundida resolve o fluff pela fonte LFL (o
// mesmo mecanismo que dá arte própria ao Pallid Elf / Aven Ibis-Headed).
//
// Por que os `_mod` das versões aplicam limpo sobre a base mainstream, sem o
// guarda-chuva que o DDL-0063 precisou montar:
//   - Elf: as versões fazem `replaceArr` do "Elven Lineage", que o Elf|XPHB TEM.
//   - Fairy: as versões fazem `removeArr "Faerie Lineage"` (o guarda-chuva que o
//     `_copy` do Faerie acrescenta) - no Fairy|MPMM cru não existe, e um
//     `removeArr` sem alvo é no-op inofensivo (nada some em silêncio).
//
// Para ACRESCENTAR um par: uma linha `{ base, from }`. `from` tem de ser um
// `_copy` de `base` (ou de mesma mecânica), para que as `_versions` dele se
// exprimam sobre os mesmos traços da base.
// -----------------------------------------------------------------------------

/**
 * Reimpressões de cenário cujas linhagens são fundidas na espécie mainstream.
 * @type {ReadonlyArray<{ base: string, from: string }>}
 */
export const MERGED_LINEAGES = Object.freeze([
  { base: 'Elf|XPHB', from: 'Elf|LFL' }, // + Lorwyn / Shadowmoor
  { base: 'Fairy|MPMM', from: 'Faerie|LFL' }, // + Lorwyn / Shadowmoor
]);

/** Ids das entradas standalone que a fusão remove do seletor ("Nome|FONTE"). */
const foldedIds = new Set(MERGED_LINEAGES.map((e) => e.from));

/** Índice base → [ids de origem]. */
const fromsByBase = new Map();
for (const e of MERGED_LINEAGES) {
  const arr = fromsByBase.get(e.base) ?? [];
  arr.push(e.from);
  fromsByBase.set(e.base, arr);
}

/** Id de catálogo de uma espécie ("Nome|FONTE"). */
function idOf(race) {
  return race?.name ? `${race.name}|${race.source}` : '';
}

/**
 * A espécie é uma reimpressão de cenário cujas linhagens já foram fundidas na
 * base? (removida do seletor, do glossário e da matriz do sweep). Continua
 * RESOLVÍVEL por nome - `speciesCatalog` não a remove - para uma ficha salva com
 * ela não perder a espécie ao recarregar.
 * @param {object|null} race
 * @returns {boolean}
 */
export function isFoldedSpecies(race) {
  return foldedIds.has(idOf(race));
}

/**
 * Os descritores de linhagem (`_versions`) a fundir na espécie BASE. Cru: cada um
 * é passado por `buildVariant(base, v)` pelo chamador (raceLineages).
 * @param {object|null} db
 * @param {object|null} race  espécie BASE (ex: Elf|XPHB)
 * @returns {object[]}
 */
export function mergedLineageVersions(db, race) {
  if (!db || !race?.name) return [];
  const froms = fromsByBase.get(idOf(race));
  if (!froms) return [];
  const out = [];
  for (const from of froms) {
    const i = from.lastIndexOf('|');
    const name = from.slice(0, i);
    const source = from.slice(i + 1);
    const fromRace = (db.races?.race ?? []).find((r) => r?.name === name && r.source === source);
    for (const v of fromRace?._versions ?? []) out.push(v);
  }
  return out;
}
