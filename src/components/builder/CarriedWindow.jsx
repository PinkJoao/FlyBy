// =============================================================================
// CarriedWindow: a janela da carga
// =============================================================================
// O QUE FAZ
//   Aberta pelo Carried da faixa do inventário (DDL-0321): de onde vem o limite (Força
//   vezes 15), o que acontece além dele e o que mais pesa. Tocar num item abre o detalhe.
//
// FUNÇÕES
//   CarriedWindow(props): a janela. `encumbrance`, `strength`, `entries`, `db`,
//     `onInfo(entry)`, `onClose`.
//
// DECISÕES E ARMADILHAS
//   - Só entra na lista o que conta no peso (o guardado numa Bag of Holding não conta).
//   - As moedas não pesam no app, e a janela não diz que pesam.
// -----------------------------------------------------------------------------

import PreviewLayer from '../common/PreviewLayer';
import Button from '../common/Button';
import { ruleOpener } from '../common/ruleNamed';
import PartsRow from './PartsRow';
import { nameOf } from './inventoryDisplay';
import styles from './StripWindows.module.css';

const TOP = 5;

/** A janela da carga. */
export default function CarriedWindow({ encumbrance, strength, entries, db, onInfo, onClose }) {
  const { totalWeight, capacity, encumbered } = encumbrance;
  const heavy = entries.filter((e) => e.weightCounts && e.lineWeight > 0).sort((a, b) => b.lineWeight - a.lineWeight).slice(0, TOP);
  const openRule = ruleOpener(db, 'Carrying Capacity');
  return (
    <PreviewLayer onClose={onClose} title="Carried weight" maxWidth={440}>
      <div className={styles.body}>
        <PartsRow
          parts={[{ key: 'str', value: strength, label: 'Strength' }, { key: 'x', value: '× 15', label: 'Pounds' }]}
          result={{ value: `${capacity} lb`, label: 'Limit' }}
        />
        <p className={styles.note}>
          You carry <b className={encumbered ? styles.over : undefined}>{Math.round(totalWeight * 100) / 100} lb</b>. The limit is
          the most you can carry; you can drag or push up to {capacity * 2} lb, at a Speed of 5 feet at most.{' '}
          {openRule && <Button variant="link" onClick={openRule}>Read the rule</Button>}
        </p>
        {heavy.length > 0 && (
          <section className={styles.panel}>
            <h3 className={styles.panelHead}>Heaviest</h3>
            <ul className={styles.rows}>
              {heavy.map((e) => (
                <li key={e.uid} className={styles.item}>
                  <button type="button" className={styles.itemHit} onClick={() => onInfo(e)} title={`About ${nameOf(e)}`}>
                    <span className={styles.rowName}>{nameOf(e)}{e.quantity > 1 ? ` ×${e.quantity}` : ''}</span>
                  </button>
                  <span className={styles.rowNote}>{e.lineWeight} lb</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PreviewLayer>
  );
}
