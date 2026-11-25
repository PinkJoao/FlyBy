// =============================================================================
// CurrencyCard: as 5 moedas do personagem (Fase B1)
// =============================================================================
// O QUE FAZ
//   Cinco CAIXAS DE INPUT (pp a cp), com ícone, sigla e campo com cara de editável
//   (pedido do usuário). Uma linha; em container estreito, 3 + 2 (container query).
//   O nome completo fica no title de cada moeda, e o total em ouro no do card.
//
// FUNÇÕES
//   CurrencyCard(props): o card.
// -----------------------------------------------------------------------------

import { DENOMINATIONS, toGp } from '../../engine/currency';
import styles from './CurrencyCard.module.css';

const LABEL = { pp: 'Platinum', gp: 'Gold', ep: 'Electrum', sp: 'Silver', cp: 'Copper' };

export default function CurrencyCard({ currency, onChange }) {
  const set = (denom, value) => onChange({ ...currency, [denom]: Math.max(0, value) });

  return (
    <div className={styles.card} title={`≈ ${toGp(currency).toLocaleString()} gp total`}>
      <div className={styles.coins}>
        {DENOMINATIONS.map((d) => (
          <label key={d} className={styles.coin} title={LABEL[d]}>
            <span className={`${styles.coinIcon} ${styles[`coin_${d}`]}`} aria-hidden="true" />
            <span className={styles.coinLabel} aria-hidden="true">{d}</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              className={styles.value}
              aria-label={LABEL[d]}
              value={currency[d] ?? 0}
              onChange={(e) => set(d, Number(e.target.value) || 0)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
