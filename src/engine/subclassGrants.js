// =============================================================================
// subclassGrants: as proficiências e resistências FIXAS de features de subclasse
// =============================================================================
// O QUE FAZ
//   Features de subclasse concedem proficiências só em PROSA ("You gain
//   proficiency with heavy armor"), então um REGISTRO CURADO (TC-0012), levantado
//   varrendo todos os class-*.json (2026-07-16): toda feature com "gain
//   proficiency/training with/in" está aqui ou no SUBCLASS_FEATURE_GRANTS (o lado
//   das ESCOLHAS, em classFeatureChoices).
//
//   Cada grupo: { level, source?, feature, ...grants }. `source` distingue versões
//   com grants diferentes (Alchemist EFA x TCE). Os campos:
//     armor, weapons, tools, languages: rótulos.
//     skills, expertiseSkills, saves: códigos (expertiseSkills marca o nível 2).
//     resist, immune: tipos de dano PERMANENTES.
//     resistBy: resistência permanente cujo TIPO vem de outra escolha já feita.
//   E os CONDICIONAIS ("if you already have..."), que viram escolhas geradas ao
//   vivo contra o personagem: conditionalArtisanTool (uma ferramenta de artesão
//   por tool do grant que ele já tinha), conditionalSaveAlt e conditionalSkillAlt
//   (outro save ou perícia desta lista; [] é qualquer um ainda não proficiente).
//
// FUNÇÕES
//   subclassGrantGroups(classId, subclassObj, level): os grupos que se aplicam.
//   resistByTypes(spec, cls): os tipos de um `resistBy`, lidos do bag da classe.
//   deriveSubclassGrants(character, db): as proficiências e traços de dano.
//   baselineTools, baselineSkills, baselineSaves(character, db): o que o
//     personagem tem SEM os grants de subclasse (a base do "if you already").
//   subclassConditionalChoices(db, cls, subclassObj, character): as escolhas
//     condicionais (ids `sub:cond-*@<nível>`, na flag residual, DDL-0028).
//
// DECISÕES E ARMADILHAS
//   - Arma individual à escolha é o kind 'weaponProf' (só o Kensei alcança).
//     Grants dentro de OPÇÕES de featureoption não têm caso alcançável (só o Totem
//     Warrior Tiger, reprint-oculto). Sidekicks e UA fora.
//   - RESISTÊNCIA (DDL-0080, DDL-0081): a varredura é sobre TODA feature cuja
//     prosa cite "resistance", em QUALQUER fonte (96 features), e separa:
//       1a. PERMANENTE E FIXA: este registro (15 casos).
//       1b. PERMANENTE com tipo de outra escolha já feita: `resistBy` (Genie, pelo
//           genie kind; Storm Herald, pelo ambiente do Storm Aura).
//       2. PERMANENTE À ESCOLHA: kind 'resist' (só Elemental Affinity).
//       3. RE-ESCOLHIDA A CADA DESCANSO: estado de sessão, não build (Fiendish
//          Resilience, Dread Allegiance, Nature's Ward). Fica na prosa até o
//          play-state da Fase C.
//       4. CONDICIONAL a aura, forma ou reação, ou que não é sobre TIPO de dano
//          (Aura of Warding, Spell Resistance, Stormborn, Elemental Epitome, Rage,
//          Wild Shape): prosa, pela regra do damageTraits.
//   - "from nonmagical attacks" é um `bypasses` do Foundry que o traço plano não
//     expressa: o Avatar of Battle PHB fica na prosa (a entrada casa XPHB), e do
//     Saint of Forge and Fire só entra a imunidade a fogo.
//   - Não filtre a varredura pela tag `{@variantrule Resistance}` nem pela fonte
//     atual: 11 subclasses alcançáveis ficaram sem derivar nada por isso. A
//     maioria escreve em texto puro, e toda subclasse legada é alcançável pelo
//     chassi 2024 (stub `_copy`, DDL-0039).
//   - Notas de entradas: Alchemist (acid e poison; a imunidade é à CONDIÇÃO
//     Poisoned, que fica na prosa); Storm Soul "even when your aura isn't active";
//     Speech of the Woods (Sylvan) e Wind Speaker (Primordial) são idioma em prosa
//     (TC-0039), e no chassi 2024 a subclasse só entra no 3, então o gate de nível
//     nunca dispara cedo; Form of Dread tem a imunidade condicional e a
//     resistência permanente.
//   - resistByTypes varre o bag pelo KIND: há uma subclasse por classe, e um pick
//     fora do mapa não contribui. O pick pode trazer a fonte ("Desert|XGE"),
//     descartada na normalização.
// -----------------------------------------------------------------------------

