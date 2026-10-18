// =============================================================================
// TableViewer: o frame de tabela: scroll horizontal e tela cheia
// =============================================================================
// O QUE FAZ
//   Tabela larga NÃO é comprimida: rola na horizontal no tamanho natural. Só quando
//   há rolagem aparece o botão de tela cheia (mobile-friendly). `footer` fica
//   dentro do frame; `fullscreenChildren` troca o conteúdo da tela cheia (a tabela
//   completa com a inline colapsada). O overflow é re-checado em resize e quando o
//   conteúdo muda.
//
// FUNÇÕES
//   TableViewer(props): o frame.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import styles from './TableViewer.module.css';

export default function TableViewer({ children, footer = null, fullscreenChildren = null }) {
  const [full, setFull] = useState(false);
  const [canScroll, setCanScroll] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const check = () => setCanScroll(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  });

  return (
    <div className={styles.box}>
      <div className={styles.scrollWrap}>
        <div className={styles.scroll} ref={scrollRef}>
          {children}
        </div>
        {canScroll && (
          <button
            type="button"
            className={styles.expand}
            onClick={() => setFull(true)}
            aria-label="View table fullscreen"
            title="Fullscreen"
          >
            ⛶
          </button>
        )}
      </div>
      {footer}

      {full && (
        <div className={styles.overlay} onClick={() => setFull(false)}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHead}>
              <button type="button" className={styles.close} onClick={() => setFull(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className={styles.sheetScroll}>{fullscreenChildren ?? children}</div>
          </div>
        </div>
      )}
    </div>
  );
}
