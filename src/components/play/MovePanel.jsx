// =============================================================================
// MovePanel: os deslocamentos e o movimento do turno
// =============================================================================
// O QUE FAZ
//   O painel do tile Move: cada deslocamento do personagem (a pé, voo, natação,
//   escalada, escavação), já com condições e exaustão, e, em combate, quanto sobra
//   do movimento do turno, com botões para andar 5 a 30 pés, o Dash e zerar. Fecha
//   com { action: 'move', feet }, { action: 'dash' } ou { action: 'reset' }, ou
//   null. Quem o abre é o playDialogs.jsx.
//
// FUNÇÕES
//   MovePanel(props): o conteúdo do diálogo.
//
// DECISÕES E ARMADILHAS
//   - Cada toque num valor grava e fecha (um movimento por toque é o comum na mesa);
//     andar mais do que sobra é permitido e o que sobra fica negativo, em aviso.
//   - SPEED_LABEL dá a ordem e o nome dos deslocamentos.
//   - Fora de combate o painel só mostra os deslocamentos: o movimento do turno
//     existe a partir do Roll initiative.
// -----------------------------------------------------------------------------

import { useDialogClose } from '../common/dialogContext';
import styles from './PlayPanels.module.css';

const SPEED_LABEL = { walk: 'Walk', fly: 'Fly', swim: 'Swim', climb: 'Climb', burrow: 'Burrow' };
const STEPS = [5, 10, 15, 20, 30];

/**
 * O painel de movimento.
 * @param {{ speeds: object, combat: object|null, left: number, speed: number }} props
 */
export default function MovePanel({ speeds, combat, left, speed }) {
  const close = useDialogClose();
  const modes = Object.keys(SPEED_LABEL).filter((m) => speeds[m]);
  const dash = combat?.used?.dash ?? 0;

  return (
    <div className={styles.form}>
      <div className={styles.options}>
        {modes.length === 0 && <p className={styles.note}>No speed on the sheet yet (it comes from the species).</p>}
        {modes.map((m) => (
          <div key={m} className={styles.option}>
            <span className={styles.optionText}>
              <strong>{SPEED_LABEL[m]}</strong>
              {speeds[m].note && <span className={styles.left}>{speeds[m].note}</span>}
            </span>
            <span className={speeds[m].feet !== speeds[m].base ? `${styles.stepValue} ${styles.short}` : styles.stepValue}>
              {speeds[m].feet} ft
            </span>
          </div>
        ))}
      </div>

      {combat ? (
        <>
          <p className={left < 0 ? `${styles.note} ${styles.short}` : styles.note}>
            This turn: <strong>{left} ft</strong> of {speed * (1 + dash)} ft left{dash ? ` (Dash${dash > 1 ? ` x${dash}` : ''})` : ''}.
          </p>
          <div className={styles.seg}>
            {STEPS.map((f) => (
              <button key={f} type="button" className={styles.segBtn} onClick={() => close({ action: 'move', feet: f })}>{f} ft</button>
            ))}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={() => close({ action: 'reset' })}>Reset</button>
            <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={() => close({ action: 'dash' })}>Dash</button>
          </div>
        </>
      ) : (
        <p className={styles.note}>Your movement each turn is tracked in combat. Roll initiative to start one.</p>
      )}
    </div>
  );
}
