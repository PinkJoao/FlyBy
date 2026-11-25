// =============================================================================
// Pips: o contador de um recurso em marcadores (bolinhas ou gemas)
// =============================================================================
// O QUE FAZ
//   O que sobra de um recurso, desenhado: bolinhas (até 12) ou o número; `shape="gem"`
//   desenha gemas, os espaços de magia no jogo e no grimório (DDL-0201, DDL-0321).
//
// FUNÇÕES
//   Pips(props): `left`, `max`, `shape` e `label` (o texto do leitor de tela; sem
//     ele, "2 of 4 left").
//
// DECISÕES E ARMADILHAS
//   - Morava na aba Features do jogo; veio para o comum quando o grimório passou a
//     mostrar as gemas no cabeçalho dos círculos (DDL-0321).
// -----------------------------------------------------------------------------

import styles from './Pips.module.css';

/** O contador em marcadores, ou em número acima de 12. */
export default function Pips({ left, max, shape, label }) {
  const text = label ?? `${left} of ${max} left`;
  if (max > 12) return <span className={styles.count} aria-label={text}>{left}/{max}</span>;
  const base = shape === 'gem' ? `${styles.pip} ${styles.gem}` : styles.pip;
  return (
    <span className={styles.pips} role="img" aria-label={text}>
      {Array.from({ length: max }, (_, i) => <span key={i} className={i < left ? `${base} ${styles.pipOn}` : base} />)}
    </span>
  );
}
