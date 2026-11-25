// =============================================================================
// guidancePendencies: todas as pendências obrigatórias da ficha (o botão do guia)
// =============================================================================
// O QUE FAZ
//   O botão do guia fica aparente enquanto faltar QUALQUER campo obrigatório, não
//   só decisões de classe (DDL-0022); só as etapas biográficas ficam fora. Separa
//   as pendências por onde se resolvem:
//     basic: passos de CRIAÇÃO (espécie, classe, talento de origem, proficiências,
//       atributos, boosts), que o botão resolve abrindo o guia de criação.
//     fixup: decisões de CLASSE, que o LevelUpWizard preenche.
//   total = basic + fixup, o badge.
//
// FUNÇÕES
//   hasClass(c): utilitário.
//   guidancePendencies(db, character, derived): { basic, fixup, total }.
//   guidanceActive(character): `meta.guided` não é false (ausente conta como
//     ativo).
// -----------------------------------------------------------------------------

import { createGuideContext } from './createGuideContext';
import { fixupPendencyCount } from './fixupSteps';
import { scoresTouched, boostsComplete } from '../../engine/wizardSteps';

const hasClass = (c) => (c?.classes ?? []).some((x) => x.classId);

/**
 * As pendências obrigatórias, separadas por onde se resolvem.
 * @param {object} db
 * @param {object} character
 * @param {object} derived
 * @returns {{ basic: number, fixup: number, total: number }}
 */
export function guidancePendencies(db, character, derived) {
  const ctx = createGuideContext(db, character);
  let basic = 0;
  if (!hasClass(character)) basic += 1;
  if (!ctx.speciesComplete) basic += 1;
  if (!ctx.originFeatComplete) basic += 1;
  if (!ctx.proficienciesComplete) basic += 1;
  if (!scoresTouched(character)) basic += 1;
  if (!boostsComplete(character)) basic += 1;
  const fixup = fixupPendencyCount(db, character, derived);
  return { basic, fixup, total: basic + fixup };
}

/** A guidance está ativa para este personagem? */
export const guidanceActive = (character) => character?.meta?.guided !== false;
