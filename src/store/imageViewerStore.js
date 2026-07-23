// =============================================================================
// imageViewerStore - visualizador de imagem em tela cheia (Zustand singleton)
// =============================================================================
// No espírito do glossaryStore/dialogStore: um singleton que a UI (ImageViewer,
// montado UMA vez no App) só LÊ, e que qualquer imagem clicável do app aciona via
// a API imperativa `showImageViewer(images, index)`. Guarda o array inteiro (para
// o carrossel navegar em tela cheia) e o índice atual.
//
// `images`: array de `{ src, alt?, credit? }`.
// -----------------------------------------------------------------------------

import { create } from 'zustand';

const useImageViewerStore = create((set, get) => ({
  open: false,
  images: [],
  index: 0,

  show: (images, index = 0) => {
    const list = (images ?? []).filter((im) => im && im.src);
    if (list.length === 0) return;
    const n = list.length;
    set({ open: true, images: list, index: ((index % n) + n) % n });
  },

  hide: () => set({ open: false }),

  /** Navega com wrap-around (o carrossel é circular). */
  setIndex: (i) => {
    const n = get().images.length;
    if (n) set({ index: ((i % n) + n) % n });
  },
}));

/**
 * Abre o visualizador em tela cheia. Aceita:
 *  - um array de `{ src, alt?, credit? }` (+ índice inicial), ou
 *  - uma única string de src (conveniência para imagens avulsas).
 */
export function showImageViewer(images, index = 0) {
  const list = typeof images === 'string' ? [{ src: images }] : images;
  useImageViewerStore.getState().show(list, index);
}

export default useImageViewerStore;
