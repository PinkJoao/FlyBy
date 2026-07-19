// =============================================================================
// entityLinks - resolução das tags de ENTIDADE ({@spell}, {@item}, {@feat}…)
// =============================================================================
// Extensão v2 do glossário de regras (DDL-0020 → DDL-0025): menções a magias,
// itens, talentos, optional features, espécies, classes, idiomas, backgrounds e
// features de classe/subclasse dentro de qualquer texto renderizado viram links
// que abrem o preview EXISTENTE da entidade (DetailView via showDetailPopup) ou,
// para os tipos sem entity própria (background, classFeature, subclassFeature),
// o popup de regra (showRulePopup). Resolve apenas contra o que o db já tem -
// sem match, o link degrada para o texto inerte (nunca um link morto).
//
// Puro (sem JSX): o componente EntityLink vive em EntryContent.jsx, que chama
// `lookupEntityLink`. Índice memoizado por db (WeakMap), como engine/glossary.
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

// Entities de popup genéricas (sem ctx de personagem: pré-requisitos aparecem
// sem coloração de status, como nos seletores abertos "a seco").
const featPopupEntity = makeFeatEntity(['G'], 'Feat');
const optFeaturePopupEntity = makeOptionalFeatureEntity([], 'Feature Option');

/** Um itemGroup ("Arcane Focus", "Ioun Stone"…) citado por {@item} vira um
 * popup listando os itens-membro como links {@item} aninhados (o grupo em si
 * não tem entries). Cópia rasa só para o índice de links - a loja não o vê. */
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

/** Tags simples (gramática Name|Source|Display). `entity` → DetailView popup;
 * `rule` → popup de regra (tipos sem entity de seletor própria); `label` é o
 * rótulo de categoria (usado pelo glossário navegável - glossaryIndex.js). Para
 * os LINKS o catálogo de itens não filtra `age` (a prosa pode citar armas de
 * fogo). Os itemGroups entram por ÚLTIMO: um item real de mesmo nome vence.
 *
 * `glossaryList` (opcional) é a lista que o glossário NAVEGÁVEL usa no lugar de
 * `list`: o índice de LINKS é deliberadamente permissivo (prosa legada cita
 * `{@race Aarakocra|DMG}` e o link não pode morrer), mas o glossário deve
 * mostrar exatamente o que o resto do app oferece - só as versões atuais. */
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
    // No glossário, a MESMA lista do seletor de espécies: fora as "NPC Species"
    // (as versões DMG de Aarakocra/Goblin/Kenku/Kobold/Lizardfolk… não trazem
    // `reprintedAs`, então o latestOnly sozinho as deixava passar e a espécie
    // aparecia duas vezes).
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

/** A tag abre link de entidade? (as demais tags de referência ficam inertes). */
export function isEntityTag(tag) {
  return tag in SIMPLE_TAGS || tag === 'classFeature' || tag === 'subclassFeature';
}

/**
 * Texto exibido de uma tag de entidade (também usado pelo fallback inerte).
 * classFeature/subclassFeature têm gramática própria (o display fica depois de
 * classe/subclasse/nível); as demais seguem Name|Source|Display.
 */
export function entityTagDisplay(tag, content) {
  const parts = String(content ?? '').split('|');
  if (tag === 'classFeature') return (parts[5] ?? '').trim() || parts[0];
  if (tag === 'subclassFeature') return (parts[7] ?? '').trim() || parts[0];
  return parseTagContent(content).display;
}

/** Preferência de fonte: match exato > 2024 (XPHB/XDMG) > clássico > primeira. */
function pickBySource(candidates, source) {
  if (!candidates?.length) return null;
  const bySrc = (s) => candidates.find((c) => c.source?.toLowerCase() === s);
  if (source) {
    const exact = bySrc(source.toLowerCase());
    if (exact) return exact;
  }
  return bySrc('xphb') ?? bySrc('xdmg') ?? bySrc('phb') ?? bySrc('dmg') ?? candidates[0];
}

// --- Índice por db ------------------------------------------------------------
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

// --- Features de classe/subclasse ----------------------------------------------
// {@classFeature Name|Class|ClassSource|Level|FeatureSource|Display}
// {@subclassFeature Name|Class|ClassSource|ScShortName|ScSource|Level|FeatureSource|Display}
// O pool vem do arquivo da própria classe no db (class-fighter.classFeature…).
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

/**
 * Resolve uma tag de entidade para o alvo do link, ou null (sem match → o
 * chamador degrada para o span inerte).
 * @returns {{ kind:'entity', entity, raw, display } |
 *           { kind:'rule', entry:{type,name,source,entries}, display } | null}
 */
export function lookupEntityLink(db, tag, content) {
  if (!db) return null;
  if (tag === 'classFeature') return lookupClassFeature(db, content);
  if (tag === 'subclassFeature') return lookupSubclassFeature(db, content);
  const cfg = SIMPLE_TAGS[tag];
  if (!cfg) return null;
  const { name, source, display } = parseTagContent(content);
  if (!name) return null;
  const idx = indexFor(db);
  let candidates = idx.get(`${tag}:${name.toLowerCase()}`);
  // Espécie citada com linhagem embutida ("gnome (rock)", "elf (high)") → cai
  // na raça base; o popup mostra a espécie inteira, que contém a linhagem.
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
