// =============================================================================
// BonusChips: as pílulas dos bônus que entram um a um nas animações de dados
// =============================================================================
// O QUE FAZ
//   A pílula de uma parte da rolagem ("+4 Dexterity", "+5 Longsword"), usada pelo d20
//   em destaque e pela bandeja (DDL-0157, DDL-0158): o valor, o rótulo e, quando a
//   parte é rolada e o dado não está na tela, os dados pequenos girando até o valor
//   (o d4 do Bless no d20).
//
// FUNÇÕES
//   MiniDie(props): o dado pequeno de uma parte rolada, girando até o valor.
//   BonusChip(props): a pílula de uma parte.
//
// DECISÕES E ARMADILHAS
//   - `fast` (o jogador pulou a animação) para o dado pequeno direto na face final.
//   - No máximo três dados pequenos por pílula: mais que isso não cabe no celular, e
//     o valor da pílula já diz a soma.
// -----------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import { formatBonus } from '../engine/math';
import { createD20 } from './d20Canvas';
import { tokenColors } from './colors';
import styles from './D20Overlay.module.css';

/** O dado pequeno de uma parte rolada, girando até o valor. */
export function MiniDie({ sides, value, fast }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = createD20(ref.current, tokenColors(), sides);
    if (fast) {
      d.spinTo(value, 1);
      d.finish();
    } else d.spinTo(value, 560);
    return () => d.stop();
  }, [sides, value, fast]);
  return <canvas ref={ref} className={styles.miniDie} aria-hidden="true" />;
}

/** A pílula de uma parte: o valor, o rótulo e, se rolada, os dados pequenos. */
export function BonusChip({ bonus, fast }) {
  return (
    <span className={styles.chip}>
      {(bonus.dice ?? []).slice(0, 3).map((d, i) => (
        <MiniDie key={i} sides={d.sides} value={d.value} fast={fast} />
      ))}
      <span className={styles.chipValue}>{formatBonus(bonus.total)}</span>
      <span className={styles.chipLabel}>{bonus.label}</span>
    </span>
  );
}
