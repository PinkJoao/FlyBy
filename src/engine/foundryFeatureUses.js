// =============================================================================
// foundryFeatureUses: o pool de recurso (uses) de cada feature
// =============================================================================
// O QUE FAZ
//   Dá a uma feature de RECURSO o `system.uses` do Foundry (máximo e
//   recuperação), para a ficha rastrear Second Wind, Rages, Channel Divinity,
//   pontos de feitiçaria. O `max` costuma citar um ScaleValue da própria classe
//   (`@scale.<classId>.<id>`); sem escala, uma fórmula literal. Valores dos 12
//   premades oficiais. As activities são outro módulo.
//
// FUNÇÕES
//   slug(s): o slug de um título.
//   featureUses(name, classId): o bloco `uses`, ou null (o chamador cai no
//     overlay). O classId escolhe a linha quando o nome colide entre classes e
//     monta a referência; sem ele, só a tabela plana (traços, talentos). Para um
//     membro de pool compartilhado devolve NO_POOL, que o firstUses respeita.
//   featUses(name): o pool curado de um TALENTO (FEAT_USES), ou null.
//   hasActivityUses(activities): alguma activity já traz o pool dela?
//   proseUses(name, classId, activities): o pool que SÓ a prosa declara, ou null;
//     a última reserva, depois do overlay, e nunca com pool na activity.
//   firstUses(...list): o primeiro bloco com `max`; sem nenhum, o primeiro que
//     existe (o overlay sem máximo continua saindo como antes), ou o vazio. Um
//     NO_POOL antes de qualquer máximo encerra a busca no vazio.
//
// DECISÕES E ARMADILHAS
//   - SCOPED_USES (TC-0093, TC-0094): pools com nome que colide entre classes ou
//     cuja escala mora na SUBCLASSE, por `classe|nome`, cada um conferido no texto
//     do XPHB: Combat Superiority (todos no curto ou longo, `sr`), Psionic Power
//     do Psi Warrior e do Soulknife (1 no curto, todos no longo), Warrior of the
//     Gods (o pool de d12 do Zealot, na escala curada da subclasse), Fey
//     Reinforcements (1 Summon Fey sem slot por descanso longo). O overlay
//     descreve esses pools como `entryData.resources` (um "dicePool" que o
//     Plutonium vira item à parte) e o nosso export não lia; sem o pool no DONO,
//     as sub-features ficavam sem ter o que gastar.
//   - SHARED_POOL_MEMBERS: as sub-features em que o overlay COPIA o máximo do
//     pool do dono (Protective Field, Psionic Strike, Telekinetic Movement,
//     Psi-Bolstered Knack, Psychic Whispers). Elas gastam o pool do Psionic Power;
//     um pool próprio daria N contadores onde o livro tem um. Os usos grátis delas
//     (uma vez por descanso) moram na ACTIVITY e ficam.
//   - FEAT_USES: Ritual Caster (o Quick Ritual, 1 por descanso longo) e Boon of
//     Recovery (o Recover Vitality, dez d10 por descanso longo; o Last Stand tem o
//     pool na activity). O talento não passava pelo registro curado.
//   - Precedência (TC-0068): este registro, depois a tabela GERADA do SRD
//     (FEATURE_USES_BY_CLASS e FEATURE_USES_FLAT, por `npm run gen:uuids`), depois
//     o overlay. O SRD vem antes por ser o próprio sistema de destino.
//   - `scale` usa o título; `id`, um identificador literal. Onde o SRD tem
//     identificador curto próprio (TC-0062), o slug do título NÃO serve. O Wild
//     Shape é o exemplo: `wild-shape` é a escala de CR, os USOS moram em "Wild
//     Shape Uses".
//   - Recuperação comum: descanso longo recupera tudo; curto recupera 1.
//   - PROSE_USES_* (DDL-0106) vem de `npx vite-node scripts/survey-feature-uses.js`:
//     a frase de uso limitado da prosa ("Once you use this trait, you can't use it
//     again until you finish a Long Rest", "a number of times equal to your
//     Proficiency Bonus") lida para [máximo, descanso]. É a ÚLTIMA reserva, para
//     nunca trocar um dado do SRD ou do overlay; "Short Rest or Long Rest" é `sr`
//     (o dnd5e recupera o `sr` também no descanso longo). O SRD às vezes guarda o
//     pool na ACTIVITY (Natural Recovery, Tireless): aí o item fica sem `uses` de
//     propósito, e somar um no item daria dois contadores. Feature de classe vai por
//     `classe|nome`; traço e talento, só pelo nome.
//   - NOT_A_POOL: frases que a varredura acha mas não são pool PRÓPRIO, cada uma
//     lida à mão: mexem no pool de outra feature (Superior Inspiration, Improved
//     Warding Flare, Master of Runes), limitam por ALVO, benefício ou portal
//     (Hypnotic Gaze, Instinctive Charm, Lunar Phenomenon, Planar Wanderer), ou o
//     pool mora no item da escolha (Giant Ancestry: cada dádiva já tem o @prof).
// -----------------------------------------------------------------------------

