// =============================================================================
// entityLinks: a resolução das tags de entidade
// =============================================================================
// O QUE FAZ
//   Extensão do glossário (DDL-0020, DDL-0025): menções a magias, itens, talentos,
//   optional features, espécies, classes, subclasses, idiomas, backgrounds e
//   features de classe e subclasse viram links que abrem o preview existente da
//   entidade (showDetailPopup) ou, para os tipos sem entity própria, o popup de
//   regra. Só resolve contra o que o db tem. Puro (o EntityLink vive no
//   EntryContent); índice memoizado por db.
//
// FUNÇÕES
//   groupAsItem(g): um itemGroup ("Arcane Focus") como popup que lista os
//     membros como links (cópia rasa, só para o índice).
//   isEntityTag(tag), entityTagDisplay(tag, content): a tag e o texto exibido.
//   pickBySource(candidates, source): fonte exata, depois 2024, depois clássica.
//   buildIndex(db), indexFor(db): o índice.
//   classPool(db, className, prop), lookupClassFeature(db, content),
//     lookupSubclassFeature(db, content), lookupSubclass(db, content): as
//     gramáticas próprias de feature e subclasse.
//   lookupEntityLink(db, tag, content): o alvo do link, ou null.
//
// DECISÕES E ARMADILHAS
//   - SIMPLE_TAGS é o "onde adicionar" de uma tag nova (§7): gramática
//     Name|Source|Display, `entity` ou `rule`, e o `label` do glossário.
//   - O índice de LINKS é permissivo de propósito (a prosa legada cita {@race
//     Aarakocra|DMG} e o link não pode morrer); `glossaryList` é o que o glossário
//     navegável mostra, só o atual. Nas espécies, a mesma lista do seletor, sem as
//     "NPC Species" (sem reprintedAs, o latestOnly as deixava passar duplicadas).
//   - Os links de item não filtram `age` (a prosa cita armas de fogo). Os
//     itemGroups entram por último: um item real de mesmo nome vence.
//   - {@classFeature Name|Class|ClassSource|Level|FeatureSource|Display},
//     {@subclassFeature ...|ScShortName|ScSource|Level|...} e {@subclass
//     ShortName|Class|ClassSource|Source|Display}, este pela fábrica
//     makeSubclassEntity, com `_copy` resolvido antes.
//   - Espécie citada com a linhagem ("gnome (rock)") cai na raça base.
//   - Os popups genéricos não têm ctx de personagem: pré-requisitos sem cor.
// -----------------------------------------------------------------------------

import { latestOnly, dedupeByName } from '../../selector/reprints';
import { resolveCopies } from '../../selector/copy';
import { CLASS_NAMES } from '../../data/config';
import { resolveClassObj } from '../../engine/resolve';
import { allSpells } from '../../engine/spells';
import { specificVariants } from '../../engine/magicVariants';
import { parseTagContent } from '../../engine/glossary';
import spellEntity from '../../selector/entities/spell';
import itemEntity from '../../selector/entities/item';
import raceEntity from '../../selector/entities/race';
import classEntity from '../../selector/entities/class';
import languageEntity from '../../selector/entities/language';
import { makeFeatEntity } from '../../selector/entities/feat';
import { makeOptionalFeatureEntity } from '../../selector/entities/optionalfeature';
import { makeSubclassEntity } from '../../selector/entities/subclass';

const featPopupEntity = makeFeatEntity(['G'], 'Feat');
const optFeaturePopupEntity = makeOptionalFeatureEntity([], 'Feature Option');

/** Um itemGroup como popup que lista os membros. */
function groupAsItem(g) {
  if (!g.items?.length) return g;
  return {
    ...g,
    entries: [
      ...(g.entries ?? []),
      'Multiple variations of this item exist, as listed below:',
      { type: 'list', items: g.items.map((uid) => `{@item ${uid}}`) },
    ],
  };
}

export const SIMPLE_TAGS = {
  spell: { label: 'Spell', list: (db) => allSpells(db), entity: spellEntity },
  item: {
    label: 'Item',
    list: (db) => [
      ...latestOnly(db?.['items-base']?.baseitem ?? []),
      ...latestOnly(db?.items?.item ?? []),
      ...specificVariants(db),
      ...latestOnly(db?.items?.itemGroup ?? []).map(groupAsItem),
    ],
    entity: itemEntity,
  },
  feat: { label: 'Feat', list: (db) => latestOnly(db?.feats?.feat ?? []), entity: featPopupEntity },
  optfeature: {
    label: 'Feature Option',
    list: (db) => latestOnly(db?.optionalfeatures?.optionalfeature ?? []),
    entity: optFeaturePopupEntity,
  },
  race: {
    label: 'Species',
    list: (db) => latestOnly(resolveCopies(db?.races?.race ?? [])),
    glossaryList: (db) => raceEntity.list(db),
    entity: raceEntity,
  },
  class: {
    label: 'Class',
    list: (db) => CLASS_NAMES.map((n) => resolveClassObj(db, n)).filter(Boolean),
    entity: classEntity,
  },
  language: {
    label: 'Language',
    list: (db) => dedupeByName(latestOnly(db?.languages?.language ?? [])),
    entity: languageEntity,
  },
  background: {
    label: 'Background',
    list: (db) => latestOnly(db?.backgrounds?.background ?? []),
    rule: 'background',
  },
};

/** A tag abre link de entidade? */
export function isEntityTag(tag) {
  return tag in SIMPLE_TAGS || tag === 'classFeature' || tag === 'subclassFeature' || tag === 'subclass';
}

