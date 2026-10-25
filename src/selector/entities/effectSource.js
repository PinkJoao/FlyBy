// =============================================================================
// effectSource: a entity do causador de um efeito (o "Add effect" do jogo)
// =============================================================================
// O QUE FAZ
//   Para o card de efeitos do play mode (DDL-0121): o jogador procura o que causou
//   o efeito (uma magia, uma feature, um talento, uma opção de feature, um item),
//   sobretudo o que OUTRO jogador lançou nele. A lista é a do glossário
//   (glossaryIndex) nessas categorias, e a prévia é a mesma do glossário. A
//   ordem padrão põe primeiro o que tem efeito CURADO, depois o resto por tipo;
//   as outras são o nome, o tipo e o círculo da magia.
//
// FUNÇÕES
//   isAutomatic(e): se a entrada tem efeito curado (entra sozinha ao escolher).
//
// DECISÕES E ARMADILHAS
//   - O índice do glossário já junta tudo isso com a edição 2024 na frente e é
//     memoizado por db; aqui só se filtra e se delega a prévia (a entity de cada
//     entrada, ou o texto da regra para as features de classe).
//   - O badge "Automatic" marca o que tem efeito CURADO (playEffects.sourceModifier):
//     escolhido, ele entra sozinho; o resto abre o painel do efeito próprio com o
//     nome e a duração já preenchidos.
//   - A lista filtrada é guardada por db (LIST_CACHE), como a das condições.
//   - "Automatic first" é a `naturalSort`: o curado no topo e o que abre o efeito
//     próprio depois, este por tipo (magia, feature, talento e, no fim, os mais
//     de 6000 itens, que sozinhos afogariam o resto pelo nome). O badge e a ordem
//     leem o mesmo isAutomatic, para nunca discordarem. "Type" segue a ordem de CATEGORIES (a
//     magia é o causador mais comum); "Spell level" deixa o que não é magia no fim.
// -----------------------------------------------------------------------------

import { glossaryIndexFor } from '../../components/common/glossaryIndex';
import { sourceModifier } from '../../engine/playEffects';

const CATEGORIES = ['Spell', 'Class Feature', 'Subclass Feature', 'Feature Option', 'Feat', 'Item'];

const CATEGORY_SET = new Set(CATEGORIES);

/** Se a entrada tem efeito curado: escolhida, entra sozinha. */
export function isAutomatic(e) {
  return e.categoryLabel === 'Spell' && !!sourceModifier(e.name);
}

const LIST_CACHE = new WeakMap();

const effectSourceEntity = {
  type: 'effectSource',
  title: 'Effect source',

  list: (db) => {
    if (!db) return [];
    if (!LIST_CACHE.has(db)) {
      LIST_CACHE.set(db, glossaryIndexFor(db).entries.filter((e) => CATEGORY_SET.has(e.categoryLabel)));
    }
    return LIST_CACHE.get(db);
  },

  naturalSort: {
    value: 'automatic',
    label: 'Automatic first',
    defaultDir: 'asc',
    dirLabels: ['Automatic first', 'Custom first'],
    keyOf: (e) => (isAutomatic(e) ? -1 : CATEGORIES.indexOf(e.categoryLabel)),
  },

  sorts: [
    { value: 'type', label: 'Type', defaultDir: 'asc', dirLabels: ['Spells first', 'Items first'], keyOf: (e) => CATEGORIES.indexOf(e.categoryLabel) },
    { value: 'level', label: 'Spell level', defaultDir: 'asc', keyOf: (e) => (e.categoryLabel === 'Spell' ? (e.raw?.level ?? null) : null) },
  ],

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
    badges: [e.categoryLabel, ...(isAutomatic(e) ? ['Automatic'] : [])],
  }),
};

export default effectSourceEntity;
