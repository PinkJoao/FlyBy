// =============================================================================
// spellSources - a QUAIS LISTAS uma magia pertence
// =============================================================================
// Puro: sem rede/DOM. O bloco que o 5e.tools imprime no pé da ficha da magia
// ("Classes: ... / Subclasses: ... / Species: ... / Feats: ..."), derivado aqui.
//
// DUAS ORIGENS, e elas são de naturezas diferentes:
//
//  1. `db['spell-sources']` (spells/sources.json) - o mapa reverso OFICIAL
//     magia→classe, keyed [FONTE_DA_MAGIA][Nome].class / .classVariant. É a
//     autoridade sobre a LISTA DE CLASSE e não é derivável de outro lugar.
//  2. `additionalSpells` das demais entidades (subclasse, espécie, sub-raça,
//     linhagem `_versions`, talento, background, optional feature). O 5etools
//     resolve isso em tempo de execução varrendo o dataset; nós fazemos o mesmo,
//     com o índice memoizado por `db`.
//
// NATUREZA da entrada, e ela vale ser dita (é a distinção do DDL-0054):
//   - `granted`   - a entidade te DÁ a magia (buckets known/prepared/innate com
//                   um nome concreto: o Drow ganha Faerie Fire, e ponto).
//   - `available` - a magia só entra na sua LISTA, ou é uma das opções de uma
//                   ESCOLHA aberta (bucket `expanded`, ou uma folha `{choose}`/
//                   `{all}`). "Magic Initiate (Wizard)" alcança TODO truque de
//                   mago; dizer que ele "concede" Fire Bolt seria mentira.
// Sem a marca, as duas viram a mesma linha e a lista de um truque comum fica
// dominada pelas escolhas abertas - que é justamente o que o 5etools resolveu
// PODANDO (ele nem lista as `additionalSpells` de CLASSE). Aqui elas ficam, com
// a marca; e quem quiser só o que é concedido lê as entradas sem marca.
//
// A ÚNICA poda: as folhas de FILTRO (`{choose}`/`{all}` com expressão) das
// `additionalSpells` de CLASSE. Os Magical Secrets do Bardo alcançam metade do
// catálogo, e a linha "Classes" já vem do mapa reverso oficial, que é exato. Os
// nomes CONCRETOS de classe ficam - é assim que o Druida 2024 aparece em Find
// Familiar (ele a tem sempre preparada, e ela não está na lista dele).
// -----------------------------------------------------------------------------

import { latestOnly } from '../selector/reprints';
import { resolveCopies } from '../selector/copy';
import { CLASS_NAMES } from '../data/config';
import { parseSpellRef } from './grantedSpells';
import { spellChoosePredicate } from './spells';

/** Buckets que CONCEDEM a magia, e o que só amplia a lista (DDL-0054). */
const GRANT_BUCKETS = ['known', 'prepared', 'innate'];
const LIST_BUCKETS = ['expanded'];
const ALL_BUCKETS = [...GRANT_BUCKETS, ...LIST_BUCKETS];

/** Categorias, na ordem em que aparecem na ficha (a mesma do 5e.tools). */
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

// ---------------------------------------------------------------------------
// Varredura de um `additionalSpells`
// ---------------------------------------------------------------------------

/**
 * Percorre um `additionalSpells` chamando `push(leaf, nature)` para cada folha,
 * onde `leaf` é a string da magia ou o objeto `{choose}`/`{all}`. A forma do
 * dado (níveis, tipos de recarga, contagens de uso) é irrelevante aqui: só
 * interessa QUAIS magias o bloco alcança, em qualquer nível.
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
 * Achata um `additionalSpells` em nomes concretos + regras de filtro.
 * @param {object[]|null|undefined} additionalSpells
 * @param {boolean} concreteOnly  descarta as folhas de FILTRO (usado nas
 *   `additionalSpells` de CLASSE - ver o cabeçalho).
 * @returns {{ names: Map<string,'granted'|'available'>, filters: Array<{expr:string}> }}
 */
