// =============================================================================
// subclassGrants - proficiências FIXAS concedidas por features de subclasse
// =============================================================================
// (TC-0012, a classe adiada da DDL-0002 "FIXED subclass grants".) As features de
// subclasse concedem proficiências só em PROSA ("You gain proficiency with heavy
// armor…"), então mantemos um REGISTRO CURADO - levantado por varredura completa
// de todos os class-*.json (2026-07-16): toda feature de subclasse com "gain
// proficiency/training with/in" está aqui ou em SUBCLASS_FEATURE_GRANTS
// (classFeatureChoices.js - o lado das ESCOLHAS).
//
// Cada grupo: { level, source?, feature, ...grants }. `source` distingue versões
// da mesma subclasse com grants diferentes (Alchemist EFA × TCE); ausente, vale
// para qualquer fonte. Campos de grant:
//   armor/weapons/tools/languages  - rótulos (como autoProficiencies)
//   skills/expertiseSkills/saves   - códigos (skill codes / abreviações de
//                                    atributo); expertiseSkills marca nível 2
// Campos CONDICIONAIS ("if you already have…") viram ESCOLHAS geradas ao vivo
// por subclassConditionalChoices (precisa do personagem):
//   conditionalArtisanTool: true   - 1 ferramenta de artesão por tool do grant
//                                    que o personagem JÁ tinha de outra fonte
//   conditionalSaveAlt: [codes]    - se o save do grant já é proficiente,
//                                    escolhe outro desta lista ([] = qualquer
//                                    save ainda não proficiente)
//   conditionalSkillAlt: [codes]   - idem para uma perícia do grant
//
// Proficiência de ARMA INDIVIDUAL à escolha virou o kind 'weaponProf'
// (2026-07-17): o único caso alcançável é o Kensei (ver o registro em
// classFeatureChoices) - Bladesinging TCE é reprint-oculto e o herdeiro FRHoF
// concede o grant FIXO daqui. Grants dentro de OPÇÕES de featureoption não têm
// NENHUMA instância alcançável (só o Totem Warrior PHB/SCAG "Tiger" L6, e o
// Totem Warrior é reprint-oculto pelo Wild Heart XPHB) - se um dia houver um
// toggle de conteúdo legacy, isso exigiria sub-escolhas em featureoptions.
// Classes sidekick e UA (Mystic) não são curadas.
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

