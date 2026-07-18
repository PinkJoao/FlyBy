// =============================================================================
// foundryExport - exporta o personagem no formato de ATOR do sistema dnd5e
// =============================================================================
// Alvo: o JSON de `Actor` (type 'character') do sistema D&D 5e do Foundry VTT.
// Estratégia (DDL-0001, Opção B): o Foundry RECALCULA os derivados (modificadores,
// saves, CA, deslocamento) a partir dos ITENS + Active Effects; o bloco `system`
// do ator carrega os VALORES-BASE (atributos, proficiências de perícia/ferramenta,
// traços) e as REFERÊNCIAS aos itens. Esta primeira fatia gera o `system` completo
// (generalizado, direto do nosso `derived`); a próxima gera os `items[]`
// (classe/subclasse/espécie/background/feats/magias) e seus Active Effects.
//
// Tabelas de mapeamento abaixo são ENUMERAÇÕES padrão do dnd5e (não lógica por
// personagem) - o tradutor em si é genérico.
// -----------------------------------------------------------------------------

import { ABILITIES } from '../schema/character';
import { SKILL_ABILITY } from './proficiency';
import { collectChoicePicks } from './choices';

// --- Tabelas de mapeamento (rótulos/códigos nossos → códigos do Foundry) -------

const ARMOR_TO_FVTT = { 'light armor': 'lgt', 'medium armor': 'med', 'heavy armor': 'hvy', shields: 'shl' };
const WEAPON_TO_FVTT = { 'simple weapons': 'sim', 'martial weapons': 'mar' };

// Armas mundanas padrão: o id do dnd5e é o nome minúsculo sem espaços (mesma
// convenção que weaponMasteries usa). Proficiências de arma INDIVIDUAL
// (Kensei picks, grants fixos tipo o Scimitar do Bard Swords) mapeiam por aqui;
// rótulos em prosa ("Melee Martial Weapons (lacking…)") continuam em custom.
const KNOWN_WEAPON_NAMES = new Set([
  'battleaxe', 'blowgun', 'club', 'dagger', 'dart', 'flail', 'glaive', 'greataxe',
  'greatclub', 'greatsword', 'halberd', 'hand crossbow', 'handaxe', 'heavy crossbow',
  'javelin', 'lance', 'light crossbow', 'light hammer', 'longbow', 'longsword',
  'mace', 'maul', 'morningstar', 'musket', 'net', 'pike', 'pistol', 'quarterstaff',
  'rapier', 'scimitar', 'shortbow', 'shortsword', 'sickle', 'sling', 'spear',
  'trident', 'war pick', 'warhammer', 'whip',
]);

/** Nome de arma/categoria → código de weaponProf do dnd5e (null = vai p/ custom). */
function weaponProfCode(name) {
  const n = norm(name);
  if (WEAPON_TO_FVTT[n]) return WEAPON_TO_FVTT[n];
  if (KNOWN_WEAPON_NAMES.has(n)) return n.replace(/\s+/g, '');
  return null;
}

// Idiomas: a maioria é só o nome em minúsculas; overrides p/ os que divergem.
const LANGUAGE_TO_FVTT = {
  'deep speech': 'deep',
  "thieves' cant": 'thievescant',
  'thieves cant': 'thievescant',
};

// Ferramentas: nosso código/nome → id do Foundry. Cobre as comuns; fallback
// slugifica (ver toolId). Prefixo "game:"/"art:"/"music:" é descartado.
const TOOL_TO_FVTT = {
  dice: 'dice',
  cards: 'card',
  // Nomes 5etools multi-palavra cujo id canônico do Foundry é uma palavra só.
  // O fallback antigo (1ª palavra truncada) acertava alguns por coincidência;
  // com o fallback de slug completo (reversível), o canônico precisa estar AQUI.
  'dice set': 'dice',
  'chess set': 'chess',
  'playing card set': 'card',
  'pan flute': 'panflute',
  "thieves' tools": 'thief',
  "tinker's tools": 'tinker',
  "smith's tools": 'smith',
  'herbalism kit': 'herb',
  "alchemist's supplies": 'alchemist',
  "brewer's supplies": 'brewer',
  "calligrapher's supplies": 'calligrapher',
  "carpenter's tools": 'carpenter',
  "cartographer's tools": 'cartographer',
  "cobbler's tools": 'cobbler',
  "cook's utensils": 'cook',
  "glassblower's tools": 'glassblower',
  "jeweler's tools": 'jeweler',
  "leatherworker's tools": 'leatherworker',
  "mason's tools": 'mason',
  "painter's supplies": 'painter',
  "potter's tools": 'potter',
  "weaver's tools": 'weaver',
  "woodcarver's tools": 'woodcarver',
  "disguise kit": 'disg',
  "forgery kit": 'forg',
  "navigator's tools": 'navg',
  "poisoner's kit": 'pois',
};

