// =============================================================================
// BackButton - o ÚNICO botão de "voltar" do app
// =============================================================================
// Antes havia três textos diferentes ("← Characters", "← Back", "← Back" do
// seletor), cada um ocupando largura proporcional ao rótulo. Aqui é sempre o
// mesmo ícone compacto (uma seta), com o destino no `title`/`aria-label` - a
// UI ganha espaço e a linguagem visual fica uma só.
//
// Aceita `to` (vira um <Link> do router) OU `onClick` (vira um <button>).
// -----------------------------------------------------------------------------

import { Link } from 'react-router-dom';
import styles from './BackButton.module.css';

/** Seta em SVG (não um glifo): escala com a fonte e não depende do sistema. */
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
 * @param {object} props
 * @param {string} [props.to]        destino (Link do router)
 * @param {() => void} [props.onClick]
 * @param {string} [props.label]     descrição do destino ("Characters", "Results")
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
