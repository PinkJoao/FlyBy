// =============================================================================
// LevelControls - subir / descer de nível a partir do topo da ficha
// =============================================================================
// Um par de botões compactos ao lado do Export. Com UMA classe, o clique já
// resolve; em MULTICLASSE, pergunta qual classe muda (diálogo in-app, DDL-0007).
//
// Regras:
//  - o nível total do personagem vai até 20;
//  - nenhuma classe desce abaixo de 1 - remover uma classe é decisão da aba
//    Class, não um efeito colateral de um clique em "−";
//  - por isso o "−" só oferece classes com nível > 1 (e some quando não há nenhuma).
//
// O gancho do WIZARD de level-up (Fase D) é o `onLeveledUp` - quem chama decide
// se abre o assistente ou não.
// -----------------------------------------------------------------------------

import { ask } from '../common/dialog';
import { totalLevel } from '../../schema/character';
import styles from './LevelControls.module.css';

const MAX_TOTAL_LEVEL = 20;

/** Rótulo de uma classe no diálogo: "Warlock (level 5)". */
function classLabel(cls) {
  return `${cls.classId ? cls.classId[0].toUpperCase() + cls.classId.slice(1) : 'Class'} (level ${cls.level})`;
}

/**
 * Pergunta qual classe muda. Devolve o `uid` escolhido, ou null se cancelou.
 * Com uma única opção, não pergunta nada.
 */
async function pickClass(classes, title) {
  if (classes.length === 1) return classes[0].uid;
  const { action, values } = await ask({
    title,
    message: 'This character has more than one class. Which one changes?',
    fields: [
      {
        type: 'select',
        name: 'uid',
        label: 'Class',
        options: classes.map((c) => ({ label: classLabel(c), value: c.uid })),
        default: classes[0].uid,
      },
    ],
    actions: [
      { label: 'Cancel', value: false },
      { label: 'Confirm', value: true, tone: 'primary', autoFocus: true },
    ],
  });
  return action ? values.uid : null;
}

/**
 * @param {object} props
 * @param {import('../../schema/character').Character} props.character
 * @param {(classes: object[]) => void} props.onChangeClasses  o Builder detecta o
 *   level-up (+1) aqui dentro e abre o guia - não há gancho separado.
 */
export default function LevelControls({ character, onChangeClasses }) {
  const classes = (character.classes ?? []).filter((c) => c.classId);
  const total = totalLevel(character);

  const canLevelUp = classes.length > 0 && total < MAX_TOTAL_LEVEL;
  const downable = classes.filter((c) => c.level > 1);
  const canLevelDown = downable.length > 0;

  const applyDelta = (uid, delta) =>
    onChangeClasses(character.classes.map((c) => (c.uid === uid ? { ...c, level: c.level + delta } : c)));

  const levelUp = async () => {
    const uid = await pickClass(classes, 'Level up');
    if (!uid) return;
    applyDelta(uid, +1); // o Builder detecta o +1 e abre o guia, se houver o que preencher
  };

  const levelDown = async () => {
    const uid = await pickClass(downable, 'Level down');
    if (!uid) return;
    applyDelta(uid, -1);
  };

  return (
    <div className={styles.group} role="group" aria-label="Character level">
      <button
        type="button"
        className={styles.btn}
        onClick={levelDown}
        disabled={!canLevelDown}
        title={canLevelDown ? 'Level down' : 'A class cannot go below level 1'}
        aria-label="Level down"
      >
        −
      </button>
      <span className={styles.level} title={`Character level ${total}`}>
        <span className={styles.levelValue}>{total}</span>
        <span className={styles.levelLabel}>LVL</span>
      </span>
      <button
        type="button"
        className={styles.btn}
        onClick={levelUp}
        disabled={!canLevelUp}
        title={canLevelUp ? 'Level up' : `Level ${MAX_TOTAL_LEVEL} is the maximum`}
        aria-label="Level up"
      >
        +
      </button>
    </div>
  );
}
