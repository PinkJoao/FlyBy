// =============================================================================
// AttunedWindow: a janela dos itens sintonizados
// =============================================================================
// O QUE FAZ
//   Aberta pelo Attuned da faixa do inventário (DDL-0321): uma frase do que é a
//   sintonia, os itens com vínculo (encerrar), os vínculos livres e os itens que
//   esperam um (Attune). Tocar no item abre o detalhe dele por cima.
//
// FUNÇÕES
//   AttunedWindow(props): a janela. `entries`, `max`, `db`, `onToggle(entry)`,
//     `onInfo(entry)`, `onClose`.
//   ItemLine(props): a linha de um item.
//
// DECISÕES E ARMADILHAS
//   - Sintonizar e encerrar passam pelo `toggleAttune` do InventoryTab, que avisa e
//     confirma (pré-requisito, limite): aqui não há regra própria.
//   - Acima do limite a conta acende, e nada some (liberdade com aviso).
// -----------------------------------------------------------------------------

import PreviewLayer from '../common/PreviewLayer';
import Button from '../common/Button';
import Icon from '../common/Icon';
import Tag from '../common/Tag';
import Thumb from '../common/Thumb';
import { ruleOpener } from '../common/ruleNamed';
import { GROUP_ICONS, RARITY_COLOR, cap, nameOf, thumbOf } from './inventoryDisplay';
import styles from './StripWindows.module.css';

/** A linha de um item, com o detalhe ao toque. */
function ItemLine({ entry, db, onInfo, children }) {
  return (
    <li className={styles.item}>
      <button type="button" className={styles.itemHit} onClick={() => onInfo(entry)} title={`About ${nameOf(entry)}`}>
        <Thumb src={thumbOf(entry, db)} icon={GROUP_ICONS[entry.group] ?? GROUP_ICONS.other} width={36} className={styles.thumb} />
        <span className={styles.rowText}>
          <span className={styles.rowName}>{nameOf(entry)}</span>
          {entry.rarity && <span><Tag color={RARITY_COLOR[entry.rarity]}>{cap(entry.rarity)}</Tag></span>}
        </span>
      </button>
      {children}
    </li>
  );
}

/** A janela dos itens sintonizados. */
export default function AttunedWindow({ entries, max, db, onToggle, onInfo, onClose }) {
  const bonded = entries.filter((e) => e.attuned);
  const waiting = entries.filter((e) => e.required && !e.attuned);
  const free = Math.max(0, max - bonded.length);
  const openRule = ruleOpener(db, 'Attunement');
  return (
    <PreviewLayer onClose={onClose} title="Attuned items" maxWidth={440}>
      <div className={styles.body}>
        <p className={styles.note}>
          Some magic items need a bond with you before they work. You can hold <b>{max}</b> bonds at a time, and making one
          takes a Short Rest.{' '}
          {openRule && <Button variant="link" onClick={openRule}>Read the rule</Button>}
        </p>
        <section className={styles.panel}>
          <h3 className={styles.panelHead}>
            Bonded <span className={bonded.length > max ? `${styles.panelCount} ${styles.over}` : styles.panelCount}>{bonded.length}/{max}</span>
          </h3>
          <ul className={styles.rows}>
            {bonded.map((e) => (
              <ItemLine key={e.uid} entry={e} db={db} onInfo={onInfo}>
                <Button icon size="xs" onClick={() => onToggle(e)} title="End the bond" aria-label={`End the bond with ${nameOf(e)}`}>
                  <Icon name="close" />
                </Button>
              </ItemLine>
            ))}
            {Array.from({ length: free }, (_, i) => (
              <li key={`free-${i}`} className={styles.item}>
                <span className={styles.freeSlot} aria-hidden="true" />
                <span className={styles.rowNote}>Free bond</span>
              </li>
            ))}
          </ul>
        </section>
        {waiting.length > 0 && (
          <section className={styles.panel}>
            <h3 className={styles.panelHead}>Waiting for a bond <span className={styles.panelCount}>{waiting.length}</span></h3>
            <ul className={styles.rows}>
              {waiting.map((e) => (
                <ItemLine key={e.uid} entry={e} db={db} onInfo={onInfo}>
                  <Button size="sm" variant="primary" onClick={() => onToggle(e)}>Attune</Button>
                </ItemLine>
              ))}
            </ul>
          </section>
        )}
        {waiting.length === 0 && bonded.length === 0 && <p className={styles.note}>Nothing you carry needs a bond.</p>}
      </div>
    </PreviewLayer>
  );
}
