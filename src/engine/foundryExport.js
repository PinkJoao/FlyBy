// =============================================================================
// foundryExport: o bloco system do ator dnd5e
// =============================================================================
// O QUE FAZ
//   Alvo: o JSON de Actor (type 'character') do dnd5e. O Foundry RECALCULA os
//   derivados (mods, saves, CA, deslocamento) a partir dos itens e Active Effects
//   (DDL-0001, opção B); o `system` do ator carrega os VALORES-BASE (atributos,
//   proficiências, traços, detalhes, moedas). Este módulo o monta a partir do
//   `derived`; os itens vêm do foundryItems e o foundryActor junta tudo. As
//   tabelas aqui são enumerações padrão do dnd5e, não lógica por personagem.
//
// FUNÇÕES
//   weaponProfCode(name): arma ou categoria como código de weaponProf, ou null
//     (vai para custom).
//   norm(s), fullSlug(n): normalização e o slug completo e reversível.
//   toolId(raw), languageCode(raw): os ids de ferramenta e idioma (exportados para
//     o foundryItems e o import).
//   buildAbilities(derived), buildSkills(derived), buildTools(derived),
//     weaponMasteries(character), damageTraitBlock(list), buildTraits(derived,
//     character, size): os blocos de proficiências e traços.
//   textToHtml(text): texto simples em parágrafos HTML.
//   buildDetails(character, derived), buildAttributes(derived, hpBonus, hpExtra):
//     detalhes e atributos.
//   emptyBonuses(), emptySpells(), buildCurrency(character), emptyResources():
//     blocos padrão.
//   buildActorSystem(character, derived, opts): o system completo.
//   buildFoundryActor(character, derived, opts): o ator com system e os items
//     ainda vazios.
//   foundrySize(raceSizeArr): o tamanho em código Foundry.
//
// DECISÕES E ARMADILHAS
//   - Idiomas e ferramentas: as tabelas listam só os que NÃO saem do slug
//     (TC-0058: "Common Sign Language" é `sign`, Thieves' Cant é `cant`); o resto
//     é o slug COMPLETO e reversível. O antigo (primeira palavra) era ambíguo:
//     'hand' voltava como Hand Crossbow (TC-0001). Nomes multi-palavra com id de
//     uma palavra precisam estar na tabela.
//   - Armas individuais (Kensei, o Scimitar do Bard Swords) mapeiam pelo nome
//     minúsculo; regra CONDICIONAL não tem código, então as armas são enumeradas
//     e a frase segue em `custom` (TC-0078).
//   - Traços de dano do ator são só os do PERSONAGEM; o item equipado carrega o
//     próprio efeito.
//   - Alinhamento: guardado como CÓDIGO e exportado por extenso, na grafia dos
//     premades ("Neutral", não "True Neutral"; TC-0074). Antes lia um campo
//     inexistente e saía vazio.
//   - A história da aba Background é a biografia; os traços de roleplay usam o
//     SINGULAR do Foundry (`trait`, `ideal`, `bond`, `flaw`).
//   - HP extra: a taxa por nível de personagem vai em `bonuses.level` (nativo); o
//     resto soma ao ajuste manual em `bonuses.overall`, e o import subtrai a parte
//     derivável.
//   - Moedas exportadas (TC-0055: o import as lia e o export zerava).
//   - foundrySize: sem a escolha S/M feita (DDL-0017), o MAIOR, como os premades de
//     Humano e Tiefling; o primeiro do array dava Small (TC-0073).
// -----------------------------------------------------------------------------

import { ABILITIES } from '../schema/character';
import { SKILL_ABILITY } from './proficiency';
import { collectChoicePicks } from './choices';

const ARMOR_TO_FVTT = { 'light armor': 'lgt', 'medium armor': 'med', 'heavy armor': 'hvy', shields: 'shl' };
const WEAPON_TO_FVTT = { 'simple weapons': 'sim', 'martial weapons': 'mar' };

const KNOWN_WEAPON_NAMES = new Set([
  'battleaxe', 'blowgun', 'club', 'dagger', 'dart', 'flail', 'glaive', 'greataxe',
  'greatclub', 'greatsword', 'halberd', 'hand crossbow', 'handaxe', 'heavy crossbow',
  'javelin', 'lance', 'light crossbow', 'light hammer', 'longbow', 'longsword',
  'mace', 'maul', 'morningstar', 'musket', 'net', 'pike', 'pistol', 'quarterstaff',
  'rapier', 'scimitar', 'shortbow', 'shortsword', 'sickle', 'sling', 'spear',
  'trident', 'war pick', 'warhammer', 'whip',
]);

/** Nome de arma ou categoria como código de weaponProf (null vai para custom). */
function weaponProfCode(name) {
  const n = norm(name);
  if (WEAPON_TO_FVTT[n]) return WEAPON_TO_FVTT[n];
  if (KNOWN_WEAPON_NAMES.has(n)) return n.replace(/\s+/g, '');
  return null;
}