import { FEATURE_USES_BY_CLASS, FEATURE_USES_FLAT } from './compendiumUuidsData';

const SR_FULL = [{ period: 'sr', type: 'recoverAll' }];
const LR_FULL = [{ period: 'lr', type: 'recoverAll' }];
const LR_FULL_SR_ONE = [
  { period: 'lr', type: 'recoverAll' },
  { period: 'sr', type: 'formula', formula: '1' },
];

const slug = (s) => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ATENÇÃO: cite o IDENTIFICADOR exportado, não o título; use id onde o SRD é curto (TC-0068).
const FEATURE_USES = {
  'second wind': { scale: 'Second Wind', recovery: LR_FULL_SR_ONE },
  'action surge': { scale: 'Action Surge', recovery: SR_FULL },
  indomitable: { scale: 'Indomitable', recovery: LR_FULL },
  rage: { scale: 'Rages', recovery: LR_FULL_SR_ONE },
  'channel divinity': { scale: 'Channel Divinity', recovery: LR_FULL_SR_ONE },
  'wild shape': { id: 'wild-shape-uses', recovery: LR_FULL_SR_ONE },
  'favored enemy': { scale: 'Favored Enemy', recovery: LR_FULL },
  "monk's focus": { id: 'focus', recovery: SR_FULL },
  'font of magic': { id: 'points', recovery: LR_FULL },
  'bardic inspiration': { max: 'max(1, @abilities.cha.mod)', recovery: SR_FULL },
  'innate sorcery': { max: '2', recovery: LR_FULL },
  'lay on hands': { max: '5 * @classes.paladin.levels', recovery: LR_FULL },
  'arcane recovery': { max: '1', recovery: LR_FULL },
  'magical cunning': { max: '1', recovery: LR_FULL },
};

const REST = { lr: LR_FULL, sr: SR_FULL };

export const NO_POOL = Object.freeze({ none: true });

const SCOPED_USES = {
  'fighter|combat superiority': { max: '@scale.battle-master.superiority.number', recovery: SR_FULL },
  'fighter|psionic power': { max: '@scale.psi-warrior.die.number', recovery: LR_FULL_SR_ONE },
  'rogue|psionic power': { max: '@scale.soulknife.die.number', recovery: LR_FULL_SR_ONE },
  'barbarian|warrior of the gods': { max: '@scale.zealot.warrior-of-the-gods', recovery: LR_FULL },
  'ranger|fey reinforcements': { max: '1', recovery: LR_FULL },
};

const SHARED_POOL_MEMBERS = new Set([
  'fighter|protective field', 'fighter|psionic strike', 'fighter|telekinetic movement',
  'rogue|psi-bolstered knack', 'rogue|psychic whispers',
]);

const FEAT_USES = {
  'ritual caster': { max: '1', recovery: LR_FULL },
  'boon of recovery': { max: '10', recovery: LR_FULL },
};

