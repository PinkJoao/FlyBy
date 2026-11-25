// =============================================================================
// glossaryIndex: o índice único e navegável de tudo que o app sabe explicar
// =============================================================================
// O QUE FAZ
//   O GlossaryOverlay mostra num só lugar TUDO que vira link no texto: as regras
//   (condições, ações, sentidos, perícias, propriedades e maestrias de arma), as
//   tabelas do SRD 5.2, as entidades (incluindo as variantes geradas) e as
//   features de classe e subclasse. Cada entrada leva o necessário para abrir o
//   MESMO preview do link. Reusa a config de tipos do entityLinks (a fonte única
//   do que é linkável) e o índice de regras do engine/glossary. Memoizado por db.
//
// FUNÇÕES
//   norm(s), cap(s): texto.
//   itemTier(label): a faixa de ordenação de um item.
//   ruleEntries(db), tableEntries(db), entityEntries(db), subclassEntries(db),
//     featureEntries(db): as fontes.
//   preferNewer(a, b): a edição 2024 vence.
//   buildIndex(db), glossaryIndexFor(db): { entries, categories }.
//
// DECISÕES E ARMADILHAS
//   - Ordem dos ITENS em faixas (pedido do usuário, DDL-0027): 0 regras core; 1 o
//     glossário de jogo (condição, status, doença, ação, perícia, sentido),
//     alfabético sem agrupar; 2 as tabelas do SRD 5.2; 3 as demais regras,
//     agrupadas por subcategoria; 4 o resto, alfabético. Os FILTROS são
//     alfabéticos e vêm das filterCategories (sem "Variant Optional Rule").
//   - Classe no glossário traz a PROGRESSÃO completa (glossaryClassEntity): no
//     seletor seria ruído, aqui é o que se veio procurar.
//   - Background abre no popup de regra. A subclasse usa a entity do seletor.
//   - Features não carregam reprintedAs (PHB e XPHB coexistem): colapsam por nome,
//     classe e subclasse, preferindo 2024.
// -----------------------------------------------------------------------------

import { CLASS_NAMES } from '../../data/config';
import { glossaryEntries, glossaryTables, ruleCategoryLabel, ruleFilterCategories } from '../../engine/glossary';
import { classFeatureLevels } from '../../engine/classProgression';
import classEntity from '../../selector/entities/class';
import { makeSubclassEntity } from '../../selector/entities/subclass';
import { SIMPLE_TAGS } from './entityLinks';

const norm = (s) => String(s ?? '').toLowerCase();
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const TIER_GAME_GLOSSARY = new Set(['Condition', 'Status', 'Disease', 'Action', 'Skill', 'Sense']);
const TIER_OTHER_RULES = ['Variant Rule', 'Optional Rule', 'Variant Optional Rule', 'Rule'];

function itemTier(label) {
  if (label === 'Core Rule') return 0;
  if (TIER_GAME_GLOSSARY.has(label)) return 1;
  if (label === 'Table') return 2;
  if (TIER_OTHER_RULES.includes(label)) return 3;
  return 4;
}

const glossaryClassEntity = {
  ...classEntity,
  entries: (c, db) => [
    ...(classEntity.entries(c, db) ?? []),
    ...classFeatureLevels(db, norm(c.name), c).flatMap((lv) =>
      lv.features.map((f) => ({ type: 'entries', name: `Level ${lv.level}: ${f.name}`, entries: f.entries })),
    ),
  ],
};

function ruleEntries(db) {
  return glossaryEntries(db).map((e) => ({
    id: `rule:${e.type}:${norm(e.name)}|${norm(e.source)}`,
    category: e.type,
    categoryLabel: ruleCategoryLabel(e),
    filterCategories: ruleFilterCategories(e),
    name: e.name,
    source: e.source,
    subtitle: e.source,
    searchText: `${norm(e.name)} ${norm(e.source)}`,
    kind: 'rule',
    ruleEntry: e,
  }));
}

function tableEntries(db) {
  return glossaryTables(db).map((e) => ({
    id: `table:${norm(e.name)}|${norm(e.source)}`,
    category: 'table',
    categoryLabel: 'Table',
    filterCategories: ['Table'],
    name: e.name,
    source: e.source,
    subtitle: e.source,
    searchText: `${norm(e.name)} ${norm(e.source)}`,
    kind: 'rule',
    ruleEntry: e,
  }));
}

