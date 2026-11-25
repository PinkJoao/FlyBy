// =============================================================================
// spellSources: a quais listas uma magia pertence
// =============================================================================
// O QUE FAZ
//   O bloco que o 5e.tools imprime no pé da magia ("Classes / Subclasses /
//   Species / Feats"), derivado aqui (DDL-0089). Duas origens de naturezas
//   diferentes:
//     1. db['spell-sources'], o mapa reverso OFICIAL magia para classe: a
//        autoridade sobre a LISTA de classe.
//     2. O `additionalSpells` das demais entidades (subclasse, espécie, sub-raça,
//        linhagem, talento, background, optional feature), varrido como o 5etools
//        faz, com índice memoizado por db.
//   Cada entrada vira uma TAG {@...}, e o EntryContent já a transforma em link.
//
// FUNÇÕES
//   emptyResult(): o resultado vazio.
//   walkAdditionalSpells(additionalSpells, push): cada folha, com a natureza.
//   flattenAdditionalSpells(additionalSpells, concreteOnly): nomes e filtros.
//   entryKey(entry), preferNewer(a, b), indexEntity(idx, entry,
//     additionalSpells, concreteOnly): o índice.
//   allSubclasses(db), allSpecies(db): as entidades varridas.
//   lineageLabel(name): "Elf; Drow Lineage" vira "Elf (Drow Lineage)".
//   buildIndex(db), spellSourceIndex(db): o índice inverso (memoizado).
//   reverseMapEntry(db, spell): as entradas do mapa reverso de uma magia.
//   dedupe(list): colapsa por identidade.
//   spellSources(db, spell): as listas de uma magia.
//   entryTag(e), spellSourceEntries(db, spell): o bloco pronto, com tags.
//
// DECISÕES E ARMADILHAS
//   - A NATUREZA da entrada é dita (DDL-0054): `granted` (buckets known,
//     prepared, innate com nome concreto: o Drow ganha Faerie Fire) ou
//     `available` (bucket `expanded`, ou folha `{choose}`/`{all}`: Magic Initiate
//     alcança todo truque de mago, e dizer que concede Fire Bolt seria mentira).
//     Sem a marca `*`, as escolhas abertas afogariam as concessões; o 5etools
//     resolveu PODANDO, aqui a informação fica.
//   - A ÚNICA poda: as folhas de FILTRO das `additionalSpells` de CLASSE (o Magical
//     Secrets alcança metade do catálogo, e a linha Classes já vem exata do mapa).
//     Os nomes concretos de classe ficam: é assim que o Druida 2024 aparece em
//     Find Familiar. Se a classe já tem a magia na lista, a concessão é redundante.
//   - `granted` vence quando a mesma entidade concede E amplia. Lista fechada
//     (`{choose:{from}}`) é escolha. Expressão VAZIA alcança tudo: ruído, fora.
//   - Subclasses com `_copy` resolvido (a compat herda o `additionalSpells`).
//   - Espécies: a mesma lista do índice de links (`_copy` resolvido, sem as
//     reimpressas). A base guarda a UNIÃO dos grupos e cada `_versions` traz o
//     seu, então com versões a base sai (senão "Elf" e "Elf (Drow Lineage)"
//     repetiriam a Faerie Fire). `additionalSpells: null` numa versão APAGA a
//     concessão (Kobold); a base fica quando nenhuma versão traz a sua.
//   - As ~120 expressões de filtro viram predicados UMA vez no índice.
//   - A espécie linka para a BASE (o preview mostra todas as linhagens), mas exibe
//     o nome da linhagem, que é quem concede.
// -----------------------------------------------------------------------------

import { latestOnly } from '../selector/reprints';
import { resolveCopies } from '../selector/copy';
import { CLASS_NAMES } from '../data/config';
import { parseSpellRef } from './grantedSpells';
import { spellChoosePredicate } from './spells';

const GRANT_BUCKETS = ['known', 'prepared', 'innate'];
const LIST_BUCKETS = ['expanded'];
const ALL_BUCKETS = [...GRANT_BUCKETS, ...LIST_BUCKETS];

