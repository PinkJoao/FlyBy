// =============================================================================
// ShortRestPanel: o descanso curto, dado de vida a dado de vida
// =============================================================================
// O QUE FAZ
//   O XPHB deixa decidir se gasta OUTRO dado de vida depois de cada rolagem, então
//   o painel rola um dado por toque (com a CON, mínimo 1) e mostra a soma e o HP
//   que vai ficar, antes de terminar o descanso. Cada face tem a sua linha, com
//   os dados que sobram e um campo opcional para o valor de um dado rolado na
//   mesa. "Finish rest" fecha com os dados gastos (`spends`), e o evento do
//   descanso (engine/playRest) grava tudo junto; sem dado gasto, o descanso
//   ainda recupera o que é de descanso curto. Quem o abre é o playDialogs.jsx.
//
// FUNÇÕES
//   ShortRestPanel(props): o conteúdo do diálogo.
//     spend(faces): rola um dado daquela face (o digitado, se houver).
//     undoLast(): devolve o último dado rolado no painel.
//
// DECISÕES E ARMADILHAS
//   - O dado é rolado AQUI e o resultado viaja pronto no `spends`: o evento
//     grava exatamente o que o jogador viu.
//   - Valor digitado fora do dado (um 9 num d8) vira a mensagem do erro do
//     dice.js na própria linha, sem rolar.
//   - Os dados gastos usam o ÍNDICE como key: dois podem ter o mesmo valor.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { rollHitDie, hitDiceLeft } from '../../engine/playRest';
import { sequenceRng } from '../../engine/dice';
import { hpView } from '../../engine/playState';
import { useDialogClose } from '../common/dialogContext';
import styles from './ShortRestPanel.module.css';

/**
 * O conteúdo do diálogo do descanso curto.
 * @param {{ catalog: object, state: object }} props
 */
export default function ShortRestPanel({ catalog, state }) {
  const close = useDialogClose();
  const [spends, setSpends] = useState([]);
  const [typed, setTyped] = useState({});
  const [error, setError] = useState(null);

  const hp = hpView(state, catalog.stats.hpMax);
  const healed = spends.reduce((s, x) => s + x.healed, 0);
  const rows = hitDiceLeft(catalog, state).map((r) => ({ ...r, left: r.left - spends.filter((s) => s.faces === r.faces).length }));

  /** Rola um dado daquela face; usa o valor digitado, se houver. */
  const spend = (faces) => {
    const value = String(typed[faces] ?? '').trim();
    try {
      const rng = value ? sequenceRng([Number(value)], () => NaN) : undefined;
      setSpends([...spends, rollHitDie({ catalog, faces, rng })]);
      setTyped({ ...typed, [faces]: '' });
      setError(null);
    } catch (e) {
      setError({ faces, message: String(e?.message ?? e) });
    }
  };

  /** Devolve o último dado rolado no painel. */
  const undoLast = () => setSpends(spends.slice(0, -1));

  return (
    <div className={styles.panel}>
      <p className={styles.now}>
        {hp.current} / {hp.max} HP
        {healed > 0 && <> {'->'} <strong>{Math.min(hp.max, hp.current + healed)}</strong></>}
      </p>
      {hp.current === 0 && <p className={styles.warn}>The rules need at least 1 HP to start a Short Rest.</p>}

      <ul className={styles.rows}>
        {rows.map((r) => (
          <li key={r.key} className={styles.row}>
            <span className={styles.die}>d{r.faces}</span>
            <span className={styles.left}>{r.left} of {r.max} left</span>
            <input
              className={styles.typed}
              value={typed[r.faces] ?? ''}
              onChange={(e) => setTyped({ ...typed, [r.faces]: e.target.value })}
              inputMode="numeric"
              placeholder="table"
              aria-label={`d${r.faces} rolled at the table (optional)`}
            />
            <button type="button" className={styles.spend} disabled={r.left <= 0} onClick={() => spend(r.faces)}>
              Roll d{r.faces}
            </button>
            {error?.faces === r.faces && <span className={styles.error}>{error.message}</span>}
          </li>
        ))}
      </ul>

      {spends.length > 0 && (
        <div className={styles.rolled}>
          {spends.map((s, i) => (
            <span key={i} className={styles.chip}>d{s.faces}: {s.healed}</span>
          ))}
          <button type="button" className={styles.link} onClick={undoLast}>Undo last</button>
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={() => close(null)}>Cancel</button>
        <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={() => close({ spends })}>
          Finish rest{healed > 0 ? ` (+${healed} HP)` : ''}
        </button>
      </div>
    </div>
  );
}