import { resolveSubclassObj, resolveClassObj, resolveRaceObj } from './resolve';
import { collectChoicePicks } from './choices';
import { collectSkillProficiencies, collectToolProficiencies } from './proficiency';
import { deriveFeatureGrants } from './featureEffects';

const HEAVY = 'Heavy Armor';
const MEDIUM = 'Medium Armor';
const LIGHT = 'Light Armor';
const SHIELDS = 'Shields';
const MARTIAL = 'Martial Weapons';

/** @type {Record<string, object[]>} */
export const SUBCLASS_GRANTS = {
  'artificer|alchemist': [
    { level: 3, source: 'EFA', feature: 'Tools of the Trade', tools: ["Alchemist's Supplies", 'Herbalism Kit'], conditionalArtisanTool: true },
    { level: 3, source: 'TCE', feature: 'Tool Proficiency', tools: ["Alchemist's Supplies"], conditionalArtisanTool: true },
    { level: 15, source: 'EFA', feature: 'Chemical Mastery', resist: ['acid', 'poison'] },
    { level: 15, source: 'TCE', feature: 'Chemical Mastery', resist: ['acid', 'poison'] },
  ],
  'artificer|armorer': [
    { level: 3, source: 'EFA', feature: 'Tools of the Trade', armor: [HEAVY], tools: ["Smith's Tools"], conditionalArtisanTool: true },
    { level: 3, source: 'TCE', feature: 'Tools of the Trade', armor: [HEAVY], tools: ["Smith's Tools"], conditionalArtisanTool: true },
  ],
  'artificer|artillerist': [
    { level: 3, source: 'EFA', feature: 'Tools of the Trade', weapons: ['Martial Ranged Weapons'], tools: ["Woodcarver's Tools"], conditionalArtisanTool: true },
    { level: 3, source: 'TCE', feature: 'Tool Proficiency', tools: ["Woodcarver's Tools"], conditionalArtisanTool: true },
  ],
  'artificer|battle smith': [
    { level: 3, feature: 'Battle Ready', weapons: [MARTIAL] },
    { level: 3, feature: 'Tools of the Trade', tools: ["Smith's Tools"], conditionalArtisanTool: true },
  ],
  'artificer|cartographer': [
    { level: 3, feature: 'Tools of the Trade', tools: ["Calligrapher's Supplies", "Cartographer's Tools"], conditionalArtisanTool: true },
  ],
  'artificer|reanimator': [
    { level: 3, feature: "Reanimator's Skill Set", tools: ["Alchemist's Supplies"], conditionalArtisanTool: true },
  ],
  'barbarian|storm herald': [
    {
      level: 6,
      feature: 'Storm Soul',
      resistBy: { choice: 'featureoption', map: { desert: ['fire'], sea: ['lightning'], tundra: ['cold'] } },
    },
  ],
  'bard|valor': [
    { level: 3, feature: 'Bonus Proficiencies', armor: [MEDIUM, SHIELDS], weapons: [MARTIAL] },
  ],
  'bard|swords': [{ level: 3, feature: 'Bonus Proficiencies', armor: [MEDIUM], weapons: ['Scimitar'] }],
  'bard|spirits': [{ level: 3, feature: 'Channeler', tools: ['Playing Cards'] }],
  'cleric|life': [{ level: 1, source: 'PHB', feature: 'Bonus Proficiency', armor: [HEAVY] }],
  'cleric|nature': [{ level: 1, source: 'PHB', feature: 'Bonus Proficiency', armor: [HEAVY] }],
  'cleric|tempest': [{ level: 1, source: 'PHB', feature: 'Bonus Proficiencies', armor: [HEAVY], weapons: [MARTIAL] }],
  'cleric|war': [
    { level: 1, source: 'PHB', feature: 'Bonus Proficiencies', armor: [HEAVY], weapons: [MARTIAL] },
    { level: 17, source: 'XPHB', feature: 'Avatar of Battle', resist: ['bludgeoning', 'piercing', 'slashing'] },
  ],
  'cleric|solidarity (psa)': [{ level: 1, feature: 'Bonus Proficiency', armor: [HEAVY] }],
  'cleric|strength (psa)': [{ level: 1, feature: 'Bonus Proficiency', armor: [HEAVY] }],
  'cleric|zeal (psa)': [{ level: 1, feature: 'Bonus Proficiencies', armor: [HEAVY], weapons: [MARTIAL] }],
  'cleric|arcana': [{ level: 1, feature: 'Arcane Initiate', skills: ['arc'] }],
  'cleric|order': [{ level: 1, feature: 'Bonus Proficiencies', armor: [HEAVY] }],
  'cleric|twilight': [{ level: 1, feature: 'Bonus Proficiencies', armor: [HEAVY], weapons: [MARTIAL] }],
  'cleric|forge': [
    { level: 1, feature: 'Bonus Proficiency', armor: [HEAVY], tools: ["Smith's Tools"] },
    { level: 6, feature: 'Soul of the Forge', resist: ['fire'] },
    { level: 17, feature: 'Saint of Forge and Fire', immune: ['fire'] },
  ],
  'cleric|knowledge': [
    { level: 6, source: 'FRHoF', feature: 'Unfettered Mind', saves: ['int'], conditionalSaveAlt: [] },
  ],
  'druid|shepherd': [
    { level: 2, feature: 'Speech of the Woods', languages: ['Sylvan'] },
  ],
  'fighter|purple dragon knight (banneret)': [
    { level: 7, feature: 'Royal Envoy', skills: ['per'], expertiseSkills: ['per'], conditionalSkillAlt: ['ani', 'ins', 'itm', 'prf'] },
  ],
  'fighter|rune knight': [{ level: 3, feature: 'Bonus Proficiencies', tools: ["Smith's Tools"], languages: ['Giant'] }],
  'fighter|psi warrior': [{ level: 10, feature: 'Guarded Mind', resist: ['psychic'] }],
  'monk|mercy': [{ level: 3, feature: 'Implements of Mercy', skills: ['ins', 'med'], tools: ['Herbalism Kit'] }],
  'monk|drunken master': [{ level: 3, feature: 'Bonus Proficiencies', skills: ['prf'], tools: ["Brewer's Supplies"] }],
  'ranger|gloom stalker': [
    { level: 7, feature: 'Iron Mind', saves: ['wis'], conditionalSaveAlt: ['int', 'cha'] },
  ],
  'ranger|winter walker': [{ level: 3, feature: 'Frigid Explorer', resist: ['cold'] }],
  'fighter|samurai': [
    { level: 7, feature: 'Elegant Courtier', saves: ['wis'], conditionalSaveAlt: ['int', 'cha'] },
  ],
  'rogue|assassin': [
    { level: 3, source: 'PHB', feature: 'Bonus Proficiencies', tools: ['Disguise Kit', "Poisoner's Kit"] },
    { level: 3, source: 'XPHB', feature: "Assassin's Tools", tools: ['Disguise Kit', "Poisoner's Kit"] },
  ],
  'rogue|mastermind': [{ level: 3, feature: 'Master of Intrigue', tools: ['Disguise Kit', 'Forgery Kit'] }],
  'rogue|scout': [{ level: 3, feature: 'Survivalist', skills: ['nat', 'sur'], expertiseSkills: ['nat', 'sur'] }],
  'sorcerer|storm': [
    { level: 3, feature: 'Wind Speaker', languages: ['Primordial'] },
    { level: 6, feature: 'Heart of the Storm', resist: ['lightning', 'thunder'] },
  ],
  'sorcerer|pyromancer (psk)': [
    { level: 6, feature: 'Fire in the Veins', resist: ['fire'] },
    { level: 18, feature: 'Fiery Soul', immune: ['fire'] },
  ],
  'sorcerer|aberrant': [{ level: 6, feature: 'Psychic Defenses', resist: ['psychic'] }],
  'warlock|celestial': [{ level: 6, feature: 'Radiant Soul', resist: ['radiant'] }],
  'warlock|fathomless': [{ level: 6, feature: 'Oceanic Soul', resist: ['cold'] }],
  'warlock|genie': [
    {
      level: 6,
      feature: 'Elemental Gift',
      resistBy: {
        choice: 'spellSet',
        map: { dao: ['bludgeoning'], djinni: ['thunder'], efreeti: ['fire'], marid: ['cold'] },
      },
    },
  ],
  'warlock|great old one': [{ level: 10, feature: 'Thought Shield', resist: ['psychic'] }],
  'warlock|undead': [{ level: 10, feature: 'Necrotic Husk', resist: ['necrotic'] }],
  'warlock|hexblade': [{ level: 1, feature: 'Hex Warrior', armor: [MEDIUM, SHIELDS], weapons: [MARTIAL] }],
  'wizard|necromancy': [{ level: 10, feature: 'Inured to Undeath', resist: ['necrotic'] }],
  'wizard|bladesinging': [
    { level: 2, feature: 'Training in War and Song', armor: [LIGHT], skills: ['prf'] },
  ],
  'wizard|bladesinger': [
    { level: 3, feature: 'Training in War and Song', weapons: ['Melee Martial Weapons (lacking Two-Handed or Heavy)'] },
  ],
};

