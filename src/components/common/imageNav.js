// =============================================================================
// imageNav - hooks compartilhados de navegação de imagem (carrossel)
// =============================================================================
// Usados tanto pelo carrossel inline (ImageCarousel) quanto pelo visualizador em
// tela cheia (ImageViewer): swipe horizontal no toque e índice circular.
// -----------------------------------------------------------------------------

import { useRef, useState } from 'react';

/** Handlers de swipe horizontal: dispara onPrev/onNext ao arrastar mais de 40px. */
export function useSwipe(onPrev, onNext) {
  const start = useRef(null);
  return {
    onTouchStart: (e) => {
      start.current = e.touches[0].clientX;
    },
    onTouchEnd: (e) => {
      if (start.current == null) return;
      const dx = e.changedTouches[0].clientX - start.current;
      start.current = null;
      if (Math.abs(dx) > 40) (dx < 0 ? onNext : onPrev)();
    },
  };
}

/** Índice circular para um carrossel de `count` imagens (clampa se `count` encolher). */
export function useCarouselIndex(count) {
  const [raw, setRaw] = useState(0);
  const index = count ? Math.min(raw, count - 1) : 0;
  const go = (i) => setRaw(count ? ((i % count) + count) % count : 0);
  return {
    index,
    setIndex: go,
    prev: () => go(index - 1),
    next: () => go(index + 1),
  };
}
