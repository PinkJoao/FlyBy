// =============================================================================
// classFeatureGrants - o que uma feature de CLASSE concede só em PROSA
// =============================================================================
// (TC-0059 / TC-0075 / TC-0077.) Irmão do `subclassGrants.js`: ali as features de
// SUBCLASSE, aqui as de CLASSE. São grants que o 5etools não expressa em campo
// estruturado nenhum - estão no texto da feature -, então precisam de um registro
// CURADO. A lista abaixo é o resultado de uma varredura EXAUSTIVA (2026-07-26),
// feita de dois lados que se confirmam:
//   · o SRD do dnd5e (`packs/_source/classes24`): todo advancement `Trait`/
//     `AbilityScoreImprovement` de classe fora dos iniciais e dos ASIs padrão;
//   · o dado do 5etools: toda feature de classe/subclasse de fonte ATUAL cujo
//     texto casa "{@language …}", "proficien* in … saving throw" ou
//     "score(s) increase by N".
// Os dois convergem para os MESMOS quatro casos de CLASSE (mais Deft Explorer, já
// coberto pelo NAMED_FEATURE_GRANTS, e Iron Mind/Unfettered Mind, já em
// SUBCLASS_GRANTS). Sidekicks e UA (Mystic) ficam fora, como sempre (CLAUDE.md §4).
//
// Cada grupo: `{ level, feature, ...grants }`, e os campos são:
//   languages        - rótulos concedidos de graça (como autoProficiencies)
//   languageChoices  - quantos idiomas o jogador ESCOLHE (vira uma Choice de
//                      kind 'language' no bag da classe: `classgrant-lang@<nível>`)
//   saves            - abreviações; `allSaves: true` concede TODAS as seis
//   abilityBoosts    - [{ability, amount, max }] dos capstones (max 25, RAW)
//
// REGRA para acrescentar uma entrada: varra o dataset (os dois lados acima) em vez
// de cadastrar o caso isolado que apareceu - foi assim que estes quatro saíram de
// uma vez, e é o que evita um registro cheio de furos.
// -----------------------------------------------------------------------------

import { resolveClassObj } from './resolve';

/** @type {Record<string, object[]>}  chave: classId minúsculo */
export const CLASS_FEATURE_GRANTS = {
  druid: [
    // "You know Druidic, the secret language of Druids."
    { level: 1, feature: 'Druidic', languages: ['Druidic'] },
  ],
  rogue: [
    // "You know Thieves' Cant and one other language of your choice."
    { level: 1, feature: "Thieves' Cant", languages: ["Thieves' Cant"], languageChoices: 1 },
    // Slippery Mind: "you gain proficiency in Wisdom and Charisma saving throws."
    { level: 15, feature: 'Slippery Mind', saves: ['wis', 'cha'] },
    // Primal Champion / Body and Mind estão nas classes abaixo.
  ],
  monk: [
    // "Your physical and mental discipline grant you proficiency in all saving throws."
    { level: 14, feature: 'Disciplined Survivor', allSaves: true },
    // "Your Dexterity and Wisdom scores increase by 4, to a maximum of 25."
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
    // "Your Strength and Constitution scores increase by 4, to a maximum of 25."
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

/** Grupos de grant já ALCANÇADOS por uma entrada de classe. */
export function classGrantGroups(classId, level) {
  return (CLASS_FEATURE_GRANTS[String(classId ?? '').toLowerCase()] ?? []).filter(
    (g) => (g.level ?? 1) <= (level ?? 0),
  );
}

/**
 * O que as features de CLASSE do personagem concedem em prosa.
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
 * As escolhas de IDIOMA que uma feature de classe abre (hoje só o "one other
 * language of your choice" do Thieves' Cant). Descritor no mesmo formato das
 * outras escolhas de classe, então ChoiceList/completude/autoBuild/export o
 * tratam sem fiação nova; o pick viaja na flag residual do item de classe
 * (DDL-0028), como as demais escolhas sem casa nativa.
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
 * Advancements do item de classe para estes grants (lado Foundry): um `Trait` no
 * nível da feature para as salvaguardas (é a forma do SRD - o premade do Ladino
 * tem um Trait@15 com `saves:wis`/`saves:cha`) e um `AbilityScoreImprovement` com
 * valores FIXOS para o capstone. O ASI só recebe `value` quando o nível já foi
 * alcançado: aí ele está APLICADO (os scores exportados já incluem o aumento) e o
 * Foundry não o aplica de novo; num nível futuro fica pendente, como deve.
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} db
 * @returns {object[]} entradas de advancement (sem `_id`)
 */
export function buildClassGrantAdvancements(classEntry, db) {
  const classId = classEntry?.classId;
  if (!classId) return [];
  const classObj = resolveClassObj(db, classId, classEntry.source);
  if (!classObj) return [];
  const out = [];
  // TODOS os grupos (não só os alcançados): a escada do item de classe descreve a
  // classe inteira, como no SRD.
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
