// =============================================================================
// dialogStore - fila de diálogos in-app (Zustand)
// =============================================================================
// Substitui window.confirm/alert/prompt do navegador por diálogos renderizados
// DENTRO do app (mesma identidade visual, controle total de estilo/comportamento).
//
// A UI (DialogHost) só LÊ esta fila e renderiza. Quem dispara um diálogo usa a
// API imperativa em `components/common/dialog.js` (alert/confirm/ask), que chama
// `open()` e recebe uma Promise resolvida quando o usuário responde. Como o store
// é um singleton, a API funciona de qualquer lugar (dentro ou fora do React).
// -----------------------------------------------------------------------------

import { create } from 'zustand';

let seq = 0;
const nextId = () => `dlg-${++seq}`;

const useDialogStore = create((set, get) => ({
  /** Pilha de diálogos abertos (o último é o de cima). Vários são raros, mas
   *  suportados (ex.: um confirm disparado de dentro de outro fluxo). */
  dialogs: [],

  /**
   * Abre um diálogo e resolve a Promise com a resposta do usuário.
   * @param {object} config  ver dialog.js / DialogHost para as chaves aceitas.
   * @returns {Promise<any>}
   */
  open: (config) =>
    new Promise((resolve) => {
      const id = nextId();
      set((s) => ({ dialogs: [...s.dialogs, { ...config, id, resolve }] }));
    }),

  /** Fecha um diálogo, resolvendo sua Promise com `result`. Idempotente. */
  resolve: (id, result) => {
    const d = get().dialogs.find((x) => x.id === id);
    if (!d) return;
    d.resolve(result);
    set((s) => ({ dialogs: s.dialogs.filter((x) => x.id !== id) }));
  },
}));

export default useDialogStore;
