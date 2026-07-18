// =============================================================================
// Entity config: Optional Feature (fábrica por featureType)
// =============================================================================
// O 5etools guarda invocations, metamagic, maneuvers, infusions, fighting
// styles de subclasse, arcane shots, runes, elemental disciplines e pact boons
// TODOS em optionalfeatures.json, distinguidos por `featureType` (EI, MM, MV:B,
// AI, FS:F/R/P/B, AS, RN, ED, PB…). Uma entity por conjunto de featureTypes
// alimenta o SelectorPanel - reusa o mesmo padrão de raça/talento.
//
// Pré-requisitos (nível, outra optional feature, pact…) são coloridos pelo
// status contra o personagem quando a entity recebe `ctx` (prereqContext).
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';
import { evalPrereq } from '../../engine/prereq';

const EMPTY_CTX = { scores: {}, level: 0, raceId: null, classLevels: {}, grantedFeatures: [] };

function inTypes(feat, types) {
  return (feat.featureType ?? []).some((t) => types.includes(t));
}

/**
 * @param {string[]} featureTypes  ex: ['EI'] (invocations), ['MM'] (metamagic)
 * @param {string} title           título do painel (ex: 'Eldritch Invocation')
 * @param {object} [ctx]           prereqContext(character) - colore pré-requisitos
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
          prereq: [pre?.status ?? 'ok'], // sem pré-requisito conta como atendido
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
