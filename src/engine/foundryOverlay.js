// =============================================================================
// foundryOverlay: o overlay foundry-*.json do 5etools (DDL-0009)
// =============================================================================
// O QUE FAZ
//   O 5etools mantém (MIT, no mesmo mirror) um overlay de mecânicas Foundry:
//   foundry-feats, foundry-races, foundry-optionalfeatures e class/foundry.json,
//   keyed por nome e fonte, com effects, activities, system e advancement que a
//   prosa não expressa. Este módulo os indexa (memoizado por db) e traduz para o
//   formato do dnd5e. Adotado POR COMPLETO no DDL-0057.
//
// FUNÇÕES
//   Índice
//   norm(s), overlayId(), push(map, key, entry), buildIndex(db), indexFor(db).
//   Tradução
//   translateChange(ch): um change do overlay, ou null.
//   translateOverlayEffects(entry, fallbackName), overlayEffectsWithIds(entry,
//     fallbackName): os effects (e o mapa foundryId para `_id`).
//   setPath(target, path, value), translateOverlaySystem(entry): o `system`.
//   resolvePlaceholder(value), resolveActivityRefs(act),
//     translateOverlayActivities(entry, effectIds): as activities.
//   overlayMechanics(entry, fallbackName): effects, activities e system juntos.
//   translateOverlayAdvancement(entry): os ScaleValue.
//   pickEntry(entries, source, level): a entrada certa entre homônimas.
//   Consultas (todas toleram db null)
//   overlayFeatEntry, overlayOptionalFeatureEntry, overlayClassFeatureEntry,
//     overlaySubclassFeatureEntry: a entrada crua.
//   overlayClassAdvancement, overlaySubclassAdvancement, overlayRaceAdvancement:
//     os ScaleValue de classe, subclasse e raça.
//   overlayFeatEffects, overlayOptionalFeatureEffects, overlayClassFeatureEffects,
//     overlaySubclassFeatureEffects: os effects.
//   overlayRaceEffects(db, raceObj, itemizedNames), overlayRaceTraits(db, raceObj):
//     a mecânica dos traços de raça.
//
// DECISÕES E ARMADILHAS
//   - O curado (foundryEffects) vence; o overlay só preenche quem não tem entrada,
//     tudo-ou-nada por feature (DDL-0031).
//   - Traduções: `mode` é string no overlay (vira o número de
//     ACTIVE_EFFECT_MODES); `value` vira string; `transfer` AUSENTE é "on-use", não
//     true (a semântica do conversor do Plutonium); effects `enchantment` e riders
//     são de item e saem; só data paths de ator (system., flags.) entram.
//   - Changes em `system.attributes.hp.bonuses.*` são DESCARTADOS: o HP extra já
//     vai nativo (hpBonuses), e um AE somaria em dobro (o Tough some inteiro).
//   - pickEntry: a FONTE é obrigatória (nunca cruza PHB e XPHB); entre homônimas,
//     o nível exato, senão o mais baixo (o nosso item é dedupado na 1ª ocorrência).
//   - Activities: `effects[].foundryId` vira o `_id` real; link órfão é
//     descartado. `@spell[...]`, `@creature[...]` são TOKENS do Plutonium, não
//     uuids (TC-0070): resolvidos para o uuid do compêndio, ou a activity inteira
//     sai. As `enchant` FICAM (os premades as trazem: Martial Arts, Sacred Weapon);
//     descartá-las foi o erro da primeira tentativa.
//   - O ScaleValue de raça (o Breath Weapon, 1d10 a 4d10) é o alvo do `@scale` da
//     activity do sopro; sem ele o Foundry rola ZERO.
//   - Traços de raça: o lookup tenta o nome RESOLVIDO (o overlay tem entradas da
//     sub-raça mesclada) e depois o BASE (`_baseName`). Só traços que a raça
//     resolvida TEM (a linhagem que substitui um traço não herda o efeito). Hoje
//     TODO traço vira item (TC-0064), e a mecânica viaja com ele; `ownItem` marca
//     os que têm activities ou uses.
// -----------------------------------------------------------------------------

import { spellUuid } from './compendiumUuids';

const norm = (s) => (s ?? '').toString().trim().toLowerCase();

