// =============================================================================
// glossary: o glossário de regras: índice e resolução de tags
// =============================================================================
// O QUE FAZ
//   A prosa do 5etools embute tags que apontam para regras ({@condition
//   Prone|XPHB}, {@variantrule Proficiency|XPHB|Proficiency Bonus}). Este módulo
//   indexa os arquivos de glossário que o db já carrega e resolve uma tag na
//   entrada de regra; a UI (EntryContent) transforma a menção em link para o popup
//   (DDL-0020). Também alimenta o glossário NAVEGÁVEL (DDL-0027) e as tabelas do
//   SRD 5.2 (DDL-0035).
//
// FUNÇÕES
//   key(type, name), add(map, type, name, entry): o índice.
//   buildGlossary(db): Map '{type}:{nome}' para entradas.
//   parseTagContent(content): Name|Source|Display.
//   pickBySource(candidates, source): fonte exata, depois 2024, depois clássica.
//   lookupRule(glossary, tag, content): a entrada de uma tag, ou null.
//   ruleCategoryLabel(entry), ruleFilterCategories(entry): o rótulo de exibição e
//     as categorias de filtro.
//   glossaryEntries(db): a lista plana do glossário navegável.
//   glossaryTables(db): as tabelas do SRD 5.2.
//   norm(s), tableIndex(db), lookupTable(db, name, source): a tag {@table}.
//   glossaryFor(db): o índice memoizado por db.
//
// DECISÕES E ARMADILHAS
//   - Link nunca é morto: sem match, o texto fica como está.
//   - As regras do gendata (as do XDMG) entram junto das variantrules, como na
//     página Rules Glossary do 5etools.
//   - itemProperty não tem `name` no topo: a prosa cita a ABREVIAÇÃO ({@itemProperty
//     2H|XPHB|Two-Handed}), então indexa-se a abreviação E o nome; a lista plana
//     deduplica por IDENTIDADE do objeto.
//   - Filtros de regra (pedido do usuário): toda variantrule entra em "Rule", e uma
//     "Variant Optional" entra em "Variant Rule" E em "Optional Rule" (contagem
//     dupla de propósito); o rótulo de exibição segue o `ruleType`.
//   - O navegável esconde edições REPUBLICADAS (latestOnly), inclusive renomeadas
//     ("Use an Object" virou "Utilize"); o índice segue completo para a prosa legada.
//   - Tabelas: só as marcadas `srd52` (~49 de ~2300) entram no navegável, com o
//     `caption` como nome ("Skills", não "Skill List; Skills"). A tag {@table}
//     resolve contra TODAS, pelo nome composto, com o nome puro como rede.
// -----------------------------------------------------------------------------

export const GLOSSARY_TAGS = {
  condition: 'condition',
  disease: 'disease',
  status: 'status',
  variantrule: 'variantrule',
  action: 'action',
  sense: 'sense',
  skill: 'skill',
  itemProperty: 'itemProperty',
  itemMastery: 'itemMastery',
};

const key = (type, name) => `${type}:${String(name ?? '').toLowerCase()}`;

function add(map, type, name, entry) {
  if (!name || !entry?.entries?.length) return;
  const k = key(type, name);
  const list = map.get(k);
  if (list) list.push(entry);
  else map.set(k, [entry]);
}

/** O índice do glossário sobre o db. */
export function buildGlossary(db) {
  const map = new Map();
  const simple = [
    ['condition', db?.conditionsdiseases?.condition],
    ['disease', db?.conditionsdiseases?.disease],
    ['status', db?.conditionsdiseases?.status],
    ['variantrule', db?.variantrules?.variantrule],
    ['variantrule', db?.['gendata-variantrules']?.variantrule],
    ['action', db?.actions?.action],
    ['sense', db?.senses?.sense],
    ['skill', db?.skills?.skill],
    ['itemMastery', db?.['items-base']?.itemMastery],
  ];
  for (const [type, list] of simple) {
    for (const raw of list ?? []) {
      add(map, type, raw.name, {
        type,
        name: raw.name,
        source: raw.source,
        entries: raw.entries,
        ...(raw.ruleType ? { ruleType: raw.ruleType } : {}),
        ...(raw.reprintedAs?.length ? { reprintedAs: raw.reprintedAs } : {}),
      });
    }
  }
  for (const raw of db?.['items-base']?.itemProperty ?? []) {
    const inner = (raw.entries ?? []).find((e) => e?.name);
    const name = inner?.name ?? raw.abbreviation;
    const entry = {
      type: 'itemProperty',
      name,
      source: raw.source,
      entries: inner?.entries ?? raw.entries,
      ...(raw.reprintedAs?.length ? { reprintedAs: raw.reprintedAs } : {}),
    };
    add(map, 'itemProperty', raw.abbreviation, entry);
    if (name && name !== raw.abbreviation) add(map, 'itemProperty', name, entry);
  }
  return map;
}

