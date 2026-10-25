// =============================================================================
// UsePanel: o diálogo antes de usar uma feature no play mode
// =============================================================================
// O QUE FAZ
//   Mostra o que a activity vai gastar (com o que sobra de cada recurso) e pede só
//   o que ela precisa: quanto gastar (`@scaling`, o Lay on Hands), o círculo do
//   slot (Wild Companion), se a cura vai no próprio personagem, e, num ataque, o
//   modo e o bônus. Fecha com as opções do engine/playUse, ou null. Quem o abre é
//   o playDialogs.jsx.
//
// FUNÇÕES
//   UsePanel(props): o conteúdo do diálogo.
//     submit(e): fecha com as opções.
//
// DECISÕES E ARMADILHAS
//   - Os custos mostrados saem de resolveCosts, a MESMA conta do evento: o que o
//     painel promete é o que se grava.
//   - O círculo do slot começa no menor que ainda tem slot livre.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { resolveCosts, left } from '../../engine/playUse';
import { useDialogClose } from '../common/dialogContext';
import SegmentedControl from '../common/SegmentedControl';
import styles from './PlayPanels.module.css';

/**
 * O conteúdo do diálogo de usar uma feature.
 * @param {{ catalog: object, state: object, action: object, activity: object }} props
 */
export default function UsePanel({ catalog, state, activity }) {
  const close = useDialogClose();
  const slotCost = (activity.consumes ?? []).find((c) => c.spellSlot != null);
  const minSlot = slotCost ? Number.parseInt(slotCost.spellSlot, 10) || 1 : null;
  const slotLevels = (catalog.resources ?? []).filter((r) => r.kind === 'slot' && r.level >= (minSlot ?? 1));
  const firstFree = slotLevels.find((r) => left(catalog, state, r.key) > 0) ?? slotLevels[0];
  const [scaling, setScaling] = useState(1);
  const [slotLevel, setSlotLevel] = useState(firstFree?.level ?? minSlot);
  const [applyHeal, setApplyHeal] = useState(!!activity.selfTarget);
  const [mode, setMode] = useState('normal');
  const [bonus, setBonus] = useState('');
  const btnRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => btnRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  const options = { scaling, slotLevel, applyHeal, mode, bonus };
  const costs = resolveCosts(catalog, state, activity, options);
  const nameOf = (key) => (catalog.resources ?? []).find((r) => r.key === key)?.name ?? key;

  /** Fecha com as opções. */
  const submit = (e) => {
    e.preventDefault();
    close(options);
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      {costs.length > 0 ? (
        <ul className={styles.costs}>
          {costs.map((c) => {
            const l = left(catalog, state, c.key);
            const short = c.amount > 0 && l < c.amount;
            return (
              <li key={c.key} className={short ? styles.short : undefined}>
                {c.amount > 0 ? `Spends ${c.amount}` : `Regains ${-c.amount}`} {nameOf(c.key)} ({l} left)
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.note}>Costs nothing.</p>
      )}

      {activity.scalable && (
        <label className={styles.field}>
          <span className={styles.label}>How many</span>
          <input className={styles.input} type="number" min="1" value={scaling} onChange={(e) => setScaling(Math.max(1, Number(e.target.value) || 1))} />
        </label>
      )}
      {slotCost && slotLevels.length > 0 && (
        <label className={styles.field}>
          <span className={styles.label}>Spell slot</span>
          <select className={styles.input} value={slotLevel} onChange={(e) => setSlotLevel(Number(e.target.value))}>
            {slotLevels.map((r) => <option key={r.key} value={r.level}>Level {r.level} ({left(catalog, state, r.key)} left)</option>)}
          </select>
        </label>
      )}
      {activity.heal && (
        <label className={styles.check}>
          <input type="checkbox" checked={applyHeal} onChange={(e) => setApplyHeal(e.target.checked)} />
          <span>Heal myself with it</span>
        </label>
      )}
      {activity.attack && (
        <SegmentedControl
          block
          value={mode}
          options={['disadvantage', 'normal', 'advantage'].map((m) => [
            m,
            m[0].toUpperCase() + m.slice(1),
          ])}
          onChange={setMode}
        />
      )}
      {(activity.attack || activity.heal || (activity.damage ?? []).length > 0) && (
        <label className={styles.field}>
          <span className={styles.label}>Situational bonus</span>
          <input className={styles.input} value={bonus} onChange={(e) => setBonus(e.target.value)} placeholder="e.g. 1d4 or -2" autoComplete="off" />
        </label>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={() => close(null)}>Cancel</button>
        <button ref={btnRef} type="submit" className={`${styles.btn} ${styles.primary}`}>Use</button>
      </div>
    </form>
  );
}