function entityEntries(db) {
  const out = [];
  for (const cfg of Object.values(SIMPLE_TAGS)) {
    for (const raw of (cfg.glossaryList ?? cfg.list)(db)) {
      if (!raw?.name) continue;
      out.push({
        id: `${cfg.label}:${norm(raw.name)}|${norm(raw.source)}`,
        category: cfg.label,
        categoryLabel: cfg.label,
        filterCategories: [cfg.label],
        name: raw.name,
        source: raw.source ?? '',
        subtitle: raw.source ?? '',
        searchText: `${norm(raw.name)} ${norm(raw.source)}`,
        ...(cfg.rule
          ? { kind: 'rule', ruleEntry: { type: cfg.rule, name: raw.name, source: raw.source, entries: raw.entries } }
          : { kind: 'entity', entity: cfg.label === 'Class' ? glossaryClassEntity : cfg.entity, raw }),
      });
    }
  }
  return out;
}

function subclassEntries(db) {
  const out = [];
  for (const cn of CLASS_NAMES) {
    if (!db[`class-${cn}`]) continue;
    const ent = makeSubclassEntity(cn, 'Subclass');
    for (const s of ent.list(db)) {
      if (!s?.name) continue;
      const className = s.className ?? cap(cn);
      out.push({
        id: `subclass:${cn}:${norm(s.shortName ?? s.name)}|${norm(s.source)}`,
        category: 'Subclass',
        categoryLabel: 'Subclass',
        filterCategories: ['Subclass'],
        name: s.name,
        source: s.source ?? '',
        subtitle: className,
        searchText: `${norm(s.name)} ${norm(s.shortName)} ${norm(className)} ${norm(s.source)}`,
        kind: 'entity',
        entity: ent,
        raw: s,
      });
    }
  }
  return out;
}

/** A edição mais nova (2024) vence. */
function preferNewer(a, b) {
  const rank = (s) => (norm(s) === 'xphb' || norm(s) === 'xdmg' ? 2 : norm(s) === 'phb' || norm(s) === 'dmg' ? 1 : 0);
  return rank(b.source) > rank(a.source) ? b : a;
}

function featureEntries(db) {
  const byKey = new Map();
  for (const cn of CLASS_NAMES) {
    const file = db[`class-${cn}`];
    if (!file) continue;
    for (const [prop, label, type] of [
      ['classFeature', 'Class Feature', 'classFeature'],
      ['subclassFeature', 'Subclass Feature', 'subclassFeature'],
    ]) {
      for (const f of file[prop] ?? []) {
        if (!f?.name || !f.entries?.length) continue;
        const key = `${type}:${norm(f.name)}:${norm(f.className)}:${norm(f.subclassShortName)}`;
        const prev = byKey.get(key);
        const chosen = prev ? preferNewer(prev, f) : f;
        byKey.set(key, { ...chosen, __label: label, __type: type });
      }
    }
  }
  const out = [];
  for (const [key, f] of byKey) {
    const sub = f.subclassShortName ? ` (${f.subclassShortName})` : '';
    out.push({
      id: key,
      category: f.__type,
      categoryLabel: f.__label,
      filterCategories: [f.__label],
      name: f.name,
      source: f.source ?? '',
      subtitle: `${f.className ?? ''}${sub}`.trim() || f.source,
      searchText: `${norm(f.name)} ${norm(f.className)} ${norm(f.subclassShortName)} ${norm(f.source)}`,
      kind: 'rule',
      ruleEntry: { type: f.__type, name: f.name, source: f.source, entries: f.entries },
    });
  }
  return out;
}

function buildIndex(db) {
  const all = [...entityEntries(db), ...subclassEntries(db), ...featureEntries(db), ...tableEntries(db), ...ruleEntries(db)];
  all.sort((a, b) => {
    const ta = itemTier(a.categoryLabel);
    const tb = itemTier(b.categoryLabel);
    if (ta !== tb) return ta - tb;
    if (ta === 3 && a.categoryLabel !== b.categoryLabel) {
      return TIER_OTHER_RULES.indexOf(a.categoryLabel) - TIER_OTHER_RULES.indexOf(b.categoryLabel);
    }
    return a.name.localeCompare(b.name);
  });
  const categories = [...new Set(all.flatMap((e) => e.filterCategories))].sort((a, b) =>
    a.localeCompare(b),
  );
  return { entries: all, categories };
}

const cache = new WeakMap();

/** O índice memoizado por db. */
export function glossaryIndexFor(db) {
  if (!db || typeof db !== 'object') return { entries: [], categories: [] };
  let idx = cache.get(db);
  if (!idx) {
    idx = buildIndex(db);
    cache.set(db, idx);
  }
  return idx;
}