/** Os grupos do registro que valem para a subclasse até o nível. */
export function subclassGrantGroups(classId, subclassObj, level) {
  if (!classId || !subclassObj) return [];
  const key = `${classId.toLowerCase()}|${(subclassObj.shortName ?? '').toLowerCase()}`;
  return (SUBCLASS_GRANTS[key] ?? []).filter(
    (g) => (g.level ?? 1) <= level && (!g.source || g.source === subclassObj.source),
  );
}

/** Os tipos de dano de um `resistBy`, lidos de um pick do bag da classe. */
function resistByTypes(spec, cls) {
  const out = [];
  for (const pick of collectChoicePicks(cls?.choices, spec.choice)) {
    const key = String(pick).split('|')[0].trim().toLowerCase();
    out.push(...(spec.map?.[key] ?? []));
  }
  return out;
}

/**
 * As proficiências e traços de dano fixos das subclasses do personagem.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {{armor:string[], weapons:string[], grantedSkills:string[],
 *   expertiseSkills:string[], grantedTools:string[],
 *   languages:string[], saves:string[], resist:string[],
 *   immune:string[]}}
 */
export function deriveSubclassGrants(character, db) {
  const out = { armor: [], weapons: [], grantedSkills: [], expertiseSkills: [], grantedTools: [], languages: [], saves: [], resist: [], immune: [] };
  for (const cls of character?.classes ?? []) {
    if (!cls.classId || !cls.subclassId) continue;
    const subObj = resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource);
    for (const g of subclassGrantGroups(cls.classId, subObj, cls.level)) {
      out.armor.push(...(g.armor ?? []));
      out.weapons.push(...(g.weapons ?? []));
      out.grantedSkills.push(...(g.skills ?? []));
      out.expertiseSkills.push(...(g.expertiseSkills ?? []));
      out.grantedTools.push(...(g.tools ?? []));
      out.languages.push(...(g.languages ?? []));
      out.saves.push(...(g.saves ?? []));
      out.resist.push(...(g.resist ?? []));
      out.immune.push(...(g.immune ?? []));
      if (g.resistBy) out.resist.push(...resistByTypes(g.resistBy, cls));
    }
  }
  return out;
}

