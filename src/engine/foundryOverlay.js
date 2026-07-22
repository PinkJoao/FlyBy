// =============================================================================
// foundryOverlay - Active Effects do overlay foundry-*.json do 5etools (DDL-0009)
// =============================================================================
// O 5etools mantém (MIT, no mesmo mirror que já consumimos) um overlay de
// mecânicas Foundry: `foundry-feats.json`, `foundry-races.json`,
// `foundry-optionalfeatures.json` e `class/foundry.json`, cada entrada keyed
// por nome+fonte com os Active Effects que a prosa não expressa. Este módulo
// indexa esses arquivos (memoizado por db, WeakMap - mesmo padrão do
// glossaryFor) e traduz as entradas para o formato de effect do dnd5e.
//
// PRECEDÊNCIA (decidida em DDL-0031): o registro CURADO (foundryEffects.js,
// validado contra os premades reais e referenciado pelas activities) vence;
// o overlay só preenche features SEM entrada curada - regra tudo-ou-nada por
// feature, para o resultado ser previsível.
//
// Traduções necessárias (o overlay não está no formato final do Foundry):
//   - `mode` é STRING ("ADD"/"OVERRIDE"...) → numérico (CONST.ACTIVE_EFFECT_MODES);
//   - `value` pode ser boolean/number/objeto → o campo do Foundry é string;
//   - `transfer` AUSENTE = efeito "on-use" (não transferido; o jogador aplica
//     manualmente - a semântica do conversor do Plutonium), não default true;
//   - efeitos `type:"enchantment"` (e riders) são de encantamento de item, não
//     efeitos de ator - pulados;
//   - changes em `system.attributes.hp.bonuses.*` são DESCARTADOS: o HP máximo
//     bônus já exporta NATIVO no ator (engine/hpBonuses.js → hp.bonuses.level/
//     overall); um Active Effect somaria em dobro (Tough, Dwarven Toughness,
//     a metade HP do Draconic Resilience - a metade CA dele sobrevive).
// -----------------------------------------------------------------------------

const norm = (s) => (s ?? '').toString().trim().toLowerCase();

// mode string do overlay → numérico do Foundry (CONST.ACTIVE_EFFECT_MODES).
const MODE_NUM = { CUSTOM: 0, MULTIPLY: 1, ADD: 2, DOWNGRADE: 3, UPGRADE: 4, OVERRIDE: 5 };

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Id 16-chars formato Foundry (local p/ não importar foundryItems - ciclo). */
function overlayId() {
  let s = '';
  for (let i = 0; i < 16; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s;
}

// ---------------------------------------------------------------------------
// Índice memoizado por db
// ---------------------------------------------------------------------------

/** @type {WeakMap<object, ReturnType<typeof buildIndex>>} */
const CACHE = new WeakMap();

function push(map, key, entry) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(entry);
}