const MODE_NUM = { CUSTOM: 0, MULTIPLY: 1, ADD: 2, DOWNGRADE: 3, UPGRADE: 4, OVERRIDE: 5 };

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Id de 16 caracteres (local, para não importar o foundryItems). */
function overlayId() {
  let s = '';
  for (let i = 0; i < 16; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s;
}

/** @type {WeakMap<object, ReturnType<typeof buildIndex>>} */
const CACHE = new WeakMap();

function push(map, key, entry) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(entry);
}

function buildIndex(db) {
  const feat = new Map();
  for (const e of db?.['foundry-feats']?.feat ?? []) {
    feat.set(`${norm(e.name)}|${norm(e.source)}`, e);
  }
  const optional = new Map();
  for (const e of db?.['foundry-optionalfeatures']?.optionalfeature ?? []) {
    optional.set(`${norm(e.name)}|${norm(e.source)}`, e);
  }
  const classFeature = new Map();
  const subclassFeature = new Map();
  for (const e of db?.['foundry-class']?.classFeature ?? []) {
    push(classFeature, `${norm(e.name)}|${norm(e.className)}`, e);
  }
  for (const e of db?.['foundry-class']?.subclassFeature ?? []) {
    push(subclassFeature, `${norm(e.name)}|${norm(e.className)}|${norm(e.subclassShortName)}`, e);
  }
  const raceFeature = new Map();
  for (const e of db?.['foundry-races']?.raceFeature ?? []) {
    if (e._copy) continue;
    push(raceFeature, `${norm(e.raceName)}|${norm(e.raceSource)}`, e);
  }
  return { feat, optional, classFeature, subclassFeature, raceFeature };
}

function indexFor(db) {
  if (!db || typeof db !== 'object') return null;
  let idx = CACHE.get(db);
  if (!idx) {
    idx = buildIndex(db);
    CACHE.set(db, idx);
  }
  return idx;
}

/** Um change do overlay no formato do Foundry, ou null. */
function translateChange(ch) {
  const key = String(ch?.key ?? '');
  if (!/^(system\.|flags\.)/.test(key)) return null;
  if (key.startsWith('system.attributes.hp.bonuses')) return null;
  const mode = MODE_NUM[ch.mode] ?? (typeof ch.mode === 'number' ? ch.mode : MODE_NUM.ADD);
  const value = typeof ch.value === 'object' ? JSON.stringify(ch.value) : String(ch.value);
  return { key, mode, value, priority: ch.priority ?? null };
}

/**
 * Os effects de uma entrada do overlay como Active Effects do dnd5e.
 * @param {object} entry
 * @param {string} fallbackName
 * @returns {object[]}
 */
export function translateOverlayEffects(entry, fallbackName) {
  return overlayEffectsWithIds(entry, fallbackName).effects;
}

/** Os effects e o mapa foundryId para `_id` gerado. */
function overlayEffectsWithIds(entry, fallbackName) {
  const effects = [];
  const byFoundryId = new Map();
  for (const eff of entry?.effects ?? []) {
    if (eff?.type === 'enchantment' || eff?.enchantmentRiderParent) continue;
    const changes = (eff?.changes ?? []).map(translateChange).filter(Boolean);
    const statuses = eff?.statuses ?? [];
    if (!changes.length && !statuses.length) continue;
    const _id = overlayId();
    if (eff.foundryId) byFoundryId.set(eff.foundryId, _id);
    effects.push({
      _id,
      name: eff.name ?? fallbackName,
      changes,
      disabled: !!eff.disabled,
      transfer: !!eff.transfer,
      ...(statuses.length ? { statuses } : {}),
      img: 'icons/svg/aura.svg',
      origin: '',
      duration: eff.duration ?? {},
      description: eff.description ?? '',
      flags: {},
    });
  }
  return { effects, byFoundryId };
}

/** Escreve `a.b.c` num objeto, criando os níveis. */
function setPath(target, path, value) {
  const parts = String(path).split('.');
  let node = target;
  for (const p of parts.slice(0, -1)) {
    if (typeof node[p] !== 'object' || node[p] === null) node[p] = {};
    node = node[p];
  }
  node[parts.at(-1)] = value;
}

