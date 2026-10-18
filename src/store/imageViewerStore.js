// =============================================================================
// imageViewerStore: o visualizador de imagem em tela cheia (Zustand)
// =============================================================================
// O QUE FAZ
//   Como o glossaryStore e o dialogStore: um singleton que a UI (ImageViewer,
//   montado UMA vez no App) só LÊ, e que qualquer imagem clicável aciona. Guarda o
//   array inteiro, para o carrossel navegar em tela cheia, e o índice atual.
//   `images` é uma lista de `{ src, alt?, credit? }`. `actions` são botões
//   opcionais sob a imagem (`{ label, onClick, tone? }`), como o Trocar/Remover
//   da imagem de item do inventário.
//
// FUNÇÕES
//   useImageViewerStore: o store: show(images, index, actions), hide() e
//     setIndex(i), que navega com wrap-around.
//   showImageViewer(images, index, actions): abre; aceita uma lista ou uma única
//     string de src.
// -----------------------------------------------------------------------------

import { create } from 'zustand';

const useImageViewerStore = create((set, get) => ({
  open: false,
  images: [],
  index: 0,
  actions: [],

  show: (images, index = 0, actions = null) => {
    const list = (images ?? []).filter((im) => im && im.src);
    if (list.length === 0) return;
    const n = list.length;
    set({ open: true, images: list, index: ((index % n) + n) % n, actions: actions ?? [] });
  },

  hide: () => set({ open: false }),

  /** Navega com wrap-around (o carrossel é circular). */
  setIndex: (i) => {
    const n = get().images.length;
    if (n) set({ index: ((i % n) + n) % n });
  },
}));

/** Abre o visualizador: uma lista com índice inicial, ou uma única src. */
export function showImageViewer(images, index = 0, actions = null) {
  const list = typeof images === 'string' ? [{ src: images }] : images;
  useImageViewerStore.getState().show(list, index, actions);
}

export default useImageViewerStore;
