// =============================================================================
// CurrencyCard - as 5 moedas do personagem (Fase B1, estágio 3)
// =============================================================================
// Grade de 5 CAIXAS DE INPUT (uma por moeda, em ordem de valor pp→cp): ícone
// colorido + sigla + campo numérico com cara de input (caixa com borda), pra
// deixar claro que os valores são editáveis (pedido do usuário). Uma única
// linha; em container estreito quebra em 2 linhas (3+2) via container query.
// O nome completo fica no title/aria-label de cada moeda e o total em ouro
// equivalente no title do card.
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
