// =============================================================================
// magicVariants - expansão de variantes genéricas de itens mágicos (5etools)
// =============================================================================
// O catálogo de itens do 5e.tools NÃO lista "+1 Longsword" ou "Warhammer of
// Warning": esses itens são GERADOS em runtime aplicando as variantes GENÉRICAS
// de magicvariants.json ("+1 Weapon", "Weapon of Warning"…) sobre os itens BASE
// (items-base.json) que casam com seus `requires`/`excludes`. Este módulo é o
// porte dessa expansão (Renderer.item._createSpecificVariants do 5etools) para
// o nosso engine - sem ela a loja não tem nenhum "+1 Shield" ou variante.
//
// Decisões de adaptação (vs. o 5etools integral):
//  - Só variantes ATUAIS: toda variante `edition: "classic"` tem reprint XDMG
//    (verificado 2026-07-16 sobre o dataset completo), então descartamos
//    qualquer uma com `inherits.reprintedAs` - o mesmo princípio do latestOnly.
//  - Itens base: só os pós-latestOnly (o app inteiro esconde reprints). A
//    matriz de edição do 5etools é mantida p/ os casos base=classic sem reprint.
//  - Campos de publicação (srd/page/lootTables…) não são herdados - ruído sem
//    consumidor no app.
//
// Puro: sem rede/DOM. Memoizado por db (WeakMap), como engine/glossary.js.
// -----------------------------------------------------------------------------

import { latestOnly } from '../selector/reprints';

// --- Matching de requires/excludes (porte literal do 5etools) -----------------
// `requires` é uma LISTA de alternativas (OR); dentro de cada uma, TODAS as
// chaves precisam casar (AND). `excludes` é um único objeto: QUALQUER chave que
// case veta o item. Valores-array casam por interseção/pertinência literal
// (ex: requires {type:"M|XPHB"} contra baseitem.type "M|XPHB").
function isMatch(candidate, requirements, method) {
  if (candidate == null || requirements == null) return false;
  return Object.entries(requirements)[method](([key, reqVal]) => {
    if (Array.isArray(reqVal)) {
      return Array.isArray(candidate[key])
        ? candidate[key].some((it) => reqVal.includes(it))
        : reqVal.includes(candidate[key]);
    }
    if (reqVal != null && typeof reqVal === 'object') {
      return isMatch(candidate[key], reqVal, method);
    }
    return Array.isArray(candidate[key])
      ? candidate[key].some((it) => reqVal === it)
      : reqVal === candidate[key];
  });
}

export function variantApplies(baseItem, variant) {
  if (!editionMatch(baseItem, variant)) return false;
  if (!(variant.requires ?? []).some((req) => isMatch(baseItem, req, 'every'))) return false;
  if (variant.excludes && isMatch(baseItem, variant.excludes, 'some')) return false;
  return true;
}

/** Matriz de edições do 5etools: iguais casam; base "classic" nunca recebe
 * variante de outra edição; base sem edição recebe qualquer uma; base "one" não
 * recebe variante "classic". */
function editionMatch(baseItem, variant) {
  const b = baseItem.edition ?? null;
  const v = variant.edition ?? null;
  if (b === v) return true;
  if (b === 'classic') return false;
  if (b == null) return true;
  if (b === 'one') return v !== 'classic';
  return false;
}

// --- Templates {=prop} nas entries herdadas -----------------------------------
// As entries de `inherits` são moldes: "{=bonusWeapon} bonus…", "{=baseName/l}".
// Os modificadores relevantes no dataset: l (minúsculas), t (Title Case),
// a (vira o artigo "a"/"an"), u (maiúsculas) - aplicados na ordem fixa do
// 5etools (valor → representação).
const MOD_ORDER = ['r', 'f', 'c', 'v', 'x', 'l', 't', 'u', 'a'];

function applyMods(value, mods) {
  let out = String(value);
  const sorted = [...mods].sort((a, b) => MOD_ORDER.indexOf(a) - MOD_ORDER.indexOf(b));
  for (const m of sorted) {
    if (m === 'l') out = out.toLowerCase();
    else if (m === 'u') out = out.toUpperCase();
    else if (m === 't') out = out.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));
    else if (m === 'a') out = /^[aeiou]/i.test(out) ? 'an' : 'a';
  }
  return out;
}

