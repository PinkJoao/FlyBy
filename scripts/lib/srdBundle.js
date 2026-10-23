// =============================================================================
// srdBundle: a lógica pura do pacote SRD 5.2 embutido (npm run gen:srd-bundle)
// =============================================================================
// O QUE FAZ
//   Recebe o compêndio inteiro no formato do db do app (loadDb) e devolve só o
//   subconjunto SRD 5.2 (CC-BY-4.0), pronto para embutir (DDL-0091). Sem I/O: o
//   gerador (scripts/gen-srd-bundle.js) lê o snapshot e o texto do SRD e grava.
//   Etapas: filtrar por `srd52` -> renomear para o nome do SRD -> limpar tags
//   que apontam para fora do pacote -> correções curadas -> podar campos de
//   metadado -> varrer nomes protegidos contra o texto oficial do SRD.
//
// FUNÇÕES
//   norm(s): o nome comparável (aspas retas, minúsculo).
//   isEntityArray(v): um array de entidades 5etools (objetos com name e source).
//   srdKeep(e): a entrada está no SRD 5.2 (`srd52`, ou `inherits.srd52`).
//   legacyKey(e), legacyKeep(e, where, legacy): os extras do SRD 5.1, por lista
//     fechada (DDL-0107).
//   entityKey(e): a chave de identidade (nome, fonte, classe, subclasse, nível).
//   buildRenames(full, extra): nome antigo -> nome do SRD, das 33 entradas com
//     `srd52` string (as variantes mágicas trazem o nome em `inherits.srd52`),
//     mais as trocas curadas de `extra`.
//   escapeRe(s): a string como regex literal.
//   renameText(s, renames): troca os nomes antigos pelos do SRD no texto.
//   stripTags(s): as tags `{@tag nome|fonte|texto}` viram o texto exibido.
//   untagOutside(s, keptNames): a tag cujo alvo não está no pacote vira texto.
//   mapStrings(v, fn): aplica fn a toda string de um valor (recursivo).
//   applyTextFixes(e, fixes): as correções curadas de uma entrada.
//   pruneMeta(e, keptKeys): tira os campos de metadado que citam outros livros.
//   filterSpellSources(map, keptSpells, keptClasses): o mapa magia -> classes.
//   filterOverlay(file, kept): o overlay Foundry, pelas entidades mantidas.
//   filterItemMeta(base, keptItems): propriedades e tipos que os itens usam.
//   normalizeCorpus(s): texto comparável (sem HTML nem enricher do Foundry,
//     aspas retas, sem espaço antes de pontuação, minúsculo).
//   scanProtected(bundle, terms, corpus, opts): os nomes protegidos que sobraram
//     e cujo trecho não aparece igual no texto oficial do SRD; e o nome de
//     entrada com termo protegido que não é nome de documento do SRD.
//   buildSrdBundle(full, opts): o pacote inteiro, com o relatório.
//
// DECISÕES E ARMADILHAS
//   - O critério é a flag `srd52` do próprio 5etools, nunca `basicRules2024`
//     (gratuito, mas não é licença aberta). A flag `srd` (5.1) só vale para a
//     lista FECHADA de extras que o gerador passa em `legacy` (DDL-0107): o que
//     o 5.2 não cobre e serve a uma ficha 2024. Cada extra precisa estar na
//     lista E ter a flag; vira `srd51: true` no pacote, e a varredura confere o
//     texto dele contra o SRD 5.1 (`legacyCorpus`), não contra o 5.2. Extra
//     pedido que não existe mais no dado aparece em `legacyMissing`.
//   - `srd52` como STRING é o nome com que o SRD publica a entrada ("Heward's
//     Handy Haversack" -> "Handy Haversack"). A troca vale para o nome E para
//     toda menção no texto de qualquer entrada mantida; em minúsculas (as
//     concessões vêm assim) a troca sai em minúsculas.
//   - Metadados sem flag (propriedades e tipos de item, entradas de modelo) não
//     se filtram por `srd52`: ficam os que algum item MANTIDO referencia.
//   - Fluff (lore e arte) não tem nada SRD: sai inteiro. O overlay Foundry não
//     tem flag: fica o que casa com uma entidade mantida pela CHAVE completa,
//     porque nome de feature se repete entre subclasses ("Bonus Proficiency").
//   - A varredura não confia numa lista de permitidos: um nome protegido só
//     passa se o MESMO trecho (uns 20 caracteres de cada lado) existe no texto do
//     SRD 5.2. O SRD cita "Monster Manual" no Wild Shape e Demogorgon no Fiend
//     Patron; o 5etools cita "Dungeon Master's Guide" no Bedroll, o SRD não.
//     O NOME da entrada tem uma checagem à parte: um nome curto casa em qualquer
//     lugar do texto, e o próprio SRD escreve "Lolth's Sting" no corpo do item
//     que ele chama de "Spider's Sting".
//   - O texto das entradas é o do XPHB/XDMG marcado como SRD, não o do PDF do
//     SRD palavra por palavra (resíduo aceito pelo usuário, DDL-0091).
// -----------------------------------------------------------------------------

