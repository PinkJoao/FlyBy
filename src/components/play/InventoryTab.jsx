// =============================================================================
// InventoryTab: o inventário do play mode, no desenho da aba da ficha
// =============================================================================
// O QUE FAZ
//   A aba "Inventory" do play mode (docs/PLAY-MODE-V2-PLAN.md §6, DDL-0150): a
//   busca, o filtro por grupo (o ListControls da ficha, ao lado dela) e as seções por tipo, com a linha ItemRow da ficha só para USAR: o
//   consumível (poção, pergaminho, comida) tem "Use", o item com cargas mostra o que
//   sobra e o "Use" gasta uma, e a arma tem "Attack" (DDL-0165), o mesmo ataque da
//   aba Actions. Tocar na linha abre o detalhe do item.
//
// FUNÇÕES
//   InventoryTab(props): a aba.
//
// DECISÕES E ARMADILHAS
//   - A prévia do item (o "i") traz o mesmo Use ou Attack da linha no rodapé (DDL-0251).
//   - O ataque da linha é o da arma pelo `uid`, nunca a variante do Cleave (mesmo uid): o Attack do Greataxe
//     abria o "Greataxe (Cleave)", sem o modificador (TC-0173, DDL-0249).
//   - A arma de pacto vinculada (`state.pactWeapon`) aparece com "(pact weapon)" no nome (DDL-0240); a
//     conjurada já entra no inventário com esse nome.
//   - Sem loja, sem quantidade, sem equipar, sem guardar em contêiner (definições do
//     dono, DDL-0146 e P6): isso é da ficha. As moedas também saíram (DDL-0160): no
//     jogo quase não servem, e a ficha as edita. A quantidade aparece só lida ("x3"); o
//     gasto é o uso (a poção bebida, a flecha do ataque, a carga da varinha). As
//     cargas tocadas abrem o ajuste à mão (o que o mestre tira ou dá, DDL-0202).
//   - Mostra TUDO, solto ou guardado, numa lista só: no jogo o que importa é achar o
//     item, não onde ele está (a ficha mostra os contêineres).
//   - O que está equipado ou atunado aparece destacado, como na ficha (rowActive).
// -----------------------------------------------------------------------------

import ListControls from '../common/ListControls';
import SearchField from '../common/SearchField';
import { useState } from 'react';
import { GROUP_ORDER } from '../../engine/items';
import { isUsable } from '../../engine/playInventory';
import { remainingOf } from '../../engine/playState';
import itemEntity from '../../selector/entities/item';
import { showDetailPopup } from '../common/detailPopup';
import Collapse from '../common/Collapse';
import Icon from '../common/Icon';
import { nameOf, thumbOf } from '../builder/inventoryDisplay';
import { ItemRow } from '../builder/InventoryTab';
import styles from '../builder/InventoryTab.module.css';
import { TUT } from '../../tutorial/anchors';

/**
 * A aba de inventário do jogo.
 * @param {{ catalog: object, state: object, inventory: object[], db: object, onUse: Function, onCharge: Function, onAttack: Function, onResource?: Function }} props
 */
export default function InventoryTab({ catalog, state, inventory, db, onUse, onCharge, onAttack, onResource }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const items = (inventory ?? []).filter((e) => e && (e.raw || e.isCustom));
  const charges = new Map((catalog.resources ?? []).filter((r) => r.kind === 'charges').map((r) => [r.uid, r]));
  const attacks = new Map((catalog.attacks ?? []).filter((a) => a.kind === 'weapon' && a.uid && !a.cleave).map((a) => [a.uid, a]));
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

  const row = (raw) => {
    const pact = state?.pactWeapon?.uid === raw.uid && !/[(]pact weapon[)]$/.test(nameOf(raw));
    const entry = pact ? { ...raw, customName: nameOf(raw) + ' (pact weapon)' } : raw;
    const charge = charges.get(entry.uid);
    const attack = attacks.get(entry.uid);
    const use = isUsable(entry.raw) ? () => onUse(entry) : charge ? () => onCharge(charge) : attack ? () => onAttack(attack) : undefined;
    const useLabel = !isUsable(entry.raw) && !charge && attack ? 'Attack' : 'Use';
    return (
      <ItemRow
        key={entry.uid ?? nameOf(entry)}
        entry={entry}
        thumb={thumbOf(entry, db)}
        readOnly
        onInfo={() => entry.raw && showDetailPopup({ entity: itemEntity, raw: entry.raw, db, actions: use ? [{ label: useLabel, value: 'use', tone: 'primary' }] : [] }).then((v) => v === 'use' && use())}
        onUse={use}
        useLabel={useLabel}
        usesLeft={charge ? `${remainingOf(state, charge.key, charge.max)}/${charge.max}` : null}
        onUsesLeft={charge && onResource ? () => onResource(charge) : undefined}
      />
    );
  };

  return (
    <div className={styles.tab}>
      <div className={styles.controls}>
        <SearchField placeholder="Search inventory…" value={query} onChange={setQuery} />
        <ListControls
          dataTour={TUT.PLAY_INV_GROUPS}
          filterOptions={[{ value: 'all', label: 'All Items' }, ...presentGroups.map((g) => ({ value: g.key, label: g.label }))]}
          filter={group}
          onFilter={setGroup}
        />
      </div>

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
