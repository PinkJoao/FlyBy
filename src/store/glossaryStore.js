// =============================================================================
// glossaryStore - abre/fecha o glossário navegável (Zustand singleton)
// =============================================================================
// Igual ao dialogStore: um singleton que a UI (GlossaryOverlay, montado no App
// dentro do DataProvider) só LÊ, e que qualquer lugar do app pode acionar via
// `useGlossaryStore.getState().show()` - os menus sanduíche da Home e da ficha.
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
