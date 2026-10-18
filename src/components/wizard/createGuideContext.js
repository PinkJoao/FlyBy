// =============================================================================
// createGuideContext: as flags do guia de criação que precisam do db
// =============================================================================
// O QUE FAZ
//   O catálogo de passos (engine, puro) recebe estas flags prontas: se há escolhas
//   de feature no nível, e se proficiências, features, espécie, talento de origem
//   e kit estão TODOS escolhidos. Calculado onde há db (WizardPage e Builder).
//
// FUNÇÕES
//   featSubChoices(featData, level, bag): as sub-escolhas de um talento (a mesma
//     lista do ChoiceList, com o +1 livre dos legacy).
//   targetCount(ch, entry): quantos picks completam (no ASI, o da alternativa
//     escolhida; sem alternativa, nunca).
//   choiceComplete(ch, bag, db, level), choicesComplete(choices, bag, db, level):
//     a completude PROFUNDA de uma escolha e de uma lista.
//   speciesStepComplete(db, character), kitStepComplete(db, character),
//     originFeatStepComplete(db, character): os passos.
//   createGuideContext(db, character): as flags.
//
// DECISÕES E ARMADILHAS
//   - Regra com o usuário (2026-07-15, DDL-0018): na criação, TODO passo
//     não-biográfico é OBRIGATÓRIO, e a completude é PROFUNDA: um talento só
//     completa com o sub-bag dele (o Magic Initiate sem as magias, o ASI sem o
//     +2/+1). Só história, alinhamento e nome ficam opcionais. O fixup e o botão do
//     guia usam o MESMO choiceComplete (TC-0013).
//   - A espécie usa a MESMA lista da aba (speciesChoices), senão o guia exigiria o
//     que a tela esconde. Só as linhagens NATIVAS obrigam. Raça ou talento fora do
//     compêndio não tem o que preencher.
//   - O kit completa com os itens a escolher (o instrumento do Bardo, TC-0024).
// -----------------------------------------------------------------------------

import { parseChoices, LEGACY_ABILITY_CHOICE } from '../../engine/choices';
import { resolveFeat, resolveRaceObj, resolveClassObj } from '../../engine/resolve';
import { totalLevel } from '../../schema/character';
import { requiresLineage, speciesChoices } from '../../engine/speciesData';
import { parseStartingEquipment, kitChoosesComplete } from '../../engine/startingEquipment';
import { buildClassChoices, isProficiencyChoice, isFeatureChoice } from '../builder/classChoices';
import { ORIGIN_CHOICES } from '../builder/originChoices';
import { hasFreeLegacyBonus } from '../../selector/entities/feat';

/** As sub-escolhas de um talento. */
function featSubChoices(featData, level = Infinity, bag = null) {
  if (!featData) return [];
  return [...parseChoices(featData, { level, bag }), ...(hasFreeLegacyBonus(featData) ? [LEGACY_ABILITY_CHOICE] : [])];
}

/** Quantos picks completam uma escolha. */
function targetCount(ch, entry) {
  if (ch.pool?.type === 'ability') {
    const alts = ch.pool.alternatives ?? [];
    const alt = entry?.alt ?? (alts.length === 1 ? 0 : null);
    return alt == null ? Infinity : (alts[alt]?.count ?? 1);
  }
  return ch.count ?? 1;
}

/**
 * A escolha está preenchida, inclusive os sub-bags (completude profunda)?
 * @param {object} ch
 * @param {object} bag
 * @param {object} db
 * @param {number} [level]
 * @returns {boolean}
 */
export function choiceComplete(ch, bag, db, level = Infinity) {
  const entry = bag?.[ch.id];
  const picks = entry?.picks ?? [];
  if (picks.length < targetCount(ch, entry)) return false;
  if (ch.kind !== 'feat') return true;
  return picks.every((pick) => {
    const featData = resolveFeat(db, pick);
    if (!featData) return true;
    const sub = entry?.sub?.[pick] ?? {};
    return choicesComplete(featSubChoices(featData, level, sub), sub, db, level);
  });
}

/**
 * Todas as escolhas estão preenchidas?
 * @param {object[]} choices
 * @param {object} bag
 * @param {object} db
 * @param {number} [level]
 * @returns {boolean}
 */
export function choicesComplete(choices, bag, db, level = Infinity) {
  return (choices ?? []).every((ch) => choiceComplete(ch, bag, db, level));
}

/** A espécie está completa (linhagem e sub-escolhas)? */
export function speciesStepComplete(db, character) {
  const sp = character?.species;
  if (!sp?.id) return false;
  const baseRace = resolveRaceObj(db, sp.id, sp.source);
  if (!baseRace) return true;
  if (requiresLineage(db, baseRace) && !sp.lineage) return false;
  const raceObj = resolveRaceObj(db, sp.id, sp.source, sp.lineage);
  const level = totalLevel(character);
  const choices = speciesChoices({ db, baseRace, raceObj, lineage: sp.lineage, level, bag: sp.choices });
  return choicesComplete(choices, sp.choices, db, level);
}

/** O kit inicial está completo? */
export function kitStepComplete(db, character) {
  const kitKey = character?.meta?.startingKit;
  if (!kitKey) return false;
  const cls = character?.classes?.[0];
  const classObj = cls?.classId ? resolveClassObj(db, cls.classId, cls.source) : null;
  const option = classObj
    ? parseStartingEquipment(db, classObj).find((o) => o.key === kitKey)
    : null;
  return kitChoosesComplete(option, character?.meta?.startingKitPicks);
}

/** O talento de origem está completo? */
export function originFeatStepComplete(db, character) {
  const of = character?.origin?.originFeat;
  if (!of?.id) return false;
  const featData = resolveFeat(db, `${of.id}|${of.source}`);
  const level = totalLevel(character);
  return choicesComplete(featSubChoices(featData, level, of.choices ?? {}), of.choices ?? {}, db, level);
}

/**
 * As flags do guia de criação.
 * @param {object} db
 * @param {object} character
 * @returns {{
 *   hasFeatureChoices: boolean,
 *   proficienciesComplete: boolean,
 *   featuresComplete: boolean,
 *   speciesComplete: boolean,
 *   originFeatComplete: boolean,
 *   kitComplete: boolean,
 *   }}
 */
export function createGuideContext(db, character) {
  const cls = character?.classes?.[0];
  const level = totalLevel(character);
  const choices = cls?.classId ? buildClassChoices(db, cls, character) : [];
  const profChoices = choices.filter(isProficiencyChoice);
  const featChoices = choices.filter(isFeatureChoice);
  return {
    hasFeatureChoices: featChoices.length > 0,
    proficienciesComplete:
      choicesComplete(profChoices, cls?.choices, db, level) &&
      choicesComplete(ORIGIN_CHOICES, character?.origin?.choices, db, level),
    featuresComplete: choicesComplete(featChoices, cls?.choices, db, level),
    speciesComplete: speciesStepComplete(db, character),
    originFeatComplete: originFeatStepComplete(db, character),
    kitComplete: kitStepComplete(db, character),
  };
}
