// =============================================================================
// Tag: a etiqueta de destaque do app (raridade, tipo, custo, estado de uma linha)
// =============================================================================
// O QUE FAZ
//   A etiqueta pequena, só de leitura, que qualifica uma linha ou um cartão: "Always
//   Prepared", "Ritual", "Rare", "Bonus Action", "Cantrip", "Locked", "Critical".
//   Uma forma só (DDL-0199, DDL-0200): retângulo de 4px, 9px, maiúsculas, 16px de
//   altura com o texto centrado na altura da maiúscula, borda de 1px, com
//   o tom pela cor do significado (`tone`) ou por uma cor do dado (`color`, a
//   raridade do item).
//
// FUNÇÕES
//   Tag(props): a etiqueta.
//
// DECISÕES E ARMADILHAS
//   - Tag x Chip: o Chip é a PÍLULA (algo que se toca, se escolhe ou um valor); a Tag
//     é o RÓTULO retangular de uma categoria. As duas nunca se misturam numa tela.
//   - Tons: neutral (padrão), accent, info, success, warning, danger e os três gastos
//     do turno (action, bonus, reaction, os tokens --econ-* do DDL-0163). `color` vem
//     do dado (a raridade): borda e texto na cor, o fundo um tom dela por color-mix.
//   - `dim` esmaece (o custo já gasto no turno, um item desligado).
// -----------------------------------------------------------------------------

import styles from './Tag.module.css';

/**
 * A etiqueta de destaque.
 * @param {{ children: any, tone?: 'neutral'|'accent'|'info'|'success'|'warning'|'danger'|'action'|'bonus'|'reaction',
 *   color?: string|null, dim?: boolean, title?: string, className?: string }} props
 */
export default function Tag({ children, tone = 'neutral', color = null, dim = false, title, className }) {
  const cls = [styles.tag, color ? styles.custom : styles[tone], dim ? styles.dim : null, className].filter(Boolean).join(' ');
  return (
    <span className={cls} style={color ? { '--tag': color } : undefined} title={title}>
      <span className={styles.text}>{children}</span>
    </span>
  );
}
