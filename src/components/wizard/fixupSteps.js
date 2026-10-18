// =============================================================================
// fixupSteps: os passos de "preencher o que falta"
// =============================================================================
// O QUE FAZ
//   O guia leve (botão do guia e level-up) mostra só as decisões de CLASSE por
//   preencher, de TODOS os níveis, em ordem: subclasse, features e magias. Fica na
//   camada de componentes porque precisa do db. Os status são AO VIVO.
//
// FUNÇÕES
//   subclassLevelOf(c), clsByUid(c, uid): utilitários.
//   unfilledClassChoices(db, character, cls): as escolhas de classe por preencher.
//   classOrigins(derived, uid), spellsFull(derived, uid), hasSpellsToFill(derived,
//     uid): as magias de classe.
//   buildFixupSteps(db, character, classUid, derived): os passos de uma classe.
//   fixupPendencyCount(db, character, derived): o total de DECISÕES (o badge).
//   firstClassWithFixup(db, character, derived): a classe alvo do botão.
//
// DECISÕES E ARMADILHAS
//   - Inclui as proficiências da classe (resetadas ao trocar de classe) e grants
//     como o Primal Knowledge (vem com a subclasse no 3), não só ASI e invocações.
//   - Completude PROFUNDA (TC-0013).
//   - O badge conta DECISÕES, não passos (TC-0020: um Bárbaro 19 com 7 escolhas
//     abertas mostrava 1, porque tudo cabia num passo).
// -----------------------------------------------------------------------------

import { buildClassChoices } from '../builder/classChoices';
import { choiceComplete } from './createGuideContext';
import { totalLevel } from '../../schema/character';

const subclassLevelOf = (c) => c?.rulesConfig?.subclassLevel ?? 3;
const clsByUid = (c, uid) => (c?.classes ?? []).find((x) => x.uid === uid) ?? null;

/** As escolhas de classe ainda por preencher, de todos os níveis. */
export function unfilledClassChoices(db, character, cls) {
  if (!cls?.classId) return [];
  const level = totalLevel(character);
  return buildClassChoices(db, cls, character).filter((ch) => !choiceComplete(ch, cls.choices, db, level));
}

/** As origens de magia de classe com algo por preencher. */
const classOrigins = (derived, uid) =>
  (derived?.spellcasting?.origins ?? []).filter((o) => o.kind === 'class' && o.uid === uid);
const spellsFull = (derived, uid) =>
  classOrigins(derived, uid).every(
    (o) =>
      (o.cantripLimit === 0 || (o.cantrips?.length ?? 0) >= o.cantripLimit) &&
      (o.prepareLimit === 0 || (o.prepared?.length ?? 0) >= o.prepareLimit),
  );
const hasSpellsToFill = (derived, uid) =>
  classOrigins(derived, uid).some((o) => o.cantripLimit > 0 || o.prepareLimit > 0) && !spellsFull(derived, uid);

/**
 * Os passos por preencher de uma classe.
 * @param {object} db
 * @param {object} character
 * @param {string} classUid
 * @param {object} derived
 * @returns {Array<{id,title,subtitle,status:Function}>}
 */
export function buildFixupSteps(db, character, classUid, derived) {
  const cls = clsByUid(character, classUid);
  if (!cls?.classId) return [];
  const cap = cls.classId.charAt(0).toUpperCase() + cls.classId.slice(1);
  const steps = [];

  if (cls.level >= subclassLevelOf(character) && !cls.subclassId) {
    steps.push({
      id: 'fixup-subclass',
      title: 'Choose a subclass',
      subtitle: `${cap} · subclass`,
      status: (c) => (clsByUid(c, classUid)?.subclassId ? 'complete' : 'incomplete'),
    });
  }

  if (unfilledClassChoices(db, character, cls).length > 0) {
    steps.push({
      id: 'fixup-features',
      title: 'Class features & skills',
      subtitle: `${cap} · choices`,
      status: (c) => (unfilledClassChoices(db, c, clsByUid(c, classUid)).length === 0 ? 'complete' : 'incomplete'),
    });
  }

  if (hasSpellsToFill(derived, classUid)) {
    steps.push({
      id: 'fixup-spells',
      title: 'Spells',
      subtitle: `${cap} · spells`,
      status: (c, d) => (spellsFull(d, classUid) ? 'complete' : 'incomplete'),
    });
  }

  return steps;
}

/** O total de decisões por preencher, somando as classes. */
export function fixupPendencyCount(db, character, derived) {
  return (character?.classes ?? [])
    .filter((c) => c.classId)
    .reduce((sum, c) => {
      let n = unfilledClassChoices(db, character, c).length;
      if (c.level >= subclassLevelOf(character) && !c.subclassId) n += 1;
      if (hasSpellsToFill(derived, c.uid)) n += 1;
      return sum + n;
    }, 0);
}

/** A primeira classe com algo por preencher. */
export function firstClassWithFixup(db, character, derived) {
  return (character?.classes ?? []).find(
    (c) => c.classId && buildFixupSteps(db, character, c.uid, derived).length > 0,
  ) ?? null;
}