export const SPELL_SOURCE_CATEGORIES = [
  { key: 'classes', label: 'Classes' },
  { key: 'classesVariant', label: 'Optional/Variant Classes' },
  { key: 'subclasses', label: 'Subclasses' },
  { key: 'races', label: 'Species' },
  { key: 'backgrounds', label: 'Backgrounds' },
  { key: 'feats', label: 'Feats' },
  { key: 'optionalfeatures', label: 'Other Options/Features' },
];

const emptyResult = () =>
  Object.fromEntries(SPELL_SOURCE_CATEGORIES.map((c) => [c.key, []]));

/**
 * Chama `push(leaf, nature)` para cada folha de um `additionalSpells`.
 * @param {object[]|null|undefined} additionalSpells
 * @param {(leaf: any, nature: 'granted'|'available') => void} push
 */
function walkAdditionalSpells(additionalSpells, push) {
  const descend = (value, nature) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      for (const leaf of value) push(leaf, nature);
      return;
    }
    if (typeof value !== 'object') return;
    for (const inner of Object.values(value)) descend(inner, nature);
  };
  for (const group of additionalSpells ?? []) {
    if (!group || typeof group !== 'object') continue;
    for (const bucket of ALL_BUCKETS) {
      if (group[bucket] == null) continue;
      descend(group[bucket], LIST_BUCKETS.includes(bucket) ? 'available' : 'granted');
    }
  }
}

/**
 * Um `additionalSpells` em nomes concretos e regras de filtro.
 * @param {object[]|null|undefined} additionalSpells
 * @param {boolean} concreteOnly
 * @returns {{ names: Map<string,'granted'|'available'>, filters: Array<{expr:string}> }}
 */
function flattenAdditionalSpells(additionalSpells, concreteOnly = false) {
  const names = new Map();
  const filters = [];
  const addName = (raw, nature) => {
    const ref = parseSpellRef(raw);
    if (!ref) return;
    const key = ref.name.toLowerCase();
    if (nature === 'granted' || !names.has(key)) names.set(key, nature);
  };
  walkAdditionalSpells(additionalSpells, (leaf, nature) => {
    if (typeof leaf === 'string') return addName(leaf, nature);
    if (!leaf || typeof leaf !== 'object') return;
    if (Array.isArray(leaf.choose?.from)) {
      for (const uid of leaf.choose.from) addName(uid, 'available');
      return;
    }
    if (concreteOnly) return;
    const expr = typeof leaf.choose === 'string' ? leaf.choose
      : typeof leaf.all === 'string' ? leaf.all
        : null;
    if (expr) filters.push({ expr });
  });
  return { names, filters };
}

const cache = new WeakMap();

/** A chave de identidade de uma entrada. */
function entryKey(entry) {
  return entry.kind === 'subclass'
    ? `subclass:${entry.className}|${entry.shortName}`.toLowerCase()
    : `${entry.kind}:${entry.name}`.toLowerCase();
}

/** Entre duas entradas iguais, a edição mais nova. */
function preferNewer(a, b) {
  if (!a) return b;
  const rank = (e) => (e.source === 'XPHB' ? 2 : e.source === 'PHB' ? 0 : 1);
  if (rank(b) > rank(a)) return { ...b, nature: a.nature === 'granted' ? 'granted' : b.nature };
  if (a.nature !== 'granted' && b.nature === 'granted') return { ...a, nature: 'granted' };
  return a;
}

/** Registra uma entidade no índice com as magias que ela alcança. */
function indexEntity(idx, entry, additionalSpells, concreteOnly = false) {
  const { names, filters } = flattenAdditionalSpells(additionalSpells, concreteOnly);
  for (const [name, nature] of names) {
    const list = idx.byName.get(name) ?? [];
    list.push({ ...entry, nature });
    idx.byName.set(name, list);
  }
  for (const { expr } of filters) idx.broad.push({ entry, expr });
}