/** Nome COMPLETO (minúsculo) do tipo de dano, p/ o template {=dmgType}. */
const DMG_TYPE_FULL = {
  A: 'acid', B: 'bludgeoning', C: 'cold', F: 'fire', O: 'force', L: 'lightning',
  N: 'necrotic', P: 'piercing', I: 'poison', Y: 'psychic', R: 'radiant', S: 'slashing', T: 'thunder',
};

/** Propriedades injetáveis nos templates (porte de _getInjectableProps). */
function injectableProps(baseItem, inherits) {
  return {
    baseName: baseItem.name,
    dmgType: baseItem.dmgType ? DMG_TYPE_FULL[baseItem.dmgType] ?? baseItem.dmgType : null,
    bonusAc: inherits.bonusAc,
    bonusWeapon: inherits.bonusWeapon,
    bonusWeaponAttack: inherits.bonusWeaponAttack,
    bonusWeaponDamage: inherits.bonusWeaponDamage,
    bonusWeaponCritDamage: inherits.bonusWeaponCritDamage,
    bonusSpellAttack: inherits.bonusSpellAttack,
    bonusSpellSaveDc: inherits.bonusSpellSaveDc,
    bonusSavingThrow: inherits.bonusSavingThrow,
  };
}

function applyTemplateString(str, props) {
  return str.replace(/\{=([^}/]+)(?:\/([^}]+))?\}/g, (_, path, mods) => {
    const v = props[path];
    if (v == null) return '';
    return mods ? applyMods(v, mods) : String(v);
  });
}

/** Aplica os templates {=…} em profundidade (strings dentro de listas/objetos). */
function applyTemplates(node, props) {
  if (typeof node === 'string') return applyTemplateString(node, props);
  if (Array.isArray(node)) return node.map((n) => applyTemplates(n, props));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = applyTemplates(v, props);
    return out;
  }
  return node;
}

// --- Expressões de peso/valor --------------------------------------------------
// Ex: "[[baseItem.value]] + 50000" (Adamantine), "[[baseItem.weight]] * 2"
// (Barding). Substitui os [[caminhos]] e avalia a aritmética simples (+ - * /,
// precedência de * e /). Sem valor no item base → null (a propriedade não é
// definida, como no 5etools quando a expressão não resolve).
function getPath(obj, path) {
  let cur = obj;
  for (const p of path.split('.')) cur = cur?.[p];
  return cur;
}

export function evaluateExpression(expr, { baseItem, item }) {
  let missing = false;
  const substituted = String(expr).replace(/\[\[([^\]]+)\]\]/g, (_, path) => {
    const parts = path.split('.');
    const value =
      parts[0] === 'item' ? getPath(item, parts.slice(1).join('.'))
      : parts[0] === 'baseItem' ? getPath(baseItem, parts.slice(1).join('.'))
      : getPath(item, path);
    if (typeof value !== 'number') {
      missing = true;
      return '0';
    }
    return String(value);
  });
  if (missing) return null;
  if (!/^[\d\s+\-*/().]+$/.test(substituted)) return null;
  const tokens = substituted.match(/\d+(?:\.\d+)?|[+\-*/()]/g) ?? [];
  return evalTokens(tokens);
}

