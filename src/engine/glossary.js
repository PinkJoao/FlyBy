// =============================================================================
// Glossário de regras - índice + resolução de tags {@condition …}, {@action …}…
// =============================================================================
// A prosa do 5etools já embute tags legíveis por máquina apontando para regras
// ({@condition Prone|XPHB}, {@variantrule Proficiency|XPHB|Proficiency Bonus}).
// Este módulo constrói um índice sobre os arquivos de glossário que o db já
// carrega e resolve uma tag para a entrada de regra alvo - a UI (EntryContent)
// transforma a menção num link que abre o popup da regra (ver CLAUDE.md DDL-0020).
//
// Puro: nada de rede/DOM. O cache por db (WeakMap) é só memoização.
// -----------------------------------------------------------------------------

/** Tag do 5etools → tipo de entrada no índice. Só estes viram link no v1. */
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

/**
 * Constrói o índice `Map<'{type}:{nome-minúsculo}', entry[]>` sobre o db.
 * Cada entry normalizada: `{ type, name, source, entries, ruleType?,
 * reprintedAs? }` - ruleType (C/O/V/VO, só variantrule) alimenta as categorias
 * de regra; reprintedAs deixa o glossário NAVEGÁVEL esconder edições antigas
 * (o índice completo fica, para as tags inline que citam a fonte legada).
 */
export function buildGlossary(db) {
  const map = new Map();
  const simple = [
    ['condition', db?.conditionsdiseases?.condition],
    ['disease', db?.conditionsdiseases?.disease],
    ['status', db?.conditionsdiseases?.status],
    ['variantrule', db?.variantrules?.variantrule],
    // Regras extraídas dos livros pelo gendata do 5etools - inclui as do XDMG
    // (a página Rules Glossary deles concatena os dois arquivos).
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
  // itemProperty não tem `name` no topo: a prosa referencia pela ABREVIAÇÃO
  // ({@itemProperty 2H|XPHB|Two-Handed}) e o nome real vive em entries[0].name.
  // Indexamos por abreviação E por nome (ambos aparecem nas tags).
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

/**
 * Decompõe o conteúdo de uma tag (`Name|Source|Display`, pipes opcionais).
 * O display exibido é o 3º segmento quando presente (ex: "Proficiency Bonus"
 * exibido, "Proficiency" alvo).
 */
export function parseTagContent(content) {
  const parts = String(content ?? '').split('|');
  const name = (parts[0] ?? '').trim();
  const source = (parts[1] ?? '').trim();
  const display = (parts[2] ?? '').trim() || name;
  return { name, source, display };
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

/**
 * Resolve uma tag para sua entrada de glossário, ou null quando o termo não
 * existe (o link nunca pode ser "morto" - sem match, o texto fica como está).
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

/** Rótulo humano de cada tipo do glossário (categorias do glossário navegável). */
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

/** ruleType do 5etools (variantrule) → rótulo de categoria de regra. */
const RULE_TYPE_LABELS = {
  C: 'Core Rule',
  O: 'Optional Rule',
  V: 'Variant Rule',
  VO: 'Variant Optional Rule',
};

/**
 * Rótulo de categoria de UMA entrada do glossário: variantrules se desdobram
 * pelo `ruleType` (Core/Optional/Variant/Variant Optional; sem ruleType fica o
 * genérico "Rule"); os demais tipos usam o rótulo fixo.
 */
export function ruleCategoryLabel(entry) {
  if (entry?.type === 'variantrule') {
    return RULE_TYPE_LABELS[entry.ruleType] ?? GLOSSARY_TYPE_LABELS.variantrule;
  }
  return GLOSSARY_TYPE_LABELS[entry?.type] ?? entry?.type;
}

/**
 * Categorias de FILTRO de UMA entrada (podem ser VÁRIAS) - distinto do rótulo de
 * EXIBIÇÃO acima. As regras (variantrule) têm filtros mais intuitivos que os
 * rótulos: toda regra entra no filtro genérico "Rule"; uma regra "Variant
 * Optional" entra tanto em "Variant Rule" QUANTO em "Optional Rule" (contagem
 * dupla proposital) - não existe filtro "Variant Optional Rule" separado. Os
 * demais tipos usam o rótulo fixo. (Pedido do usuário - DDL-0027.)
 */
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

/**
 * Lista PLANA das entradas de regra do glossário (uma por nome+tipo, a melhor
 * fonte), para alimentar o glossário navegável. Cada item:
 * `{ type, name, source, entries, ruleType? }`.
 * Edições REPUBLICADAS ficam de fora (semântica latestOnly): um reprint de
 * mesmo nome já colapsava via pickBySource, mas um RENOMEADO (PHB "Use an
 * Object" → XPHB "Utilize") mostraria as duas versões sem este filtro. O
 * ÍNDICE (lookupRule) segue completo - prosa legada que cita a fonte antiga
 * continua resolvendo.
 * Uma MESMA entrada pode estar sob várias chaves (itemProperty é indexada pela
 * abreviação E pelo nome - "A" e "Ammunition" apontam para o mesmo objeto), o
 * que a listaria duas vezes: dedupamos por IDENTIDADE do objeto.
 */
export function glossaryEntries(db) {
  const g = glossaryFor(db);
  if (!g) return [];
  const out = [];
  const seen = new Set();
  for (const arr of g.values()) {
    const current = arr.filter((e) => !e.reprintedAs);
    if (!current.length) continue; // tudo republicado → a entrada nova tem outra chave
    const entry = pickBySource(current) ?? current[0];
    if (seen.has(entry)) continue;
    seen.add(entry);
    out.push(entry);
  }
  return out;
}

/**
 * Tabelas das REGRAS GRATUITAS (SRD 5.2) do PHB/DMG/MM 2024, para o glossário
 * navegável. O 5etools marca essas tabelas com `srd52: true` no arquivo gendata
 * (é o critério exato de "pertence às regras gratuitas"); só ~49 das ~2300
 * tabelas extraídas o carregam. Cada uma vira uma entrada de glossário no MESMO
 * shape das regras (`{ type:'table', name, source, entries }`), com o corpo
 * sendo a própria tabela (`type:'table'` → renderTable no EntryContent). O NOME
 * exibido é o `caption` (limpo: "Skills"), não o `name` composto do gendata
 * ("Skill List; Skills"). Nada de resolução de tag `{@table}` aqui - essas
 * seguem inertes (tabelas fora do SRD nem são carregadas).
 */
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

// --- Memoização por db (o db é imutável durante a sessão) --------------------
const cache = new WeakMap();

/** Índice memoizado por objeto db - barato de chamar em todo render. */
export function glossaryFor(db) {
  if (!db || typeof db !== 'object') return null;
  let g = cache.get(db);
  if (!g) {
    g = buildGlossary(db);
    cache.set(db, g);
  }
  return g;
}
