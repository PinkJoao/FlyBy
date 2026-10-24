// =============================================================================
// RecoveryPanels: os diálogos das recuperações especiais do play mode
// =============================================================================
// O QUE FAZ
//   Os dois painéis que a activity sozinha não resolve (engine/playUse):
//   SlotRecoveryPanel (Arcane Recovery, Natural Recovery) escolhe quantos slots
//   de cada círculo voltam, contra o orçamento de metade do nível; FontOfMagicPanel
//   cria um slot com pontos de feitiçaria ou converte um slot em pontos. Quem os
//   abre é o playDialogs.jsx.
//
// FUNÇÕES
//   SlotRecoveryPanel(props): os slots a recuperar; fecha com { picks } ou null.
//   FontOfMagicPanel(props): criar ou converter; fecha com { mode, level } ou null.
//
// DECISÕES E ARMADILHAS
//   - Passar do orçamento ou do círculo máximo pinta o total de vermelho e avisa,
//     mas não bloqueia (liberdade com aviso, §6.4).
//   - Criar um slot só reabastece um slot GASTO (o modelo guarda o gasto): sem
//     slot gasto daquele círculo, o painel avisa que os pontos se perdem.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { remainingOf } from '../../engine/playState';
import { useDialogClose } from '../common/dialogContext';
import styles from './PlayPanels.module.css';

/**
 * Os slots a recuperar, contra o orçamento.
 * @param {{ catalog: object, state: object, rule: { budget: number, maxLevel: number } }} props
 */
export function SlotRecoveryPanel({ catalog, state, rule }) {
  const close = useDialogClose();
  const [picks, setPicks] = useState({});
  const slots = (catalog.resources ?? []).filter((r) => r.kind === 'slot' && (state.spent?.[r.key] ?? 0) > 0);
  const total = Object.entries(picks).reduce((s, [lvl, n]) => s + Number(lvl) * n, 0);
  const over = total > rule.budget || Object.entries(picks).some(([lvl, n]) => n > 0 && Number(lvl) > rule.maxLevel);

  return (
    <div className={styles.form}>
      <p className={styles.note}>Regain slots whose levels add up to {rule.budget} or less, none of level {rule.maxLevel + 1} or higher.</p>
      {slots.length === 0 && <p className={styles.note}>No spell slot is spent.</p>}
      <ul className={styles.costs}>
        {slots.map((r) => {
          const spent = state.spent[r.key];
          const n = picks[r.level] ?? 0;
          return (
            <li key={r.key} className={styles.stepRow}>
              <span>Level {r.level} ({spent} spent)</span>
              <span className={styles.stepper}>
                <button type="button" className={styles.smallBtn} disabled={n <= 0} onClick={() => setPicks({ ...picks, [r.level]: n - 1 })}>-</button>
                <span className={styles.stepValue}>{n}</span>
                <button type="button" className={styles.smallBtn} disabled={n >= spent} onClick={() => setPicks({ ...picks, [r.level]: n + 1 })}>+</button>
              </span>
            </li>
          );
        })}
      </ul>
      <p className={over ? `${styles.note} ${styles.short}` : styles.note}>Total: {total} of {rule.budget}{over ? ' (over the limit)' : ''}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={() => close(null)}>Cancel</button>
        <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={total === 0} onClick={() => close({ picks })}>Recover</button>
      </div>
    </div>
  );
}

/**
 * Criar um slot com pontos, ou converter um slot em pontos.
 * @param {{ catalog: object, state: object, rule: { cost: Record<number, number> } }} props
 */
export function FontOfMagicPanel({ catalog, state, rule }) {
  const close = useDialogClose();
  const levels = (catalog.resources ?? []).filter((r) => r.kind === 'slot' && r.level <= 5);
  const points = (catalog.resources ?? []).find((r) => r.key === 'pool:font-of-magic');
  const [mode, setMode] = useState('create');
  const [level, setLevel] = useState(levels[0]?.level ?? 1);
  const slot = levels.find((r) => r.level === level);
  const pointsLeft = points ? remainingOf(state, points.key, points.max) : 0;
  const slotLeft = slot ? remainingOf(state, slot.key, slot.max) : 0;
  const noSpent = mode === 'create' && (state.spent?.[slot?.key] ?? 0) === 0;
  const short = mode === 'create' ? pointsLeft < rule.cost[level] : slotLeft < 1;

  return (
    <div className={styles.form}>
      <div className={styles.seg}>
        <button type="button" className={mode === 'create' ? `${styles.segBtn} ${styles.segOn}` : styles.segBtn} onClick={() => setMode('create')}>Create a slot</button>
        <button type="button" className={mode === 'convert' ? `${styles.segBtn} ${styles.segOn}` : styles.segBtn} onClick={() => setMode('convert')}>Slot to points</button>
      </div>
      <label className={styles.field}>
        <span className={styles.label}>Slot level</span>
        <select className={styles.input} value={level} onChange={(e) => setLevel(Number(e.target.value))}>
          {levels.map((r) => <option key={r.key} value={r.level}>Level {r.level} ({remainingOf(state, r.key, r.max)} left)</option>)}
        </select>
      </label>
      <p className={short ? `${styles.note} ${styles.short}` : styles.note}>
        {mode === 'create' ? `Costs ${rule.cost[level]} sorcery points (${pointsLeft} left).` : `Gives ${level} sorcery points (${slotLeft} level ${level} slots left).`}
      </p>
      {noSpent && <p className={styles.warn}>No level {level} slot is spent, so the points would be lost.</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={() => close(null)}>Cancel</button>
        <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={() => close({ mode, level })}>
          {mode === 'create' ? 'Create' : 'Convert'}
        </button>
      </div>
    </div>
  );
}
