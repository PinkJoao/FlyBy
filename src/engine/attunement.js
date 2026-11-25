// =============================================================================
// attunement: o limite e os pré-requisitos de atunement (Fase B1)
// =============================================================================
// O QUE FAZ
//   No máximo 3 itens atunados por vez, ou o que uma feature do personagem diz ("you
//   can attune to up to four magic items at once": Use Magic Device do Thief, Magic Item
//   Adept, Savant ou Advanced Artifice e Master do Artificer).
//
// FUNÇÕES
//   unmetAttunement(attunedCount, raw, max): o motivo pelo qual atunar violaria o
//     limite ou o pré-requisito, ou null.
//   attunementMaxFor(db, classes): o limite, pela prosa das features de classe e de
//     subclasse que o personagem já alcançou.
//
// DECISÕES E ARMADILHAS
//   - O limite vem da PROSA (DDL-0217): a frase "attune to up to <número>" nas features
//     alcançadas, a maior vale. Medido no espelho: 7 features (o Thief 13 e o Artificer
//     10, 14 e 18, nas versões TCE e EFA), nenhuma em talento.
//   - Avisa, não bloqueia: o chamador pergunta "atunar mesmo assim?" pelo confirm
//     in-app, no mesmo padrão de unmetMulticlassReqs e prereqStatus.
// -----------------------------------------------------------------------------

import { attunementInfo } from './items';

export const ATTUNEMENT_MAX = 3;

const WORDS = { four: 4, five: 5, six: 6, seven: 7, eight: 8 };
const RAISE = /attune to up to (\w+)/i;

/**
 * O limite de atunement do personagem, pela prosa das features alcançadas.
 * @param {object} db
 * @param {{ classId: string, className: string, classSource: string, level: number, subclassShortName?: string, subclassSource?: string }[]} classes
 */
export function attunementMaxFor(db, classes = []) {
  let max = ATTUNEMENT_MAX;
  const read = (f) => {
    const m = JSON.stringify(f.entries ?? []).match(RAISE);
    const n = m ? WORDS[m[1].toLowerCase()] ?? Number(m[1]) : 0;
    if (n > max) max = n;
  };
  for (const c of classes) {
    const pool = db?.[`class-${c.classId}`] ?? {};
    for (const f of pool.classFeature ?? []) {
      if (f.className === c.className && f.classSource === c.classSource && f.level <= c.level && !f.isClassFeatureVariant) read(f);
    }
    if (!c.subclassShortName) continue;
    for (const f of pool.subclassFeature ?? []) {
      if (f.className === c.className && f.subclassShortName === c.subclassShortName && f.subclassSource === c.subclassSource && f.level <= c.level) read(f);
    }
  }
  return max;
}

/**
 * Por que atunar este item violaria o limite ou o pré-requisito, ou null.
 * @param {number} attunedCount
 * @param {object|null} raw
 * @param {number} [max]
 * @returns {string|null}
 */
export function unmetAttunement(attunedCount, raw, max = ATTUNEMENT_MAX) {
  const info = attunementInfo(raw);
  if (!info.required) return null;
  if (attunedCount >= max) {
    return `Already attuned to ${max} items (the maximum)`;
  }
  if (info.prereqText) {
    return `Requires attunement ${info.prereqText} - can't be checked automatically`;
  }
  return null;
}
