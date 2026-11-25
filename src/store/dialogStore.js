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
//     addLive(id), removeLive(id): registram uma janela de conteúdo vivo (PreviewLayer) e quantos
//     diálogos já estavam abertos quando ela nasceu (`base`), para a pilha contar as duas portas.
//
// DECISÕES E ARMADILHAS
//   - As janelas vivas entram na conta da profundidade (DDL-0313): um diálogo aberto por cima de um
//     PreviewLayer (a fonte de uma magia do grimório, um link de regra) é uma janela EMPILHADA, com
//     o voltar, os pontos e a entrada pela direita, e a de baixo se guarda como na pilha do DialogHost.
//     Antes só os diálogos do store contavam, e a janela de cima abria como se fosse a única.
// -----------------------------------------------------------------------------

import { create } from 'zustand';

let seq = 0;
const nextId = () => `dlg-${++seq}`;

const useDialogStore = create((set, get) => ({
  dialogs: [],
  live: [],

  /** Registra a janela viva `id` com a altura da pilha de agora. */
  addLive: (id) => set((s) => ({ live: [...s.live, { id, base: s.dialogs.length }] })),

  /** Tira uma janela viva da conta. */
  removeLive: (id) => set((s) => ({ live: s.live.filter((l) => l.id !== id) })),

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
