// =============================================================================
// MovePanel: quantos pés andar (Walk) ou correr (Dash) neste turno
// =============================================================================
// O QUE FAZ
//   O painel dos botões Walk e Dash do card de movimento aberto: o jogador diz
//   quantos pés se desloca, e o painel mostra quanto sobra agora e quanto vai
//   sobrar. No Dash, o turno ganha mais um deslocamento inteiro antes de andar.
//   Fecha com { feet }, ou null. Quem o abre é o playDialogs.jsx.
//
// FUNÇÕES
//   MovePanel(props): o conteúdo do diálogo.
//
// DECISÕES E ARMADILHAS
//   - Os atalhos (5 a 30 pés) SOMAM ao número, não gravam: o jogador monta o
//     movimento e confirma uma vez.
//   - Andar mais do que sobra é permitido e o que sobra fica negativo, em aviso
//     (liberdade com aviso, §6.4).
//   - O Dash pode ser gravado com 0 pés: ganhar o deslocamento e andar depois.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { useDialogClose } from '../common/dialogContext';
import panel from './PlayPanels.module.css';
import styles from './HpPanels.module.css';

const STEPS = [5, 10, 15, 20, 30];

/**
 * O painel de andar ou correr.
 * @param {{ dash: boolean, speed: number, left: number }} props
 */
export default function MovePanel({ dash, speed, left }) {
  const close = useDialogClose();
  const inputRef = useRef(null);
  const [feet, setFeet] = useState('');
  const n = Math.max(0, Math.trunc(Number(feet) || 0));
  const now = dash ? left + speed : left;
  const after = now - n;

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <form
      className={panel.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (n > 0 || dash) close({ feet: n });
      }}
    >
      <p className={styles.now}>
        {left} ft left this turn{dash ? `, ${left + speed} ft with the Dash` : ''}
      </p>
      <input
        ref={inputRef}
        className={styles.amount}
        type="number"
        inputMode="numeric"
        min="0"
        step="5"
        value={feet}
        onChange={(e) => setFeet(e.target.value)}
        placeholder="0"
        aria-label="Feet"
      />
      <div className={panel.seg}>
        {STEPS.map((f) => (
          <button key={f} type="button" className={panel.segBtn} onClick={() => setFeet(String(n + f))}>+{f}</button>
        ))}
      </div>
      <p className={after < 0 ? `${styles.preview} ${panel.short}` : styles.preview}>
        {after} ft left after {dash ? 'the Dash' : 'walking'}{after < 0 ? ' (more than you have)' : ''}
      </p>
      {dash && <p className={panel.note}>The Dash uses your action.</p>}
      <div className={panel.actions}>
        <button type="submit" className={`${panel.btn} ${panel.primary}`} disabled={n <= 0 && !dash}>{dash ? 'Dash' : 'Walk'}</button>
      </div>
    </form>
  );
}
