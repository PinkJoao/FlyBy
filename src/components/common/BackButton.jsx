// =============================================================================
// BackButton: o único botão de voltar do app
// =============================================================================
// O QUE FAZ
//   Antes havia três textos diferentes de "voltar", cada um com a largura do
//   rótulo. Aqui é sempre o mesmo ícone compacto, com o destino no title e no
//   aria-label: a UI ganha espaço e fala uma língua só. Aceita `to` (vira um Link
//   do router) OU `onClick` (vira um button).
//
// FUNÇÕES
//   Chevron(): a seta em SVG (escala com a fonte, não depende do sistema).
//   BackButton(props): o botão.
// -----------------------------------------------------------------------------

import { Link } from 'react-router-dom';
import styles from './BackButton.module.css';

/** A seta em SVG. */
function Chevron() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        d="M15 5 L8 12 L15 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * O botão de voltar (`to` ou `onClick`).
 * @param {object} props
 * @param {string} [props.to]
 * @param {() => void} [props.onClick]
 * @param {string} [props.label]
 * @param {string} [props.className]
 */
export default function BackButton({ to, onClick, label = 'Back', className }) {
  const cls = className ? `${styles.back} ${className}` : styles.back;
  const content = <Chevron />;
  const a11y = { title: `Back to ${label.toLowerCase()}`, 'aria-label': `Back to ${label.toLowerCase()}` };

  if (to) {
    return (
      <Link to={to} className={cls} {...a11y}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} {...a11y}>
      {content}
    </button>
  );
}
