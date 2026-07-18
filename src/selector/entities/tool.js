// =============================================================================
// Entity config: Tool (ferramentas, instrumentos, kits de jogo)
// =============================================================================
// baseitem + items.json filtrados pelos tipos de ferramenta, MUNDANOS apenas.
// Dedup por nome (prefere XPHB). Filtro por categoria derivada do prefixo do
// tipo (AT/INS/GS/T).
//
// ⚠ items-base.json NÃO contém todas as ferramentas: os gaming sets (Dice Set,
// Playing Cards…) e vários kits (Thieves' Tools, Disguise Kit, Poisoner's Kit,
// Herbalism Kit, Navigator's Tools, Forgery Kit) vivem só em items.json - sem
// fundir os dois catálogos, essas escolhas ficavam SEM opções (achado no sweep
// do TC-0012, família DDL-0002 "Problem 1").
// -----------------------------------------------------------------------------

import { latestOnly, dedupeByName } from '../reprints';

const TOOL_TYPES = ['AT', 'GS', 'T', 'INS'];
const TOOL_CAT = {
  AT: "Artisan's Tools",
  INS: 'Musical Instrument',
  GS: 'Gaming Set',
  T: 'Tool',
};

function toolCat(item) {
  const prefix = (item.type ?? '').split('|')[0];
  return TOOL_CAT[prefix] ?? 'Tool';
}

/** Item de tipo ferramenta e MUNDANO (rarity real = item mágico, fora). */
function isMundaneTool(i) {
  if (!i.type || !TOOL_TYPES.includes(i.type.split('|')[0])) return false;
  return !i.rarity || i.rarity === 'none' || i.rarity === 'unknown';
}

const toolEntity = {
  type: 'tool',
  title: 'Tool',

  list: (db) =>
    dedupeByName(
      latestOnly([
        ...(db?.['items-base']?.baseitem ?? []),
        ...(db?.items?.item ?? []),
      ]).filter(isMundaneTool),
    ),

  idOf: (i) => i.name,

  precompute: (i) => ({
    searchText: i.name.toLowerCase(),
    filterValues: { category: [toolCat(i)] },
  }),

  filters: [{ id: 'category', header: 'Category', derive: true }],

  card: (i) => ({
    title: i.name,
    subtitle: toolCat(i),
    badges: [],
  }),
};

export default toolEntity;