/** O texto exibido de uma tag de entidade. */
export function entityTagDisplay(tag, content) {
  const parts = String(content ?? '').split('|');
  if (tag === 'classFeature') return (parts[5] ?? '').trim() || parts[0];
  if (tag === 'subclassFeature') return (parts[7] ?? '').trim() || parts[0];
  if (tag === 'subclass') return (parts[4] ?? '').trim() || parts[0];
  return parseTagContent(content).display;
}

/** A fonte preferida: exata, depois 2024, depois clássica. */
function pickBySource(candidates, source) {
  if (!candidates?.length) return null;
  const bySrc = (s) => candidates.find((c) => c.source?.toLowerCase() === s);
  if (source) {
    const exact = bySrc(source.toLowerCase());
    if (exact) return exact;
  }
  return bySrc('xphb') ?? bySrc('xdmg') ?? bySrc('phb') ?? bySrc('dmg') ?? candidates[0];
}

const cache = new WeakMap();

function buildIndex(db) {
  const map = new Map();
  for (const [tag, cfg] of Object.entries(SIMPLE_TAGS)) {
    for (const raw of cfg.list(db)) {
      if (!raw?.name) continue;
      const k = `${tag}:${raw.name.toLowerCase()}`;
      const list = map.get(k);
      if (list) list.push(raw);
      else map.set(k, [raw]);
    }
  }
  return map;
}

function indexFor(db) {
  if (!db || typeof db !== 'object') return null;
  let idx = cache.get(db);
  if (!idx) {
    idx = buildIndex(db);
    cache.set(db, idx);
  }
  return idx;
}

function classPool(db, className, prop) {
  return db?.[`class-${String(className ?? '').toLowerCase()}`]?.[prop] ?? [];
}

function lookupClassFeature(db, content) {
  const p = String(content ?? '').split('|').map((s) => s.trim());
  const [name, className, , level, featureSource] = p;
  if (!name) return null;
  const candidates = classPool(db, className, 'classFeature').filter(
    (f) =>
      f.name?.toLowerCase() === name.toLowerCase() &&
      (!level || String(f.level) === String(level)),
  );
  const raw = pickBySource(candidates, featureSource);
  if (!raw?.entries) return null;
  return {
    kind: 'rule',
    entry: { type: 'classFeature', name: raw.name, source: raw.source, entries: raw.entries },
    display: entityTagDisplay('classFeature', content),
  };
}

function lookupSubclassFeature(db, content) {
  const p = String(content ?? '').split('|').map((s) => s.trim());
  const [name, className, , scShortName, , level, featureSource] = p;
  if (!name) return null;
  const candidates = classPool(db, className, 'subclassFeature').filter(
    (f) =>
      f.name?.toLowerCase() === name.toLowerCase() &&
      (!scShortName || f.subclassShortName?.toLowerCase() === scShortName.toLowerCase()) &&
      (!level || String(f.level) === String(level)),
  );
  const raw = pickBySource(candidates, featureSource);
  if (!raw?.entries) return null;
  return {
    kind: 'rule',
    entry: { type: 'subclassFeature', name: raw.name, source: raw.source, entries: raw.entries },
    display: entityTagDisplay('subclassFeature', content),
  };
}

function lookupSubclass(db, content) {
  const p = String(content ?? '').split('|').map((s) => s.trim());
  const [shortName, className, , source] = p;
  if (!shortName || !className) return null;
  const classId = className.toLowerCase();
  const pool = db?.[`class-${classId}`]?.subclass;
  if (!pool?.length) return null;
  const idOf = (s) => `${s.shortName ?? s.name}|${s.source}|${s.classSource ?? ''}`;
  const want = shortName.toLowerCase();
  const candidates = resolveCopies(pool, idOf).filter(
    (s) => (s.shortName ?? s.name)?.toLowerCase() === want || s.name?.toLowerCase() === want,
  );
  const raw = pickBySource(candidates, source);
  if (!raw) return null;
  return {
    kind: 'entity',
    entity: makeSubclassEntity(classId, 'Subclass'),
    raw,
    display: entityTagDisplay('subclass', content),
  };
}

/**
 * O alvo de uma tag de entidade, ou null.
 * @returns {{ kind:'entity', entity, raw, display } |
 *   { kind:'rule', entry:{type,name,source,entries}, display } | null}
 */
export function lookupEntityLink(db, tag, content) {
  if (!db) return null;
  if (tag === 'classFeature') return lookupClassFeature(db, content);
  if (tag === 'subclassFeature') return lookupSubclassFeature(db, content);
  if (tag === 'subclass') return lookupSubclass(db, content);
  const cfg = SIMPLE_TAGS[tag];
  if (!cfg) return null;
  const { name, source, display } = parseTagContent(content);
  if (!name) return null;
  const idx = indexFor(db);
  let candidates = idx.get(`${tag}:${name.toLowerCase()}`);
  if (!candidates && tag === 'race') {
    const baseName = name.split(/[(,]/)[0].trim();
    candidates = idx.get(`race:${baseName.toLowerCase()}`);
  }
  const raw = pickBySource(candidates, source);
  if (!raw) return null;
  if (cfg.rule) {
    if (!raw.entries?.length) return null;
    return {
      kind: 'rule',
      entry: { type: cfg.rule, name: raw.name, source: raw.source, entries: raw.entries },
      display,
    };
  }
  return { kind: 'entity', entity: cfg.entity, raw, display };
}
