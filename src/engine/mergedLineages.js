// =============================================================================
// mergedLineages: a reimpressão de cenário fundida na espécie mainstream (DDL-0066)
// =============================================================================
// O QUE FAZ
//   "Lorwyn: First Light" (LFL, 2025) reimprime espécies mainstream em `_copy`
//   trocando ou acrescentando linhagens, e o seletor ficava com DUAS entradas de
//   mesmo nome: Elf XPHB e Elf LFL (Lorwyn e Shadowmoor NO LUGAR de Drow, High,
//   Wood); Fairy MPMM e Faerie LFL (que ACRESCENTA Lorwyn e Shadowmoor). O LFL é
//   OFICIAL e ATUAL, então em vez de esconder, FUNDIMOS: as `_versions` do LFL
//   viram linhagens da base mainstream e a entrada LFL sai do seletor.
//
// FUNÇÕES
//   idOf(race): o id de catálogo.
//   isFoldedSpecies(race): a entrada foi fundida (sai das listas)?
//   mergedLineageVersions(db, race): as versões a fundir na base.
//   lineageImagePath(race): a arte curada de uma linhagem fundida, ou null.
//
// DECISÕES E ARMADILHAS
//   - Lore e imagem não se perdem: cada versão declara `source: 'LFL'` e resolve o
//     fluff por ela.
//   - Os `_mod` aplicam limpo sem guarda-chuva novo: no Elf o `replaceArr` mira o
//     Elven Lineage que o XPHB tem; no Fairy o `removeArr` do Faerie Lineage não
//     acha alvo, e isso é no-op inofensivo.
//   - A entrada fundida continua RESOLVÍVEL por nome (uma ficha salva com ela não
//     perde a espécie).
//   - Arte curada (pedido do usuário): os dois arquivos do Elf LFL estão TROCADOS
//     no dado (o de Lorwyn retrata Shadowmoor), e no Fairy o Lorwyn usa a arte
//     original MPMM, o Shadowmoor a do Faerie.
//   - Para acrescentar um par: uma linha { base, from }, com `from` um `_copy` de
//     `base` (ou de mesma mecânica).
// -----------------------------------------------------------------------------

/** @type {ReadonlyArray<{ base: string, from: string }>} */
export const MERGED_LINEAGES = Object.freeze([
  { base: 'Elf|XPHB', from: 'Elf|LFL' },
  { base: 'Fairy|MPMM', from: 'Faerie|LFL' },
]);

/** @type {Readonly<Record<string, string>>} */
export const LINEAGE_IMAGE = Object.freeze({
  'Elf; Lorwyn Lineage|LFL': 'races/LFL/Elf (Shadowmoor).webp',
  'Elf; Shadowmoor Lineage|LFL': 'races/LFL/Elf (Lorwyn).webp',
  'Faerie; Lorwyn|LFL': 'races/MPMM/Fairy.webp',
  'Faerie; Shadowmoor|LFL': 'races/LFL/Faerie.webp',
});

const foldedIds = new Set(MERGED_LINEAGES.map((e) => e.from));

const fromsByBase = new Map();
for (const e of MERGED_LINEAGES) {
  const arr = fromsByBase.get(e.base) ?? [];
  arr.push(e.from);
  fromsByBase.set(e.base, arr);
}

/** O id de catálogo de uma espécie ("Nome|FONTE"). */
function idOf(race) {
  return race?.name ? `${race.name}|${race.source}` : '';
}

/**
 * A espécie é uma reimpressão já fundida na base?
 * @param {object|null} race
 * @returns {boolean}
 */
export function isFoldedSpecies(race) {
  return foldedIds.has(idOf(race));
}

/**
 * As versões de linhagem a fundir na espécie base.
 * @param {object|null} db
 * @param {object|null} race
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

/**
 * O caminho da arte curada de uma linhagem fundida, ou null.
 * @param {object|null} race
 * @returns {string|null}
 */
export function lineageImagePath(race) {
  return LINEAGE_IMAGE[idOf(race)] ?? null;
}
