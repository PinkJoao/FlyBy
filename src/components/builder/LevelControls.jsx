// =============================================================================
// LevelControls: subir e descer de nível pelo topo da ficha
// =============================================================================
// O QUE FAZ
//   Dois botões ao lado do Export. Com uma classe, o clique resolve; em
//   multiclasse, pergunta qual muda (diálogo in-app). O nível total vai até 20;
//   nenhuma classe desce abaixo de 1 (remover é decisão da aba Class), então o
//   menos só oferece classes acima de 1 e some sem nenhuma. O Builder detecta o +1
//   e abre o guia de level-up, se houver o que preencher.
//
// FUNÇÕES
//   classLabel(cls): "Warlock (level 5)".
//   pickClass(classes, title): o uid escolhido, ou null (com uma opção, não
//     pergunta).
//   LevelControls(props): os botões.
// -----------------------------------------------------------------------------

import { ask } from '../common/dialog';
import { totalLevel } from '../../schema/character';
import styles from './LevelControls.module.css';
import AnimatedNumber from '../common/AnimatedNumber';

const MAX_TOTAL_LEVEL = 20;

/** O rótulo de uma classe no diálogo. */
function classLabel(cls) {
  return `${cls.classId ? cls.classId[0].toUpperCase() + cls.classId.slice(1) : 'Class'} (level ${cls.level})`;
}

/** Pergunta qual classe muda; o uid, ou null. */
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
 * Os controles de nível.
 * @param {object} props
 * @param {import('../../schema/character').Character} props.character
 * @param {(classes: object[]) => void} props.onChangeClasses
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
    applyDelta(uid, +1);
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
        <AnimatedNumber value={total} className={styles.levelValue} />
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
