// =============================================================================
// glossaryIndex - índice ÚNICO e navegável de tudo que o app sabe explicar
// =============================================================================
// O glossário navegável (GlossaryOverlay) mostra, num só lugar pesquisável,
// TUDO que já vira link inline no texto (DDL-0020/0025): as regras do glossário
// (condições, ações, sentidos, perícias, propriedades/maestrias de arma…) E as
// entidades (magias, itens - incluindo as variantes geradas -, talentos, opções
// de recurso, espécies, classes, idiomas, backgrounds) + as features de classe
// e subclasse. Cada entrada carrega o que é preciso para abrir o MESMO preview
// que o link abriria: `entity`+`raw` → showDetailPopup; `ruleEntry` → showRulePopup.
//
// Reaproveita a config de tipos do entityLinks (fonte única de "o que é
// linkável") e o índice de regras do engine/glossary. Memoizado por db (WeakMap):
// o índice varre milhares de itens uma vez por sessão.
// -----------------------------------------------------------------------------

import { CLASS_NAMES } from '../../data/config';
import { glossaryEntries, glossaryTables, ruleCategoryLabel, ruleFilterCategories } from '../../engine/glossary';
import { classFeatureLevels } from '../../engine/classProgression';
import classEntity from '../../selector/entities/class';
import { makeSubclassEntity } from '../../selector/entities/subclass';
import { SIMPLE_TAGS } from './entityLinks';

const norm = (s) => String(s ?? '').toLowerCase();
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Ordenação CUSTOMIZADA dos ITENS do painel (não dos filtros - estes são
// alfabéticos, ver buildIndex). Em faixas, priorizando regras (pedido do
// usuário - DDL-0027):
//   0. Regras CORE.
//   1. Glossário de jogo (condição/status/doença/ação/perícia/sentido), em
//      ordem alfabética por NOME, SEM agrupar por categoria.
//   2. Tabelas das regras gratuitas (SRD 5.2) - mais relevantes que regras não
//      core, menos que o glossário de jogo (pedido do usuário).
//   3. Demais regras (variante/opcional/variante-opcional/genérica), agrupadas
//      por subcategoria nessa ordem.
//   4. Restante (entidades + propriedades/maestrias de arma), alfabético por
//      NOME, SEM agrupar por categoria.
const TIER_GAME_GLOSSARY = new Set(['Condition', 'Status', 'Disease', 'Action', 'Skill', 'Sense']);
const TIER_OTHER_RULES = ['Variant Rule', 'Optional Rule', 'Variant Optional Rule', 'Rule'];

function itemTier(label) {
  if (label === 'Core Rule') return 0;
  if (TIER_GAME_GLOSSARY.has(label)) return 1;
  if (label === 'Table') return 2;
  if (TIER_OTHER_RULES.includes(label)) return 3;
  return 4;
}

/** Classe NO GLOSSÁRIO: além do texto de info (entity do seletor), o corpo traz
 * a PROGRESSÃO completa (features de classe por nível, como o preview do
 * seletor de subclasse faz). No seletor de classe isso seria ruído para o
 * novato; num glossário é exatamente o que se veio procurar. */
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
    // variantrules se desdobram pelo ruleType (Core/Optional/Variant/Variant
    // Optional Rule) - a mesma categoria vira o badge do RulePopup.
    categoryLabel: ruleCategoryLabel(e),
    // Filtros: uma regra "Variant Optional" cai em Variant E Optional, e toda
    // regra cai em "Rule" (ver ruleFilterCategories).
    filterCategories: ruleFilterCategories(e),
    name: e.name,
    source: e.source,
    subtitle: e.source,
    searchText: `${norm(e.name)} ${norm(e.source)}`,
    kind: 'rule',
    ruleEntry: e,
  }));
}

// Tabelas das regras gratuitas (SRD 5.2). Como as regras, abrem no showRulePopup
// (kind:'rule'), mas o corpo (ruleEntry.entries) é a própria tabela → renderTable.
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
    // `glossaryList` quando o índice de LINKS é mais permissivo que o catálogo
    // do app (ver SIMPLE_TAGS): o glossário lista só as versões atuais.
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
        // Background não tem entity de seletor: abre no popup de regra.
        // Classe troca para a entity de glossário (info + progressão completa).
        ...(cfg.rule
          ? { kind: 'rule', ruleEntry: { type: cfg.rule, name: raw.name, source: raw.source, entries: raw.entries } }
          : { kind: 'entity', entity: cfg.label === 'Class' ? glossaryClassEntity : cfg.entity, raw }),
      });
    }
  }
  return out;
}

// Subclasses: vivem no arquivo da própria classe; reusa a MESMA entity do
// seletor de subclasse (lista dedupada + preview com todas as features), uma
// por classe. Já temos classes, class features e subclass features no índice -
// a subclasse em si não podia faltar.
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

/** Edição mais nova (2024) ganha da clássica. As features de classe NÃO carregam
 * `reprintedAs` (então latestOnly não as colapsa): uma mesma feature existe em
 * PHB e XPHB, e queremos só a atual, como o resto do app (classes 2024). */
function preferNewer(a, b) {
  const rank = (s) => (norm(s) === 'xphb' || norm(s) === 'xdmg' ? 2 : norm(s) === 'phb' || norm(s) === 'dmg' ? 1 : 0);
  return rank(b.source) > rank(a.source) ? b : a;
}

// Features de classe/subclasse: não têm lista plana pré-montada (o link resolve
// por gramática), então varremos os arquivos de cada classe. Colapsa por
// nome+classe+subclasse (uma feature em vários níveis/edições aparece uma vez,
// preferindo a edição 2024).
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
  // ITENS do painel: ordenação customizada em faixas (regras primeiro; ver
  // itemTier). Faixas 1 e 3 são alfabéticas por nome SEM agrupar por categoria;
  // a faixa 2 (demais regras) agrupa por subcategoria e depois pelo nome.
  all.sort((a, b) => {
    const ta = itemTier(a.categoryLabel);
    const tb = itemTier(b.categoryLabel);
    if (ta !== tb) return ta - tb;
    if (ta === 3 && a.categoryLabel !== b.categoryLabel) {
      return TIER_OTHER_RULES.indexOf(a.categoryLabel) - TIER_OTHER_RULES.indexOf(b.categoryLabel);
    }
    return a.name.localeCompare(b.name);
  });
  // FILTROS de categoria: alfabéticos (mais intuitivos que a ordem dos itens),
  // e vindos das filterCategories - então "Rule"/"Core/Variant/Optional Rule"
  // aparecem, mas NÃO "Variant Optional Rule" (ver ruleFilterCategories).
  const categories = [...new Set(all.flatMap((e) => e.filterCategories))].sort((a, b) =>
    a.localeCompare(b),
  );
  return { entries: all, categories };
}

const cache = new WeakMap();

/** Índice memoizado por db: `{ entries, categories }`. */
export function glossaryIndexFor(db) {
  if (!db || typeof db !== 'object') return { entries: [], categories: [] };
  let idx = cache.get(db);
  if (!idx) {
    idx = buildIndex(db);
    cache.set(db, idx);
  }
  return idx;
}