/** O `system` do overlay (dot-path) num objeto aninhado. */
function translateOverlaySystem(entry) {
  const out = {};
  for (const [path, value] of Object.entries(entry?.system ?? {})) setPath(out, path, value);
  if (out.uses) out.uses = { max: '', spent: 0, recovery: [], ...out.uses };
  return out;
}

const PLACEHOLDER = /@(\w+)\[([^\]]*)\]/;

/** `@spell[nome|fonte]` vira o uuid do compêndio, ou null. */
function resolvePlaceholder(value) {
  const m = PLACEHOLDER.exec(String(value ?? ''));
  if (!m) return value;
  if (m[1] !== 'spell') return null;
  return spellUuid(m[2].split('|')[0]) ?? null;
}

/** A activity com toda referência resolvida, ou null. */
function resolveActivityRefs(act) {
  const walk = (v) => {
    if (typeof v === 'string') return PLACEHOLDER.test(v) ? resolvePlaceholder(v) : v;
    if (Array.isArray(v)) {
      const out = [];
      for (const x of v) {
        const r = walk(x);
        if (r === null) return null;
        out.push(r);
      }
      return out;
    }
    if (v && typeof v === 'object') {
      const out = {};
      for (const [k, x] of Object.entries(v)) {
        const r = walk(x);
        if (r === null) return null;
        out[k] = r;
      }
      return out;
    }
    return v;
  };
  return walk(act);
}

/** As activities do overlay no mapa indexado por `_id`. */
function translateOverlayActivities(entry, effectIds) {
  const out = {};
  for (const act of entry?.activities ?? []) {
    if (!act?.type) continue;
    const resolved = resolveActivityRefs(act);
    if (!resolved) continue;
    const _id = overlayId();
    const { effects, ...rest } = resolved;
    delete rest.foundryId;
    const linked = (effects ?? [])
      .map((e) => (e?.foundryId ? effectIds.get(e.foundryId) : e?._id))
      .filter(Boolean)
      .map((id) => ({ _id: id }));
    out[_id] = { _id, ...rest, ...(linked.length ? { effects: linked } : {}) };
  }
  return out;
}

/**
 * Toda a mecânica de uma entrada do overlay.
 * @param {object|null} entry
 * @param {string} fallbackName
 * @returns {{effects: object[], activities: object, system: object}}
 */
export function overlayMechanics(entry, fallbackName) {
  if (!entry) return { effects: [], activities: {}, system: {} };
  const { effects, byFoundryId } = overlayEffectsWithIds(entry, fallbackName);
  return {
    effects,
    activities: translateOverlayActivities(entry, byFoundryId),
    system: translateOverlaySystem(entry),
  };
}

/** Os ScaleValue do overlay no nosso formato. */
function translateOverlayAdvancement(entry) {
  return (entry?.advancement ?? [])
    .filter((a) => a?.type === 'ScaleValue' && a.configuration?.scale)
    .map((a) => ({
      type: 'ScaleValue',
      title: a.title ?? '',
      configuration: {
        identifier: a.configuration.identifier ?? '',
        type: a.configuration.type ?? 'number',
        distance: { units: a.configuration.type === 'distance' ? 'ft' : '' },
        scale: a.configuration.scale,
      },
    }));
}

/** A entrada certa entre homônimas: mesma fonte, nível exato ou o mais baixo. */
function pickEntry(entries, source, level) {
  const candidates = (entries ?? []).filter((e) => norm(e.source) === norm(source));
  if (!candidates.length) return null;
  const exact = candidates.find((e) => e.level === level);
  return exact ?? [...candidates].sort((a, b) => (a.level ?? 0) - (b.level ?? 0))[0];
}

/** A entrada de um talento. */
export function overlayFeatEntry(db, name, source) {
  return indexFor(db)?.feat.get(`${norm(name)}|${norm(source)}`) ?? null;
}

/** A entrada de uma optional feature. */
export function overlayOptionalFeatureEntry(db, name, source) {
  return indexFor(db)?.optional.get(`${norm(name)}|${norm(source)}`) ?? null;
}

/** A entrada de uma feature de classe. */
export function overlayClassFeatureEntry(db, { name, classId, source, level }) {
  return pickEntry(indexFor(db)?.classFeature.get(`${norm(name)}|${norm(classId)}`), source, level);
}

