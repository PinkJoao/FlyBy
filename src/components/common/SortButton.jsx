// =============================================================================
// SortButton: o botão de ordenar (ícone que abre as opções)
// =============================================================================
// O QUE FAZ
//   Um botão quadrado com o ícone de ordenação, no lugar de um select "Sort".
//   Abre um menu (MenuButton) com as opções; a ativa leva o check e, embaixo, a
//   direção. Escolher outra opção começa na direção natural dela; escolher a
//   mesma de novo inverte (src/sorting.js, nextSort).
//
// FUNÇÕES
//   SortButton({ options, value, dir, onChange, className }): o botão.
//
// DECISÕES E ARMADILHAS
//   - O title e o aria-label dizem a ordenação atual ("Sort: Weight, High to
//     low"): o ícone sozinho não mostra qual é.
// -----------------------------------------------------------------------------

import MenuButton from './MenuButton';
import Icon from './Icon';
import { nextSort, dirLabel } from '../../sorting';
import styles from './SortButton.module.css';

/**
 * O botão de ordenar.
 * @param {{ options: Array<object>, value: string, dir: 'asc'|'desc', onChange: (value: string, dir: string) => void, className?: string }} props
 */
export default function SortButton({ options, value, dir, onChange, className }) {
  const active = options.find((o) => o.value === value) ?? options[0];
  return (
    <MenuButton
      buttonClassName={className ? `${styles.btn} ${className}` : styles.btn}
      buttonTitle={`Sort: ${active.label}${dirLabel(active, dir) === active.label ? '' : `, ${dirLabel(active, dir)}`}`}
      items={options.map((o) => ({
        label: o.label,
        sub: o.value === active.value ? `${dirLabel(o, dir)} · again to reverse` : undefined,
        checked: o.value === active.value,
        onClick: () => {
          const next = nextSort({ value: active.value, dir }, o);
          onChange(next.value, next.dir);
        },
      }))}
    >
      <Icon name="sort" />
    </MenuButton>
  );
}
