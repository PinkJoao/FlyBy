// =============================================================================
// EquipmentShop - comprar itens do compêndio, com CARRINHO (Fase B1)
// =============================================================================
// Abre o SelectorPanel DIRETO (não via PickerField - PickerField fecha ao
// selecionar; aqui queremos continuar comprando). A UI de compra vive nas props
// opcionais do SelectorPanel:
//   • renderCardActions(raw) → SÓ o stepper de quantidade do card (default 0).
//     Aumentar adiciona ao carrinho; zerar remove do carrinho.
//   • renderFooter(raw)      → rodapé do preview: "Buy" compra 1 unidade DIRETO
//     (ignora o carrinho) e fecha o painel.
//   • renderBottomBar({setPreview}) → barra inferior com o total do carrinho +
//     Checkout; ao tocar, sobe uma gaveta com a lista (ajustar/remover qty,
//     tocar p/ ver o preview, esvaziar, e Buy que compra tudo).
//
// Comprar aplica inventário + moeda num ÚNICO save() (via `onPurchase`) - dois
// setters separados sobre o MESMO `character` da closure se pisariam (cada
// save() substitui o registro inteiro). `onPurchase(items[], currency)` também
// faz MERGE de stacks no Builder.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import SelectorPanel from '../../selector/SelectorPanel';
import Stepper from '../common/Stepper';
import itemEntity from '../../selector/entities/item';
import { createInventoryItem } from '../../schema/character';
import { toCopper, toGp, fromCopper } from '../../engine/currency';
import { itemValue } from '../../engine/magicItemPrice';
import { confirm } from '../common/dialog';
import styles from './EquipmentShop.module.css';

const idOf = (raw) => `${raw.name}|${raw.source}`;

// Estilo base dos steppers da loja: fundo --bg-soft e número largo o bastante
// para 3 dígitos. Cada uso adiciona o que precisa (largura total no card, mais
// alto no preview).
const SHOP_STEPPER = { bg: 'var(--bg-soft)', numberWidth: '3ch' };

/** Texto em gp de um valor em cobre (ex: 1500 → "15 gp"). */
function gpText(copper) {
  return `${(copper / 100).toLocaleString()} gp`;
}