/** A entrada de uma feature de subclasse. */
export function overlaySubclassFeatureEntry(db, { name, classId, shortName, source, level }) {
  return pickEntry(
    indexFor(db)?.subclassFeature.get(`${norm(name)}|${norm(classId)}|${norm(shortName)}`),
    source,
    level,
  );
}

/** Os ScaleValue do overlay para o item de classe. */
export function overlayClassAdvancement(db, className, source) {
  const entry = (db?.['foundry-class']?.class ?? [])
    .find((e) => norm(e.name) === norm(className) && norm(e.source) === norm(source));
  return translateOverlayAdvancement(entry);
}

/** Os ScaleValue do overlay para o item de subclasse. */
export function overlaySubclassAdvancement(db, { className, shortName, source }) {
  const entry = (db?.['foundry-class']?.subclass ?? []).find(
    (e) => norm(e.className) === norm(className)
      && norm(e.shortName) === norm(shortName)
      && norm(e.source) === norm(source),
  );
  return translateOverlayAdvancement(entry);
}

/**
 * Os ScaleValue do overlay para o item de raça.
 * @param {object} db
 * @param {object} raceObj
 */
export function overlayRaceAdvancement(db, raceObj) {
  if (!raceObj) return [];
  const list = db?.['foundry-races']?.race ?? [];
  const src = norm(raceObj.source);
  const entry =
    list.find((e) => norm(e.name) === norm(raceObj.name) && norm(e.source) === src)
    ?? list.find((e) => norm(e.name) === norm(raceObj._baseName ?? raceObj.name) && norm(e.source) === src);
  return translateOverlayAdvancement(entry);
}

/** Os effects de um talento. */
export function overlayFeatEffects(db, name, source) {
  const entry = overlayFeatEntry(db, name, source);
  return entry ? translateOverlayEffects(entry, name) : [];
}

/** Os effects de uma optional feature. */
export function overlayOptionalFeatureEffects(db, name, source) {
  const entry = overlayOptionalFeatureEntry(db, name, source);
  return entry ? translateOverlayEffects(entry, name) : [];
}

/**
 * Os effects de uma feature de classe.
 * @param {object} db
 * @param {{name:string, classId:string, source:string, level?:number}} ref
 */
export function overlayClassFeatureEffects(db, ref) {
  const entry = overlayClassFeatureEntry(db, ref);
  return entry ? translateOverlayEffects(entry, ref.name) : [];
}

/**
 * Os effects de uma feature de subclasse.
 * @param {object} db
 * @param {{name:string, classId:string, shortName:string, source:string, level?:number}} ref
 */
export function overlaySubclassFeatureEffects(db, ref) {
  const entry = overlaySubclassFeatureEntry(db, ref);
  return entry ? translateOverlayEffects(entry, ref.name) : [];
}

/**
 * Os effects dos traços que ficam no item de raça.
 * @param {object} db
 * @param {object} raceObj
 * @returns {object[]}
 */
export function overlayRaceEffects(db, raceObj, itemizedNames = null) {
  return overlayRaceTraits(db, raceObj)
    .filter((t) => (itemizedNames ? !itemizedNames.has(norm(t.name)) : !t.ownItem))
    .flatMap((t) => t.effects);
}

/**
 * A mecânica de cada traço da raça resolvida.
 * @param {object} db
 * @param {object} raceObj
 * @returns {Array<{name, effects, activities, system, ownItem}>}
 */
export function overlayRaceTraits(db, raceObj) {
  if (!raceObj) return [];
  const idx = indexFor(db);
  const src = norm(raceObj.source);
  const entries =
    idx?.raceFeature.get(`${norm(raceObj.name)}|${src}`) ??
    idx?.raceFeature.get(`${norm(raceObj._baseName ?? raceObj.name)}|${src}`);
  if (!entries) return [];
  const traitNames = new Set(
    (raceObj.entries ?? []).map((e) => norm(e?.name)).filter(Boolean),
  );
  const out = [];
  for (const entry of entries) {
    if (!traitNames.has(norm(entry.name))) continue;
    const m = overlayMechanics(entry, entry.name);
    out.push({ name: entry.name, ...m, ownItem: Object.keys(m.activities).length > 0 || !!m.system.uses });
  }
  return out;
}
