// =============================================================================
// Coin: o disco de uma moeda
// =============================================================================
// O QUE FAZ
//   O desenho da moeda (pp, gp, ep, sp, cp), em CSS, para a faixa do inventário e a
//   janela das moedas. Decorativo: o nome fica no texto ao lado.
//
// FUNÇÕES
//   Coin({ denom, size }): a moeda; `size="lg"` é a da janela.
//
// DECISÕES E ARMADILHAS
//   - Veio do antigo CurrencyCard (as cinco caixas no topo do inventário, que a faixa
//     substituiu, DDL-0321).
// -----------------------------------------------------------------------------

import styles from './Coin.module.css';

/** O disco de uma moeda. */
export default function Coin({ denom, size }) {
  return <span className={[styles.coin, styles[denom], size === 'lg' ? styles.lg : null].filter(Boolean).join(' ')} aria-hidden="true" />;
}
