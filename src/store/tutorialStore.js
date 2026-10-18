// =============================================================================
// tutorialStore: o estado do tutorial de uso, os coach-marks (Zustand e localStorage)
// =============================================================================
// O QUE FAZ
//   No molde dos outros singletons: a UI (TutorialOverlay, montado UMA vez no App)
//   lê, e qualquer lugar aciona pela API imperativa (DDL-0069).
//
//   PERSISTIDO no localStorage: `enabled` (liga e desliga tudo) e `seen` (tourId
//   para true). Só em RUNTIME: o tour ativo (`tourId`, `steps` já filtrados por
//   dispositivo, `index`). localStorage ausente ou JSON corrompido cai no
//   default, e no modo privado tudo fica só em memória.
//
// FUNÇÕES
//   isMobile(): o mesmo breakpoint do SelectorPanel (seguro sem matchMedia).
//   loadPersisted(), persist(state): leitura e escrita no localStorage.
//   useTutorialStore: o store. Ações:
//     hasPersisted(): já há estado salvo? (a semeadura usa para a 1a execução).
//     markSeen(ids), resetSeen(): marcam tours como vistos ou zeram tudo.
//     setEnabled(enabled): liga ou desliga o tutorial inteiro.
//     startTour(id, { force }): inicia um tour; devolve se iniciou.
//     next(), back(), finish(): navegação; finish marca o tour como visto.
//   maybeStartTutorial(id): disparo automático e contextual.
//   startTutorial(id): replay pelo menu.
//   seedTutorials(rosterCount): semeadura da 1a execução.
//
// DECISÕES E ARMADILHAS
//   - Um tour por vez, sempre: nem o replay fura um tour aberto.
//   - maybeStartTutorial só dispara se `enabled`, o tour não foi visto e nada
//     está ativo. startTutorial ignora o `seen`.
//   - seedTutorials roda UMA vez, com o roster carregado: quem já tem personagens
//     nasce com tudo visto (os tours não estouram em massa); uma instalação nova
//     persiste `seen` vazio e os tours disparam conforme o usuário chega neles.
// -----------------------------------------------------------------------------

import { create } from 'zustand';
import { getTour, ALL_TOUR_IDS } from '../tutorial/tours';

const KEY = 'flyby:tutorial';

/** Mesmo breakpoint do SelectorPanel; seguro sem matchMedia. */
function isMobile() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 760px)').matches
  );
}

function loadPersisted() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      return { enabled: raw.enabled !== false, seen: raw.seen ?? {} };
    }
  } catch {
    // localStorage indisponivel / JSON corrompido: cai no default.
  }
  return null;
}

function persist(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ enabled: state.enabled, seen: state.seen }));
  } catch {
    // modo privado: preferencias ficam so em memoria.
  }
}

const initial = loadPersisted() ?? { enabled: true, seen: {} };

const useTutorialStore = create((set, get) => ({
  enabled: initial.enabled,
  seen: initial.seen,

  tourId: null,
  steps: [],
  index: 0,

  /** Há estado persistido? (a semeadura usa para saber se é a 1a execução). */
  hasPersisted: () => loadPersisted() != null,

  setEnabled: (enabled) => {
    set({ enabled });
    persist(get());
    if (!enabled) set({ tourId: null, steps: [], index: 0 });
  },

  /** Marca os tours como vistos e persiste; lista vazia só persiste. */
  markSeen: (ids) => {
    const seen = { ...get().seen };
    for (const id of ids) seen[id] = true;
    set({ seen });
    persist(get());
  },

  /** Zera o `seen`: os tours voltam a disparar sozinhos. */
  resetSeen: () => {
    set({ seen: {} });
    persist(get());
  },

  /** Inicia um tour (`force` ignora o `seen`, nunca o "um por vez"); devolve se iniciou. */
  startTour: (id, { force = false } = {}) => {
    const st = get();
    if (st.tourId) return false;
    if (!force) {
      if (!st.enabled) return false;
      if (st.seen[id]) return false;
    }
    const tour = getTour(id);
    if (!tour) return false;
    const mobile = isMobile();
    const steps = tour.steps.filter((s) => !s.only || s.only === (mobile ? 'mobile' : 'desktop'));
    if (steps.length === 0) return false;
    set({ tourId: id, steps, index: 0 });
    return true;
  },

  next: () => {
    const { index, steps } = get();
    if (index + 1 >= steps.length) return get().finish();
    return set({ index: index + 1 });
  },

  back: () => set((s) => ({ index: Math.max(0, s.index - 1) })),

  /** Encerra o tour ativo, marcando-o como visto. */
  finish: () => {
    const { tourId } = get();
    if (tourId) get().markSeen([tourId]);
    set({ tourId: null, steps: [], index: 0 });
  },
}));

/** Disparo automático: só se ligado, não visto e nada ativo. */
export function maybeStartTutorial(id) {
  return useTutorialStore.getState().startTour(id);
}

/** Replay pelo menu: ignora o `seen`. */
export function startTutorial(id) {
  return useTutorialStore.getState().startTour(id, { force: true });
}

/** Semeadura da 1a execução (chamar com o roster já carregado). */
export function seedTutorials(rosterCount) {
  const st = useTutorialStore.getState();
  if (st.hasPersisted()) return;
  st.markSeen(rosterCount > 0 ? ALL_TOUR_IDS : []);
}

export default useTutorialStore;