const ABILITY_LABEL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const ALL_ABILITIES = Object.keys(ABILITY_LABEL);

/** As ferramentas do personagem sem os grants de subclasse. */
function baselineTools(character, db) {
  const out = new Set(collectToolProficiencies(character).map((t) => t.toLowerCase()));
  for (const cls of character?.classes ?? []) {
    const sp = resolveClassObj(db, cls.classId, cls.source)?.startingProficiencies;
    for (const entry of sp?.toolProficiencies ?? []) {
      if (!entry || typeof entry !== 'object') continue;
      for (const [k, v] of Object.entries(entry)) if (v === true) out.add(k.toLowerCase());
    }
  }
  const race = character?.species
    ? resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage)
    : null;
  for (const entry of race?.toolProficiencies ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [k, v] of Object.entries(entry)) if (v === true) out.add(k.toLowerCase());
  }
  for (const t of deriveFeatureGrants(character).grantedTools) out.add(String(t).toLowerCase());
  return out;
}

/** As perícias proficientes sem os grants de subclasse. */
function baselineSkills(character, db) {
  const out = new Set(Object.keys(collectSkillProficiencies(character)));
  const race = character?.species
    ? resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage)
    : null;
  for (const entry of race?.skillProficiencies ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [k, v] of Object.entries(entry)) if (v === true) out.add(k);
  }
  for (const s of deriveFeatureGrants(character).grantedSkills) out.add(s);
  return out;
}

