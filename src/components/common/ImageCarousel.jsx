// =============================================================================
// ImageCarousel: a imagem (ou carrossel) clicável que expande em tela cheia
// =============================================================================
// O QUE FAZ
//   Recebe uma lista de { src, alt?, credit? }. Uma imagem é só a arte clicável;
//   duas ou mais viram carrossel com pontinhos, swipe e setas no hover. Clicar abre
//   o ImageViewer no índice atual, com a lista inteira (DDL-0067). Imagem que falha
//   sai do carrossel; se todas falharem, nada renderiza.
//
// FUNÇÕES
//   ImageCarousel(props): o carrossel.
//
// DECISÕES E ARMADILHAS
//   - Com mais de uma imagem, o quadro leva `data-own-swipe`: o arrasto entre as
//     abas da ficha (useSwipeNav) deixa o gesto horizontal para o carrossel.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { showImageViewer } from '../../store/imageViewerStore';
import { useCarouselIndex, useSwipe } from './imageNav';
import styles from './ImageCarousel.module.css';
import Icon from './Icon';
import { slideClass } from '../../motion';

export default function ImageCarousel({ images, capped = false, alt = '' }) {
  const [broken, setBroken] = useState(() => new Set());
  const shown = images.filter((im) => im?.src && !broken.has(im.src));
  const { index, dir, setIndex, prev, next } = useCarouselIndex(shown.length);
  const swipe = useSwipe(prev, next);

  if (shown.length === 0) return null;
  const multi = shown.length > 1;
  const cur = shown[index];

  return (
    <div className={styles.carousel}>
      <div
        className={capped ? `${styles.frame} ${styles.frameCapped}` : styles.frame}
        data-own-swipe={multi ? '' : undefined}
        {...(multi ? swipe : {})}
      >
        <button
          type="button"
          className={styles.imgBtn}
          onClick={() => showImageViewer(shown, index)}
          title="Expand image"
        >
          <img
            key={`${cur.src}-${index}`}
            className={`${styles.img} ${slideClass(dir)}`}
            src={cur.src}
            alt={cur.alt ?? alt}
            loading="lazy"
            onError={() => setBroken((b) => new Set(b).add(cur.src))}
          />
        </button>

        {multi && (
          <>
            <button
              type="button"
              className={`${styles.arrow} ${styles.arrowL}`}
              onClick={prev}
              aria-label="Previous image"
            >
              <Icon name="chevronLeft" />
            </button>
            <button
              type="button"
              className={`${styles.arrow} ${styles.arrowR}`}
              onClick={next}
              aria-label="Next image"
            >
              <Icon name="chevronRight" />
            </button>
          </>
        )}
      </div>

      {multi && (
        <div className={styles.dots}>
          {shown.map((im, i) => (
            <button
              key={`${im.src}-${i}`}
              type="button"
              className={i === index ? `${styles.dot} ${styles.dotOn}` : styles.dot}
              onClick={() => setIndex(i)}
              aria-label={`Go to image ${i + 1}`}
              aria-current={i === index}
            />
          ))}
        </div>
      )}

      {cur.credit && <p className={styles.credit}>Art: {cur.credit}</p>}
    </div>
  );
}
