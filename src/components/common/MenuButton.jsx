// =============================================================================
// MenuButton: o gatilho com dropdown genérico
// =============================================================================
// O QUE FAZ
//   O menu é um PORTAL no body: os cards do roster têm `overflow:hidden` e
//   cortariam um dropdown dentro deles. A posição é medida a cada abertura e
//   ancorada ao gatilho. Itens: [{ label, sub?, onClick?, href?, disabled?,
//   danger?, title? }]; `href` vira link real (mais confiável para mailto:), e um
//   http(s) abre em aba nova.
//
// FUNÇÕES
//   MenuButton(props): o gatilho e o menu.
//
// DECISÕES E ARMADILHAS
//   - Abre para BAIXO, mas INVERTE para cima quando falta espaço abaixo e sobra
//     acima, limitando a altura ao disponível. Mede o scrollHeight (a altura total,
//     mesmo com um maxHeight residual da abertura anterior), com uma folga do
//     gatilho e da borda.
//   - O menu renderiza assim que abre, escondido, para medir antes de decidir.
// -----------------------------------------------------------------------------

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './MenuButton.module.css';

const GAP = 6;
const MARGIN = 8;

/**
 * O gatilho e o dropdown.
 * @param {object} props
 * @param {Array<{label: string, sub?: string, onClick?: () => void, href?: string, disabled?: boolean, danger?: boolean, title?: string}>} props.items
 * @param {string} [props.buttonClassName]
 * @param {string} [props.buttonTitle]
 * @param {'left'|'right'} [props.align]
 * @param {string} [props.dataTour]
 * @param {import('react').ReactNode} props.children
 */
export default function MenuButton({ items, buttonClassName, buttonTitle, align = 'right', dataTour, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !menuRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const menuH = menuRef.current.scrollHeight;
    const spaceBelow = window.innerHeight - r.bottom - GAP;
    const spaceAbove = r.top - GAP;
    const openUp = spaceBelow < menuH && spaceAbove > spaceBelow;
    const vertical = openUp
      ? { bottom: window.innerHeight - r.top + GAP, maxHeight: Math.max(0, spaceAbove - MARGIN) }
      : { top: r.bottom + GAP, maxHeight: Math.max(0, spaceBelow - MARGIN) };
    const horizontal = align === 'left' ? { left: r.left } : { right: window.innerWidth - r.right };
    setPos({ ...vertical, ...horizontal, overflowY: 'auto' });
  }, [open, align]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={buttonClassName}
        title={buttonTitle}
        data-tour={dataTour}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className={styles.menu}
            style={pos ?? { top: 0, left: 0, visibility: 'hidden' }}
            role="menu"
          >
            {items.map((item) => {
              const className = item.danger ? `${styles.item} ${styles.itemDanger}` : styles.item;
              const body = (
                <>
                  <span className={styles.itemTitle}>{item.label}</span>
                  {item.sub && <span className={styles.itemSub}>{item.sub}</span>}
                </>
              );
              if (item.href) {
                const isExternal = /^https?:/.test(item.href);
                return (
                  <a
                    key={item.label}
                    role="menuitem"
                    className={className}
                    title={item.title}
                    href={item.href}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {body}
                  </a>
                );
              }
              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className={className}
                  disabled={item.disabled}
                  title={item.title}
                  onClick={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                >
                  {body}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
