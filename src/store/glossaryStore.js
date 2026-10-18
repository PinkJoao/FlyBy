// =============================================================================
// glossaryStore: abre e fecha o glossário navegável (Zustand)
// =============================================================================
// O QUE FAZ
//   Como o dialogStore: um singleton que a UI (GlossaryOverlay, montado no App
//   dentro do DataProvider) só LÊ, e que qualquer lugar aciona, como os menus
//   sanduíche da Home e da ficha.
//
// FUNÇÕES
//   useGlossaryStore: o store (show, hide).
//   openGlossary(): atalho imperativo, para fora do React.
// -----------------------------------------------------------------------------

import { create } from 'zustand';

const useGlossaryStore = create((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

/** Atalho imperativo (fora do React, como os menus). */
export function openGlossary() {
  useGlossaryStore.getState().show();
}

export default useGlossaryStore;
