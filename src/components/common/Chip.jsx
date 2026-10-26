// =============================================================================
// Chip: a pílula padrão do app (filtro, escolhida removível, estado)
// =============================================================================
// O QUE FAZ
//   Uma forma só, a pílula, em três usos (docs/UI-PATTERNS.md):
//   - filtro ou alternância: botão com `onClick`, aceso com `active`;
//   - escolhida removível: com `onRemove`, ganha o X redondo à direita (e o rótulo
//     ainda pode abrir algo com `onClick`), no molde da faixa "Chosen" do seletor;
//   - estado (sem clique): só leitura, com `tone` para info, aviso ou perigo.
//   `icon` vai antes do rótulo e `count` depois, esmaecido.
//
// FUNÇÕES
//   Chip(props): a pílula.
//
// DECISÕES E ARMADILHAS
//   - Acesa = fundo e borda de accent com texto accent, SEM mudar o peso da fonte:
//     negrito ao acender alargava a pílula e empurrava as vizinhas (DDL-0129).
//   - O fundo segue a superfície: --bg-soft sobre a página (--bg) e --bg dentro de
//     um card --bg-soft (`onCard`), para a pílula não sumir no card.
// -----------------------------------------------------------------------------

import Icon from './Icon';
import styles from './Chip.module.css';

/**
 * A pílula padrão.
 * @param {{
 *   children: any, active?: boolean, onClick?: () => void, onRemove?: () => void,
 *   removeLabel?: string, count?: number|string, icon?: string, tone?: 'info'|'warning'|'danger',
 *   size?: 'sm'|'md', onCard?: boolean, disabled?: boolean, title?: string, className?: string,
 * }} props
 */
export default function Chip({
  children,
  active = false,
  onClick,
  onRemove,
  removeLabel,
  count,
  icon,
  tone,
  size = 'md',
  onCard = false,
  disabled = false,
  title,
  className,
}) {
  const cls = [
    styles.chip,
    size === 'sm' ? styles.sm : null,
    onCard ? styles.onCard : null,
    active || onRemove ? styles.active : null,
    tone ? styles[tone] : null,
    onRemove ? styles.removable : null,
    onClick || onRemove ? null : styles.static,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      {icon && <Icon name={icon} />}
      <span className={styles.label}>{children}</span>
      {count != null && <span className={styles.count}>{typeof count === 'number' ? count.toLocaleString('en-US') : count}</span>}
    </>
  );

  if (onRemove) {
    return (
      <span className={cls} title={title}>
        {onClick ? (
          <button type="button" className={styles.labelBtn} onClick={onClick} disabled={disabled}>
            {body}
          </button>
        ) : (
          <span className={styles.labelBtn}>{body}</span>
        )}
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          aria-label={removeLabel ?? (typeof children === 'string' ? `Remove ${children}` : 'Remove')}
          disabled={disabled}
        >
          <Icon name="close" />
        </button>
      </span>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={active} disabled={disabled} title={title}>
        {body}
      </button>
    );
  }

  return (
    <span className={cls} title={title}>
      {body}
    </span>
  );
}