const BS = String.fromCharCode(92);
const RE_SPECIALS = '.*+?^${}()|[]/' + BS;

const ENTITY_TAGS = new Set([
  'spell', 'item', 'feat', 'race', 'background', 'class', 'optfeature', 'condition',
  'disease', 'status', 'action', 'variantrule', 'sense', 'skill', 'language', 'table',
  'creature', 'deity', 'hazard', 'object', 'vehicle', 'reward', 'psionic', 'trap',
  'cult', 'boon', 'charoption', 'legroup', 'book', 'adventure', 'quickref',
  'classFeature', 'subclassFeature', 'subclass', 'itemMastery', 'card', 'deck',
  'facility', 'recipe', 'vehupgrade',
]);

const META_FIELDS = [
  'srd', 'basicRules', 'basicRules2024', 'otherSources', 'additionalSources',
  'referenceSources', 'hasFluff', 'hasFluffImages', 'fluff', 'page', 'lootTables',
];

const norm = (s) => String(s ?? '').replace(/[’‘]/g, "'").trim().toLowerCase();

/** Um array de entidades 5etools (objetos com name e source). */
export function isEntityArray(v) {
  return Array.isArray(v) && v.length > 0
    && v.every((e) => e && typeof e === 'object' && !Array.isArray(e))
    && v.some((e) => 'name' in e && 'source' in e);
}

/** A entrada está no SRD 5.2. */
export function srdKeep(e) {
  return Boolean(e?.srd52 || e?.inherits?.srd52);
}

/** A chave de um extra do SRD 5.1: "Nome|Fonte", ou "|Fonte|Raça" na sub-raça sem nome. */
export const legacyKey = (e) => (e?.name ? `${e.name}|${e.source}` : `|${e?.source}|${e?.raceName ?? ''}`);

/** A entrada é um extra pedido do SRD 5.1 (na lista E com a flag `srd` do 5etools). */
export function legacyKeep(e, where, legacy) {
  return Boolean(e?.srd && legacy?.[where]?.includes(legacyKey(e)));
}

/** A chave de identidade: nome, fonte, classe, subclasse e nível. */
export function entityKey(e) {
  return [e.name, e.source, e.className, e.classSource, e.subclassShortName, e.subclassSource, e.level]
    .map((x) => norm(x)).join('|');
}

/** Nome antigo (minúsculo) -> nome do SRD, do mais longo ao mais curto. */
export function buildRenames(full, extra = {}) {
  const out = new Map(Object.entries(extra).map(([k, v]) => [norm(k), v]));
  for (const file of Object.values(full ?? {})) {
    for (const arr of Object.values(file ?? {})) {
      if (!Array.isArray(arr)) continue;
      for (const e of arr) {
        if (typeof e?.srd52 === 'string' && e.srd52 !== e.name) out.set(norm(e.name), e.srd52);
        if (typeof e?.inherits?.srd52 === 'string' && e.inherits.srd52 !== e.name) out.set(norm(e.name), e.inherits.srd52);
      }
    }
  }
  return new Map([...out].sort((a, b) => b[0].length - a[0].length));
}

/** A string como regex literal. */
export function escapeRe(s) {
  return [...String(s)].map((c) => (RE_SPECIALS.includes(c) ? BS + c : c)).join('');
}

/** Troca os nomes antigos pelos do SRD; em minúsculas sai minúsculo. */
export function renameText(s, renames) {
  if (typeof s !== 'string' || !renames.size) return s;
  let out = s;
  for (const [old, to] of renames) {
    const pattern = escapeRe(old).replace(/'/g, "['’]");
    const re = new RegExp(pattern, 'gi');
    out = out.replace(re, (m) => (m === m.toLowerCase() ? to.toLowerCase() : to));
  }
  return out;
}