// ATENÇÃO: reserva de precedência MAIS BAIXA; regenere a lista com o survey, não por memória do livro.
const PROSE_USES_BY_CLASS = {
  "artificer|flash of genius": ['max(1, @abilities.int.mod)', 'lr'],
  "artificer|magic item tinker": ['1', 'lr'],
  "artificer|tinker's magic": ['max(1, @abilities.int.mod)', 'lr'],
  "warlock|accursed specter": ['1', 'lr'],
  "ranger|ancient might": ['1', 'lr'],
  "bard|animating performance": ['1', 'lr'],
  "wizard|arcane abeyance": ['1', 'sr'],
  "artificer|arcane jolt": ['max(1, @abilities.int.mod)', 'lr'],
  "paladin|avenging angel": ['1', 'lr'],
  "wizard|awakened spellbook": ['1', 'lr'],
  "warlock|beguiling defenses": ['1', 'lr'],
  "bard|beguiling magic": ['1', 'lr'],
  "wizard|bladesong": ['max(1, @abilities.int.mod)', 'lr'],
  "cleric|blaze of glory": ['1', 'lr'],
  "druid|blazing revival": ['1', 'lr'],
  "bard|blessing of moonlight": ['1', 'lr'],
  "cleric|blessing of the forge": ['1', 'lr'],
  "rogue|bloodthirst": ['max(1, @abilities.int.mod)', 'lr'],
  "barbarian|bolstering magic": ['@prof', 'lr'],
  "monk|breath of the dragon": ['@prof', 'lr'],
  "fighter|bulwark of force": ['1', 'lr'],
  "barbarian|call the hunt": ['@prof', 'lr'],
  "druid|cauterizing flames": ['@prof', 'lr'],
  "artificer|chemical mastery": ['1', 'lr'],
  "ranger|chilling retribution": ['max(1, @abilities.wis.mod)', 'lr'],
  "warlock|clairvoyant combatant": ['1', 'sr'],
  "sorcerer|clockwork cavalcade": ['1', 'lr'],
  "sorcerer|crown of spellfire": ['1', 'lr'],
  "warlock|defy death": ['1', 'lr'],
  "ranger|detect portal": ['1', 'sr'],
  "cleric|divine foreknowledge": ['1', 'lr'],
  "cleric|divine reaper": ['1', 'sr'],
  "ranger|drake companion": ['1', 'lr'],
  "ranger|drake's breath": ['1', 'lr'],
  "artificer|dreadnaught": ['max(1, @abilities.int.mod)', 'lr'],
  "paladin|elder champion": ['1', 'lr'],
  "artificer|eldritch cannon": ['1', 'lr'],
  "warlock|elemental gift": ['@prof', 'lr'],
  "paladin|elemental rebuke": ['max(1, @abilities.cha.mod)', 'lr'],
  "cleric|embodiment of the law": ['max(1, @abilities.wis.mod)', 'lr'],
  "cleric|emboldening bond": ['@prof', 'lr'],
  "bard|empowered channeling": ['1', 'sr'],
  "ranger|ethereal step": ['1', 'sr'],
  "wizard|event horizon": ['1', 'lr'],
  "paladin|exalted champion": ['1', 'lr'],
  "cleric|eyes of night": ['1', 'lr'],
  "druid|faithful summons": ['1', 'lr'],
  "warlock|fathomless plunge": ['1', 'sr'],
  "sorcerer|favored by the gods": ['1', 'sr'],
  "fighter|fighting spirit": ['3', 'lr'],
  "monk|flurry of healing and harm": ['max(1, @abilities.wis.mod)', 'lr'],
  "warlock|form of dread": ['max(1, @abilities.cha.mod)', 'lr'],
  "ranger|fortifying soul": ['1', 'lr'],
  "ranger|frozen haunt": ['1', 'lr'],
  "druid|fungal infestation": ['max(1, @abilities.wis.mod)', 'lr'],
  "rogue|ghost walk": ['1', 'lr'],
  "fighter|giant's might": ['@prof', 'lr'],
  "fighter|group recovery": ['1', 'sr'],
  "monk|hand of ultimate mercy": ['1', 'lr'],
  "warlock|hexblade's curse": ['1', 'sr'],
  "druid|hidden paths": ['max(1, @abilities.wis.mod)', 'lr'],
  "ranger|hunter's sense": ['max(1, @abilities.wis.mod)', 'lr'],
  "wizard|illusory self": ['1', 'sr'],
  "warlock|indestructible life": ['1', 'sr'],
  "barbarian|infectious fury": ['@prof', 'lr'],
  "bard|infectious inspiration": ['max(1, @abilities.cha.mod)', 'lr'],
  "paladin|invincible conqueror": ['1', 'lr'],
  "fighter|know your enemy": ['1', 'lr'],
  "paladin|living legend": ['1', 'lr'],
  "sorcerer|lunar boons": ['@prof', 'lr'],
  "barbarian|magic awareness": ['@prof', 'lr'],
  "ranger|magic-user's nemesis": ['1', 'sr'],
  "wizard|manifest mind": ['@prof', 'lr'],
  "bard|mantle of majesty": ['1', 'lr'],
  "artificer|mapping magic": ['max(1, @abilities.int.mod)', 'lr'],
  "rogue|master duelist": ['1', 'sr'],
  "wizard|momentary stasis": ['max(1, @abilities.int.mod)', 'lr'],
  "paladin|mortal bulwark": ['1', 'lr'],
  "warlock|necrotic husk": ['1', 'sr'],
  "paladin|noble scion": ['1', 'lr'],
  "wizard|one with the word": ['1', 'lr'],
  "artificer|perfected armor": ['max(1, @abilities.int.mod)', 'lr'],
  "ranger|perfected bond": ['@prof', 'lr'],
  "bard|performance of creation": ['1', 'lr'],
  "sorcerer|power of shadow": ['1', 'lr'],
  "cleric|priest of zeal": ['max(1, @abilities.wis.mod)', 'lr'],
  "barbarian|rage of the gods": ['1', 'lr'],
  "artificer|reanimated companion": ['1', 'lr'],
  "artificer|reanimator's skill set": ['@abilities.int.mod', 'lr'],
  "fighter|reclaim potential": ['max(1, @abilities.con.mod)', 'lr'],
  "artificer|refined reanimation": ['1', 'lr'],
  "artificer|restorative reagents": ['max(1, @abilities.int.mod)', 'lr'],
  "fighter|runic shield": ['@prof', 'lr'],
  "warlock|searing vengeance": ['1', 'lr'],
  "cleric|sentinel at death's door": ['max(1, @abilities.wis.mod)', 'lr'],
  "bard|shadow lore": ['1', 'lr'],
  "fighter|shadow martyr": ['1', 'sr'],
  "cleric|solidarity's action": ['max(1, @abilities.wis.mod)', 'lr'],
  "rogue|spell thief": ['1', 'lr'],
  "druid|spirit totem": ['1', 'sr'],
  "cleric|steps of night": ['@prof', 'lr'],
  "fighter|strength before death": ['1', 'lr'],
  "artificer|superior atlas": ['1', 'lr'],
  "ranger|swarming dispersal": ['@prof', 'lr'],
  "sorcerer|tamed surge": ['1', 'lr'],
  "warlock|tentacle of the deeps": ['@prof', 'lr'],
  "wizard|the third eye": ['1', 'sr'],
  "sorcerer|trance of order": ['1', 'lr'],
  "sorcerer|umbral form": ['1', 'lr'],
  "bard|unbreakable majesty": ['1', 'sr'],
  "paladin|undying sentinel": ['1', 'lr'],
  "sorcerer|unearthly recovery": ['1', 'lr'],
  "rogue|unerring eye": ['max(1, @abilities.wis.mod)', 'lr'],
  "bard|universal speech": ['1', 'lr'],
  "fighter|unleash incarnation": ['max(1, @abilities.con.mod)', 'lr'],
  "fighter|unwavering mark": ['max(1, @abilities.str.mod)', 'lr'],
  "wizard|violent attraction": ['max(1, @abilities.int.mod)', 'lr'],
  "rogue|wails from the grave": ['max(1, @abilities.dex.mod)', 'lr'],
  "druid|walker in dreams": ['1', 'lr'],
  "cleric|warding flare": ['max(1, @abilities.wis.mod)', 'lr'],
  "fighter|warding maneuver": ['max(1, @abilities.con.mod)', 'lr'],
  "sorcerer|warping implosion": ['1', 'lr'],
  "sorcerer|wind soul": ['1', 'sr'],
  "monk|wings unfurled": ['@prof', 'lr'],
  "bard|words of terror": ['1', 'sr'],
  "cleric|wrath of the storm": ['max(1, @abilities.wis.mod)', 'lr'],
  "barbarian|zealous presence": ['1', 'lr'],
};