/** Avaliador aritmético mínimo (números, + - * /, parênteses). */
function evalTokens(tokens) {
  let pos = 0;
  function parseExpr() {
    let left = parseTerm();
    while (tokens[pos] === '+' || tokens[pos] === '-') {
      const op = tokens[pos++];
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }
  function parseTerm() {
    let left = parseFactor();
    while (tokens[pos] === '*' || tokens[pos] === '/') {
      const op = tokens[pos++];
      const right = parseFactor();
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }
  function parseFactor() {
    if (tokens[pos] === '(') {
      pos++;
      const v = parseExpr();
      pos++; // ')'
      return v;
    }
    if (tokens[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    return Number(tokens[pos++]);
  }
  const result = parseExpr();
  return Number.isFinite(result) ? result : null;
}

// --- Referências {#itemEntry …} ------------------------------------------------
// Entries herdadas podem ser uma referência a um molde compartilhado de
// items-base.json (`itemEntry`), ex: Armor of Resistance → "You have Resistance
// to {{getFullImmRes item.resist}} damage…". Resolve o molde e substitui os
// {{item.caminho}} / {{função item.caminho}} com os campos do próprio item
// específico (porte de Renderer.utils.applyTemplate).
const titleCase = (s) => String(s).replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));

/** Parser.getFullImmRes p/ o caso dos itens (lista simples de tipos de dano):
 * Title Case (estilo 2024) + junção em lista ("Acid", "Acid and Fire"…). */
function fullImmRes(values) {
  const list = (Array.isArray(values) ? values : [values]).filter((v) => typeof v === 'string');
  const rendered = list.map(titleCase);
  if (rendered.length <= 1) return rendered.join('');
  if (rendered.length === 2) return rendered.join(' and ');
  return `${rendered.slice(0, -1).join(', ')}, and ${rendered.at(-1)}`;
}

function applyItemEntryTemplate(node, item) {
  if (typeof node === 'string') {
    return node.replace(/\{\{(?:(\w+) +)?item\.([^}]+)\}\}/g, (_, fn, path) => {
      const v = getPath(item, path.trim());
      if (v == null) return '';
      if (fn === 'getFullImmRes') return fullImmRes(v);
      return Array.isArray(v) ? v.join(', ') : String(v);
    });
  }
  if (Array.isArray(node)) return node.map((n) => applyItemEntryTemplate(n, item));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = applyItemEntryTemplate(v, item);
    return out;
  }
  return node;
}