function flattenAdditionalSpells(additionalSpells, concreteOnly = false) {
  const names = new Map();
  const filters = [];
  const addName = (raw, nature) => {
    const ref = parseSpellRef(raw);
    if (!ref) return;
    const key = ref.name.toLowerCase();
    // `granted` vence: a mesma entidade pode conceder E ampliar a lista.
    if (nature === 'granted' || !names.has(key)) names.set(key, nature);
  };
  walkAdditionalSpells(additionalSpells, (leaf, nature) => {
    if (typeof leaf === 'string') return addName(leaf, nature);
    if (!leaf || typeof leaf !== 'object') return;
    // Lista FECHADA de opções (`{choose: {from: [...]}}`): nomes concretos, mas
    // é uma escolha - o jogador leva uma delas, não todas.
    if (Array.isArray(leaf.choose?.from)) {
      for (const uid of leaf.choose.from) addName(uid, 'available');
      return;
    }
    if (concreteOnly) return;
    const expr = typeof leaf.choose === 'string' ? leaf.choose
      : typeof leaf.all === 'string' ? leaf.all
        : null;
    // Expressão VAZIA alcança o catálogo inteiro (Magical Secrets nível 18):
    // não é informação, é ruído.
    if (expr) filters.push({ expr });
  });
  return { names, filters };
}

// ---------------------------------------------------------------------------
// Índice (memoizado por db)
// ---------------------------------------------------------------------------

const cache = new WeakMap();

/** Chave de identidade de uma entrada, para dedup entre edições. */
function entryKey(entry) {
  return entry.kind === 'subclass'
    ? `subclass:${entry.className}|${entry.shortName}`.toLowerCase()
    : `${entry.kind}:${entry.name}`.toLowerCase();
}

/** Entre duas entradas da MESMA identidade, fica a edição mais nova. */
function preferNewer(a, b) {
  if (!a) return b;
  const rank = (e) => (e.source === 'XPHB' ? 2 : e.source === 'PHB' ? 0 : 1);
  if (rank(b) > rank(a)) return { ...b, nature: a.nature === 'granted' ? 'granted' : b.nature };
  if (a.nature !== 'granted' && b.nature === 'granted') return { ...a, nature: 'granted' };
  return a;
}

/** Registra uma entidade no índice, com todas as magias que ela alcança. */
function indexEntity(idx, entry, additionalSpells, concreteOnly = false) {
  const { names, filters } = flattenAdditionalSpells(additionalSpells, concreteOnly);
  for (const [name, nature] of names) {
    const list = idx.byName.get(name) ?? [];
    list.push({ ...entry, nature });
    idx.byName.set(name, list);
  }
  for (const { expr } of filters) idx.broad.push({ entry, expr });
}

/**
 * Subclasses de todas as classes baixadas, com `_copy` resolvido (uma subclasse
 * "compat" herda o `additionalSpells` da original - sem resolver, ela some).
 */
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

/**
 * Linhagens (`_versions`) e sub-raças com concessão de magia própria.
 * A base é a MESMA lista que o índice de links usa (`_copy` resolvido, sem as
 * reimpressas): dezesseis raças herdam por `_copy`, e uma espécie que o app não
 * oferece mais sob aquele nome (Half-Elf, Yuan-ti Pureblood) só produziria uma
 * linha inerte - a versão atual já entra por conta própria.
 */
