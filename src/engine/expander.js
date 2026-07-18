// =============================================================================
// Expander - DECISÕES → lista de Grants
// =============================================================================
// O coração do projeto: traduz o que o personagem escolheu numa lista plana de
// "grants" (coisas concedidas), que o export (Fase 6) hidrata em documentos
// Foundry. Compõe várias fontes: classe, subclasse, espécie, origem e talentos.
// Magias entram num passo futuro.
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
 * @property {string} [subtype]   p/ feats: origin|general|fightingStyle|...
 */

/**
 * @typedef {Object} ExpandData
 * @property {Record<string, object>} [classDataById]     classId → classe 5etools
 * @property {Record<string, object>} [subclassDataById]  subclassId → subclasse 5etools
 * @property {object} [speciesData]                       objeto de espécie 5etools
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

/** Features de subclasse, por nível, das classes que têm subclasse escolhida. */
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

/** Traços nomeados da espécie. */
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

/** Talentos: o de origem + os escolhidos em níveis de classe. Vem das decisões. */
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