// Tamanho 5etools → código Foundry.
const SIZE_TO_FVTT = { T: 'tiny', S: 'sm', M: 'med', L: 'lg', H: 'huge', G: 'grg' };

// XP acumulado por nível (DMG). Índice = nível.
const XP_BY_LEVEL = [
  0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

/** Normaliza um valor para lookup: minúsculas, sem tags, sem prefixo "x:". */
function norm(s) {
  return String(s).replace(/^[a-z]+:/i, '').trim().toLowerCase();
}

/** Slug completo e REVERSÍVEL de um nome fora das tabelas canônicas ("Hand
 * Drum" → 'hand-drum'). O fallback antigo (1ª palavra truncada) era lossy e
 * ambíguo no import - 'hand' revertia para "Hand Crossbow" (TC-0001). Ids fora
 * da tabela já não são canônicos no Foundry de toda forma; o slug completo ao
 * menos identifica o item univocamente nos dois sentidos. */
const fullSlug = (n) => n.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** id de ferramenta no Foundry (tabela canônica → fallback slug completo).
 * Exportado p/ os Traits do background (foundryItems) e o reverso no import. */
export function toolId(raw) {
  const n = norm(raw);
  return TOOL_TO_FVTT[n] ?? fullSlug(n);
}

/** código de idioma no Foundry - exportado pelos mesmos motivos do toolId. */
export function languageCode(raw) {
  const n = norm(raw);
  return LANGUAGE_TO_FVTT[n] ?? fullSlug(n);
}

// --- Construtores de cada bloco do `system` ------------------------------------

function buildAbilities(derived) {
  const out = {};
  const profSaves = new Set(derived.proficientSaves ?? []);
  for (const a of ABILITIES) {
    out[a] = {
      value: derived.scores[a] ?? 10,
      proficient: profSaves.has(a) ? 1 : 0,
      max: null,
      bonuses: { check: '', save: '' },
      check: { roll: { min: null, max: null, mode: 0 } },
      save: { roll: { min: null, max: null, mode: 0 } },
    };
  }
  return out;
}

function buildSkills(derived) {
  const out = {};
  for (const code of Object.keys(SKILL_ABILITY)) {
    out[code] = {
      ability: SKILL_ABILITY[code],
      value: derived.skills?.[code]?.proficiency ?? 0, // 0 | 1 | 2 (expertise)
      bonuses: { check: '', passive: '' },
    };
  }
  return out;
}

function buildTools(derived) {
  const out = {};
  for (const t of derived.tools ?? []) {
    const id = toolId(t);
    if (id) out[id] = { value: 1, ability: '', bonuses: { check: '' } };
  }
  return out;
}

/** Maestrias de arma escolhidas (Weapon Mastery) → ids minúsculos. */
function weaponMasteries(character) {
  const out = [];
  for (const cls of character?.classes ?? []) {
    for (const pick of collectChoicePicks(cls.choices, 'weapon')) {
      out.push(norm(String(pick).split('|')[0]).replace(/\s+/g, ''));
    }
  }
  return [...new Set(out)];
}

// Tipos de dano do dnd5e (as opções válidas de traits.dr/di/dv.value). Iguais
// aos nomes do 5etools em minúsculas; algo fora disso vai em `custom`.
const FVTT_DAMAGE_TYPES = new Set([
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
]);

/** Bloco dr/di/dv a partir de uma lista derivada de tipos de dano. */
function damageTraitBlock(list) {
  const value = [];
  const custom = [];
  for (const t of list ?? []) {
    const code = norm(t);
    if (FVTT_DAMAGE_TYPES.has(code)) value.push(code);
    else custom.push(String(t));
  }
  return { value: [...new Set(value)], custom: custom.join(';') };
}

function buildTraits(derived, character, size) {
  const weaponVals = [];
  const weaponCustom = [];
  for (const w of derived.weapons ?? []) {
    const code = weaponProfCode(w);
    if (code) weaponVals.push(code);
    else weaponCustom.push(String(w));
  }
  const armorVals = [];
  const armorCustom = [];
  for (const a of derived.armor ?? []) {
    const code = ARMOR_TO_FVTT[norm(a)];
    if (code) armorVals.push(code);
    else armorCustom.push(String(a));
  }
  return {
    size: size ?? 'med',
    languages: { value: (derived.languages ?? []).map(languageCode), custom: '', communication: {} },
    weaponProf: {
      value: [...new Set(weaponVals)],
      custom: weaponCustom.join(';'),
      mastery: { value: weaponMasteries(character), bonus: [] },
    },
    armorProf: { value: [...new Set(armorVals)], custom: armorCustom.join(';') },
    // Traços de dano derivados (raça/talentos/escolhas TC-0014). Itens equipados
    // NÃO entram aqui: no Foundry o item carrega o próprio efeito - o ator só
    // exporta o que é do personagem em si.
    di: damageTraitBlock(derived.damageTraits?.immune),
    dr: damageTraitBlock(derived.damageTraits?.resist),
    dv: damageTraitBlock(derived.damageTraits?.vulnerable),
    ci: { value: [], custom: '' },
  };
}

/** Código de alinhamento do builder → o texto livre que o Foundry guarda. */
const FOUNDRY_ALIGNMENT = {
  LG: 'Lawful good', NG: 'Neutral good', CG: 'Chaotic good',
  LN: 'Lawful neutral', N: 'True neutral', CN: 'Chaotic neutral',
  LE: 'Lawful evil', NE: 'Neutral evil', CE: 'Chaotic evil',
};

/** Texto simples → parágrafos HTML (o Foundry guarda os campos ricos como HTML). */
export function textToHtml(text) {
  const t = (text ?? '').trim();
  if (!t) return '';
  return t
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function buildDetails(character, derived) {
  const id = character.identity ?? {};
  return {
    // O alinhamento é guardado como CÓDIGO ('NG') e exportado por extenso, como
    // nos atores reais. (Antes lia `character.alignment`, que não existe - o
    // campo saía sempre vazio.)
    alignment: FOUNDRY_ALIGNMENT[id.alignment] ?? '',
    xp: { value: XP_BY_LEVEL[Math.min(derived.level ?? 1, 20)] ?? 0 },
    // Referências a itens (espécie/background/classe): preenchidas na fatia de itens.
    race: '',
    background: '',
    originalClass: '',
    // A história do personagem (aba Background) vira a biografia do ator; o item
    // de background recebe uma cópia dela na sua descrição (ver foundryItems).
    biography: { value: textToHtml(id.backstory), public: '' },
    // Traços de roleplay: o Foundry usa o SINGULAR e chama personality de `trait`.
    trait: id.personality ?? '',
    ideal: id.ideals ?? '',
    bond: id.bonds ?? '',
    flaw: id.flaws ?? '',
    appearance: id.appearance ?? '',
    // Descritores físicos, 1:1.
    age: id.age ?? '',
    height: id.height ?? '',
    weight: id.weight ?? '',
    eyes: id.eyes ?? '',
    hair: id.hair ?? '',
    skin: id.skin ?? '',
    gender: id.gender ?? '',
    faith: id.faith ?? '',
  };
}

function buildAttributes(derived, hpBonus = 0, hpExtra = null) {
  // Aumentos DERIVADOS de HP máximo (engine/hpBonuses): taxa por nível de
  // personagem (Tough, Dwarven Toughness) vai no slot nativo `bonuses.level`
  // (sobrevive a level-up no Foundry); o resto (Boon of Fortitude fixo +
  // Draconic Resilience por nível de classe, que o Foundry não expressa) soma
  // ao ajuste manual em `bonuses.overall` - o import subtrai a parte derivável.
  const perLevel = hpExtra?.perLevelRate ?? 0;
  const overall = hpBonus + (hpExtra?.flat ?? 0);
  return {
    // hp.max fica NULL: o Foundry deriva o máximo do advancement HitPoints da
    // classe (todos os atores reais exportam max:null; um número aqui forçaria
    // o modo de HP "manual" e desligaria a derivação por nível).
    hp: {
      value: derived.maxHp ?? null,
      max: null,
      temp: null,
      tempmax: 0,
      bonuses: overall || perLevel
        ? { overall: overall ? String(overall) : '', level: perLevel ? String(perLevel) : '' }
        : {},
    },
    init: { ability: '', bonus: '' },
    ac: { calc: 'default', flat: null },
    movement: { walk: null, units: null, hover: false, ignoredDifficultTerrain: [] },
    senses: { units: null, special: '', ranges: { darkvision: null, blindsight: null, tremorsense: null, truesight: null } },
    spellcasting: '',
    exhaustion: 0,
    concentration: { value: false, bonuses: { save: '' }, limit: 1 },
    death: { roll: { min: null, max: null, mode: 0 }, success: 0, failure: 0, bonuses: { save: '' } },
    inspiration: false,
    attunement: { max: 3 },
  };
}

/** Bônus globais (ataque/dano/atributos/magia) - bloco padrão vazio. */
function emptyBonuses() {
  const atk = () => ({ attack: '', damage: '' });
  return {
    mwak: atk(), rwak: atk(), msak: atk(), rsak: atk(),
    abilities: { check: '', save: '', skill: '' },
    spell: { dc: '' },
  };
}

/** Espaços de magia (spell1..9 + pact) - o Foundry deriva os máximos da classe. */
function emptySpells() {
  const out = { pact: { value: 0, override: null } };
  for (let l = 1; l <= 9; l++) out[`spell${l}`] = { value: 0, override: null };
  return out;
}

function emptyResources() {
  const r = () => ({ value: 0, max: 0, sr: false, lr: false, label: '' });
  return { primary: r(), secondary: r(), tertiary: r() };
}

/**
 * Constrói o `system` do ator (bloco de STATS) - puro, a partir do `derived`.
 * @param {import('../schema/character').Character} character
 * @param {ReturnType<import('./index').deriveCharacter>} derived
 * @param {{ size?: string, hpExtra?: {perLevelRate:number, flat:number}|null }} [opts]
 */
export function buildActorSystem(character, derived, { size = 'med', hpExtra = null } = {}) {
  return {
    abilities: buildAbilities(derived),
    attributes: buildAttributes(derived, character.hpBonus ?? 0, hpExtra),
    skills: buildSkills(derived),
    tools: buildTools(derived),
    traits: buildTraits(derived, character, size),
    details: buildDetails(character, derived),
    currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    bonuses: emptyBonuses(),
    spells: emptySpells(),
    resources: emptyResources(),
  };
}

/**
 * Ator Foundry completo (scaffold + system). Nesta fatia `items`/`effects` ficam
 * vazios - a próxima fatia os preenche (classe/espécie/feats + Active Effects).
 * @returns {object} documento de Actor pronto p/ serializar em JSON.
 */
export function buildFoundryActor(character, derived, opts = {}) {
  return {
    name: character.name ?? 'Unnamed',
    type: 'character',
    system: buildActorSystem(character, derived, opts),
    items: [],
    effects: [],
    flags: {},
    prototypeToken: { name: character.name ?? 'Unnamed', actorLink: true },
  };
}

/** Converte o tamanho 5etools (['M']) em código Foundry ('med'). */
export function foundrySize(raceSizeArr) {
  return SIZE_TO_FVTT[(raceSizeArr ?? [])[0]] ?? 'med';
}
