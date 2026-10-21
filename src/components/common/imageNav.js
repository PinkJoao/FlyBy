// =============================================================================
// imageNav: os hooks de navegação de imagem (carrossel)
// =============================================================================
// O QUE FAZ
//   Usados pelo ImageCarousel e pelo ImageViewer.
//
// FUNÇÕES
//   useSwipe(onPrev, onNext): swipe horizontal (mais de 40px).
//   useCarouselIndex(count): índice circular, clampado se `count` encolher, e a
//     direção da última troca ('next' ou 'prev'), para a foto nova entrar do lado
//     certo (motion.js). Avançar do último para o primeiro ainda é 'next'.
// -----------------------------------------------------------------------------

import { useRef, useState } from 'react';

/** Os handlers de swipe horizontal. */
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

/** O índice circular de um carrossel, com a direção da última troca. */
export function useCarouselIndex(count) {
  const [raw, setRaw] = useState(0);
  const [dir, setDir] = useState(null);
  const index = count ? Math.min(raw, count - 1) : 0;
  const go = (i, d) => {
    setDir(d ?? (i >= index ? 'next' : 'prev'));
    setRaw(count ? ((i % count) + count) % count : 0);
  };
  return {
    index,
    dir,
    setIndex: (i) => go(i),
    prev: () => go(index - 1, 'prev'),
    next: () => go(index + 1, 'next'),
  };
}
