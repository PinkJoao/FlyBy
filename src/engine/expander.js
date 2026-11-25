// =============================================================================
// expander: as decisões do personagem como uma lista de grants
// =============================================================================
// O QUE FAZ
//   Traduz o que o personagem escolheu numa lista plana de "grants" (coisas
//   concedidas): features de classe e de subclasse por nível, traços da espécie e
//   talentos (o de origem mais os de nível de classe).
//
// FUNÇÕES
//   expandClassFeatures(character, classDataById): features de classe por nível.
//   expandSubclassFeatures(character, subclassDataById): as de subclasse.
//   expandSpeciesTraits(character, speciesData): os traços nomeados.
//   expandFeats(character): os talentos, a partir das decisões.
//   expand(character, data): o ponto de entrada.
// -----------------------------------------------------------------------------

import { featuresUpToLevel } from './classData';
import { subclassFeaturesUpToLevel } from './subclassData';
import { parseSpecies } from './speciesData';

/**
 * @typedef {Object} Grant
 * @property {'class-feature'|'subclass-feature'|'species-trait'|'feat'} kind
 * @property {string} name
 * @property {string} [source]
 * @property {number} [level]
 * @property {string} [classUid]
 * @property {boolean} [gainsSubclass]
 * @property {string} [subtype]
 */

/**
 * @typedef {Object} ExpandData
 * @property {Record<string, object>} [classDataById]
 * @property {Record<string, object>} [subclassDataById]
 * @property {object} [speciesData]
 */

/** Features de classe, por nível, de todas as classes. */
export function expandClassFeatures(character, classDataById = {}) {
  /** @type {Grant[]} */
  const grants = [];
  for (const cls of character.classes ?? []) {
    const classObj = classDataById[cls.classId];
    if (!classObj) continue;
    for (const f of featuresUpToLevel(classObj, cls.level)) {
      grants.push({
        kind: 'class-feature',
        name: f.name,
        source: f.source,
        level: f.level,
        classUid: cls.uid,
        gainsSubclass: f.gainsSubclass,
      });
    }
  }
  return grants;
}

/** Features de subclasse das classes que têm subclasse. */
export function expandSubclassFeatures(character, subclassDataById = {}) {
  /** @type {Grant[]} */
  const grants = [];
  for (const cls of character.classes ?? []) {
    if (!cls.subclassId) continue;
    const subObj = subclassDataById[cls.subclassId];
    if (!subObj) continue;
    for (const f of subclassFeaturesUpToLevel(subObj, cls.level)) {
      grants.push({
        kind: 'subclass-feature',
        name: f.name,
        source: f.subclassSource,
        level: f.level,
        classUid: cls.uid,
      });
    }
  }
  return grants;
}

/** Os traços nomeados da espécie. */
export function expandSpeciesTraits(character, speciesData) {
  if (!character.species || !speciesData) return [];
  const parsed = parseSpecies(speciesData);
  if (!parsed) return [];
  return parsed.traits.map((t) => ({
    kind: 'species-trait',
    name: t.name,
    source: parsed.source,
    level: 1,
  }));
}

/** O talento de origem e os escolhidos em níveis de classe. */
export function expandFeats(character) {
  /** @type {Grant[]} */
  const grants = [];

  const pushFeat = (feat, level) => {
    if (!feat) return;
    grants.push({
      kind: 'feat',
      name: feat.id,
      source: feat.source,
      subtype: feat.subtype,
      level,
    });
  };

  pushFeat(character.origin?.originFeat, 1);

  for (const cls of character.classes ?? []) {
    for (const [lvl, choices] of Object.entries(cls.choices ?? {})) {
      for (const choice of choices) {
        if (choice.type === 'feat') pushFeat(choice.feat, Number(lvl));
        else if (choice.type === 'fighting-style') {
          grants.push({
            kind: 'feat',
            name: choice.featId,
            source: choice.source,
            subtype: 'fightingStyle',
            level: Number(lvl),
          });
        }
      }
    }
  }

  return grants;
}

/**
 * Ponto de entrada do expander.
 * @param {import('../schema/character').Character} character
 * @param {ExpandData} [data]
 * @returns {Grant[]}
 */
export function expand(character, data = {}) {
  return [
    ...expandSpeciesTraits(character, data.speciesData),
    ...expandClassFeatures(character, data.classDataById),
    ...expandSubclassFeatures(character, data.subclassDataById),
    ...expandFeats(character),
  ];
}
