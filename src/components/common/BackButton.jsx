// =============================================================================
// BackButton: o único botão de voltar do app
// =============================================================================
// O QUE FAZ
//   Antes havia três textos diferentes de "voltar", cada um com a largura do
//   rótulo. Aqui é sempre o mesmo ícone compacto, com o destino no title e no
//   aria-label: a UI ganha espaço e fala uma língua só. Aceita `to` (um link que
//   sai DESEMPILHANDO, por useLeaveTo) OU `onClick` (vira um button).
//
// DECISÕES E ARMADILHAS
//   - Com `to` ele não é um Link do router: um Link empilha a página de destino,
//     e o voltar do celular, depois, reabriria a página que o botão fechou.
//
// FUNÇÕES
//   Chevron(): a seta em SVG (escala com a fonte, não depende do sistema).
//   BackButton(props): o botão.
// -----------------------------------------------------------------------------

import { useLeaveTo } from '../../hooks/useBack';
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

  const leaveTo = useLeaveTo();

  if (to) {
    return (
      <a
        href={to}
        className={cls}
        {...a11y}
        onClick={(e) => {
          e.preventDefault();
          leaveTo(to);
        }}
      >
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} {...a11y}>
      {content}
    </button>
  );
}