/** @type {Record<string, object[]>}  chave: `${classId}|${shortName minúsculo}` */
export const SUBCLASS_GRANTS = {
  'artificer|alchemist': [
    { level: 3, source: 'EFA', feature: 'Tools of the Trade', tools: ["Alchemist's Supplies", 'Herbalism Kit'], conditionalArtisanTool: true },
    { level: 3, source: 'TCE', feature: 'Tool Proficiency', tools: ["Alchemist's Supplies"], conditionalArtisanTool: true },
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
  'bard|valor': [
    { level: 3, feature: 'Bonus Proficiencies', armor: [MEDIUM, SHIELDS], weapons: [MARTIAL] }, // PHB e XPHB (Martial Training) coincidem
  ],
  'bard|swords': [{ level: 3, feature: 'Bonus Proficiencies', armor: [MEDIUM], weapons: ['Scimitar'] }],
  'bard|spirits': [{ level: 3, feature: 'Channeler', tools: ['Playing Cards'] }],
  'cleric|life': [{ level: 1, source: 'PHB', feature: 'Bonus Proficiency', armor: [HEAVY] }],
  'cleric|nature': [{ level: 1, source: 'PHB', feature: 'Bonus Proficiency', armor: [HEAVY] }],
  'cleric|tempest': [{ level: 1, source: 'PHB', feature: 'Bonus Proficiencies', armor: [HEAVY], weapons: [MARTIAL] }],
  'cleric|war': [{ level: 1, source: 'PHB', feature: 'Bonus Proficiencies', armor: [HEAVY], weapons: [MARTIAL] }],
  'cleric|solidarity (psa)': [{ level: 1, feature: 'Bonus Proficiency', armor: [HEAVY] }],
  'cleric|strength (psa)': [{ level: 1, feature: 'Bonus Proficiency', armor: [HEAVY] }],
  'cleric|zeal (psa)': [{ level: 1, feature: 'Bonus Proficiencies', armor: [HEAVY], weapons: [MARTIAL] }],
  'cleric|arcana': [{ level: 1, feature: 'Arcane Initiate', skills: ['arc'] }],
  'cleric|order': [{ level: 1, feature: 'Bonus Proficiencies', armor: [HEAVY] }],
  'cleric|twilight': [{ level: 1, feature: 'Bonus Proficiencies', armor: [HEAVY], weapons: [MARTIAL] }],
  'cleric|forge': [{ level: 1, feature: 'Bonus Proficiency', armor: [HEAVY], tools: ["Smith's Tools"] }],
  'cleric|knowledge': [
    { level: 6, source: 'FRHoF', feature: 'Unfettered Mind', saves: ['int'], conditionalSaveAlt: [] },
  ],
  'druid|shepherd': [
    // "You learn to speak, read, and write Sylvan" (Speech of the Woods, XGE).
    // Nível 2 na subclasse original; no chassi XPHB a subclasse só entra no 3,
    // então o gate `level <= cls.level` nunca dispara cedo demais.
    { level: 2, feature: 'Speech of the Woods', languages: ['Sylvan'] },
  ],
  'fighter|purple dragon knight (banneret)': [
    { level: 7, feature: 'Royal Envoy', skills: ['per'], expertiseSkills: ['per'], conditionalSkillAlt: ['ani', 'ins', 'itm', 'prf'] },
  ],
  'fighter|rune knight': [{ level: 3, feature: 'Bonus Proficiencies', tools: ["Smith's Tools"], languages: ['Giant'] }],
  'monk|mercy': [{ level: 3, feature: 'Implements of Mercy', skills: ['ins', 'med'], tools: ['Herbalism Kit'] }],
  'monk|drunken master': [{ level: 3, feature: 'Bonus Proficiencies', skills: ['prf'], tools: ["Brewer's Supplies"] }],
  'ranger|gloom stalker': [
    { level: 7, feature: 'Iron Mind', saves: ['wis'], conditionalSaveAlt: ['int', 'cha'] }, // XGE e XPHB coincidem
  ],
  'fighter|samurai': [
    { level: 7, feature: 'Elegant Courtier', saves: ['wis'], conditionalSaveAlt: ['int', 'cha'] },
  ],
  'rogue|assassin': [
    { level: 3, source: 'PHB', feature: 'Bonus Proficiencies', tools: ['Disguise Kit', "Poisoner's Kit"] },
    { level: 3, source: 'XPHB', feature: "Assassin's Tools", tools: ['Disguise Kit', "Poisoner's Kit"] },
  ],
  'rogue|mastermind': [{ level: 3, feature: 'Master of Intrigue', tools: ['Disguise Kit', 'Forgery Kit'] }],
  'rogue|scout': [{ level: 3, feature: 'Survivalist', skills: ['nat', 'sur'], expertiseSkills: ['nat', 'sur'] }],
  // Wind Speaker é PROSA ("You can speak, read, and write Primordial") - o grant
  // não está em nenhum campo estruturado (TC-0039, mesma família do Sylvan do
  // Shepherd). Nível 3: no chassi 2024 a umbrella "Storm Sorcery" é reapontada
  // para o nível 3, e a subclasse não é escolhível antes disso.
  'sorcerer|storm': [{ level: 3, feature: 'Wind Speaker', languages: ['Primordial'] }],
  'warlock|hexblade': [{ level: 1, feature: 'Hex Warrior', armor: [MEDIUM, SHIELDS], weapons: [MARTIAL] }],
  'wizard|bladesinging': [
    { level: 2, feature: 'Training in War and Song', armor: [LIGHT], skills: ['prf'] },
  ],
  'wizard|bladesinger': [
    { level: 3, feature: 'Training in War and Song', weapons: ['Melee Martial Weapons (lacking Two-Handed or Heavy)'] },
  ],
};

/** Grupos do registro que se aplicam a uma subclasse resolvida até `level`. */
export function subclassGrantGroups(classId, subclassObj, level) {
  if (!classId || !subclassObj) return [];
  const key = `${classId.toLowerCase()}|${(subclassObj.shortName ?? '').toLowerCase()}`;
  return (SUBCLASS_GRANTS[key] ?? []).filter(
    (g) => (g.level ?? 1) <= level && (!g.source || g.source === subclassObj.source),
  );
}

/**
 * Proficiências fixas concedidas pelas SUBCLASSES do personagem (TC-0012).
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {{armor:string[], weapons:string[], grantedSkills:string[],
 *            expertiseSkills:string[], grantedTools:string[],
 *            languages:string[], saves:string[]}}
 */
export function deriveSubclassGrants(character, db) {
  const out = { armor: [], weapons: [], grantedSkills: [], expertiseSkills: [], grantedTools: [], languages: [], saves: [] };
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
    }
  }
  return out;
}

const ABILITY_LABEL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const ALL_ABILITIES = Object.keys(ABILITY_LABEL);

/** Ferramentas que o personagem tem SEM contar grants de subclasse - a base do
 * "if you already have this proficiency". Escolhas + fixas de classe/espécie +
 * efeitos de features/talentos. */
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

/** Perícias proficientes SEM contar grants de subclasse (escolhas + espécie fixa). */
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

/** Saves proficientes SEM contar grants fixos de subclasse: os da classe
 * ORIGINAL (regra de multiclasse) + os picks de save já feitos (escolhas
 * condicionais de outra subclasse, em multiclasse). */
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
 * Escolhas CONDICIONAIS dos grants de subclasse ("if you already have…"):
 * geradas ao vivo contra o personagem (a condição olha o que ele tem de OUTRAS
 * fontes). Ids `sub:cond-*@<nível>` → podados com a subclasse/nível e levados
 * na flag residual do item de classe no export (DDL-0028).
 * @param {object} db
 * @param {object} cls        entrada de classe
 * @param {object} subclassObj  objeto de subclasse resolvido
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
        pool: { type: 'any', of: 'skill' }, // finalizado pelo resolvePool (lista rotulada)
      });
    }
  }
  return out;
}