/** As tags viram o texto exibido (o terceiro campo, ou o nome). */
export function stripTags(s) {
  let out = String(s ?? '');
  let prev;
  do {
    prev = out;
    out = out.replace(/\{@(\w+) ([^{}]*)\}/g, (m, tag, body) => {
      const parts = body.split('|');
      if (tag === 'book' || tag === 'adventure') return parts[0];
      return parts[2] || parts[0];
    });
  } while (out !== prev);
  return out;
}

/** A tag de entidade cujo alvo não está no pacote vira o texto exibido. */
export function untagOutside(s, keptNames) {
  if (typeof s !== 'string' || !s.includes('{@')) return s;
  return s.replace(/\{@(\w+) ([^{}]*)\}/g, (m, tag, body) => {
    if (!ENTITY_TAGS.has(tag)) return m;
    const parts = body.split('|');
    if (keptNames.has(norm(parts[0])) && tag !== 'book' && tag !== 'adventure' && tag !== 'creature' && tag !== 'deity') return m;
    if (tag === 'book' || tag === 'adventure') return parts[0];
    return parts[2] || parts[0];
  });
}

/** Aplica fn a toda string de um valor, recursivo. */
export function mapStrings(v, fn) {
  if (typeof v === 'string') return fn(v);
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, fn));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = mapStrings(x, fn);
    return out;
  }
  return v;
}

/**
 * As correções curadas de uma entrada: `replace` troca um trecho, `dropString`
 * tira do array toda string que contém o trecho.
 */
export function applyTextFixes(e, fixes) {
  if (!fixes?.length) return e;
  let out = e;
  for (const f of fixes) {
    if (f.replace) {
      out = mapStrings(out, (s) => s.split(f.replace[0]).join(f.replace[1]));
    } else if (f.dropString) {
      const drop = (v) => {
        if (Array.isArray(v)) return v.filter((x) => !(typeof x === 'string' && x.includes(f.dropString))).map(drop);
        if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, drop(x)]));
        return v;
      };
      out = drop(out);
    }
  }
  return out;
}

/** Tira os campos de metadado; `reprintedAs` fica só se aponta para dentro. */
export function pruneMeta(e, keptKeys) {
  const out = { ...e };
  for (const f of META_FIELDS) delete out[f];
  if (out.srd52) out.srd52 = true;
  if (Array.isArray(out.reprintedAs)) {
    const inside = out.reprintedAs.filter((r) => keptKeys.has(norm(typeof r === 'string' ? r : r?.uid)));
    if (inside.length) out.reprintedAs = inside;
    else delete out.reprintedAs;
  }
  if (out.inherits && typeof out.inherits === 'object') {
    const inh = { ...out.inherits };
    for (const f of META_FIELDS) delete inh[f];
    if (inh.srd52) inh.srd52 = true;
    out.inherits = inh;
  }
  return out;
}

/** O mapa magia -> classes, só com magias e classes mantidas. */
export function filterSpellSources(map, keptSpells, keptClasses) {
  const out = {};
  for (const [src, spells] of Object.entries(map ?? {})) {
    for (const [name, info] of Object.entries(spells ?? {})) {
      if (!keptSpells.has(`${norm(name)}|${norm(src)}`)) continue;
      const entry = {};
      for (const [k, list] of Object.entries(info ?? {})) {
        if (!Array.isArray(list)) continue;
        const kept = list.filter((c) => keptClasses.has(`${norm(c.className ?? c.name)}|${norm(c.classSource ?? c.source)}`));
        if (kept.length) entry[k] = kept;
      }
      if (Object.keys(entry).length) (out[src] ??= {})[name] = entry;
    }
  }
  return out;
}

/** O overlay Foundry, só o que casa com entidades mantidas. */
export function filterOverlay(file, kept) {
  const out = {};
  for (const [k, arr] of Object.entries(file ?? {})) {
    if (!Array.isArray(arr)) { out[k] = arr; continue; }
    out[k] = arr.filter((e) => {
      if (k === 'raceFeature') return kept.races.has(`${norm(e.raceName)}|${norm(e.raceSource)}`);
      if (k === 'race') return kept.races.has(`${norm(String(e.name).replace(/ \(.*$/, ''))}|${norm(e.source)}`);
      if (e.className) return kept.keys.has(entityKey(e));
      return kept.nameSource.has(`${norm(e.name)}|${norm(e.source)}|${k}`);
    });
  }
  return out;
}

