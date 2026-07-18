// =============================================================================
// fixupSteps - passos de "preencher o que falta" (botão do guia + level-up)
// =============================================================================
// O guia leve (compartilhado pelo botão ✦ e pelo level-up) NÃO reusa o fluxo de
// criação inteiro: mostra só as decisões de CLASSE ainda por preencher, de TODOS
// os níveis, em ordem - subclasse, features (feat/weapon mastery/invocação/…) e
// magias. Sem etapas já concluídas, sem Review.
//
// Diferente do catálogo de criação (engine, puro), isto vive na camada de
// componentes porque precisa do `db` (buildClassChoices). Os `status` são AO
// VIVO - fecham sobre `db`/`classUid` e recomputam com o personagem atual, então
// o passo "abre" enquanto falta preencher e "completa" quando enche.
// -----------------------------------------------------------------------------

import { buildClassChoices } from '../builder/classChoices';
import { choiceComplete } from './createGuideContext';
import { totalLevel } from '../../schema/character';

const subclassLevelOf = (c) => c?.rulesConfig?.subclassLevel ?? 3;
const clsByUid = (c, uid) => (c?.classes ?? []).find((x) => x.uid === uid) ?? null;

/**
 * Escolhas de CLASSE ainda por preencher (todos os níveis) - features E
 * proficiências. Inclui perícia/ferramenta/idioma da classe (resetadas ao trocar
 * de classe) e grants de feature como o Primal Knowledge do Barbarian (uma perícia
 * ganha JUNTO da subclasse no nível 3), não só ASI/mastery/invocação.
 * A completude é PROFUNDA (`choiceComplete`, TC-0013): um feat escolhido num slot
 * de ASI/boon só sai daqui quando o sub-bag dele (+2/+1, magias…) também encher.
 */
export function unfilledClassChoices(db, character, cls) {
  if (!cls?.classId) return [];
  const level = totalLevel(character);
  return buildClassChoices(db, cls, character).filter((ch) => !choiceComplete(ch, cls.choices, db, level));
}

/** Origens de MAGIA de classe (uid) que têm algo por preencher. */
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
 * Passos por preencher de UMA classe, em ordem. Só inclui o que falta.
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

/** Total de DECISÕES por preencher (badge do botão ✦), somando as classes.
 *  Conta escolhas, não passos do guia (TC-0020: um Barbarian 19 com 7 escolhas
 *  em aberto mostrava "1" porque tudo cabe num único passo de features). */
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

/** A primeira classe com algo por preencher (alvo do botão do guia). */
export function firstClassWithFixup(db, character, derived) {
  return (character?.classes ?? []).find(
    (c) => c.classId && buildFixupSteps(db, character, c.uid, derived).length > 0,
  ) ?? null;
}
