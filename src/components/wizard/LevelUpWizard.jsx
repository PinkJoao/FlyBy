// =============================================================================
// LevelUpWizard: o guia leve, do botão do guia e do level-up
// =============================================================================
// O QUE FAZ
//   Mostra só as decisões de CLASSE por preencher (subclasse, features de todos os
//   níveis, magias), em ordem, sem fluxo de criação e sem Revisão (DDL-0015). O
//   Avançar trava até preencher. Aberto pelo LEVEL-UP (`levelUp={{toLevel}}`, o +1
//   já aplicado; sair oferece Reverter ou Manter) ou pelo BOTÃO do guia (sair só
//   fecha). Os passos são AO VIVO: preencher um o fecha e o guia avança; com tudo
//   preenchido, ele fecha sozinho.
//
// FUNÇÕES
//   cap(s): texto.
//   LevelUpWizard(props): o guia.
// -----------------------------------------------------------------------------

import { useEffect, useMemo } from 'react';
import { useBackLayer } from '../../hooks/useBack';
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
 * O guia leve de preencher o que falta.
 * @param {object} props
 * @param {object} props.character
 * @param {object} props.db
 * @param {(next) => void} props.save
 * @param {string} props.classUid
 * @param {() => void} props.onClose
 * @param {{ toLevel: number }} [props.levelUp]
 * @param {() => void} [props.onRevert]
 */
export default function LevelUpWizard({ character, db, save, classUid, onClose, levelUp, onRevert }) {
  // ATENÇÃO: força a classe ao nível alvo; o save é assíncrono e o store pode estar um tick atrás.
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

  useBackLayer(steps.length > 0, onExit);

  if (steps.length === 0) return null;

  // ATENÇÃO: o portal para document.body é necessário; um ancestral com transform prenderia o overlay.
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
