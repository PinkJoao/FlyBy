// =============================================================================
// LevelUpWizard - o guia LEVE, compartilhado pelo botão ✦ e pelo level-up
// =============================================================================
// Mostra só as decisões de CLASSE ainda por preencher (subclasse → features de
// TODOS os níveis → magias), em ordem - nada de fluxo de criação, nada de Review
// (#5/#6/#7). O Avançar trava até preencher (#8). Aberto:
//   - por LEVEL-UP (`levelUp={{toLevel}}`): o `+1` já foi aplicado; sair oferece
//     Reverter/Manter.
//   - pelo BOTÃO ✦ (`levelUp` ausente): sair só fecha.
// Os passos são AO VIVO (recomputados com o personagem), então preencher um os
// "fecha" e o guia avança sozinho. Para o level-up, forçamos a classe ao nível
// alvo (o `save` é assíncrono → o store pode estar atrasado um tick).
// -----------------------------------------------------------------------------

import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import useDerived from '../../hooks/useDerived';
import { ask } from '../common/dialog';
import Wizard from './Wizard';
import SubclassStep from './steps/SubclassStep';
import FeaturesStep from './steps/FeaturesStep';
import LevelUpSpellsStep from './steps/LevelUpSpellsStep';
import { buildFixupSteps } from './fixupSteps';
import styles from './LevelUpWizard.module.css';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const SCREENS = {
  'fixup-subclass': SubclassStep,
  'fixup-features': FeaturesStep,
  'fixup-spells': LevelUpSpellsStep,
};

/**
 * @param {object} props
 * @param {object} props.character
 * @param {object} props.db
 * @param {(next) => void} props.save
 * @param {string} props.classUid
 * @param {() => void} props.onClose
 * @param {{ toLevel: number }} [props.levelUp]  presente ⇒ aberto por level-up
 * @param {() => void} [props.onRevert]          desfaz o +1 (só no level-up)
 */
export default function LevelUpWizard({ character, db, save, classUid, onClose, levelUp, onRevert }) {
  // No level-up, força a classe ao nível alvo (contorna o atraso do save).
  const effChar = useMemo(
    () =>
      levelUp
        ? { ...character, classes: character.classes.map((c) => (c.uid === classUid ? { ...c, level: levelUp.toLevel } : c)) }
        : character,
    [character, classUid, levelUp],
  );
  const derived = useDerived(effChar);
  const cls = effChar.classes.find((c) => c.uid === classUid);

  const steps = buildFixupSteps(db, effChar, classUid, derived);

  // Terminou tudo (todos os passos preenchidos) → fecha sozinho.
  useEffect(() => {
    if (steps.length === 0) onClose();
  }, [steps.length, onClose]);

  const renderStep = (step, sctx) => {
    const Screen = SCREENS[step.id];
    if (!Screen) return null;
    if (step.id === 'fixup-features') return <Screen {...sctx} classUid={classUid} unfilledOnly allKinds />;
    if (step.id === 'fixup-subclass') return <Screen {...sctx} classUid={classUid} />;
    return <Screen {...sctx} />;
  };

  if (steps.length === 0) return null;

  const onExit = async () => {
    if (!levelUp) {
      onClose();
      return;
    }
    const choice = await ask({
      title: 'Leave the level-up guide?',
      message: `You leveled ${cap(cls?.classId)} to ${levelUp.toLevel}. Undo that, or keep the level and finish the choices later on the sheet?`,
      actions: [
        { label: 'Undo level-up', value: 'revert', tone: 'danger' },
        { label: 'Keep it', value: 'keep', tone: 'primary', autoFocus: true },
      ],
      dismissValue: null,
    });
    if (choice == null) return;
    if (choice === 'revert') onRevert?.();
    onClose();
  };

  // Portal p/ document.body: o overlay é `position: fixed`; renderizado dentro de
  // `.page` (max-width 760, margin auto), um ancestral com transform/filter/
  // contain o prenderia numa caixa estreita e descentralizada.
  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.panel}>
        <Wizard
          steps={steps}
          character={effChar}
          derived={derived}
          db={db}
          onChange={save}
          title={levelUp ? `Level ${levelUp.toLevel}` : cap(cls?.classId)}
          onFinish={onClose}
          onExit={onExit}
          renderStep={renderStep}
          showReview={false}
          blockIncomplete
        />
      </div>
    </div>,
    document.body,
  );
}