/** As subclasses de todas as classes, com `_copy` resolvido. */
function allSubclasses(db) {
  const out = [];
  for (const classId of CLASS_NAMES) {
    const file = db?.[`class-${classId}`];
    if (!file?.subclass) continue;
    const idOf = (s) => `${s.shortName ?? s.name}|${s.source}|${s.classSource ?? ''}`;
    for (const s of resolveCopies(file.subclass, idOf)) {
      if (!s?.additionalSpells) continue;
      out.push({
        kind: 'subclass',
        name: s.name,
        source: s.source,
        shortName: s.shortName ?? s.name,
        className: s.className ?? '',
        classSource: s.classSource ?? '',
        classId,
        additionalSpells: s.additionalSpells,
      });
    }
  }
  return out;
}

/** As linhagens e sub-raças com concessão de magia própria. */
function allSpecies(db) {
  const out = [];
  const races = latestOnly(resolveCopies(db?.races?.race ?? []));
  const liveNames = new Set(races.map((r) => r.name.toLowerCase()));
  for (const race of races) {
    const versions = (race._versions ?? []).filter((v) => v?.additionalSpells);
    if (race.additionalSpells && !versions.length) {
      out.push({ kind: 'race', name: race.name, source: race.source, baseName: race.name, baseSource: race.source, additionalSpells: race.additionalSpells });
    }
    for (const v of versions) {
      out.push({
        kind: 'race',
        name: lineageLabel(v.name ?? race.name),
        source: v.source ?? race.source,
        baseName: race.name,
        baseSource: race.source,
        additionalSpells: v.additionalSpells,
      });
    }
  }
  for (const sub of latestOnly(db?.races?.subrace ?? [])) {
    if (!sub?.additionalSpells) continue;
    const base = sub.raceName ?? '';
    if (!liveNames.has(base.toLowerCase())) continue;
    out.push({
      kind: 'race',
      name: sub.name ? `${base} (${sub.name})` : base,
      source: sub.source,
      baseName: base,
      baseSource: sub.raceSource ?? sub.source,
      additionalSpells: sub.additionalSpells,
    });
  }
  return out;
}

/** "Elf; Drow Lineage" vira "Elf (Drow Lineage)". */
function lineageLabel(name) {
  const i = String(name).indexOf(';');
  return i < 0 ? String(name) : `${name.slice(0, i).trim()} (${name.slice(i + 1).trim()})`;
}

function buildIndex(db) {
  const idx = { byName: new Map(), broad: [] };

  for (const classId of CLASS_NAMES) {
    for (const cls of db?.[`class-${classId}`]?.class ?? []) {
      if (!cls?.additionalSpells) continue;
      indexEntity(idx, { kind: 'class', name: cls.name, source: cls.source, classId }, cls.additionalSpells, true);
    }
  }
  for (const s of allSubclasses(db)) indexEntity(idx, s, s.additionalSpells);
  for (const r of allSpecies(db)) indexEntity(idx, r, r.additionalSpells);
  for (const f of latestOnly(db?.feats?.feat ?? [])) {
    if (f?.additionalSpells) indexEntity(idx, { kind: 'feat', name: f.name, source: f.source }, f.additionalSpells);
  }
  for (const b of latestOnly(db?.backgrounds?.background ?? [])) {
    if (b?.additionalSpells) indexEntity(idx, { kind: 'background', name: b.name, source: b.source }, b.additionalSpells);
  }
  for (const o of latestOnly(db?.optionalfeatures?.optionalfeature ?? [])) {
    if (o?.additionalSpells) indexEntity(idx, { kind: 'optionalfeature', name: o.name, source: o.source }, o.additionalSpells);
  }

  idx.broad = idx.broad.map(({ entry, expr }) => ({ entry, match: spellChoosePredicate({ filter: expr }, db) }));
  return idx;
}

/** O índice inverso completo, memoizado por db. */
export function spellSourceIndex(db) {
  if (!db || typeof db !== 'object') return { byName: new Map(), broad: [] };
  let idx = cache.get(db);
  if (!idx) {
    idx = buildIndex(db);
    cache.set(db, idx);
  }
  return idx;
}

