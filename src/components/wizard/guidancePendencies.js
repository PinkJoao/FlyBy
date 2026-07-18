// =============================================================================
// guidancePendencies - TODAS as pendências obrigatórias da ficha (botão ✦)
// =============================================================================
// O botão/notificação do guia deve ficar aparente enquanto a ficha não tiver
// TODOS os campos OBRIGATÓRIOS preenchidos - não só as decisões de classe. Só as
// etapas biográficas/flavour (história, alinhamento, nome/retrato) ficam de fora.
//
// Vive na camada de componentes (não no engine puro) porque precisa do `db`
// (createGuideContext / buildClassChoices). Separa as pendências por ONDE se
// resolvem:
//   - `basic`  - passos de CRIAÇÃO (espécie, classe, talento de origem,
//     proficiências, atributos, boosts de background). O overlay leve de fixup
//     não os cobre → o botão abre o GUIA DE CRIAÇÃO (na tela de Revisão).
//   - `fixup`  - decisões de CLASSE (subclasse, features, magias), que o overlay
//     leve (LevelUpWizard) sabe preencher.
// `total` = basic + fixup alimenta o badge do botão.
// -----------------------------------------------------------------------------

import { createGuideContext } from './createGuideContext';
import { fixupPendencyCount } from './fixupSteps';
import { scoresTouched, boostsComplete } from '../../engine/wizardSteps';

const hasClass = (c) => (c?.classes ?? []).some((x) => x.classId);

/**
 * Pendências obrigatórias, separadas por onde se resolvem.
 * @param {object} db
 * @param {object} character
 * @param {object} derived  saída de deriveFromDb (para as magias de classe)
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
  // Subclasse/features/magias de classe por preencher (por classe).
  const fixup = fixupPendencyCount(db, character, derived);
  return { basic, fixup, total: basic + fixup };
}

/** A guidance está ativa para ESTE personagem? Flag por-personagem
 *  (`meta.guided`): `false` desliga o botão ✦ e o overlay de level-up. Ausente
 *  (legado / criado guiado) conta como ativa. */
export const guidanceActive = (character) => character?.meta?.guided !== false;
