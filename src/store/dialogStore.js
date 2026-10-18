// =============================================================================
// dialogStore: a fila de diálogos in-app (Zustand)
// =============================================================================
// O QUE FAZ
//   Substitui window.confirm/alert/prompt por diálogos renderizados DENTRO do app,
//   com a identidade visual e o controle de estilo dele (DDL-0007). A UI
//   (DialogHost) só LÊ esta fila. Quem abre um diálogo usa a API imperativa de
//   components/common/dialog.js (alert, confirm, ask), que chama `open()` e
//   recebe uma Promise resolvida com a resposta. O store é singleton, então a API
//   funciona dentro e fora do React.
//
// FUNÇÕES
//   nextId(): id sequencial de diálogo.
//   useDialogStore: o store. Estado `dialogs` é uma PILHA (o último fica por
//     cima; vários são raros, mas um confirm pode nascer dentro de outro fluxo).
//     open(config): abre um diálogo e devolve a Promise da resposta.
//     resolve(id, result): fecha e resolve a Promise (idempotente).
// -----------------------------------------------------------------------------

import { create } from 'zustand';

let seq = 0;
const nextId = () => `dlg-${++seq}`;

const useDialogStore = create((set, get) => ({
  dialogs: [],

  /**
   * Abre um diálogo e resolve a Promise com a resposta do usuário.
   * @param {object} config
   * @returns {Promise<any>}
   */
  open: (config) =>
    new Promise((resolve) => {
      const id = nextId();
      set((s) => ({ dialogs: [...s.dialogs, { ...config, id, resolve }] }));
    }),

  /** Fecha um diálogo, resolvendo a Promise com `result` (idempotente). */
  resolve: (id, result) => {
    const d = get().dialogs.find((x) => x.id === id);
    if (!d) return;
    d.resolve(result);
    set((s) => ({ dialogs: s.dialogs.filter((x) => x.id !== id) }));
  },
}));

export default useDialogStore;
