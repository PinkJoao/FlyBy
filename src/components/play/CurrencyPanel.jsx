// =============================================================================
// CurrencyPanel: gastar ou ganhar moedas no play mode
// =============================================================================
// O QUE FAZ
//   O diálogo do dinheiro em jogo (fase C6): Spend ou Gain, quanto de cada moeda
//   e um nome opcional ("Inn", "Dragon hoard"). Fecha com { delta, label } para o
//   engine/playInventory.currencyEvent, ou null. Quem o abre é o playDialogs.jsx.
//
// FUNÇÕES
//   CurrencyPanel(props): o conteúdo do diálogo.
//     submit(e): monta o delta e fecha.
//
// DECISÕES E ARMADILHAS
//   - Gastar mais do que há de uma moeda não fecha: o applyCharacterOps não
//     deixaria a moeda negativa. Sem troco automático; o painel diz qual falta, e
//     o jogador converte (DDL-0108).
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { useDialogClose } from '../common/dialogContext';
import SegmentedControl from '../common/SegmentedControl';
import styles from './PlayPanels.module.css';

const COINS = ['pp', 'gp', 'ep', 'sp', 'cp'];

/**
 * O conteúdo do diálogo de moedas.
 * @param {{ currency: object }} props
 */
export default function CurrencyPanel({ currency }) {
  const close = useDialogClose();
  const [mode, setMode] = useState('spend');
  const [amounts, setAmounts] = useState({});
  const [label, setLabel] = useState('');

  const counts = Object.fromEntries(COINS.map((c) => [c, Math.max(0, Math.trunc(Number(amounts[c]) || 0))]));
  const any = COINS.some((c) => counts[c] > 0);
  const short = mode === 'spend' ? COINS.filter((c) => counts[c] > (currency?.[c] ?? 0)) : [];
  const ok = any && !short.length;

  /** Monta o delta e fecha. */
  const submit = (e) => {
    e.preventDefault();
    if (!ok) return;
    const sign = mode === 'spend' ? -1 : 1;
    const delta = Object.fromEntries(COINS.filter((c) => counts[c]).map((c) => [c, sign * counts[c]]));
    close({ delta, label: label.trim() });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <SegmentedControl
        block
        value={mode}
        options={[['spend', 'Spend'], ['gain', 'Gain']]}
        onChange={setMode}
      />
      <div className={styles.coinGrid}>
        {COINS.map((c) => (
          <label key={c} className={styles.field}>
            <span className={styles.label}>{c} ({currency?.[c] ?? 0})</span>
            <input
              className={styles.input}
              type="number"
              min="0"
              inputMode="numeric"
              value={amounts[c] ?? ''}
              onChange={(e) => setAmounts({ ...amounts, [c]: e.target.value })}
              placeholder="0"
            />
          </label>
        ))}
      </div>
      {short.length > 0 && <p className={styles.short}>Not enough {short.join(', ')}. Convert coins first (in the builder or with Gain).</p>}
      <label className={styles.field}>
        <span className={styles.label}>For what (optional)</span>
        <input className={styles.input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={mode === 'spend' ? 'e.g. Inn and stabling' : 'e.g. Goblin loot'} autoComplete="off" />
      </label>
      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={() => close(null)}>Cancel</button>
        <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={!ok}>{mode === 'spend' ? 'Spend' : 'Gain'}</button>
      </div>
    </form>
  );
}
