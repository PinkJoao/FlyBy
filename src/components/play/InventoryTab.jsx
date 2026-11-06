// =============================================================================
// InventoryTab: o inventário do play mode, no desenho da aba da ficha
// =============================================================================
// O QUE FAZ
//   A aba "Inventory" do play mode (docs/PLAY-MODE-V2-PLAN.md §6, DDL-0150): as
//   moedas com o botão de gastar ou ganhar, a busca, as sub-abas por grupo (as da
//   ficha) e as seções por tipo, com a linha ItemRow da ficha só para USAR: o
//   consumível (poção, pergaminho, comida) tem "Use", o item com cargas mostra o que
//   sobra e o "Use" gasta uma. Tocar na linha abre o detalhe do item.
//
// FUNÇÕES
//   InventoryTab(props): a aba.
//
// DECISÕES E ARMADILHAS
//   - Sem loja, sem quantidade, sem equipar, sem guardar em contêiner (definições do
//     dono, DDL-0146 e P6): isso é da ficha. A quantidade aparece só lida ("x3"); o
//     gasto é o uso (a poção bebida, a flecha do ataque, a carga da varinha).
//   - Mostra TUDO, solto ou guardado, numa lista só: no jogo o que importa é achar o
//     item, não onde ele está (a ficha mostra os contêineres).
//   - O que está equipado ou atunado aparece destacado, como na ficha (rowActive).
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { GROUP_ORDER } from '../../engine/items';
import { isUsable } from '../../engine/playInventory';
import { remainingOf } from '../../engine/playState';
import itemEntity from '../../selector/entities/item';
import { showDetailPopup } from '../common/detailPopup';
import Collapse from '../common/Collapse';
import Icon from '../common/Icon';
import { GROUP_ICONS, nameOf, thumbOf } from '../builder/inventoryDisplay';
import { ItemRow } from '../builder/InventoryTab';
import styles from '../builder/InventoryTab.module.css';
import play from './PlayTabs.module.css';

const COINS = ['pp', 'gp', 'ep', 'sp', 'cp'];

/**
 * A aba de inventário do jogo.
 * @param {{ catalog: object, state: object, character: object, inventory: object[], db: object, onUse: Function, onCharge: Function, onMoney: Function }} props
 */
export default function InventoryTab({ catalog, state, character, inventory, db, onUse, onCharge, onMoney }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const items = (inventory ?? []).filter((e) => e && (e.raw || e.isCustom));
  const charges = new Map((catalog.resources ?? []).filter((r) => r.kind === 'charges').map((r) => [r.uid, r]));
  const coins = character.currency ?? {};
  const presentGroups = GROUP_ORDER.map((g) => ({ key: g, label: items.find((e) => e.group === g)?.groupLabel })).filter((g) => g.label);
  const needle = query.trim().toLowerCase();
  const shown = items
    .filter((e) => group === 'all' || e.group === group)
    .filter((e) => !needle || nameOf(e).toLowerCase().includes(needle))
    .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || nameOf(a).localeCompare(nameOf(b)));
  const sections = group === 'all' ? presentGroups.map((g) => [g.label, shown.filter((e) => e.group === g.key)]).filter(([, l]) => l.length) : [[null, shown]];
  const toggle = (label) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const row = (entry) => {
    const charge = charges.get(entry.uid);
    return (
      <ItemRow
        key={entry.uid ?? nameOf(entry)}
        entry={entry}
        thumb={thumbOf(entry, db)}
        readOnly
        onInfo={() => entry.raw && showDetailPopup({ entity: itemEntity, raw: entry.raw, db })}
        onUse={isUsable(entry.raw) ? () => onUse(entry) : charge ? () => onCharge(charge) : undefined}
        usesLeft={charge ? `${remainingOf(state, charge.key, charge.max)}/${charge.max}` : null}
      />
    );
  };

  return (
    <div className={styles.tab}>
      <div className={play.row}>
        <span className={play.coins}>
          {COINS.map((c) => (
            <span key={c} className={play.coin}>
              <span className={play.coinValue}>{coins[c] ?? 0}</span>
              <span className={play.coinName}>{c}</span>
            </span>
          ))}
        </span>
        <button type="button" className={play.useBtn} onClick={onMoney}>
          Spend or gain
        </button>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <input type="search" className={styles.search} placeholder="Search inventory…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <nav className={styles.subTabs} data-wheel-x="">
        <button type="button" className={group === 'all' ? `${styles.subTab} ${styles.subTabActive}` : styles.subTab} onClick={() => setGroup('all')}>
          <span className={styles.subTabIcon} aria-hidden="true">
            <Icon name={GROUP_ICONS.all} />
          </span>
          All Items
        </button>
        {presentGroups.map((g) => (
          <button key={g.key} type="button" className={group === g.key ? `${styles.subTab} ${styles.subTabActive}` : styles.subTab} onClick={() => setGroup(g.key)}>
            <span className={styles.subTabIcon} aria-hidden="true">
              <Icon name={GROUP_ICONS[g.key] ?? GROUP_ICONS.other} />
            </span>
            {g.label}
          </button>
        ))}
      </nav>

      {items.length === 0 && <p className={styles.empty}>No items.</p>}
      {items.length > 0 && shown.length === 0 && <p className={styles.empty}>No items match your search.</p>}

      {sections.map(([label, list]) => {
        const isCollapsed = label != null && collapsed.has(label);
        return (
          <section key={label ?? 'flat'} className={styles.panel}>
            {label && (
              <button type="button" className={styles.panelHead} onClick={() => toggle(label)} aria-expanded={!isCollapsed}>
                <span className={styles.panelTitle}>{label}</span>
                <span className={styles.panelCount}>{list.length}</span>
                <span className={isCollapsed ? `${styles.panelChevron} ${styles.panelChevronClosed}` : styles.panelChevron} aria-hidden="true">
                  <Icon name="chevron" />
                </span>
              </button>
            )}
            <Collapse open={!isCollapsed}>
              <ul className={styles.list}>{list.map(row)}</ul>
            </Collapse>
          </section>
        );
      })}
    </div>
  );
}
