// =============================================================================
// ItemPickerModal: escolher várias entradas de inventário de uma vez
// =============================================================================
// O QUE FAZ
//   Serve os dois lados do contêiner: guardar itens soltos e tirar os de dentro. É
//   a mesma lista nos dois casos. De propósito simples: sem busca, agrupamento ou
//   ordenação configurável (alfabética); quem quer o catálogo usa a loja.
//
// FUNÇÕES
//   ItemPickerModal(props): a janela.
//
// DECISÕES E ARMADILHAS
//   - É a janela comum (PreviewLayer, DDL-0313, P10 do docs/UI-STUDY.md): antes tinha véu,
//     cartão, cabeçalho e rodapé próprios. Abre POR CIMA do detalhe do contêiner, que fica
//     visível embaixo, por isso o `z` um degrau acima da camada padrão.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { nameOf, metaParts, cap, RARITY_COLOR, GROUP_ICONS, thumbOf } from './inventoryDisplay';
import styles from './InventoryTab.module.css';
import Icon from '../common/Icon';
import Thumb from '../common/Thumb';
import Tag from '../common/Tag';
import Button from '../common/Button';
import PreviewLayer from '../common/PreviewLayer';

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
    <PreviewLayer
      onClose={onClose}
      title={title}
      z={120}
      maxWidth={520}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={picked.size === 0} onClick={() => onConfirm([...picked])}>
            {confirmLabel}{picked.size > 0 ? ` (${picked.size})` : ''}
          </Button>
        </>
      }
    >
      {sorted.length === 0 ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <>
          <Button size="sm" className={styles.pickerAll} onClick={() => setPicked(allPicked ? new Set() : new Set(sorted.map((e) => e.uid)))}>
            {allPicked ? 'Clear selection' : 'Select all'}
          </Button>
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
                      {on ? <Icon name="check" /> : null}
                    </span>
                    <Thumb src={thumb} icon={GROUP_ICONS[entry.group] ?? GROUP_ICONS.other} width={36} className={styles.thumb} />
                    <span className={styles.rowText}>
                      <span className={styles.rowName}>
                        {nameOf(entry)}
                        {entry.quantity > 1 && <span className={styles.pickerQty}> ×{entry.quantity}</span>}
                      </span>
                      <span className={styles.rowSub}>
                        {meta.length > 0 && <span className={styles.rowMetaLine}>{meta.join(' • ')}</span>}
                        {rarity && <Tag color={color}>{cap(rarity)}</Tag>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </PreviewLayer>
  );
}
