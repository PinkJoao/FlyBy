// =============================================================================
// tutorialStore - estado do tutorial de uso (coach-marks) (Zustand + localStorage)
// =============================================================================
// No molde do settingsStore/imageViewerStore/glossaryStore: um singleton que a
// UI (TutorialOverlay, montado UMA vez no App) le, e que qualquer lugar do app
// aciona via a API imperativa `maybeStartTutorial(id)` / `startTutorial(id)`.
//
// PERSISTIDO (localStorage): `enabled` (liga/desliga geral) e `seen` (mapa
// tourId -> true, "ja mostrei este"). RUNTIME (nao persistido): o tour ativo
// (`tourId`, `steps` ja filtrados por dispositivo, `index`).
//
// Politica de disparo:
//  - `maybeStartTutorial` (auto, contextual) so dispara se `enabled`, o tour
//    ainda nao foi visto, e nenhum outro esta ativo (um por vez).
//  - `startTutorial` (replay pelo menu) forca, ignorando o `seen`, mas ainda
//    respeita o "um por vez".
//  - `seedTutorials(rosterCount)` roda UMA vez (na 1a carga apos o recurso
//    existir): usuario com personagens ja criados nasce com tudo marcado como
//    visto (nao estoura em massa); instalacao nova (roster vazio) mantem `seen`
//    vazio, entao os tours auto-disparam conforme o usuario chega neles.
// -----------------------------------------------------------------------------

import { create } from 'zustand';
import { getTour, ALL_TOUR_IDS } from '../tutorial/tours';

const KEY = 'flyby:tutorial';

/** Mesmo breakpoint do SelectorPanel; guardado p/ ambientes sem matchMedia. */
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

  // Runtime (nao persistido).
  tourId: null,
  steps: [],
  index: 0,

  /** Ha estado persistido? (usado pela semeadura p/ saber se e a 1a execucao). */
  hasPersisted: () => loadPersisted() != null,

  setEnabled: (enabled) => {
    set({ enabled });
    persist(get());
    if (!enabled) set({ tourId: null, steps: [], index: 0 }); // fecha um tour aberto
  },

  /** Marca os tours dados como vistos (persistindo). Lista vazia so persiste o estado. */
  markSeen: (ids) => {
    const seen = { ...get().seen };
    for (const id of ids) seen[id] = true;
    set({ seen });
    persist(get());
  },

  /** Zera o `seen` - os tours voltam a auto-disparar (replay geral). */
  resetSeen: () => {
    set({ seen: {} });
    persist(get());
  },

  /**
   * Inicia um tour. `force` (replay pelo menu) ignora o `seen`; sem force
   * (auto/contextual) respeita enabled + seen. Sempre "um por vez".
   * Retorna true se iniciou.
   */
  startTour: (id, { force = false } = {}) => {
    const st = get();
    if (st.tourId) return false; // um por vez
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

  /** Encerra o tour ativo marcando-o como visto. */
  finish: () => {
    const { tourId } = get();
    if (tourId) get().markSeen([tourId]);
    set({ tourId: null, steps: [], index: 0 });
  },
}));

// --- API imperativa (fora do React) -----------------------------------------

/** Auto/contextual: so dispara se ligado, nao visto e nada ativo. */
export function maybeStartTutorial(id) {
  return useTutorialStore.getState().startTour(id);
}

/** Replay (menu): forca, ignorando o `seen`. */
export function startTutorial(id) {
  return useTutorialStore.getState().startTour(id, { force: true });
}

/**
 * Semeadura de 1a execucao. Chamar quando o roster ja estiver carregado.
 * Usuario com personagens => marca tudo visto (nao interrompe quem ja usa o
 * app); instalacao nova => persiste o estado inicial com `seen` vazio.
 */
export function seedTutorials(rosterCount) {
  const st = useTutorialStore.getState();
  if (st.hasPersisted()) return; // ja rodou antes
  st.markSeen(rosterCount > 0 ? ALL_TOUR_IDS : []);
}

export default useTutorialStore;
