// =============================================================================
// effectSource: a entity do causador de um efeito (o "Add effect" do jogo)
// =============================================================================
// O QUE FAZ
//   Para o card de efeitos do play mode (DDL-0121): o jogador procura o que causou
//   o efeito (uma magia, uma feature, um talento, uma opção de feature, um item),
//   sobretudo o que OUTRO jogador lançou nele. A lista é a do glossário
//   (glossaryIndex) nessas categorias, e a prévia é a mesma do glossário.
//
// FUNÇÕES
//   (nenhuma de topo: a entity é um objeto)
//
// DECISÕES E ARMADILHAS
//   - O índice do glossário já junta tudo isso com a edição 2024 na frente e é
//     memoizado por db; aqui só se filtra e se delega a prévia (a entity de cada
//     entrada, ou o texto da regra para as features de classe).
//   - O badge "Automatic" marca o que tem efeito CURADO (playEffects.sourceModifier):
//     escolhido, ele entra sozinho; o resto abre o painel do efeito próprio com o
//     nome e a duração já preenchidos.
//   - A lista filtrada é guardada por db (LIST_CACHE), como a das condições.
// -----------------------------------------------------------------------------

import { glossaryIndexFor } from '../../components/common/glossaryIndex';
import { sourceModifier } from '../../engine/playEffects';

const CATEGORIES = new Set(['Spell', 'Class Feature', 'Subclass Feature', 'Feat', 'Feature Option', 'Item']);

const LIST_CACHE = new WeakMap();

const effectSourceEntity = {
  type: 'effectSource',
  title: 'Effect source',

  list: (db) => {
    if (!db) return [];
    if (!LIST_CACHE.has(db)) {
      LIST_CACHE.set(db, glossaryIndexFor(db).entries.filter((e) => CATEGORIES.has(e.categoryLabel)));
    }
    return LIST_CACHE.get(db);
  },

  idOf: (e) => e.id,

  precompute: (e) => ({
    searchText: e.searchText,
    filterValues: { category: [e.categoryLabel], source: e.source ? [e.source] : [] },
  }),

  filters: [
    { id: 'category', header: 'Type', derive: true },
    { id: 'source', header: 'Source', derive: true },
  ],

  meta: (e, db) => (e.kind === 'entity' ? (e.entity.meta?.(e.raw, db) ?? []) : []),

  entries: (e, db) => (e.kind === 'entity' ? (e.entity.entries?.(e.raw, db) ?? e.raw.entries) : e.ruleEntry?.entries),

  fluff: (e, db) => (e.kind === 'entity' ? (e.entity.fluff?.(e.raw, db) ?? null) : null),

  card: (e) => ({
    title: e.name,
    subtitle: e.subtitle || e.source,
    badges: [e.categoryLabel, ...(e.categoryLabel === 'Spell' && sourceModifier(e.name) ? ['Automatic'] : [])],
  }),
};

export default effectSourceEntity;
