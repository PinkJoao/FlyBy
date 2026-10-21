// =============================================================================
// ImageViewer: o visualizador de imagem em tela cheia
// =============================================================================
// O QUE FAZ
//   Montado UMA vez no App e aberto por showImageViewer (imageViewerStore). Overlay
//   escuro com a arte; com várias imagens, carrossel em tela cheia (setas,
//   pontinhos, swipe, teclas de seta). Fecha com clique fora, X ou Esc. As ações
//   opcionais (Change, Remove) ficam sob a imagem.
//
// FUNÇÕES
//   ImageViewer(): o visualizador.
//
// DECISÕES E ARMADILHAS
//   - Esc e foco seguem o DialogHost: o overlay se foca e trata as teclas com
//     stopPropagation, então um Esc não fecha também o diálogo de baixo. O foco
//     volta ao elemento anterior.
//   - As setas ficam FIXAS nas bordas da tela, não sobre a imagem: não pulam quando
//     a proporção muda de uma foto para outra.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useImageViewerStore from '../../store/imageViewerStore';
import { useSwipe } from './imageNav';
import styles from './ImageViewer.module.css';
import { useBackLayer } from '../../hooks/useBack';
import Icon from './Icon';
import { slideClass } from '../../motion';

export default function ImageViewer() {
  const { open, images, index, actions, hide, setIndex } = useImageViewerStore();
  const overlayRef = useRef(null);

  useBackLayer(open, hide);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    overlayRef.current?.focus();
    return () => {
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, [open]);

  const [dir, setDir] = useState(null);
  /** Troca de imagem lembrando a direção, para a nova entrar do lado certo. */
  const step = (d) => {
    setDir(d > 0 ? 'next' : 'prev');
    setIndex(index + d);
  };
  const swipe = useSwipe(() => step(-1), () => step(1));

  if (!open || images.length === 0) return null;
  const multi = images.length > 1;
  const cur = images[Math.min(index, images.length - 1)];

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      hide();
    } else if (multi && e.key === 'ArrowLeft') {
      e.stopPropagation();
      step(-1);
    } else if (multi && e.key === 'ArrowRight') {
      e.stopPropagation();
      step(1);
    }
  };

  return createPortal(
    <div
      className={styles.overlay}
      ref={overlayRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) hide();
      }}
      onKeyDown={onKeyDown}
    >
      <button type="button" className={styles.close} onClick={hide} aria-label="Close">
        <Icon name="close" />
      </button>

      {multi && (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowL}`}
            onClick={() => step(-1)}
            aria-label="Previous image"
          >
            <Icon name="chevronLeft" />
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowR}`}
            onClick={() => step(1)}
            aria-label="Next image"
          >
            <Icon name="chevronRight" />
          </button>
        </>
      )}

      <div className={styles.stage} {...(multi ? swipe : {})}>
        <img
          key={`${cur.src}-${index}`}
          className={`${styles.img} ${slideClass(dir)}`}
          src={cur.src}
          alt={cur.alt ?? ''}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>

      {cur.credit && <p className={styles.credit}>Art: {cur.credit}</p>}

      {multi && (
        <div className={styles.dots}>
          {images.map((im, i) => (
            <button
              key={`${im.src}-${i}`}
              type="button"
              className={i === index ? `${styles.dot} ${styles.dotOn}` : styles.dot}
              onClick={() => {
                setDir(i >= index ? 'next' : 'prev');
                setIndex(i);
              }}
              aria-label={`Go to image ${i + 1}`}
              aria-current={i === index}
            />
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map((a, i) => (
            <button
              key={`${a.label}-${i}`}
              type="button"
              className={a.tone === 'danger' ? `${styles.actionBtn} ${styles.actionDanger}` : styles.actionBtn}
              onClick={() => {
                a.onClick?.();
                hide();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
