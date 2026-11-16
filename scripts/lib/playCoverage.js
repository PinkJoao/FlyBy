// =============================================================================
// playCoverage: as pistas de mecânica, a classificação e as sobras explicadas
// =============================================================================
// O QUE FAZ
//   O veredito de uma feature do catálogo do play mode, dividido entre o levantamento da
//   matriz (scripts/survey-play-coverage.js) e o livro dos personagens modelo
//   (scripts/play-models.js, DDL-0218): em que categoria ela cai (`use`, `log`,
//   `passive`), que pistas de mecânica o texto traz e quais dessas pistas têm motivo
//   nomeado para ficar sem conta.
//
// FUNÇÕES
//   cuesOf(text): as pistas de mecânica que o texto traz.
//   classify(f, action, pools, bridged): 'use', 'log' ou 'passive'.
//   unexplainedCues(f, cat, cues): as pistas sem conta e sem motivo de uma feature.
//
// DECISÕES E ARMADILHAS
//   - Movido do survey-play-coverage sem mudar nada: as regras e os motivos estão nos
//     DDL-0213 a DDL-0217. Uma feature em `use` não tem pista pendente: o app faz a conta.
// -----------------------------------------------------------------------------
import { isActiveFeature } from '../../src/engine/playFeatures.js';
import { PASSIVE_FEATURES } from '../../src/engine/playEffects.js';
import { REROLL_FEATURES } from '../../src/engine/playRerolls.js';