/** Propriedades, tipos e entradas-modelo que algum item mantido referencia. */
export function filterItemMeta(base, keptItems) {
  const refs = new Set();
  const add = (s) => { if (typeof s === 'string') refs.add(norm(s)); };
  for (const it of keptItems) {
    add(it.type);
    for (const p of it.property ?? []) add(typeof p === 'string' ? p : p?.uid);
    const text = JSON.stringify(it.entries ?? []);
    for (const m of text.matchAll(/\{#itemEntry ([^}]*)\}/g)) add(m[1]);
  }
  const abbr = (e) => norm(`${e.abbreviation}|${e.source}`);
  const out = { ...base };
  if (Array.isArray(base.itemProperty)) out.itemProperty = base.itemProperty.filter((e) => refs.has(abbr(e)));
  if (Array.isArray(base.itemType)) out.itemType = base.itemType.filter((e) => refs.has(abbr(e)));
  if (Array.isArray(base.itemTypeAdditionalEntries)) out.itemTypeAdditionalEntries = base.itemTypeAdditionalEntries.filter((e) => refs.has(norm(e.appliesTo)));
  if (Array.isArray(base.itemEntry)) out.itemEntry = base.itemEntry.filter((e) => refs.has(norm(`${e.name}|${e.source}`)));
  return out;
}

/** Texto comparável: sem HTML nem @UUID, aspas retas, espaço único, minúsculo. */
export function normalizeCorpus(s) {
  return String(s ?? '')
    .replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/@\w+\[([^|\]]*)[^\]]*\]/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/ ([.,;:)])/g, '$1')
    .replace(/\( /g, '(')
    .toLowerCase();
}

/**
 * Os nomes protegidos que sobraram e cujo trecho (até `pad` caracteres de cada
 * lado) não aparece igual no SRD; com `docNames`, também o NOME da entrada.
 */
export function scanProtected(bundle, terms, corpus, { pad = 20, docNames = null, legacyCorpus = null, legacyDocNames = null } = {}) {
  const re = new RegExp(`${BS}b(${terms.join('|')})${BS}b`, 'gi');
  const hits = [];
  const seen = new Set();
  for (const [fk, file] of Object.entries(bundle)) {
    for (const [ak, arr] of Object.entries(file ?? {})) {
      if (!Array.isArray(arr)) continue;
      for (const e of arr) {
        const where = `${fk}.${ak}:${e?.name ?? '?'}|${e?.source ?? ''}`;
        const old = Boolean(e?.srd51);
        const text = old ? legacyCorpus ?? '' : corpus;
        const names = old ? legacyDocNames : docNames;
        const nameHit = names && typeof e?.name === 'string' ? normalizeCorpus(e.name).match(re) : null;
        if (nameHit && !names.has(normalizeCorpus(e.name))) {
          hits.push({ where, term: nameHit[0], text: `nome "${e.name}" não é nome de documento do SRD` });
        }
        mapStrings(e, (s) => {
          const plain = normalizeCorpus(stripTags(s));
          for (const m of plain.matchAll(re)) {
            const a = Math.max(0, m.index - pad);
            const b = Math.min(plain.length, m.index + m[0].length + pad);
            const windowText = plain.slice(a, b).trim();
            if (text.includes(windowText)) continue;
            const key = `${where}#${m[0]}#${windowText}`;
            if (seen.has(key)) continue;
            seen.add(key);
            hits.push({ where, term: m[0], text: windowText });
          }
          return s;
        });
      }
    }
  }
  return hits;
}

/**
 * O pacote SRD inteiro a partir do compêndio completo.
 * @param {object} full
 * @param {{ textFixes?: Record<string, object[]>, extraRenames?: Record<string, string> }} [opts]
 * @returns {{ bundle: object, report: object }}
 */