const PROSE_USES_FLAT = {
  "aberrant dragonmark": ['1', 'lr'],
  "adept of the red robes": ['@prof', 'lr'],
  "agent of order": ['@prof', 'lr'],
  "baleful scion": ['@prof', 'lr'],
  "bloodlust": ['@prof', 'lr'],
  "boon of exquisite radiance": ['1', 'lr'],
  "boon of fluid forms": ['1', 'lr'],
  "boon of misty escape": ['1', 'lr'],
  "boon of terror": ['1', 'sr'],
  "boon of the soul drinker": ['1', 'sr'],
  "cult of the dragon initiate": ['1', 'sr'],
  "delicious pain": ['1', 'sr'],
  "ember of the fire giant": ['@prof', 'lr'],
  "fade away": ['1', 'sr'],
  "fairy trickster": ['@prof', 'lr'],
  "fury of the frost giant": ['@prof', 'lr'],
  "gathered whispers": ['@prof', 'lr'],
  "genie magic": ['1', 'lr'],
  "gift of the chromatic dragon": ['1', 'lr'],
  "gift of the gem dragon": ['@prof', 'lr'],
  "gift of the metallic dragon": ['@prof', 'lr'],
  "greater aberrant mark": ['@prof', 'lr'],
  "greater mark of handling": ['@prof', 'lr'],
  "greater mark of hospitality": ['1', 'lr'],
  "greater mark of scribing": ['1', 'lr'],
  "greater mark of warding": ['@prof', 'lr'],
  "guile of the cloud giant": ['@prof', 'lr'],
  "keenness of the stone giant": ['@prof', 'lr'],
  "knight of the crown": ['@prof', 'lr'],
  "knight of the rose": ['@prof', 'lr'],
  "knight of the sword": ['@prof', 'lr'],
  "light bringer": ['1', 'lr'],
  "living shadow": ['@prof', 'lr'],
  "lordly resolve": ['1', 'lr'],
  "love bites": ['1', 'sr'],
  "mage slayer": ['1', 'sr'],
  "mark of sentinel": ['@prof', 'lr'],
  "mist walker": ['@prof', 'lr'],
  "mythal touched": ['@prof', 'lr'],
  "orcish fury": ['1', 'sr'],
  "purple dragon rook": ['1', 'lr'],
  "putrefy": ['1', 'sr'],
  "rebuke": ['1', 'sr'],
  "righteous heritor": ['@prof', 'lr'],
  "sharp eye": ['@prof', 'lr'],
  "soul of the storm giant": ['@prof', 'lr'],
  "squire of solamnia": ['@prof', 'lr'],
  "strike of the giants": ['@prof', 'lr'],
  "strixhaven mascot": ['1', 'lr'],
  "survivor": ['1', 'lr'],
  "symbiotic being": ['@prof', 'lr'],
  "tireless reveler": ['@prof', 'sr'],
  "vampire hunter": ['1', 'sr'],
  "vampiric exultation": ['1', 'sr'],
  "astral spark": ['@prof', 'lr'],
  "blessing of the raven queen": ['@prof', 'lr'],
  "built for success": ['@prof', 'lr'],
  "celestial revelation": ['1', 'lr'],
  "daunting roar": ['1', 'sr'],
  "draconic cry": ['@prof', 'lr'],
  "eerie token": ['1', 'lr'],
  "fearless": ['1', 'lr'],
  "fey gift": ['@prof', 'lr'],
  "fey step": ['@prof', 'lr'],
  "fortune from the many": ['@prof', 'lr'],
  "gem flight": ['1', 'lr'],
  "hadozee dodge": ['@prof', 'lr'],
  "healing hands": ['1', 'lr'],
  "hidden step": ['@prof', 'lr'],
  "howl": ['@prof', 'lr'],
  "hungry jaws": ['@prof', 'lr'],
  "kenku recall": ['@prof', 'lr'],
  "knowledge from a past life": ['@prof', 'lr'],
  "partially amphibious": ['1', 'lr'],
  "rabbit hop": ['@prof', 'lr'],
  "shifting (beasthide)": ['@prof', 'lr'],
  "shifting (longtooth)": ['@prof', 'lr'],
  "shifting (swiftstride)": ['@prof', 'lr'],
  "shifting (wildhunt)": ['@prof', 'lr'],
  "starlight step": ['@prof', 'lr'],
  "svirfneblin camouflage": ['@prof', 'lr'],
  "taunt": ['@prof', 'lr'],
  "vampiric bite": ['@prof', 'lr'],
};