function allSpecies(db) {
  const out = [];
  const races = latestOnly(resolveCopies(db?.races?.race ?? []));
  const liveNames = new Set(races.map((r) => r.name.toLowerCase()));
  for (const race of races) {
    // `_versions` carrega o `additionalSpells` DIRETO (é assim que as linhagens
    // 2024 concedem: Drow/High/Wood no Elfo, as heranças do Tiefling), e o valor
    // SUBSTITUI o da base. A base guarda a UNIÃO dos grupos - um por linhagem -
    // então, quando alguma versão traz o seu, listar a base junto duplicaria
    // cada magia ("Elf" e "Elf (Drow Lineage)" para a mesma Faerie Fire). Um
    // `additionalSpells: null` na versão APAGA a concessão (as linhagens de
    // Kobold que não conjuram); por isso a base fica quando NENHUMA versão traz
    // a sua.
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

/** "Elf; Drow Lineage" → "Elf (Drow Lineage)" (o `;` do 5etools é um parêntese). */
function lineageLabel(name) {
  const i = String(name).indexOf(';');
  return i < 0 ? String(name) : `${name.slice(0, i).trim()} (${name.slice(i + 1).trim()})`;
}

function buildIndex(db) {
  const idx = { byName: new Map(), broad: [] };

  // Classes: só os nomes CONCRETOS (ver o cabeçalho). A LISTA de classe não vem
  // daqui - vem do mapa reverso, em `classListEntries`.
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

  // As regras de filtro viram predicados UMA vez (cada `class=X` varre o mapa
  // reverso inteiro; são ~120 expressões distintas em todo o dataset).
  idx.broad = idx.broad.map(({ entry, expr }) => ({ entry, match: spellChoosePredicate({ filter: expr }, db) }));
  return idx;
}

/** Índice inverso completo, memoizado por `db` (WeakMap, como entityLinks). */
export function spellSourceIndex(db) {
  if (!db || typeof db !== 'object') return { byName: new Map(), broad: [] };
  let idx = cache.get(db);
  if (!idx) {
    idx = buildIndex(db);
    cache.set(db, idx);
  }
  return idx;
}

// ---------------------------------------------------------------------------
// Consulta
// ---------------------------------------------------------------------------

/** As entradas de `spell-sources` para uma magia, casando fonte+nome sem ligar
 * para caixa. Sem a fonte exata (uma reimpressão que o mapa só tem no livro
 * antigo), varre os demais livros pelo nome. */
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

/** Colapsa por identidade, mantendo a edição mais nova e o `granted` de quem o tiver. */
function dedupe(list) {
  const map = new Map();
  for (const e of list) map.set(entryKey(e), preferNewer(map.get(entryKey(e)), e));
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A quais listas uma magia pertence.
 * @param {object} db
 * @param {object} spell  a magia CRUA do 5etools (precisa de name + source)
 * @returns {{ classes, classesVariant, subclasses, races, backgrounds, feats,
 *             optionalfeatures }} listas de `{ kind, name, source, nature, … }`
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
  // Uma classe que CONCEDE a magia sem tê-la na lista (o Druida 2024 e Find
  // Familiar) entra na linha Classes; se já estiver na lista, a concessão é
  // redundante - a lista já a nomeia.
  const granted = dedupe(extra.classes).filter((c) => c.nature === 'granted' && !out.classes.some((k) => k.name === c.name));
  out.classes = [...out.classes, ...granted].sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

// ---------------------------------------------------------------------------
// Markup: as entradas viram TAGS do 5etools, e o EntryContent as torna links
// ---------------------------------------------------------------------------

/** Uma entrada → a tag `{@...}` que o EntryContent resolve para o preview dela. */
function entryTag(e) {
  const mark = e.nature === 'available' && e.kind !== 'class' ? '*' : '';
  switch (e.kind) {
    case 'class':
      return `{@class ${e.name}}${mark}`;
    // {@subclass shortName|className|classSource|source|display} - a gramática
    // do 5etools; o display é o nome por extenso com a classe entre parênteses.
    case 'subclass':
      return `{@subclass ${e.shortName}|${e.className}|${e.classSource}|${e.source}|${e.name} (${e.className})}${mark}`;
    // A espécie linka para a BASE (o preview mostra a espécie inteira, linhagens
    // inclusas), mas exibe o nome da linhagem, que é quem concede.
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
 * O bloco pronto para o EntryContent: uma linha por categoria não-vazia, com as
 * entradas já como tags clicáveis, mais o rodapé que explica o `*`.
 * @returns {object[]} entries no formato 5etools (vazio quando não há nada)
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
