// =============================================================================
// ImageCarousel - imagem (ou carrossel) clicável que expande em tela cheia
// =============================================================================
// Recebe um array de `{ src, alt?, credit? }` já resolvido.
//  - 1 imagem: só a arte clicável (abre o ImageViewer em tela cheia).
//  - 2+: carrossel com pontinhos, swipe no toque e setas no hover (desktop).
// Clicar em qualquer imagem abre o visualizador em tela cheia NO índice atual,
// com o array inteiro (o carrossel continua funcionando lá dentro).
//
// Imagens que falham ao carregar somem do carrossel (as demais seguem). Se todas
// falharem, o componente não renderiza nada.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { showImageViewer } from '../../store/imageViewerStore';
import { useCarouselIndex, useSwipe } from './imageNav';
import styles from './ImageCarousel.module.css';

export default function ImageCarousel({ images, capped = false, alt = '' }) {
  const [broken, setBroken] = useState(() => new Set());
  const shown = images.filter((im) => im?.src && !broken.has(im.src));
  const { index, setIndex, prev, next } = useCarouselIndex(shown.length);
  const swipe = useSwipe(prev, next);

  if (shown.length === 0) return null;
  const multi = shown.length > 1;
  const cur = shown[index];

  return (
    <div className={styles.carousel}>
      <div className={capped ? `${styles.frame} ${styles.frameCapped}` : styles.frame} {...(multi ? swipe : {})}>
        <button
          type="button"
          className={styles.imgBtn}
          onClick={() => showImageViewer(shown, index)}
          title="Expand image"
        >
          <img
            className={styles.img}
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
              ‹
            </button>
            <button
              type="button"
              className={`${styles.arrow} ${styles.arrowR}`}
              onClick={next}
              aria-label="Next image"
            >
              ›
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
