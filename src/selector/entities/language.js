// =============================================================================
// Entity config: Language
// =============================================================================
// Os dados trazem MUITAS duplicatas (mesmo idioma em várias fontes). Dedup por
// nome, preferindo XPHB (2024). Filtro por tipo (standard/exotic/rare).
// -----------------------------------------------------------------------------

import { latestOnly, dedupeByName } from '../reprints';

const languageEntity = {
  type: 'language',
  title: 'Language',

  list: (db) => dedupeByName(latestOnly(db?.languages?.language ?? [])),

  idOf: (l) => l.name,

  precompute: (l) => ({
    searchText: `${l.name} ${l.source}`.toLowerCase(),
    filterValues: { type: [l.type ?? 'standard'] },
  }),

  filters: [{ id: 'type', header: 'Type', derive: true }],

  card: (l) => ({
    title: l.name,
    subtitle: l.type ?? 'standard',
    badges: [],
  }),
};

export default languageEntity;
