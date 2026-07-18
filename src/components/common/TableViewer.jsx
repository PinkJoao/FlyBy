// =============================================================================
// TableViewer - frame padrão de tabela: scroll horizontal + TELA CHEIA
// =============================================================================
// Tabelas largas NÃO são comprimidas: rolam na horizontal no tamanho natural.
// Quando (e SÓ quando) há rolagem horizontal, o botão ⛶ aparece no canto
// inferior direito e abre a visualização em tela cheia (mobile-friendly).
// `footer` (opcional) fica dentro do frame (ex: toggle da tabela de progressão);
// `fullscreenChildren` (opcional) troca o conteúdo do fullscreen (ex: tabela
// completa mesmo com a inline colapsada).
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import styles from './TableViewer.module.css';

export default function TableViewer({ children, footer = null, fullscreenChildren = null }) {
  const [full, setFull] = useState(false);
  const [canScroll, setCanScroll] = useState(false);
  const scrollRef = useRef(null);

  // Detecta overflow horizontal (re-checa em resize e mudanças de conteúdo).
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