function derefItemEntries(specificVariant, db) {
  const templates = db?.['items-base']?.itemEntry ?? [];
  specificVariant.entries = (specificVariant.entries ?? []).flatMap((ent) => {
    if (typeof ent !== 'string') return [ent];
    const m = /^\{#itemEntry ([^}|]+)(?:\|([^}]+))?\}$/.exec(ent.trim());
    if (!m) return [ent];
    const [, name, src] = m;
    const candidates = templates.filter((t) => t.name === name);
    const hit =
      (src && candidates.find((t) => t.source?.toLowerCase() === src.toLowerCase())) ??
      candidates.find((t) => t.source === specificVariant.source) ??
      candidates[0];
    if (!hit?.entriesTemplate) return [];
    return applyItemEntryTemplate(hit.entriesTemplate, specificVariant);
  });
}

// --- Merge de vulnerable/resist/immune ------------------------------------------
// Cada valor deve ser único ENTRE os três arrays: o que a variante define num
// deles é removido dos outros dois vindos do item base (porte simplificado de
// _createSpecificVariants_mergeVulnerableResistImmune).
const VRI_PROPS = ['vulnerable', 'resist', 'immune'];

function mergeVulnResImm(specificVariant, inherits) {
  const fromBase = {};
  for (const prop of VRI_PROPS) {
    if (specificVariant[prop]) fromBase[prop] = [...specificVariant[prop]];
  }
  for (const prop of VRI_PROPS) {
    const val = inherits[prop];
    if (val === undefined) continue;
    if (val === null) {
      delete fromBase[prop];
      continue;
    }
    for (const other of VRI_PROPS) {
      if (other !== prop && fromBase[other]) {
        fromBase[other] = fromBase[other].filter((v) => !val.includes(v));
      }
    }
    fromBase[prop] = [...new Set([...(fromBase[prop] ?? []), ...val])];
  }
  for (const prop of VRI_PROPS) {
    if (fromBase[prop]?.length) specificVariant[prop] = fromBase[prop];
    else delete specificVariant[prop];
  }
}

// --- Criação de uma variante específica ------------------------------------------

/** Campos de publicação do base/inherits que NÃO propagam (ruído sem consumidor;
 * `reprintedAs` em particular NÃO pode vazar - o latestOnly esconderia o item). */
const DROP_FIELDS = [
  'srd', 'srd52', 'basicRules', 'basicRules2024', 'page', 'reprintedAs',
  'referenceSources', 'hasFluff', 'hasFluffImages', 'lootTables', 'otherSources',
  'hasRefs', 'tier',
];

const uidOf = (name, source) => `${name}|${source}`;

export function createSpecificVariant(baseItem, variant, db) {
  const inherits = variant.inherits ?? {};
  const sv = structuredClone(baseItem);

  sv._category = 'Specific Variant';
  sv._baseName = baseItem.name;
  sv._variantName = variant.name;
  sv.baseItem = uidOf(baseItem.name, baseItem.source);
  // Item mágico não herda o preço do mundano (o derivado por raridade usa
  // `baseItem` - ver engine/magicItemPrice.js).
  delete sv.value;
  for (const f of DROP_FIELDS) delete sv[f];

  const props = injectableProps(baseItem, inherits);

  // "Remove" primeiro (nameRemove antes de prefix/suffix), como no 5etools.
  const entriesSorted = Object.entries(inherits).sort(
    ([kA], [kB]) => kB.includes('Remove') - kA.includes('Remove'),
  );
  for (const [key, val] of entriesSorted) {
    switch (key) {
      case 'namePrefix':
        sv.name = `${val}${sv.name}`;
        break;
      case 'nameSuffix':
        sv.name = `${sv.name}${val}`;
        break;
      case 'nameRemove':
        sv.name = sv.name.split(val).join('');
        break;
      case 'entries': {
        const applied = applyTemplates(val, props);
        sv.entries = [...applied, ...(sv.entries ?? [])];
        break;
      }
      case 'vulnerable':
      case 'resist':
      case 'immune':
        break; // merge dedicado abaixo
      case 'conditionImmune':
        sv.conditionImmune = [...new Set([...(sv.conditionImmune ?? []), ...val])];
        break;
      case 'weightExpression':
      case 'valueExpression': {
        const result = evaluateExpression(val, { baseItem, item: sv });
        if (result != null) {
          if (key === 'weightExpression') sv.weight = result;
          else sv.value = result;
        }
        break;
      }
      case 'weightMult':
        if (typeof sv.weight === 'number') sv.weight *= val;
        break;
      case 'valueMult':
        if (typeof sv.value === 'number') sv.value *= val;
        break;
      case 'barding':
        sv.bardingType = baseItem.type;
        break;
      case 'propertyAdd':
        sv.property = [
          ...(sv.property ?? []),
          ...val.filter((it) => !(sv.property ?? []).some((p) => (p?.uid ?? p) === (it?.uid ?? it))),
        ];
        break;
      case 'propertyRemove':
        if (sv.property) {
          sv.property = sv.property.filter((p) => !val.includes(p?.uid ?? p));
          if (!sv.property.length) delete sv.property;
        }
        break;
      default:
        if (DROP_FIELDS.includes(key)) break;
        if (val === null) delete sv[key];
        else sv[key] = structuredClone(val);
    }
  }

  mergeVulnResImm(sv, inherits);
  derefItemEntries(sv, db);
  return sv;
}

// --- Expansão completa + memoização por db --------------------------------------

function buildAll(db) {
  // Toda variante "classic" tem reprint XDMG (dataset verificado); ficar só com
  // as atuais evita gerar "+1 Longsword" duplicado (DMG e XDMG).
  const variants = (db?.magicvariants?.magicvariant ?? []).filter(
    (v) => !v.inherits?.reprintedAs?.length,
  );
  const baseItems = latestOnly(db?.['items-base']?.baseitem ?? []).filter(
    (b) => !b.packContents,
  );
  // Um item gerado nunca pode SOMBREAR um item real do catálogo (alguns "+X"
  // nomeados existem em items.json de verdade) - o real vence.
  const taken = new Set(
    [...latestOnly(db?.items?.item ?? []), ...baseItems].map((i) =>
      uidOf(i.name, i.source).toLowerCase(),
    ),
  );

  const list = [];
  const byId = new Map();
  for (const base of baseItems) {
    for (const variant of variants) {
      if (!variantApplies(base, variant)) continue;
      const sv = createSpecificVariant(base, variant, db);
      const id = uidOf(sv.name, sv.source).toLowerCase();
      // Colisão (mesmo nome+fonte já catalogado ou já gerado): mantém o primeiro.
      if (taken.has(id) || byId.has(id)) continue;
      byId.set(id, sv);
      list.push(sv);
    }
  }
  return { list, byId };
}

const cache = new WeakMap();

function expansion(db) {
  if (!db || typeof db !== 'object') return { list: [], byId: new Map() };
  let out = cache.get(db);
  if (!out) {
    out = buildAll(db);
    cache.set(db, out);
  }
  return out;
}

/** Todas as variantes específicas geradas (memoizado por db). */
export function specificVariants(db) {
  return expansion(db).list;
}

/** Resolve uma variante específica por nome+fonte (case-insensitive), ou null. */
export function resolveVariantObj(db, name, source) {
  if (!name) return null;
  return expansion(db).byId.get(uidOf(name, source ?? '').toLowerCase()) ?? null;
}
