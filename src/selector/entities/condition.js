// =============================================================================
// condition: a entity das condições, status e doenças (o "Add condition" do jogo)
// =============================================================================
// O QUE FAZ
//   Lista as condições (Poisoned, Prone...), os status (Concentration, Surprised,
//   Bloodied) e as doenças (Sewer Plague...) do `conditionsdiseases.json`, na
//   edição mais nova, para o painel seletor do card de condições do play mode
//   (DDL-0121). Filtro por tipo e por fonte; a prévia é o texto da regra.
//
// FUNÇÕES
//   (nenhuma de topo: a entity é um objeto)
//
// DECISÕES E ARMADILHAS
//   - O tipo vai num campo próprio (`__kind`) da cópia da entrada: as três listas
//     do arquivo não dizem o tipo em cada item.
//   - A lista é calculada uma vez por db (KIND_CACHE): o seletor chama `list` a
//     cada render, e cópias novas a cada vez quebrariam o cache dos cards.
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';

const KINDS = [
  ['condition', 'Condition'],
  ['status', 'Status'],
  ['disease', 'Disease'],
];

const KIND_CACHE = new WeakMap();

const conditionEntity = {
  type: 'condition',
  title: 'Condition',

  list: (db) => {
    if (!db) return [];
    if (!KIND_CACHE.has(db)) {
      KIND_CACHE.set(db, KINDS.flatMap(([key, label]) =>
        latestOnly(db.conditionsdiseases?.[key] ?? []).map((c) => ({ ...c, __kind: label }))));
    }
    return KIND_CACHE.get(db);
  },

  idOf: (c) => `${c.__kind}:${c.name}|${c.source}`,

  precompute: (c) => ({
    searchText: `${c.name} ${c.__kind} ${c.source}`.toLowerCase(),
    filterValues: { kind: [c.__kind], source: [c.source].filter(Boolean) },
  }),

  filters: [
    { id: 'kind', header: 'Type', derive: true },
    { id: 'source', header: 'Source', derive: true },
  ],

  meta: (c) => [{ label: 'Type', value: c.__kind }],

  card: (c) => ({
    title: c.name,
    subtitle: c.source,
    badges: [c.__kind],
  }),
};

export default conditionEntity;