export const CUES = [
  ['advantage', /\badvantage on\b/],
  ['disadvantage', /\bdisadvantage on\b/],
  ['reroll', /\breroll\b|\broll (?:it |the die |the dice )?again\b/],
  ['dice', /\b\d+d\d+\b|\b(?:bardic inspiration|superiority|psionic energy|martial arts|exertion) die\b/],
  ['heal', /\bregains? (?:a number of |additional |extra )?hit points\b|\bregain (?:additional )?hit points\b/],
  ['temp', /\btemporary hit points\b/],
  ['bonus', /\b(?:add|adds) (?:your |a |the |\w+ )?(?:\w+ )?(?:modifier|bonus|die|roll)\b.*?\bto\b|\bbonus to\b|\+\d+ bonus\b/],
  ['floor', /\btreat (?:a|the|any) .{0,30}roll of \d+ or lower as\b|\bcan't be lower than\b/],
];

const OTHER = 'the text gives it to another creature (an ally, an enemy, a summon, the bearer)';
const NEGATES = 'only removes a Disadvantage the app never imposes (range, a nearby enemy, a Hostile attitude)';
const ONCE = 'a use that gives it once, before the roll (G3, with the reroll family)';
const SNEAK = 'about when Sneak Attack works, not a roll mode';
const TWO_WEAPONS = 'the ability modifier of the extra attack of two weapons: the Attack panel says it (DDL-0147)';
const FAMILY = 'in another family of the plan (F1 a new attack, F3 options on Use, F4 a table)';
const TEXT = 'no number for the player: a description of what happens';
const AC = 'the sheet adds it to the AC (AC_BONUS_FEATURES, SUBCLASS_AC_BONUSES, naturalArmor; DDL-0215)';
const HP_CARD = "spends one Hit Point Die outside a rest: the HP card's Hit dice does it at any time (DDL-0120)";
const HIT_DICE = 'changes the Hit Point Die roll: HIT_DIE_RULES and REST_HIT_DICE_BONUS in engine/playRest (DDL-0215)';
const SLOT = 'a button on the cast card, by the slot level (CAST_TRIGGERS in engine/playCast, DDL-0215)';
const SPELL_HEAL = 'added to the healing of a spell of level 1 or higher (SPELL_HEAL_BONUS in engine/playCast, DDL-0219)';
const HEAL_MOD = 'added to every healing or Temporary Hit Points (healOutcome, tempHpOutcome; Honed Spellfire in the catalog; DDL-0215)';
export const EXPLAINED = {
  advantage: {
    'cohort of chaos': OTHER, 'street justice': OTHER, 'team tactics': OTHER, 'adjust density': OTHER, 'potent stone': OTHER,
    'zhentarim ruffian': ONCE, 'vigilant blessing': ONCE, 'tides of chaos': ONCE,
    'insightful fighting': SNEAK, 'rakish audacity': SNEAK,
    'rapid strike': 'trades an Advantage away for an extra attack; nothing to add to the roll',
  },
  disadvantage: {
    'armor model: guardian': OTHER, guardian: OTHER, 'improved brutal strike': OTHER, 'heightened spell': OTHER,
    'boon of the furious storm': OTHER, 'cohort of chaos': OTHER, 'harper teamwork': OTHER, 'illusion adept': OTHER,
    slasher: OTHER, 'magical ambush': OTHER, 'eldritch strike': OTHER, 'adjust density': OTHER, 'eldritch hex': OTHER,
    'defensive tactics': OTHER, 'dread lord': OTHER, 'spiritual protectors': OTHER, 'power of the wilds': OTHER,
    'beasts of ill omen': OTHER, panache: OTHER, 'focused strike': OTHER,
    'boon of communication': NEGATES, bomber: NEGATES, 'crossbow expert': NEGATES, gunner: NEGATES, sharpshooter: NEGATES,
    'spell sniper': NEGATES, 'street justice': NEGATES, hawkeyed: NEGATES, 'firearms mastery': NEGATES,
    'insightful fighting': SNEAK, 'rakish audacity': SNEAK,
    'unpredictable movement': 'a condition of another rule (no Disadvantage on the Initiative roll)',
  },
  bonus: {
    'giant ancestry': "the umbrella of the goliath's ancestries: the chosen one is its own feature with its own pool and roll",
    'improved brutal strike': OTHER, "oketra's blessing": OTHER, "rhonas's blessing": OTHER, 'dashing strikes': OTHER, 'health funnel': OTHER,
    'crossbow expert': TWO_WEAPONS, 'dual wielder': TWO_WEAPONS,
    'experimental elixir': FAMILY, 'armor model': FAMILY, 'animal enhancement': FAMILY, 'radiant sun bolt': FAMILY,
    'soul of the forge': AC, 'agile parry': AC, 'awakened astral self': AC, defense: AC, 'tauren lineage (taunka)': AC, 'integrated protection': AC, 'revenant blade': AC,
    'dwarven fortitude': HP_CARD,
    'sharpen the blade': FAMILY,
    'sanctuary vessel': TEXT, "artisan's expertise": 'double proficiency and proficiency, the sheet derives them',
  },
  reroll: {
    'bountiful luck': OTHER, 'second chance': OTHER, 'shared resilience': OTHER,
    'black blood healing': HIT_DICE,
  },
  heal: {
    'guardian spirit': OTHER, 'holy deliverance': OTHER, 'rot and violence': OTHER, 'master of hexes': 'it takes a healing away; nothing to roll',
    'pet specialization': OTHER, 'infusion of light': 'refills a pool by the damage rolled: the pool is adjusted by hand (DDL-0209)',
    'experimental elixir': FAMILY, 'holy bolt': FAMILY, 'mystic brew': FAMILY,
    'dwarven fortitude': HP_CARD, 'healing machine': HP_CARD, lifedrinker: HP_CARD, 'emergency fail-safe': HP_CARD, 'inner peace': HIT_DICE, 'troll healing': HIT_DICE, 'vigor of the hill giant': HIT_DICE, 'boon of bountiful health': HIT_DICE,
    'boon of fortitude': HEAL_MOD,
    'blessed healer': SLOT, 'disciple of life': SPELL_HEAL, 'atonement': OTHER,
    'necromancy spellbook': TEXT,
  },
  temp: {
    tundra: OTHER, 'mote of potential': OTHER, 'improved warding flare': OTHER, 'fortifying spell': OTHER, 'luminous barrier': OTHER,
    'durable summons': OTHER, 'create thrall': OTHER, 'health funnel': OTHER, 'semblance of life': OTHER, 'enveloping mist': OTHER,
    'boon of bountiful health': HEAL_MOD, 'honed spellfire': HEAL_MOD,
    'abjuration adept': SLOT,
  },
  floor: {},
  dice: {
    'giant ancestry': "the umbrella of the goliath's ancestries: the chosen one is its own feature with its own pool and roll",
    'improved brutal strike (2)': 'the scale raises the Brutal Strike die; the two effects are two riders',
    'boon of spell recall': 'a button on the cast card rolls the 1d4 and gives the slot back (CAST_TRIGGERS, DDL-0218)',
    appearance: 'a table for how the tiefling looks (1d4 + 1 features), not a roll in play',
    'improved elemental fury': 'the scale raises the Primal Strike die (FEATURE_ROLLS passive)',
    'improved blessed strikes': 'the scale raises the Divine Strike die; the Use gives the temp HP',
    'supreme healing': 'every spell healing die at its maximum (withDiceMax in spellHealEvent, DDL-0217)',
    'great stature': "the fighter level raises the Giant's Might die (FEATURE_ROLLS toggle, byLevel)",
    'runic juggernaut': "the fighter level raises the Giant's Might die (FEATURE_ROLLS toggle, byLevel)",
  },
};

/** As pistas de mecânica do texto. */
export function cuesOf(text) {
  const t = text.toLowerCase();
  return CUES.filter(([, re]) => re.test(t)).map(([c]) => c);
}

/** 'use', 'log' ou 'passive'. */
export function classify(f, action, pools, bridged) {
  if ((action?.activities ?? []).length || pools.length || (f.roll && f.roll !== 'passive') || bridged || PASSIVE_FEATURES.includes(f.name.toLowerCase()) || REROLL_FEATURES.includes(f.name.toLowerCase())) return 'use';
  return isActiveFeature(f, action, pools) ? 'log' : 'passive';
}

/** As pistas sem conta e sem motivo nomeado de uma feature (vazio em `use`). */
export function unexplainedCues(f, cat, cues) {
  if (cat === 'use') return [];
  return cues.filter((c) => !EXPLAINED[c]?.[String(f.name).toLowerCase()]);
}
