// =============================================================================
// classFeatureGrants: o que uma feature de CLASSE concede só em prosa
// =============================================================================
// O QUE FAZ
//   Irmão do subclassGrants (TC-0059, TC-0075, TC-0077; DDL-0073): grants que o
//   5etools não expressa em campo nenhum. O registro saiu de uma varredura
//   EXAUSTIVA (2026-07-26) de dois lados que se confirmam: o SRD do dnd5e (todo
//   Trait e ASI de classe fora dos iniciais) e o dado do 5etools (feature cujo
//   texto casa "{@language}", "proficien* in ... saving throw" ou "score(s)
//   increase by N"). Os dois convergem para os MESMOS quatro casos de classe:
//   Druidic, Thieves' Cant (mais um idioma à escolha), Slippery Mind e Disciplined
//   Survivor (saves), e os capstones Body and Mind e Primal Champion (+4, máx. 25).
//
//   Cada grupo: { level, feature, languages, languageChoices, saves, allSaves,
//   abilityBoosts: [{ ability, amount, max }] }.
//
// FUNÇÕES
//   classGrantGroups(classId, level): os grupos já alcançados.
//   deriveClassFeatureGrants(character): { languages, saves, abilityBoosts }.
//   classGrantChoices(classId, level): as escolhas de idioma que uma feature abre.
//   buildClassGrantAdvancements(classEntry, db): os advancements do item de classe.
//
// DECISÕES E ARMADILHAS
//   - Para acrescentar uma entrada, varra o dataset pelos dois lados em vez de
//     cadastrar o caso isolado; foi assim que os quatro saíram de uma vez.
//   - Deft Explorer já está no NAMED_FEATURE_GRANTS, Iron Mind e Unfettered Mind no
//     SUBCLASS_GRANTS. Sidekicks e UA ficam fora.
//   - A escolha de idioma usa o formato das outras escolhas de classe; o pick viaja
//     na flag residual do item de classe (DDL-0028).
//   - Lado Foundry: um Trait no nível da feature para os saves (o premade do Ladino
//     tem um Trait@15) e um ASI de valores FIXOS para o capstone. O ASI só recebe
//     `value` quando o nível foi alcançado (os scores exportados já o incluem); num
//     nível futuro fica pendente. A escada traz TODOS os grupos, como no SRD.
// -----------------------------------------------------------------------------

import { resolveClassObj } from './resolve';

/** @type {Record<string, object[]>} */
export const CLASS_FEATURE_GRANTS = {
  druid: [
    { level: 1, feature: 'Druidic', languages: ['Druidic'] },
  ],
  rogue: [
    { level: 1, feature: "Thieves' Cant", languages: ["Thieves' Cant"], languageChoices: 1 },
    { level: 15, feature: 'Slippery Mind', saves: ['wis', 'cha'] },
  ],
  monk: [
    { level: 14, feature: 'Disciplined Survivor', allSaves: true },
    {
      level: 20,
      feature: 'Body and Mind',
      abilityBoosts: [
        { ability: 'dex', amount: 4, max: 25 },
        { ability: 'wis', amount: 4, max: 25 },
      ],
    },
  ],
  barbarian: [
    {
      level: 20,
      feature: 'Primal Champion',
      abilityBoosts: [
        { ability: 'str', amount: 4, max: 25 },
        { ability: 'con', amount: 4, max: 25 },
      ],
    },
  ],
};

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Os grupos de grant já alcançados por uma classe. */
export function classGrantGroups(classId, level) {
  return (CLASS_FEATURE_GRANTS[String(classId ?? '').toLowerCase()] ?? []).filter(
    (g) => (g.level ?? 1) <= (level ?? 0),
  );
}

/**
 * O que as features de classe do personagem concedem em prosa.
 * @param {import('../schema/character').Character} character
 * @returns {{languages: string[], saves: string[], abilityBoosts: object[]}}
 */
export function deriveClassFeatureGrants(character) {
  const out = { languages: [], saves: [], abilityBoosts: [] };
  for (const cls of character?.classes ?? []) {
    for (const g of classGrantGroups(cls.classId, cls.level)) {
      out.languages.push(...(g.languages ?? []));
      out.saves.push(...(g.allSaves ? ABILITIES : (g.saves ?? [])));
      out.abilityBoosts.push(...(g.abilityBoosts ?? []));
    }
  }
  return out;
}

/**
 * As escolhas de idioma que uma feature de classe abre.
 * @param {string} classId
 * @param {number} level
 * @returns {import('./choices').Choice[]}
 */
export function classGrantChoices(classId, level) {
  const out = [];
  for (const g of classGrantGroups(classId, level)) {
    if (!g.languageChoices) continue;
    out.push({
      id: `classgrant-lang@${g.level}`,
      kind: 'language',
      count: g.languageChoices,
      level: g.level,
      label: 'Language',
      feature: { name: g.feature, level: g.level },
      pool: { type: 'any', of: 'language' },
    });
  }
  return out;
}

/**
 * Os advancements (Trait e ASI fixo) destes grants no item de classe.
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} db
 * @returns {object[]}
 */
export function buildClassGrantAdvancements(classEntry, db) {
  const classId = classEntry?.classId;
  if (!classId) return [];
  const classObj = resolveClassObj(db, classId, classEntry.source);
  if (!classObj) return [];
  const out = [];
  for (const g of CLASS_FEATURE_GRANTS[String(classId).toLowerCase()] ?? []) {
    const saves = g.allSaves ? ABILITIES : (g.saves ?? []);
    if (saves.length) {
      const grants = saves.map((s) => `saves:${s}`);
      out.push({
        type: 'Trait',
        level: g.level,
        title: g.feature,
        configuration: { mode: 'default', allowReplacements: false, grants, choices: [] },
        value: { chosen: [...grants] },
      });
    }
    if (g.abilityBoosts?.length) {
      const fixed = Object.fromEntries(ABILITIES.map((a) => [a, 0]));
      for (const b of g.abilityBoosts) fixed[b.ability] = (fixed[b.ability] ?? 0) + b.amount;
      const reached = (classEntry.level ?? 0) >= g.level;
      out.push({
        type: 'AbilityScoreImprovement',
        level: g.level,
        title: g.feature,
        configuration: {
          points: 0,
          fixed,
          cap: null,
          locked: [...ABILITIES],
          recommendation: null,
          max: Math.max(...g.abilityBoosts.map((b) => b.max ?? 20)),
        },
        value: reached ? { type: 'asi', assignments: {} } : {},
      });
    }
  }
  return out;
}