/** Decompõe o conteúdo de uma tag (Name|Source|Display). */
export function parseTagContent(content) {
  const parts = String(content ?? '').split('|');
  const name = (parts[0] ?? '').trim();
  const source = (parts[1] ?? '').trim();
  const display = (parts[2] ?? '').trim() || name;
  return { name, source, display };
}

/** A fonte preferida: exata, depois 2024, depois clássica, depois a primeira. */
function pickBySource(candidates, source) {
  if (!candidates?.length) return null;
  const bySrc = (s) => candidates.find((c) => c.source?.toLowerCase() === s);
  if (source) {
    const exact = bySrc(source.toLowerCase());
    if (exact) return exact;
  }
  return bySrc('xphb') ?? bySrc('xdmg') ?? bySrc('phb') ?? bySrc('dmg') ?? candidates[0];
}

/**
 * A entrada de glossário de uma tag, ou null.
 * @returns {{ entry: {type,name,source,entries}, display: string } | null}
 */
export function lookupRule(glossary, tag, content) {
  const type = GLOSSARY_TAGS[tag];
  if (!type || !glossary) return null;
  const { name, source, display } = parseTagContent(content);
  if (!name) return null;
  const entry = pickBySource(glossary.get(key(type, name)), source);
  return entry ? { entry, display } : null;
}

export const GLOSSARY_TYPE_LABELS = {
  condition: 'Condition',
  disease: 'Disease',
  status: 'Status',
  variantrule: 'Rule',
  action: 'Action',
  sense: 'Sense',
  skill: 'Skill',
  itemProperty: 'Weapon Property',
  itemMastery: 'Weapon Mastery',
  table: 'Table',
};

const RULE_TYPE_LABELS = {
  C: 'Core Rule',
  O: 'Optional Rule',
  V: 'Variant Rule',
  VO: 'Variant Optional Rule',
};

/** O rótulo de categoria de uma entrada. */
export function ruleCategoryLabel(entry) {
  if (entry?.type === 'variantrule') {
    return RULE_TYPE_LABELS[entry.ruleType] ?? GLOSSARY_TYPE_LABELS.variantrule;
  }
  return GLOSSARY_TYPE_LABELS[entry?.type] ?? entry?.type;
}

/** As categorias de filtro de uma entrada (podem ser várias). */
export function ruleFilterCategories(entry) {
  if (entry?.type === 'variantrule') {
    const out = ['Rule'];
    if (entry.ruleType === 'C') out.push('Core Rule');
    if (entry.ruleType === 'V' || entry.ruleType === 'VO') out.push('Variant Rule');
    if (entry.ruleType === 'O' || entry.ruleType === 'VO') out.push('Optional Rule');
    return out;
  }
  return [ruleCategoryLabel(entry)];
}

/** A lista plana do glossário navegável, sem edições republicadas. */
export function glossaryEntries(db) {
  const g = glossaryFor(db);
  if (!g) return [];
  const out = [];
  const seen = new Set();
  for (const arr of g.values()) {
    const current = arr.filter((e) => !e.reprintedAs);
    if (!current.length) continue;
    const entry = pickBySource(current) ?? current[0];
    if (seen.has(entry)) continue;
    seen.add(entry);
    out.push(entry);
  }
  return out;
}

/** As tabelas do SRD 5.2 como entradas de glossário. */
export function glossaryTables(db) {
  const out = [];
  for (const t of db?.['gendata-tables']?.table ?? []) {
    if (!t.srd52 || !t.rows?.length) continue;
    const name = t.caption || t.name;
    out.push({
      type: 'table',
      name,
      source: t.source,
      entries: [{ ...t, type: 'table' }],
    });
  }
  return out;
}

const tableCache = new WeakMap();
const norm = (s) => String(s ?? '').trim().toLowerCase();
function tableIndex(db) {
  if (!db || typeof db !== 'object') return null;
  if (tableCache.has(db)) return tableCache.get(db);
  const idx = new Map();
  for (const t of db['gendata-tables']?.table ?? []) {
    if (!t.name || !t.rows?.length) continue;
    const key = norm(t.name);
    idx.set(`${key}|${norm(t.source)}`, t);
    if (!idx.has(key)) idx.set(key, t);
  }
  tableCache.set(db, idx);
  return idx;
}

/**
 * Uma tag {@table} como entrada de glossário, ou null.
 * @param {object} db
 * @param {string} name
 * @param {string} [source]
 * @returns {object|null}
 */
export function lookupTable(db, name, source) {
  const idx = tableIndex(db);
  if (!idx || !name) return null;
  const t = (source && idx.get(`${norm(name)}|${norm(source)}`)) || idx.get(norm(name));
  if (!t) return null;
  return { type: 'table', name: t.caption || t.name, source: t.source, entries: [{ ...t, type: 'table' }] };
}

const cache = new WeakMap();

/** O índice memoizado por db. */
export function glossaryFor(db) {
  if (!db || typeof db !== 'object') return null;
  let g = cache.get(db);
  if (!g) {
    g = buildGlossary(db);
    cache.set(db, g);
  }
  return g;
}