const LANGUAGE_TO_FVTT = {
  'deep speech': 'deep',
  "thieves' cant": 'cant',
  'thieves cant': 'cant',
  'common sign language': 'sign',
};

const TOOL_TO_FVTT = {
  dice: 'dice',
  cards: 'card',
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

const SIZE_TO_FVTT = { T: 'tiny', S: 'sm', M: 'med', L: 'lg', H: 'huge', G: 'grg' };

const XP_BY_LEVEL = [
  0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

/** Normaliza para lookup: minúsculas, sem tags, sem prefixo. */
function norm(s) {
  return String(s).replace(/^[a-z]+:/i, '').trim().toLowerCase();
}

/** O slug completo e reversível de um nome fora das tabelas. */
const fullSlug = (n) => n.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** O id de ferramenta no Foundry. */
export function toolId(raw) {
  const n = norm(raw);
  return TOOL_TO_FVTT[n] ?? fullSlug(n);
}

/** O código de idioma no Foundry. */
export function languageCode(raw) {
  const n = norm(raw);
  return LANGUAGE_TO_FVTT[n] ?? fullSlug(n);
}

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
      value: derived.skills?.[code]?.proficiency ?? 0,
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

/** As maestrias de arma escolhidas, em ids. */
function weaponMasteries(character) {
  const out = [];
  for (const cls of character?.classes ?? []) {
    for (const pick of collectChoicePicks(cls.choices, 'weapon')) {
      out.push(norm(String(pick).split('|')[0]).replace(/\s+/g, ''));
    }
  }
  return [...new Set(out)];
}

const FVTT_DAMAGE_TYPES = new Set([
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
]);

/** O bloco dr/di/dv de uma lista de tipos de dano. */
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
  for (const n of derived.weaponNames ?? []) {
    const code = weaponProfCode(n);
    if (code) weaponVals.push(code);
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
    di: damageTraitBlock(derived.damageTraits?.immune),
    dr: damageTraitBlock(derived.damageTraits?.resist),
    dv: damageTraitBlock(derived.damageTraits?.vulnerable),
    ci: { value: [], custom: '' },
  };
}

const FOUNDRY_ALIGNMENT = {
  LG: 'Lawful Good', NG: 'Neutral Good', CG: 'Chaotic Good',
  LN: 'Lawful Neutral', N: 'Neutral', CN: 'Chaotic Neutral',
  LE: 'Lawful Evil', NE: 'Neutral Evil', CE: 'Chaotic Evil',
};

/** Texto simples em parágrafos HTML. */
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
    alignment: FOUNDRY_ALIGNMENT[id.alignment] ?? '',
    xp: { value: XP_BY_LEVEL[Math.min(derived.level ?? 1, 20)] ?? 0 },
    race: '',
    background: '',
    originalClass: '',
    biography: { value: textToHtml(id.backstory), public: '' },
    trait: id.personality ?? '',
    ideal: id.ideals ?? '',
    bond: id.bonds ?? '',
    flaw: id.flaws ?? '',
    appearance: id.appearance ?? '',
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
  const perLevel = hpExtra?.perLevelRate ?? 0;
  const overall = hpBonus + (hpExtra?.flat ?? 0);
  return {
    // ATENÇÃO: hp.max fica NULL; um número força o modo manual e desliga a derivação por nível.
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

/** Os bônus globais vazios. */
function emptyBonuses() {
  const atk = () => ({ attack: '', damage: '' });
  return {
    mwak: atk(), rwak: atk(), msak: atk(), rsak: atk(),
    abilities: { check: '', save: '', skill: '' },
    spell: { dc: '' },
  };
}

/** Os espaços de magia vazios (o Foundry deriva os máximos). */
function emptySpells() {
  const out = { pact: { value: 0, override: null } };
  for (let l = 1; l <= 9; l++) out[`spell${l}`] = { value: 0, override: null };
  return out;
}

/** As moedas do personagem. */
function buildCurrency(character) {
  const c = character?.currency ?? {};
  return { pp: c.pp || 0, gp: c.gp || 0, ep: c.ep || 0, sp: c.sp || 0, cp: c.cp || 0 };
}

function emptyResources() {
  const r = () => ({ value: 0, max: 0, sr: false, lr: false, label: '' });
  return { primary: r(), secondary: r(), tertiary: r() };
}

/**
 * O system do ator, a partir do derived.
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
    currency: buildCurrency(character),
    bonuses: emptyBonuses(),
    spells: emptySpells(),
    resources: emptyResources(),
  };
}

/**
 * O ator com o system e os items ainda vazios.
 * @returns {object}
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

/** O tamanho 5etools como código Foundry (o maior, sem escolha feita). */
export function foundrySize(raceSizeArr) {
  const order = Object.keys(SIZE_TO_FVTT);
  const largest = (raceSizeArr ?? [])
    .filter((c) => c in SIZE_TO_FVTT)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .at(-1);
  return SIZE_TO_FVTT[largest] ?? 'med';
}
