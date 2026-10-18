// =============================================================================
// optionalfeature: a entity de optional feature, por featureType
// =============================================================================
// O QUE FAZ
//   Invocations, metamagic, maneuvers, infusions, fighting styles de subclasse,
//   arcane shots, runes, disciplines e pact boons vivem TODOS em
//   optionalfeatures.json, distinguidos por `featureType` (EI, MM, MV:B, AI...).
//   Uma entity por conjunto de tipos, com os pré-requisitos coloridos pelo status
//   quando recebe o `ctx`.
//
// FUNÇÕES
//   inTypes(feat, types): o tipo casa?
//   makeOptionalFeatureEntity(featureTypes, title, ctx): a fábrica (sem
//     pré-requisito conta como atendido).
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';
import { evalPrereq } from '../../engine/prereq';

const EMPTY_CTX = { scores: {}, level: 0, raceId: null, classLevels: {}, grantedFeatures: [] };

function inTypes(feat, types) {
  return (feat.featureType ?? []).some((t) => types.includes(t));
}

/**
 * A entity de optional feature para um conjunto de featureTypes.
 * @param {string[]} featureTypes
 * @param {string} title
 * @param {object} [ctx]
 */
export function makeOptionalFeatureEntity(featureTypes, title = 'Option', ctx = null) {
  const prereqOf = (f) => evalPrereq(f, ctx ?? EMPTY_CTX);

  return {
    type: 'optionalfeature',
    title,

    list: (db) =>
      latestOnly(db?.optionalfeatures?.optionalfeature ?? []).filter((f) => inTypes(f, featureTypes)),

    idOf: (f) => `${f.name}|${f.source}`,

    precompute: (f) => {
      const pre = prereqOf(f);
      return {
        searchText: `${f.name} ${f.source}`.toLowerCase(),
        filterValues: {
          source: [f.source].filter(Boolean),
          prereq: [pre?.status ?? 'ok'],
        },
      };
    },

    filters: [
      { id: 'source', header: 'Source', derive: true },
      {
        id: 'prereq',
        header: 'Prerequisites',
        options: [
          { value: 'ok', label: 'Met' },
          { value: 'bad', label: 'Not Met' },
          { value: 'unknown', label: 'Unverifiable' },
        ],
      },
    ],

    meta: (f) => {
      const pre = prereqOf(f);
      if (!pre) return [];
      return pre.entries.map((e) => ({ label: 'Prerequisite', value: e.text, status: ctx ? e.status : undefined }));
    },

    card: (f) => {
      const pre = prereqOf(f);
      return {
        title: f.name,
        subtitle: f.source,
        prereqs: pre ? pre.entries.map((e) => ({ text: e.text, status: ctx ? e.status : 'unknown' })) : [],
      };
    },

    entries: (f) => f.entries ?? [],
  };
}
