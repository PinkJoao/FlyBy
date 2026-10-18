// =============================================================================
// spellcastingText: os blocos de prosa da feature de conjuração
// =============================================================================
// O QUE FAZ
//   A tela de magias do wizard explica cantrips, slots e preparação com o TEXTO da
//   própria classe, não com copy genérica. Cada classe descreve isso em sub-blocos
//   nomeados dentro de "Spellcasting" (ou "Pact Magic"): Cantrips, Spell Slots,
//   Prepared Spells of Level 1+, Changing Your Prepared Spells, Spellcasting
//   Ability, Spellcasting Focus. Assim "quando recuperar slots" (o Warlock difere:
//   descanso curto OU longo) sai do dado.
//
// FUNÇÕES
//   spellcastingFeature(db, classId, classObj, subObj): a feature resolvida, da
//     classe ou da subclasse (EK, AT), ou null.
//   namedSubEntries(entries, keywords): os sub-blocos cujo nome casa, sem descer
//     num bloco já casado.
//   cantripEntries(feature): o bloco Cantrips (vazio no Ranger e no Paladino).
//   spellSlotEntries(feature): slots e preparação ('prepared spells' casa os
//     dois blocos de preparar e trocar).
// -----------------------------------------------------------------------------

import { classFeatureLevels } from './classProgression';

const SPELLCASTING_NAMES = new Set(['spellcasting', 'pact magic']);

/**
 * A feature de conjuração da classe ou da subclasse, ou null.
 * @param {object} db
 * @param {string} classId
 * @param {object} classObj
 * @param {object|null} subObj
 * @returns {{name:string, entries:Array}|null}
 */
export function spellcastingFeature(db, classId, classObj, subObj = null) {
  if (!classObj) return null;
  for (const l of classFeatureLevels(db, classId, classObj, subObj)) {
    for (const f of l.features) {
      if (SPELLCASTING_NAMES.has(f.name.trim().toLowerCase())) return f;
    }
  }
  return null;
}

/**
 * Os sub-blocos nomeados que casam alguma palavra-chave.
 * @param {Array} entries
 * @param {string[]} keywords
 * @returns {Array}
 */
export function namedSubEntries(entries, keywords) {
  const kws = keywords.map((k) => k.toLowerCase());
  const out = [];
  const walk = (e) => {
    if (Array.isArray(e)) {
      e.forEach(walk);
      return;
    }
    if (!e || typeof e !== 'object') return;
    if (e.type === 'entries' && e.name && kws.some((k) => e.name.toLowerCase().includes(k))) {
      out.push(e);
      return;
    }
    if (e.entries) walk(e.entries);
  };
  walk(entries);
  return out;
}

/** O bloco "Cantrips" da feature. */
export function cantripEntries(feature) {
  return feature ? namedSubEntries(feature.entries, ['cantrip']) : [];
}

/** Os blocos de slots e de preparação. */
export function spellSlotEntries(feature) {
  return feature ? namedSubEntries(feature.entries, ['spell slot', 'prepared spells']) : [];
}