export default function EquipmentShop({ character, db, onPurchase }) {
  // Valor em cobre: preço listado OU derivado (crafting) de item mágico.
  const valueOf = (raw) => itemValue(raw, db);
  // Custo total em cobre de `qty` unidades (0 se sem preço nem derivação).
  const costCopper = (raw, qty) => (valueOf(raw) ?? 0) * qty;
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState({}); // id → { raw, qty } (qty sempre > 0)
  const [cartOpen, setCartOpen] = useState(false);

  const cartQty = (raw) => cart[idOf(raw)]?.qty ?? 0;
  const setCartQty = (raw, n) => {
    const qty = Math.max(0, Math.floor(n) || 0);
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[idOf(raw)];
      else next[idOf(raw)] = { raw, qty };
      return next;
    });
  };

  const cartEntries = () => Object.values(cart);
  const cartUnits = cartEntries().reduce((n, e) => n + e.qty, 0);
  const cartTotalCopper = cartEntries().reduce((n, e) => n + costCopper(e.raw, e.qty), 0);

  const emptyCart = () => {
    setCart({});
    setCartOpen(false);
  };

  // Aplica uma lista de {raw, qty} → inventário + moeda; confirma se faltar $$.
  const purchase = async (entries, verb) => {
    const cost = entries.reduce((n, e) => n + costCopper(e.raw, e.qty), 0);
    const balance = toCopper(character.currency);
    const unpriced = entries.filter((e) => valueOf(e.raw) == null);
    if (unpriced.length) {
      const ok = await confirm({
        title: 'No listed price',
        message: `${unpriced.map((e) => e.raw.name).join(', ')} ${unpriced.length > 1 ? 'have' : 'has'} no listed price. Add anyway?`,
        confirmLabel: 'Add anyway',
      });
      if (!ok) return false;
    }
    if (cost > balance) {
      const ok = await confirm({
        title: 'Not enough gold',
        message: `${verb} costs ${gpText(cost)}. Your character only has ${toGp(character.currency).toLocaleString()} gp. ${verb} anyway?`,
        confirmLabel: 'Buy anyway',
      });
      if (!ok) return false;
    }
    const items = entries.map((e) => ({ ...createInventoryItem(e.raw.name, e.raw.source), quantity: e.qty }));
    onPurchase(items, fromCopper(Math.max(0, balance - cost)));
    return true;
  };

  // Preview "Buy now": compra a quantidade do CONTADOR (linkado ao carrinho;
  // mínimo 1), tira o item do carrinho (foi comprado direto) e fecha o painel.
  const buyNow = async (raw) => {
    const qty = Math.max(1, cartQty(raw));
    if (await purchase([{ raw, qty }], `${qty}× ${raw.name}`)) {
      setCartQty(raw, 0);
      setOpen(false);
      setCartOpen(false);
    }
  };

  // Checkout: compra tudo do carrinho, esvazia e fecha.
  const checkout = async () => {
    const entries = cartEntries();
    if (!entries.length) return;
    if (await purchase(entries, 'Your cart')) {
      setCart({});
      setCartOpen(false);
      setOpen(false);
    }
  };

  // Rodapé do preview: contador (linkado ao carrinho) + total + Buy now (compra
  // essa quantidade direto e fecha). O contador deixa comprar qualquer qtd.
  const renderFooter = (raw) => {
    const qty = cartQty(raw);
    const buyQty = Math.max(1, qty);
    return (
      <div className={styles.buyBar}>
        <Stepper
          value={qty}
          min={0}
          maxDigits={4}
          onChange={(n) => setCartQty(raw, n)}
          ariaLabel={`Quantity of ${raw.name}`}
          {...SHOP_STEPPER}
          buttonSize={34}
          fontSize={16}
        />
        <div className={styles.buyTotal}>
          <span className={styles.buyTotalLabel}>Total</span>
          <span className={styles.buyTotalValue}>
            {valueOf(raw) != null ? gpText(costCopper(raw, buyQty)) : '-'}
          </span>
        </div>
        <button type="button" className={styles.buyBtn} onClick={() => buyNow(raw)}>
          Buy
        </button>
      </div>
    );
  };

  // Card: SÓ o stepper (default 0), centralizado no card com fundo --bg (contrasta
  // com o card --bg-soft). Mexer aqui mexe direto no carrinho.
  const renderCardActions = (raw) => (
    <div className={styles.cardBuy}>
      <Stepper
        value={cartQty(raw)}
        min={0}
        maxDigits={4}
        onChange={(n) => setCartQty(raw, n)}
        ariaLabel={`Quantity of ${raw.name}`}
        bg="var(--bg)"
        numberWidth="3ch"
      />
    </div>
  );

  // Barra inferior + gaveta do carrinho. `setPreview` abre o preview de um item.
  const renderBottomBar = ({ setPreview }) => {
    if (cartUnits === 0) return null;
    return (
      <div className={styles.cartWrap}>
        {cartOpen && (
          <>
            <div className={styles.cartBackdrop} onClick={() => setCartOpen(false)} />
            <div className={styles.cartSheet} role="dialog" aria-label="Shopping cart">
              <div className={styles.cartSheetHead}>
                <span className={styles.cartSheetTitle}>Cart</span>
                <button type="button" className={styles.cartClear} onClick={emptyCart}>
                  Empty cart
                </button>
              </div>
              <ul className={styles.cartList}>
                {cartEntries().map(({ raw, qty }) => (
                  <li key={idOf(raw)} className={styles.cartRow}>
                    <button
                      type="button"
                      className={styles.cartRowInfo}
                      onClick={() => { setPreview(raw); setCartOpen(false); }}
                      title={`Preview ${raw.name}`}
                    >
                      <span className={styles.cartRowName}>{raw.name}</span>
                      <span className={styles.cartRowPrice}>
                        {valueOf(raw) != null ? `${gpText(valueOf(raw))} each` : 'no price'}
                      </span>
                    </button>
                    <Stepper value={qty} min={0} maxDigits={4} onChange={(n) => setCartQty(raw, n)} ariaLabel={`Quantity of ${raw.name}`} {...SHOP_STEPPER} />
                    <span className={styles.cartRowLine}>
                      {valueOf(raw) != null ? gpText(costCopper(raw, qty)) : '-'}
                    </span>
                  </li>
                ))}
              </ul>
              <div className={styles.cartSheetFoot}>
                <div className={styles.buyTotal}>
                  <span className={styles.buyTotalLabel}>Total</span>
                  <span className={styles.buyTotalValue}>{gpText(cartTotalCopper)}</span>
                </div>
                <button type="button" className={styles.buyBtn} onClick={checkout}>
                  Buy {cartUnits} item{cartUnits > 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </>
        )}
        <button
          type="button"
          className={styles.cartBar}
          onClick={() => setCartOpen((o) => !o)}
          aria-expanded={cartOpen}
        >
          <span className={styles.cartBarIcon} aria-hidden="true">🛒</span>
          <span className={styles.cartBarCount}>
            {cartUnits} item{cartUnits > 1 ? 's' : ''}
          </span>
          <span className={styles.cartBarTotal}>{gpText(cartTotalCopper)}</span>
          <span className={styles.cartBarCta}>
            Checkout <span className={cartOpen ? `${styles.cartChevron} ${styles.cartChevronUp}` : styles.cartChevron} aria-hidden="true">▴</span>
          </span>
        </button>
      </div>
    );
  };

  return (
    <>
      <button type="button" className={styles.shopBtn} onClick={() => setOpen(true)}>
        <span aria-hidden="true">🛒</span> Shop
      </button>
      {open && (
        <SelectorPanel
          entity={itemEntity}
          db={db}
          currentId={null}
          onClose={() => setOpen(false)}
          renderFooter={renderFooter}
          renderCardActions={renderCardActions}
          renderBottomBar={renderBottomBar}
        />
      )}
    </>
  );
}
