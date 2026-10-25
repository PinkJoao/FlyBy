// =============================================================================
// ImageViewer: o visualizador de imagem em tela cheia
// =============================================================================
// O QUE FAZ
//   Montado UMA vez no App e aberto por showImageViewer (imageViewerStore). Overlay
//   escuro com a arte; com várias imagens, carrossel em tela cheia (setas,
//   pontinhos ou contador, arrastar para o lado, teclas de seta). Fecha com clique
//   fora, X ou Esc. As ações opcionais ficam na barra sob a imagem: botões de texto
//   (Change, Remove) ou redondos com ícone e tom (X vermelho e check verde da prévia
//   dos retratos sugeridos).
//
// FUNÇÕES
//   ImageViewer(): o visualizador (monta o corpo só quando aberto).
//   ViewerBody(props): o overlay, o palco com o gesto, a barra e as ações.
//   ActionButton(props): uma ação, de texto ou redonda com ícone.
//
// DECISÕES E ARMADILHAS
//   - Esc e foco seguem o DialogHost: o overlay se foca e trata as teclas com
//     stopPropagation, então um Esc não fecha também o diálogo de baixo. O foco
//     volta ao elemento anterior.
//   - No desktop as setas ficam FIXAS nas bordas da tela, não sobre a imagem: não
//     pulam quando a proporção muda de uma foto para outra. No celular (abaixo de
//     700px) elas vão para a barra de baixo, nas pontas, ao lado das ações: o
//     carrossel tem botão também no toque, não só o deslize.
//   - O deslize é o MESMO das abas da ficha (useSwipeNav): a imagem acompanha o
//     dedo e, solta além do limiar, troca; a nova entra do lado certo (slideClass).
//     Por isso o corpo é um componente que monta ao abrir: o gesto se liga ao palco
//     na montagem.
//   - As vizinhas (anterior e próxima) são pré-carregadas: o deslize não mostra a
//     imagem chegando aos pedaços.
//   - Acima de MAX_DOTS imagens (a prévia das sugestões de retrato passa de 200),
//     os pontinhos viram um contador "n / total".
//   - A ação recebe a imagem atual e o índice (`onClick(cur, index)`): o check da prévia
//     usa a foto que está na tela, não a que foi tocada para abrir. Ação sem
//     `onClick` (o X) só fecha.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useImageViewerStore from '../../store/imageViewerStore';
import styles from './ImageViewer.module.css';
import { useBackLayer } from '../../hooks/useBack';
import { useSwipeNav } from '../../hooks/useSwipeNav';
import Icon from './Icon';
import { slideClass } from '../../motion';

const MAX_DOTS = 12;

export default function ImageViewer() {
  const { open, images, index, actions, hide, setIndex } = useImageViewerStore();
  useBackLayer(open, hide);
  if (!open || images.length === 0) return null;
  return createPortal(
    <ViewerBody images={images} index={index} actions={actions} hide={hide} setIndex={setIndex} />,
    document.body,
  );
}

/** O overlay aberto: palco com o gesto de deslize, barra com setas, posição e ações. */
function ViewerBody({ images, index, actions, hide, setIndex }) {
  const overlayRef = useRef(null);
  const stageRef = useRef(null);
  const [dir, setDir] = useState(null);
  const multi = images.length > 1;
  const cur = images[Math.min(index, images.length - 1)];

  useEffect(() => {
    const prev = document.activeElement;
    overlayRef.current?.focus();
    return () => {
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, []);

  useEffect(() => {
    if (!multi) return;
    for (const d of [1, -1]) {
      const n = images[(index + d + images.length) % images.length];
      if (n?.src) new Image().src = n.src;
    }
  }, [images, index, multi]);

  /** Troca de imagem lembrando a direção, para a nova entrar do lado certo. */
  const step = (d) => {
    setDir(d > 0 ? 'next' : 'prev');
    setIndex(index + d);
  };

  useSwipeNav(stageRef, {
    onPrev: () => step(-1),
    onNext: () => step(1),
    canPrev: multi,
    canNext: multi,
  });

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

  const prevBtn = (className) => (
    <button type="button" className={className} onClick={() => step(-1)} aria-label="Previous image">
      <Icon name="chevronLeft" />
    </button>
  );
  const nextBtn = (className) => (
    <button type="button" className={className} onClick={() => step(1)} aria-label="Next image">
      <Icon name="chevronRight" />
    </button>
  );

  return (
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
          {prevBtn(`${styles.arrow} ${styles.arrowL}`)}
          {nextBtn(`${styles.arrow} ${styles.arrowR}`)}
        </>
      )}

      <div className={styles.stage} ref={stageRef}>
        <img
          key={`${cur.src}-${index}`}
          className={`${styles.img} ${slideClass(dir)}`}
          src={cur.src}
          alt={cur.alt ?? ''}
          draggable={false}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>

      {cur.credit && <p className={styles.credit}>Art: {cur.credit}</p>}

      {multi && images.length > MAX_DOTS && (
        <p className={styles.counter} aria-live="polite">
          {index + 1} / {images.length}
        </p>
      )}

      {multi && images.length <= MAX_DOTS && (
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

      {(multi || actions.length > 0) && (
        <div className={styles.bar}>
          {multi && prevBtn(styles.barArrow)}
          {actions.length > 0 && (
            <div className={styles.actions}>
              {actions.map((a, i) => (
                <ActionButton
                  key={`${a.label}-${i}`}
                  action={a}
                  onClick={() => {
                    a.onClick?.(cur, index);
                    hide();
                  }}
                />
              ))}
            </div>
          )}
          {multi && nextBtn(styles.barArrow)}
        </div>
      )}
    </div>
  );
}

/** Uma ação da barra: redonda com ícone e tom (success, danger), ou de texto. */
function ActionButton({ action, onClick }) {
  if (action.icon) {
    const tone = action.tone === 'success' ? styles.roundSuccess : action.tone === 'danger' ? styles.roundDanger : '';
    return (
      <button
        type="button"
        className={`${styles.roundBtn} ${tone}`}
        onClick={onClick}
        aria-label={action.label}
        title={action.label}
      >
        <Icon name={action.icon} />
      </button>
    );
  }
  return (
    <button
      type="button"
      className={action.tone === 'danger' ? `${styles.actionBtn} ${styles.actionDanger}` : styles.actionBtn}
      onClick={onClick}
    >
      {action.label}
    </button>
  );
}