export const NOT_A_POOL = new Set([
  'superior inspiration', 'improved warding flare', 'master of runes', 'hypnotic gaze',
  'instinctive charm', 'lunar phenomenon', 'planar wanderer', 'giant ancestry',
]);

/**
 * O bloco `system.uses` de uma feature de recurso, ou null.
 * @param {string} name
 * @param {string} [classId]
 * @returns {{max:string, spent:number, recovery:object[]}|null}
 */
export function featureUses(name, classId) {
  const key = String(name ?? '').trim().toLowerCase();
  const scopedKey = classId ? `${String(classId).toLowerCase()}|${key}` : null;
  const scoped = scopedKey ? SCOPED_USES[scopedKey] : null;
  if (scoped) return { max: scoped.max, spent: 0, recovery: scoped.recovery.map((r) => ({ ...r })) };
  if (scopedKey && SHARED_POOL_MEMBERS.has(scopedKey)) return NO_POOL;
  const entry = FEATURE_USES[key];
  if (entry) {
    const max = entry.max ?? `@scale.${classId}.${entry.id ?? slug(entry.scale)}`;
    return { max, spent: 0, recovery: entry.recovery.map((r) => ({ ...r })) };
  }
  const srd = (classId ? FEATURE_USES_BY_CLASS[`${String(classId).toLowerCase()}|${key}`] : null)
    ?? FEATURE_USES_FLAT[key];
  if (!srd) return null;
  return { max: srd.max, spent: 0, recovery: srd.recovery.map((r) => ({ ...r })) };
}

