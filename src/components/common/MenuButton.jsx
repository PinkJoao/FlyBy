// =============================================================================
// MenuButton - gatilho + dropdown genérico (portal para o <body>)
// =============================================================================
// Extraído do ExportMenu, que agora é um caso particular deste. O menu é um
// PORTAL: os cards do roster têm `overflow:hidden` (cantos arredondados) e
// cortariam um dropdown posicionado dentro deles. A posição é medida a cada
// abertura e ancorada ao gatilho.
//
// Itens: [{ label, sub?, onClick?, disabled?, danger?, title? }]
// -----------------------------------------------------------------------------

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './MenuButton.module.css';

const GAP = 6; // espaço entre o gatilho e o menu
const MARGIN = 8; // respiro mínimo até a borda da viewport

/**
 * @param {object} props
 * @param {Array<{label: string, sub?: string, onClick?: () => void, disabled?: boolean, danger?: boolean, title?: string}>} props.items
 * @param {string} [props.buttonClassName]
 * @param {string} [props.buttonTitle]
 * @param {'left'|'right'} [props.align]  lado em que o menu abre (relativo ao gatilho)
 * @param {import('react').ReactNode} props.children  conteúdo do gatilho
 */
export default function MenuButton({ items, buttonClassName, buttonTitle, align = 'right', children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  // Posiciona o menu (portal fixo): abre para BAIXO, mas INVERTE para cima quando
  // não há espaço suficiente abaixo e há mais espaço acima - assim um card colado
  // na base da tela não abre um menu fora da área visível. Mede a altura REAL do
  // menu (já montado, ainda escondido) e limita a altura ao espaço disponível.
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !menuRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    // scrollHeight = altura TOTAL do conteúdo, mesmo que um `maxHeight` residual
    // da abertura anterior ainda esteja aplicado - evita medir errado no reabrir.
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
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </button>
      {/* Renderiza assim que abre (mesmo sem `pos`), escondido, para medir a
          altura real antes de decidir se abre para baixo ou para cima. */}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className={styles.menu}
            style={pos ?? { top: 0, left: 0, visibility: 'hidden' }}
            role="menu"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={item.danger ? `${styles.item} ${styles.itemDanger}` : styles.item}
                disabled={item.disabled}
                title={item.title}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                <span className={styles.itemTitle}>{item.label}</span>
                {item.sub && <span className={styles.itemSub}>{item.sub}</span>}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