/** Os saves proficientes sem os grants fixos de subclasse. */
function baselineSaves(character, db) {
  const out = new Set();
  const original = (character?.classes ?? []).find((c) => c.isOriginalClass) ?? character?.classes?.[0];
  const classObj = original ? resolveClassObj(db, original.classId, original.source) : null;
  for (const s of classObj?.proficiency ?? []) out.add(s);
  for (const cls of character?.classes ?? []) {
    for (const p of collectChoicePicks(cls.choices, 'save')) out.add(p);
  }
  return out;
}

/**
 * As escolhas condicionais dos grants de subclasse.
 * @param {object} db
 * @param {object} cls
 * @param {object} subclassObj
 * @param {import('../schema/character').Character} character
 * @returns {import('./choices').Choice[]}
 */
export function subclassConditionalChoices(db, cls, subclassObj, character) {
  const groups = subclassGrantGroups(cls?.classId, subclassObj, cls?.level ?? 0);
  if (!groups.length) return [];
  const out = [];
  const feature = (g) => ({ name: g.feature, level: g.level, subclass: subclassObj.shortName });

  for (const g of groups) {
    if (g.conditionalArtisanTool) {
      const owned = baselineTools(character, db);
      const dupes = (g.tools ?? []).filter((t) => owned.has(t.toLowerCase())).length;
      if (dupes > 0) {
        out.push({
          id: `sub:cond-tool@${g.level}`,
          kind: 'tool',
          count: dupes,
          level: g.level,
          label: `${g.feature} - Replacement Artisan's Tools`,
          feature: feature(g),
          pool: { type: 'any', of: 'tool', category: 'AT' },
        });
      }
    }
    if (g.conditionalSaveAlt && (g.saves ?? []).some((s) => baselineSaves(character, db).has(s))) {
      const from = g.conditionalSaveAlt.length
        ? g.conditionalSaveAlt
        : ALL_ABILITIES.filter((a) => !baselineSaves(character, db).has(a) && !(g.saves ?? []).includes(a));
      out.push({
        id: `sub:cond-save@${g.level}`,
        kind: 'save',
        count: 1,
        level: g.level,
        label: `${g.feature} - Saving Throw Proficiency`,
        feature: feature(g),
        pool: { type: 'list', options: from.map((a) => ({ value: a, label: ABILITY_LABEL[a] ?? a })) },
      });
    }
    if (g.conditionalSkillAlt && (g.skills ?? []).some((s) => baselineSkills(character, db).has(s))) {
      out.push({
        id: `sub:cond-skill@${g.level}`,
        kind: 'skill',
        count: 1,
        level: g.level,
        label: `${g.feature} - Skill Proficiency`,
        feature: feature(g),
        from: g.conditionalSkillAlt,
        pool: { type: 'any', of: 'skill' },
      });
    }
  }
  return out;
}
