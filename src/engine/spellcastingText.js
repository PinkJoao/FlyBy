// =============================================================================
// spellcastingText - extrai os blocos de PROSA da feature de conjuração
// =============================================================================
// PURO: sem rede/DOM. A tela de magias do wizard (Fase D) explica cantrips,
// slots e preparação com o TEXTO AUTORITATIVO da própria classe - em vez de copy
// genérica. Cada classe descreve isso em sub-blocos nomeados dentro da feature
// `Spellcasting` (ou `Pact Magic`, do Warlock):
//   Cantrips · Spell Slots · Prepared Spells of Level 1+ ·
//   Changing Your Prepared Spells · Spellcasting Ability · Spellcasting Focus
// (Ranger/Paladin NÃO têm o bloco "Cantrips" - a tela de cantrips some para eles.)
//
// Assim a explicação de "quando/como recuperar slots" (Warlock difere sozinho:
// Short OR Long Rest) e "quando/como preparar" sai direto do dado, sem hard-code.
// -----------------------------------------------------------------------------

import { classFeatureLevels } from './classProgression';

const SPELLCASTING_NAMES = new Set(['spellcasting', 'pact magic']);

/**
 * A feature de conjuração da classe (ou da subclasse, p/ Eldritch Knight /
 * Arcane Trickster). Retorna o objeto de feature resolvido ({name, entries, …})
 * ou null se a classe não conjura.
 * @param {object} db
 * @param {string} classId
 * @param {object} classObj    objeto de classe (5etools)
 * @param {object|null} subObj objeto de subclasse escolhida (ou null)
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
 * Sub-blocos NOMEADOS de um array de `entries` cujo nome contém alguma das
 * palavras-chave (case-insensitive). Não desce dentro de um bloco já casado
 * (evita duplicar). Preserva a ordem do documento.
 * @param {Array} entries
 * @param {string[]} keywords  ex: ['spell slot', 'prepared spells']
 * @returns {Array}  os nós `{type:'entries', name, entries}` casados
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
      return; // não recursa no bloco casado
    }
    if (e.entries) walk(e.entries);
  };
  walk(entries);
  return out;
}

/** Bloco(s) "Cantrips" da feature (vazio p/ Ranger/Paladin). */
export function cantripEntries(feature) {
  return feature ? namedSubEntries(feature.entries, ['cantrip']) : [];
}

/** Blocos que explicam SLOTS + PREPARAÇÃO (recuperação, preparar, trocar). O
 * keyword 'prepared spells' casa tanto "Prepared Spells of Level 1+" quanto
 * "Changing Your Prepared Spells". */
export function spellSlotEntries(feature) {
  return feature ? namedSubEntries(feature.entries, ['spell slot', 'prepared spells']) : [];
}