/** Alguma activity já tem pool próprio (`activity.uses`, a forma do SRD)? */
export function hasActivityUses(activities) {
  return Object.values(activities ?? {}).some((a) => a?.uses?.max);
}

/** O pool que só a prosa declara, ou null; nunca quando a activity já tem pool. */
export function proseUses(name, classId, activities = null) {
  if (hasActivityUses(activities)) return null;
  const key = String(name ?? '').trim().toLowerCase();
  const entry = (classId ? PROSE_USES_BY_CLASS[`${String(classId).toLowerCase()}|${key}`] : null) ?? PROSE_USES_FLAT[key];
  if (!entry) return null;
  const [max, rest] = entry;
  return { max, spent: 0, recovery: REST[rest].map((r) => ({ ...r })) };
}

/** O pool curado de um talento, ou null. */
export function featUses(name) {
  const entry = FEAT_USES[String(name ?? '').trim().toLowerCase()];
  return entry ? { max: entry.max, spent: 0, recovery: entry.recovery.map((r) => ({ ...r })) } : null;
}

/** O primeiro bloco `uses` com máximo; sem nenhum, o primeiro que existe (ou o vazio). */
export function firstUses(...list) {
  const empty = { max: '', spent: 0, recovery: [] };
  const hit = list.find((u) => u?.none || u?.max);
  if (hit?.none) return empty;
  return hit ?? list.find((u) => u && !u.none) ?? empty;
}
