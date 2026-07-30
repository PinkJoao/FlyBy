// =============================================================================
// ItemPickerModal - escolher VÁRIAS entradas de inventário de uma vez
// =============================================================================
// Serve os dois lados do contêiner: guardar itens que já estão no inventário, e
// tirar itens de dentro dele. É a mesma lista dos dois lados (o que muda é de
// onde vêm as entradas e o rótulo do botão), então um componente só.
//
// Deliberadamente simples, como o painel de contêiner: sem busca, sem
// agrupamento, sem ordenação configurável (alfabética e pronto). Quem precisa do
// catálogo inteiro usa a loja.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { nameOf, metaParts, cap, RARITY_COLOR, GROUP_ICONS, thumbOf } from './inventoryDisplay';
import styles from './InventoryTab.module.css';

export default function ItemPickerModal({ title, entries, confirmLabel, emptyText, db, onConfirm, onClose }) {
  const [picked, setPicked] = useState(() => new Set());

  const toggle = (uid) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  const sorted = [...entries].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const allPicked = sorted.length > 0 && picked.size === sorted.length;

  return (
    <div className={styles.pickerOverlay} onClick={onClose}>
      <div className={styles.pickerPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.pickerHead}>
          <h3 className={styles.pickerTitle}>{title}</h3>
          <button type="button" className={styles.infoClose} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className={styles.empty}>{emptyText}</p>
        ) : (
          <>
            <button
              type="button"
              className={styles.pickerAll}
              onClick={() => setPicked(allPicked ? new Set() : new Set(sorted.map((e) => e.uid)))}
            >
              {allPicked ? 'Clear selection' : 'Select all'}
            </button>
            <ul className={styles.pickerList}>
              {sorted.map((entry) => {
                const on = picked.has(entry.uid);
                const meta = metaParts(entry);
                const rarity = entry.rarity ?? null;
                const color = rarity ? RARITY_COLOR[rarity] : null;
                const thumb = thumbOf(entry, db);
                return (
                  <li key={entry.uid}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      className={on ? `${styles.pickerRow} ${styles.pickerRowOn}` : styles.pickerRow}
                      onClick={() => toggle(entry.uid)}
                    >
                      <span className={on ? `${styles.pickerBox} ${styles.pickerBoxOn}` : styles.pickerBox} aria-hidden="true">
                        {on ? '✓' : ''}
                      </span>
                      {thumb ? (
                        <img className={styles.thumb} src={thumb} alt="" loading="lazy" />
                      ) : (
                        <span className={styles.thumbGlyph} aria-hidden="true">
                          {GROUP_ICONS[entry.group] ?? GROUP_ICONS.other}
                        </span>
                      )}
                      <span className={styles.rowText}>
                        <span className={styles.rowName}>
                          {nameOf(entry)}
                          {entry.quantity > 1 && <span className={styles.pickerQty}> ×{entry.quantity}</span>}
                        </span>
                        <span className={styles.rowSub}>
                          {meta.length > 0 && <span className={styles.rowMetaLine}>{meta.join(' • ')}</span>}
                          {rarity && (
                            <span
                              className={styles.rowRarity}
                              style={color ? { color, borderColor: color } : undefined}
                            >
                              {cap(rarity)}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className={styles.pickerActions}>
          <button type="button" className={styles.pickerCancel} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.pickerConfirm}
            disabled={picked.size === 0}
            onClick={() => onConfirm([...picked])}
          >
            {confirmLabel}{picked.size > 0 ? ` (${picked.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