function buildIndex(db) {
  const feat = new Map(); // 'nome|fonte' → entrada
  for (const e of db?.['foundry-feats']?.feat ?? []) {
    feat.set(`${norm(e.name)}|${norm(e.source)}`, e);
  }
  const optional = new Map(); // 'nome|fonte' → entrada
  for (const e of db?.['foundry-optionalfeatures']?.optionalfeature ?? []) {
    optional.set(`${norm(e.name)}|${norm(e.source)}`, e);
  }
  // class/foundry.json: pode haver várias entradas com o mesmo nome+classe
  // (níveis diferentes, ex: Mystic Arcanum 11/13/15/17) → lista, resolvida em
  // pickEntry por fonte + nível.
  const classFeature = new Map(); // 'nome|classe' → entradas[]
  const subclassFeature = new Map(); // 'nome|classe|shortName' → entradas[]
  for (const e of db?.['foundry-class']?.classFeature ?? []) {
    push(classFeature, `${norm(e.name)}|${norm(e.className)}`, e);
  }
  for (const e of db?.['foundry-class']?.subclassFeature ?? []) {
    push(subclassFeature, `${norm(e.name)}|${norm(e.className)}|${norm(e.subclassShortName)}`, e);
  }
  const raceFeature = new Map(); // 'raça|fonte' → entradas[] (traços da raça)
  for (const e of db?.['foundry-races']?.raceFeature ?? []) {
    if (e._copy) continue; // 2 entradas-referência sem dados próprios
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

// ---------------------------------------------------------------------------
// Tradução overlay → Active Effect do dnd5e
// ---------------------------------------------------------------------------

/** Um change do overlay → change do Foundry (ou null se não aplicável). */
function translateChange(ch) {
  const key = String(ch?.key ?? '');
  // Só data paths de ator (system./flags.) - chaves exóticas (ex: paths de
  // activity usados por encantamentos) não são efeitos de ator.
  if (!/^(system\.|flags\.)/.test(key)) return null;
  // HP máximo já exporta nativo (hpBonuses.js) - um AE somaria em dobro.
  if (key.startsWith('system.attributes.hp.bonuses')) return null;
  const mode = MODE_NUM[ch.mode] ?? (typeof ch.mode === 'number' ? ch.mode : MODE_NUM.ADD);
  const value = typeof ch.value === 'object' ? JSON.stringify(ch.value) : String(ch.value);
  return { key, mode, value, priority: ch.priority ?? null };
}

/**
 * Traduz os `effects` de UMA entrada do overlay em Active Effects do dnd5e.
 * Efeitos que ficarem vazios após os filtros (sem changes E sem statuses) são
 * descartados - ex: o Tough XPHB só tem o change de HP, que é nativo.
 * @param {object} entry  entrada do overlay (com `effects[]`)
 * @param {string} fallbackName  nome do efeito quando a entrada não traz um
 * @returns {object[]} Active Effects prontos p/ `item.effects`
 */
export function translateOverlayEffects(entry, fallbackName) {
  return overlayEffectsWithIds(entry, fallbackName).effects;
}

/** Como translateOverlayEffects, mas devolve também o mapa `foundryId` → `_id`
 * gerado: as activities do overlay referenciam seus efeitos por esse apelido
 * (`effects: [{ foundryId: 'naturesVeil' }]`), e sem o mapa o link se perde. */
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
      transfer: !!eff.transfer, // ausente = "on-use" (ver cabeçalho)
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

// ---------------------------------------------------------------------------
// Blocos `system` e `activities` do overlay (DDL-0057)
// ---------------------------------------------------------------------------

/** Escreve `a.b.c` num objeto, criando os níveis intermediários. */
function setPath(target, path, value) {
  const parts = String(path).split('.');
  let node = target;
  for (const p of parts.slice(0, -1)) {
    if (typeof node[p] !== 'object' || node[p] === null) node[p] = {};
    node = node[p];
  }
  node[parts.at(-1)] = value;
}

/**
 * Bloco `system` do overlay (chaves em DOT-PATH: `uses.max`, `uses.recovery`,
 * `range.value`…) num objeto aninhado, pronto p/ mesclar no `system` do item.
 * `uses` ganha os campos que o dnd5e exige e o overlay omite (`spent`).
 */
function translateOverlaySystem(entry) {
  const out = {};
  for (const [path, value] of Object.entries(entry?.system ?? {})) setPath(out, path, value);
  if (out.uses) out.uses = { max: '', spent: 0, recovery: [], ...out.uses };
  return out;
}

/**
 * `activities` do overlay (ARRAY) no mapa indexado por `_id` que o dnd5e usa.
 * Cada activity recebe um `_id`; `effects[].foundryId` é resolvido no `_id` real
 * do Active Effect correspondente (links órfãos são descartados, não emitidos
 * quebrados).
 */
function translateOverlayActivities(entry, effectIds) {
  const out = {};
  for (const act of entry?.activities ?? []) {
    if (!act?.type) continue;
    const _id = overlayId();
    const { effects, ...rest } = act;
    delete rest.foundryId; // apelido interno do overlay, não é campo do dnd5e
    const linked = (effects ?? [])
      .map((e) => (e?.foundryId ? effectIds.get(e.foundryId) : e?._id))
      .filter(Boolean)
      .map((id) => ({ _id: id }));
    out[_id] = { _id, ...rest, ...(linked.length ? { effects: linked } : {}) };
  }
  return out;
}

/**
 * TODA a mecânica que uma entrada do overlay carrega, de uma vez.
 * @param {object|null} entry  entrada do overlay
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

/** Advancements do overlay (só ScaleValue) no nosso formato. */
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

/** Entre entradas homônimas: mesma FONTE obrigatória (nunca cruzar edição
 * PHB↔XPHB); com várias, nível exato primeiro, senão o nível mais baixo (nosso
 * item de feature é dedupado na 1ª ocorrência - Indomitable 9/13/17 → 9). */
function pickEntry(entries, source, level) {
  const candidates = (entries ?? []).filter((e) => norm(e.source) === norm(source));
  if (!candidates.length) return null;
  const exact = candidates.find((e) => e.level === level);
  return exact ?? [...candidates].sort((a, b) => (a.level ?? 0) - (b.level ?? 0))[0];
}

// ---------------------------------------------------------------------------
// Lookups públicos (todos toleram db null → [])
// ---------------------------------------------------------------------------

/** Entrada crua do overlay p/ um TALENTO (nome+fonte exatos). */
export function overlayFeatEntry(db, name, source) {
  return indexFor(db)?.feat.get(`${norm(name)}|${norm(source)}`) ?? null;
}

/** Entrada crua do overlay p/ uma OPTIONAL FEATURE. */
export function overlayOptionalFeatureEntry(db, name, source) {
  return indexFor(db)?.optional.get(`${norm(name)}|${norm(source)}`) ?? null;
}

/** Entrada crua do overlay p/ uma FEATURE de classe. */
export function overlayClassFeatureEntry(db, { name, classId, source, level }) {
  return pickEntry(indexFor(db)?.classFeature.get(`${norm(name)}|${norm(classId)}`), source, level);
}

/** Entrada crua do overlay p/ uma feature de SUBCLASSE. */
export function overlaySubclassFeatureEntry(db, { name, classId, shortName, source, level }) {
  return pickEntry(
    indexFor(db)?.subclassFeature.get(`${norm(name)}|${norm(classId)}|${norm(shortName)}`),
    source,
    level,
  );
}

/**
 * Advancements ScaleValue do overlay para o item de CLASSE - as escalas que a
 * tabela da classe não traz como coluna (Action Surge, Indomitable…). É o dado
 * upstream do que `CURATED_SCALE_VALUES` fazia à mão para duas classes.
 */
export function overlayClassAdvancement(db, className, source) {
  const entry = (db?.['foundry-class']?.class ?? [])
    .find((e) => norm(e.name) === norm(className) && norm(e.source) === norm(source));
  return translateOverlayAdvancement(entry);
}

/** Advancements ScaleValue do overlay para o item de SUBCLASSE (dados de
 * superioridade do Battle Master, etc.). */
export function overlaySubclassAdvancement(db, { className, shortName, source }) {
  const entry = (db?.['foundry-class']?.subclass ?? []).find(
    (e) => norm(e.className) === norm(className)
      && norm(e.shortName) === norm(shortName)
      && norm(e.source) === norm(source),
  );
  return translateOverlayAdvancement(entry);
}

/** Active Effects do overlay p/ um TALENTO (nome+fonte exatos). */
export function overlayFeatEffects(db, name, source) {
  const entry = overlayFeatEntry(db, name, source);
  return entry ? translateOverlayEffects(entry, name) : [];
}

/** Active Effects do overlay p/ uma OPTIONAL FEATURE (invocation, metamagic…). */
export function overlayOptionalFeatureEffects(db, name, source) {
  const entry = overlayOptionalFeatureEntry(db, name, source);
  return entry ? translateOverlayEffects(entry, name) : [];
}

/**
 * Active Effects do overlay p/ uma FEATURE de classe.
 * @param {object} db
 * @param {{name:string, classId:string, source:string, level?:number}} ref
 */
export function overlayClassFeatureEffects(db, ref) {
  const entry = overlayClassFeatureEntry(db, ref);
  return entry ? translateOverlayEffects(entry, ref.name) : [];
}

/**
 * Active Effects do overlay p/ uma feature de SUBCLASSE.
 * @param {object} db
 * @param {{name:string, classId:string, shortName:string, source:string, level?:number}} ref
 */
export function overlaySubclassFeatureEffects(db, ref) {
  const entry = overlaySubclassFeatureEntry(db, ref);
  return entry ? translateOverlayEffects(entry, ref.name) : [];
}

/**
 * Active Effects dos TRAÇOS de uma raça, para anexar ao próprio item de raça
 * (não emitimos itens por traço; um transfer effect em qualquer item embutido
 * aplica ao ator igual). Só traços que EXISTEM nas entries da raça resolvida -
 * uma linhagem/subraça que substitui um traço não herda o efeito dele.
 * Nome de lookup: o nome RESOLVIDO primeiro (o overlay tem entradas keyed pelo
 * nome mesclado de subraça, ex: "Goblin (Zendikar; Grotag Tribe)"), senão o
 * nome BASE (raça de `_versions` carrega `_baseName`; o overlay é keyed pela
 * raça base, ex: "Dragonborn").
 * @param {object} db
 * @param {object} raceObj  raça 5etools RESOLVIDA (linhagem inclusa)
 * @returns {object[]} Active Effects p/ `item.effects` do item de raça
 */
export function overlayRaceEffects(db, raceObj) {
  // Traços que ganham ITEM próprio levam a mecânica inteira com eles (effects
  // inclusive) - senão o efeito sairia em dobro, no item de raça e no do traço.
  return overlayRaceTraits(db, raceObj)
    .filter((t) => !t.ownItem)
    .flatMap((t) => t.effects);
}

/**
 * Mecânica de cada TRAÇO da raça no overlay, já casada com os traços que a raça
 * RESOLVIDA realmente tem (uma linhagem/subraça que substitui um traço não herda
 * a mecânica dele). `ownItem` marca os traços que precisam de um item próprio:
 * são os que têm `activities` ou `uses` - uma ação/recurso só existe no Foundry
 * pendurada num item, ao contrário de um Active Effect transferido, que aplica
 * ao ator a partir de qualquer item embutido (é o que os premades fazem: Breath
 * Weapon e Draconic Flight são itens; Darkvision não).
 * @param {object} db
 * @param {object} raceObj  raça 5etools RESOLVIDA (linhagem inclusa)
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
