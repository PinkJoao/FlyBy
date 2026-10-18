// =============================================================================
// tool: a entity de ferramenta (ferramentas, instrumentos, kits de jogo)
// =============================================================================
// O QUE FAZ
//   items-base e items.json filtrados pelos tipos de ferramenta, só MUNDANOS
//   (raridade real é item mágico). Dedup por nome (prefere XPHB); filtro pela
//   categoria do prefixo do tipo (AT, INS, GS, T).
//
// FUNÇÕES
//   toolCat(item): a categoria.
//   isMundaneTool(i): é ferramenta e mundana?
//
// DECISÕES E ARMADILHAS
//   - items-base NÃO tem todas: os gaming sets e vários kits (Thieves' Tools,
//     Disguise Kit, Herbalism Kit) vivem só em items.json. Sem fundir os dois, essas
//     escolhas ficavam SEM opções (achado no sweep do TC-0012).
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

/** Item de tipo ferramenta e mundano? */
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
