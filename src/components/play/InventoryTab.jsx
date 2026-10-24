// =============================================================================
// InventoryTab: o inventário e o dinheiro do play mode
// =============================================================================
// O QUE FAZ
//   A aba "Inventory" da tela do play mode (fase C6): as moedas com o botão de
//   gastar ou ganhar, os consumíveis (poção, pergaminho, comida) com Use e a
//   quantidade, a munição, as cargas dos itens mágicos e o resto do equipamento
//   com a quantidade. Tudo muda o inventário DO PERSONAGEM por eventos que se
//   desfazem (engine/playInventory, DDL-0108).
//
// FUNÇÕES
//   nameOf(entry): o nome de uma entrada do inventário (item, custom ou id).
//   ItemRow(props): uma linha com o nome, a quantidade com os botões de menos e mais e, se houver, Use.
//   InventoryTab(props): a aba.
//
// DECISÕES E ARMADILHAS
//   - Os botões de menos e mais da quantidade são eventos (aparecem no histórico e se desfazem);
//     chegar a zero tira o item da ficha, e desfazer o devolve no mesmo lugar.
//   - Cargas usam o mesmo ajuste dos pools (onAdjust com a chave `charges:<uid>`):
//     o de menos gasta uma carga, o de mais devolve.
//   - COINS dá a ordem das moedas, da mais valiosa para a menor.
//   - Equipar e mudar de contêiner ficam no builder ("Edit sheet"): o play mode só
//     gasta e ganha.
// -----------------------------------------------------------------------------

import { remainingOf } from '../../engine/playState';
import { recoveryText } from '../../engine/playCatalog';
import { isUsable, typeCode, healOf } from '../../engine/playInventory';
import { Pips } from './FeaturesTab';
import styles from './PlayTabs.module.css';

const COINS = ['pp', 'gp', 'ep', 'sp', 'cp'];

/** O nome de uma entrada do inventário. */
const nameOf = (e) => e.raw?.name ?? e.custom?.name ?? e.itemId;

/** Uma linha de item: nome, quantidade com menos e mais, e Use quando se gasta. */
function ItemRow({ entry, sub, onQuantity, onUse }) {
  const qty = entry.quantity ?? 1;
  return (
    <li className={styles.row}>
      <span className={styles.rowMain}>
        <span className={styles.name}>{nameOf(entry)}</span>
        {sub && <span className={styles.sub}>{sub}</span>}
      </span>
      <span className={styles.count}>x{qty}</span>
      <span className={styles.adjust}>
        <button type="button" className={styles.smallBtn} onClick={() => onQuantity(entry, -1)} aria-label={`One less ${nameOf(entry)}`}>-</button>
        <button type="button" className={styles.smallBtn} onClick={() => onQuantity(entry, 1)} aria-label={`One more ${nameOf(entry)}`}>+</button>
      </span>
      {onUse && <button type="button" className={styles.useBtn} onClick={() => onUse(entry)}>Use</button>}
    </li>
  );
}

/**
 * A aba de inventário.
 * @param {{ catalog: object, state: object, character: object, inventory: object[], onUse: Function, onQuantity: Function, onAdjust: Function, onMoney: Function }} props
 */
export default function InventoryTab({ catalog, state, character, inventory, onUse, onQuantity, onAdjust, onMoney }) {
  const items = inventory ?? [];
  const consumables = items.filter((e) => isUsable(e.raw));
  const ammo = items.filter((e) => ['A', 'AF'].includes(typeCode(e.raw)));
  const charges = (catalog.resources ?? []).filter((r) => r.kind === 'charges');
  const chargeUids = new Set(charges.map((r) => r.uid));
  const shown = new Set([...consumables, ...ammo].map((e) => e.uid));
  const other = items.filter((e) => !shown.has(e.uid) && !chargeUids.has(e.uid));
  const coins = character.currency ?? {};

  return (
    <section className={styles.panel}>
      <h2 className={styles.heading}>Money</h2>
      <div className={styles.row}>
        <span className={styles.coins}>
          {COINS.map((c) => (
            <span key={c} className={styles.coin}>
              <span className={styles.coinValue}>{coins[c] ?? 0}</span>
              <span className={styles.coinName}>{c}</span>
            </span>
          ))}
        </span>
        <button type="button" className={styles.useBtn} onClick={onMoney}>Spend or gain</button>
      </div>

      {consumables.length > 0 && (
        <>
          <h2 className={styles.heading}>Consumables</h2>
          <ul className={styles.list}>
            {consumables.map((e) => (
              <ItemRow
                key={e.uid}
                entry={e}
                sub={[healOf(e.raw) ? `Heals ${healOf(e.raw)}` : null, typeCode(e.raw) === 'P' ? 'Bonus action' : typeCode(e.raw) === 'SC' ? 'Action' : null].filter(Boolean).join(' · ')}
                onQuantity={onQuantity}
                onUse={onUse}
              />
            ))}
          </ul>
        </>
      )}

      {ammo.length > 0 && (
        <>
          <h2 className={styles.heading}>Ammunition</h2>
          <ul className={styles.list}>
            {ammo.map((e) => <ItemRow key={e.uid} entry={e} sub="One is spent on each attack with a matching weapon" onQuantity={onQuantity} />)}
          </ul>
        </>
      )}

      {charges.length > 0 && (
        <>
          <h2 className={styles.heading}>Charges</h2>
          <ul className={styles.list}>
            {charges.map((r) => {
              const left = remainingOf(state, r.key, r.max);
              const item = items.find((e) => e.uid === r.uid);
              const label = item ? nameOf(item) : r.name;
              return (
                <li key={r.key} className={styles.row}>
                  <span className={styles.rowMain}>
                    <span className={styles.name}>{label}</span>
                    <span className={styles.sub}>{recoveryText(r.recovery) || 'No automatic recharge'}</span>
                  </span>
                  <Pips left={left} max={r.max} />
                  <span className={styles.adjust}>
                    <button type="button" className={styles.smallBtn} onClick={() => onAdjust(r.key, 1)} disabled={left <= 0} aria-label={`Spend a charge of ${label}`}>-</button>
                    <button type="button" className={styles.smallBtn} onClick={() => onAdjust(r.key, -1)} disabled={left >= r.max} aria-label={`Regain a charge of ${label}`}>+</button>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {other.length > 0 && (
        <>
          <h2 className={styles.heading}>Gear</h2>
          <ul className={styles.list}>
            {other.map((e) => (
              <ItemRow key={e.uid} entry={e} sub={[e.equipped ? 'Equipped' : null, e.attuned ? 'Attuned' : null].filter(Boolean).join(' · ')} onQuantity={onQuantity} />
            ))}
          </ul>
        </>
      )}

      {!items.length && <p className={styles.empty}>No items. Add gear in the builder (Edit sheet).</p>}
    </section>
  );
}