export function buildSrdBundle(full, { textFixes = {}, extraRenames = {}, legacy = null } = {}) {
  const renames = buildRenames(full, extraRenames);
  const legacyFound = new Set();
  const keptNames = new Set();
  const keptKeys = new Set();
  const keptSpells = new Set();
  const keptClasses = new Set();
  const kept = { keys: new Set(), nameSource: new Set(), races: new Set() };
  const counts = {};

  const staged = {};
  for (const [fk, file] of Object.entries(full)) {
    if (fk.startsWith('fluff-')) {
      staged[fk] = Object.fromEntries(Object.entries(file ?? {}).map(([k, v]) => [k, Array.isArray(v) ? [] : v]));
      continue;
    }
    if (fk.startsWith('foundry-') || fk === 'spell-sources') continue;
    const outFile = {};
    for (const [ak, arr] of Object.entries(file ?? {})) {
      const variant = fk === 'magicvariants' && ak === 'magicvariant';
      if (!(isEntityArray(arr) || variant)) { outFile[ak] = arr; continue; }
      if (fk === 'items-base' && ak !== 'baseitem' && ak !== 'itemMastery') { outFile[ak] = arr; continue; }
      if (fk === 'languages' && ak === 'languageScript') { outFile[ak] = []; continue; }
      const keep = arr
        .filter((e) => srdKeep(e) || legacyKeep(e, `${fk}.${ak}`, legacy))
        .map((e) => (srdKeep(e) ? e : (legacyFound.add(`${fk}.${ak}:${legacyKey(e)}`), { ...e, srd51: true })));
      counts[`${fk}.${ak}`] = [keep.length, arr.length];
      for (const e of keep) {
        const name = typeof e.srd52 === 'string' ? e.srd52 : (typeof e.inherits?.srd52 === 'string' ? e.inherits.srd52 : e.name);
        keptNames.add(norm(name));
        keptKeys.add(norm(`${name}|${e.source}`));
        kept.keys.add(entityKey({ ...e, name }));
        kept.keys.add(entityKey(e));
        kept.nameSource.add(`${norm(e.name)}|${norm(e.source)}|${ak}`);
        if (fk.startsWith('spells-')) keptSpells.add(`${norm(e.name)}|${norm(e.source)}`);
        if (ak === 'class') keptClasses.add(`${norm(e.name)}|${norm(e.source)}`);
        if (ak === 'race') kept.races.add(`${norm(e.name)}|${norm(e.source)}`);
      }
      outFile[ak] = keep;
    }
    staged[fk] = outFile;
  }
  if (Array.isArray(full['magicvariants']?.linkedLootTables)) staged['magicvariants'].linkedLootTables = [];
  else if (staged['magicvariants']?.linkedLootTables) staged['magicvariants'].linkedLootTables = {};

  const allItems = [...(staged['items-base']?.baseitem ?? []), ...(staged['items']?.item ?? [])];
  if (staged['items-base']) staged['items-base'] = filterItemMeta(staged['items-base'], allItems);

  for (const fk of Object.keys(full).filter((k) => k.startsWith('foundry-'))) staged[fk] = filterOverlay(full[fk], kept);
  if (full['spell-sources']) staged['spell-sources'] = filterSpellSources(full['spell-sources'], keptSpells, keptClasses);

  const applied = new Set();
  const transform = (e) => {
    const key = `${e.name}|${e.source}`;
    let out = textFixes[key] ? (applied.add(key), applyTextFixes(e, textFixes[key])) : e;
    out = mapStrings(out, (s) => untagOutside(renameText(s, renames), keptNames));
    return pruneMeta(out, keptKeys);
  };
  const bundle = {};
  for (const [fk, file] of Object.entries(staged)) {
    if (fk === 'spell-sources') {
      bundle[fk] = Object.fromEntries(Object.entries(file).map(([src, spells]) => [src,
        Object.fromEntries(Object.entries(spells).map(([n, info]) => [renameText(n, renames), info]))]));
      continue;
    }
    const outFile = {};
    for (const [ak, arr] of Object.entries(file ?? {})) {
      outFile[ak] = Array.isArray(arr) && arr.every((e) => e && typeof e === 'object') ? arr.map(transform) : arr;
    }
    bundle[fk] = outFile;
  }
  const unusedFixes = Object.keys(textFixes).filter((k) => !applied.has(k));
  const legacyMissing = Object.entries(legacy ?? {})
    .flatMap(([where, keys]) => keys.map((k) => `${where}:${k}`))
    .filter((k) => !legacyFound.has(k));
  return {
    bundle,
    report: { counts, renames: renames.size, renameMap: Object.fromEntries(renames), unusedFixes, legacy: legacyFound.size, legacyMissing },
  };
}