/** As entradas do mapa reverso para uma magia. */
function reverseMapEntry(db, spell) {
  const map = db?.['spell-sources'];
  if (!map || !spell?.name) return null;
  const wantName = spell.name.toLowerCase();
  const wantSrc = String(spell.source ?? '').toLowerCase();
  let fallback = null;
  for (const [src, byName] of Object.entries(map)) {
    for (const [name, info] of Object.entries(byName)) {
      if (name.toLowerCase() !== wantName) continue;
      if (src.toLowerCase() === wantSrc) return info;
      fallback ??= info;
    }
  }
  return fallback;
}

/** Colapsa por identidade, com a edição mais nova e o `granted`. */
function dedupe(list) {
  const map = new Map();
  for (const e of list) map.set(entryKey(e), preferNewer(map.get(entryKey(e)), e));
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A quais listas uma magia pertence.
 * @param {object} db
 * @param {object} spell
 * @returns {{ classes, classesVariant, subclasses, races, backgrounds, feats,
 *   optionalfeatures }}
 */
export function spellSources(db, spell) {
  const out = emptyResult();
  if (!db || !spell?.name) return out;

  const info = reverseMapEntry(db, spell);
  const fromMap = (arr) =>
    dedupe((arr ?? []).filter((c) => c?.name).map((c) => ({ kind: 'class', name: c.name, source: c.source, nature: 'available' })));
  out.classes = fromMap(info?.class);
  out.classesVariant = fromMap(info?.classVariant).filter((c) => !out.classes.some((k) => k.name === c.name));

  const idx = spellSourceIndex(db);
  const hits = [...(idx.byName.get(spell.name.toLowerCase()) ?? [])];
  for (const { entry, match } of idx.broad) {
    if (match(spell)) hits.push({ ...entry, nature: 'available' });
  }

  const bucket = { class: 'classes', subclass: 'subclasses', race: 'races', background: 'backgrounds', feat: 'feats', optionalfeature: 'optionalfeatures' };
  const extra = { classes: [], subclasses: [], races: [], backgrounds: [], feats: [], optionalfeatures: [] };
  for (const h of hits) extra[bucket[h.kind]]?.push(h);

  for (const key of ['subclasses', 'races', 'backgrounds', 'feats', 'optionalfeatures']) {
    out[key] = dedupe(extra[key]);
  }
  const granted = dedupe(extra.classes).filter((c) => c.nature === 'granted' && !out.classes.some((k) => k.name === c.name));
  out.classes = [...out.classes, ...granted].sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** Uma entrada como a tag que o EntryContent resolve. */
function entryTag(e) {
  const mark = e.nature === 'available' && e.kind !== 'class' ? '*' : '';
  switch (e.kind) {
    case 'class':
      return `{@class ${e.name}}${mark}`;
    case 'subclass':
      return `{@subclass ${e.shortName}|${e.className}|${e.classSource}|${e.source}|${e.name} (${e.className})}${mark}`;
    case 'race':
      return `{@race ${e.baseName}|${e.baseSource}|${e.name}}${mark}`;
    case 'background':
      return `{@background ${e.name}|${e.source}}${mark}`;
    case 'feat':
      return `{@feat ${e.name}|${e.source}}${mark}`;
    default:
      return `{@optfeature ${e.name}|${e.source}}${mark}`;
  }
}

/**
 * O bloco pronto para o EntryContent, com o rodapé do `*`.
 * @returns {object[]}
 */
export function spellSourceEntries(db, spell) {
  const groups = spellSources(db, spell);
  const lines = [];
  let hasMark = false;
  for (const { key, label } of SPELL_SOURCE_CATEGORIES) {
    const list = groups[key];
    if (!list?.length) continue;
    if (list.some((e) => e.nature === 'available' && e.kind !== 'class')) hasMark = true;
    lines.push(`{@b ${label}:} ${list.map(entryTag).join(', ')}`);
  }
  if (!lines.length) return [];
  if (hasMark) lines.push('{@note * On the list or an open choice - not granted outright.}');
  return lines;
}
