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
  const out = [];
  for (const eff of entry?.effects ?? []) {
    if (eff?.type === 'enchantment' || eff?.enchantmentRiderParent) continue;
    const changes = (eff?.changes ?? []).map(translateChange).filter(Boolean);
    const statuses = eff?.statuses ?? [];
    if (!changes.length && !statuses.length) continue;
    out.push({
      _id: overlayId(),
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
  return out;
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

/** Active Effects do overlay p/ um TALENTO (nome+fonte exatos). */
export function overlayFeatEffects(db, name, source) {
  const entry = indexFor(db)?.feat.get(`${norm(name)}|${norm(source)}`);
  return entry ? translateOverlayEffects(entry, name) : [];
}

/** Active Effects do overlay p/ uma OPTIONAL FEATURE (invocation, metamagic…). */
export function overlayOptionalFeatureEffects(db, name, source) {
  const entry = indexFor(db)?.optional.get(`${norm(name)}|${norm(source)}`);
  return entry ? translateOverlayEffects(entry, name) : [];
}

/**
 * Active Effects do overlay p/ uma FEATURE de classe.
 * @param {object} db
 * @param {{name:string, classId:string, source:string, level?:number}} ref
 */
export function overlayClassFeatureEffects(db, { name, classId, source, level }) {
  const entries = indexFor(db)?.classFeature.get(`${norm(name)}|${norm(classId)}`);
  const entry = pickEntry(entries, source, level);
  return entry ? translateOverlayEffects(entry, name) : [];
}

/**
 * Active Effects do overlay p/ uma feature de SUBCLASSE.
 * @param {object} db
 * @param {{name:string, classId:string, shortName:string, source:string, level?:number}} ref
 */
export function overlaySubclassFeatureEffects(db, { name, classId, shortName, source, level }) {
  const entries = indexFor(db)?.subclassFeature.get(`${norm(name)}|${norm(classId)}|${norm(shortName)}`);
  const entry = pickEntry(entries, source, level);
  return entry ? translateOverlayEffects(entry, name) : [];
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
    out.push(...translateOverlayEffects(entry, entry.name));
  }
  return out;
}
