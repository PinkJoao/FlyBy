// =============================================================================
// createGuideContext - flags do guia de criação que precisam do `db`
// =============================================================================
// O catálogo de passos (engine, puro) recebe estas flags prontas: se há escolhas
// de feature no nível, e se as proficiências / features / espécie / talento de
// origem já estão TODOS escolhidos (para marcar os passos como completos vs.
// pendentes). Calculado onde há `db` (WizardPage e Builder). Espelha o
// `levelUpContext` do level-up.
//
// Regra fixada com o usuário (2026-07-15, DDL-0018): no guia de criação TODO
// passo não-biográfico é OBRIGATÓRIO - a completude é PROFUNDA: cada escolha da
// espécie (tamanho, linhagem, perícia/idioma racial) e cada sub-escolha de um
// talento escolhido (ASI embutido, magias, proficiências) conta. Só as etapas
// biográficas (história, alinhamento, nome/retrato) permanecem opcionais.
// -----------------------------------------------------------------------------

import { parseChoices, LEGACY_ABILITY_CHOICE } from '../../engine/choices';
import { resolveFeat, resolveRaceObj, resolveClassObj } from '../../engine/resolve';
import { totalLevel } from '../../schema/character';
import { requiresLineage, speciesSizeChoice } from '../../engine/speciesData';
import { parseStartingEquipment, kitChoosesComplete } from '../../engine/startingEquipment';
import { buildClassChoices, isProficiencyChoice, isFeatureChoice } from '../builder/classChoices';
import { ORIGIN_CHOICES } from '../builder/originChoices';
import { hasFreeLegacyBonus } from '../../selector/entities/feat';

/** Sub-escolhas de um TALENTO - a MESMA lista que o ChoiceList renderiza
 *  (campos do feat + o +1 livre dos legacy sem campo ability). `level` e `bag`
 *  alimentam as escolhas de MAGIA do feat (gate por nível + grupo ativo do
 *  additionalSpells - TC-0011). */
function featSubChoices(featData, level = Infinity, bag = null) {
  if (!featData) return [];
  return [...parseChoices(featData, { level, bag }), ...(hasFreeLegacyBonus(featData) ? [LEGACY_ABILITY_CHOICE] : [])];
}

/** Quantos picks completam uma escolha. Pool 'ability' mira o count da
 *  ALTERNATIVA escolhida (feat ASI: +2 em um OU +1 em dois); sem modo escolhido
 *  não há alvo → nunca completa (Infinity). */
function targetCount(ch, entry) {
  if (ch.pool?.type === 'ability') {
    const alts = ch.pool.alternatives ?? [];
    const alt = entry?.alt ?? (alts.length === 1 ? 0 : null);
    return alt == null ? Infinity : (alts[alt]?.count ?? 1);
  }
  return ch.count ?? 1;
}

/**
 * UMA escolha está preenchida? PROFUNDO: um pick de talento só conta completo
 * quando as sub-escolhas DELE (sub-bag) também estão (ex: Magic Initiate sem as
 * magias escolhidas, ou o feat ASI sem o +2/+1, ainda pendem). É o critério
 * único de completude por escolha - o guia de criação e o fixup/✦ (TC-0013)
 * usam este mesmo check.
 * @param {object} ch   descritor `Choice`
 * @param {object} bag  choice-bag salvo (do dono da escolha)
 * @param {object} db
 * @param {number} [level]  nível do personagem (gate das escolhas de magia dos
 *   feats por nível - TC-0011; Infinity = cobra tudo)
 * @returns {boolean}
 */
export function choiceComplete(ch, bag, db, level = Infinity) {
  const entry = bag?.[ch.id];
  const picks = entry?.picks ?? [];
  if (picks.length < targetCount(ch, entry)) return false;
  if (ch.kind !== 'feat') return true;
  return picks.every((pick) => {
    const featData = resolveFeat(db, pick);
    if (!featData) return true; // compêndio sem o feat: nada a renderizar/cobrar
    const sub = entry?.sub?.[pick] ?? {};
    return choicesComplete(featSubChoices(featData, level, sub), sub, db, level);
  });
}

/**
 * Todas as escolhas estão preenchidas? (deep - ver `choiceComplete`).
 * @param {object[]} choices  descritores `Choice[]`
 * @param {object} bag        choice-bag salvo
 * @param {object} db
 * @param {number} [level]
 * @returns {boolean}
 */
export function choicesComplete(choices, bag, db, level = Infinity) {
  return (choices ?? []).every((ch) => choiceComplete(ch, bag, db, level));
}

/** A ESPÉCIE está completa? Espécie escolhida + linhagem (quando a raça tem
 *  `_versions`) + todas as sub-escolhas (tamanho incluso) preenchidas. */
export function speciesStepComplete(db, character) {
  const sp = character?.species;
  if (!sp?.id) return false;
  const baseRace = resolveRaceObj(db, sp.id, sp.source);
  if (!baseRace) return true; // raça fora do compêndio: não há o que preencher
  // Linhagens NATIVAS = `_versions` + sub-raças fundidas (Genasi, Stensia…):
  // uma raça com qualquer uma delas só completa com a linhagem escolhida. As
  // legadas curadas (DDL-0058) são opcionais e não obrigam (ver requiresLineage).
  if (requiresLineage(db, baseRace) && !sp.lineage) return false;
  const raceObj = resolveRaceObj(db, sp.id, sp.source, sp.lineage);
  const sizeChoice = speciesSizeChoice(raceObj);
  const level = totalLevel(character);
  const choices = [...(sizeChoice ? [sizeChoice] : []), ...parseChoices(raceObj, { level, bag: sp.choices })];
  return choicesComplete(choices, sp.choices, db, level);
}

/** O KIT inicial está completo? Kit escolhido + os chooses dele (o instrumento
 *  do Bard XPHB - TC-0024) preenchidos. Sem kit escolhido → false (o passo já
 *  era obrigatório); kit sem chooses → true direto. */
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

/** O TALENTO DE ORIGEM está completo? Feat escolhido + sub-escolhas dele. */
export function originFeatStepComplete(db, character) {
  const of = character?.origin?.originFeat;
  if (!of?.id) return false;
  const featData = resolveFeat(db, `${of.id}|${of.source}`);
  const level = totalLevel(character);
  return choicesComplete(featSubChoices(featData, level, of.choices ?? {}), of.choices ?? {}, db, level);
}

/**
 * @param {object} db
 * @param {object} character
 * @returns {{
 *   hasFeatureChoices: boolean,
 *   proficienciesComplete: boolean,
 *   featuresComplete: boolean,
 *   speciesComplete: boolean,
 *   originFeatComplete: boolean,
 *   kitComplete: boolean,
 * }}
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
    // Profundo: um feat escolhido num slot de ASI só completa com o sub-bag dele.
    featuresComplete: choicesComplete(featChoices, cls?.choices, db, level),
    speciesComplete: speciesStepComplete(db, character),
    originFeatComplete: originFeatStepComplete(db, character),
    kitComplete: kitStepComplete(db, character),
  };
}
