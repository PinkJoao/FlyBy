// =============================================================================
// settingsStore: as preferências do app (Zustand e localStorage)
// =============================================================================
// O QUE FAZ
//   Preferências que NÃO são de um personagem: por ora só a Character Guidance (o
//   assistente de criação e level-up, Fase D). Ficam no localStorage (síncrono, e
//   não é dado de jogo), não no IndexedDB.
//
//   guidance: 'ask' pergunta a cada criação (o padrão); 'on' guia sempre; 'off'
//   nunca guia.
//
// FUNÇÕES
//   load(), persist(state): leitura e escrita no localStorage. Sem localStorage
//     (modo privado), as preferências ficam só em memória.
//   useSettingsStore: o store. setGuidance(value) muda a preferência.
// -----------------------------------------------------------------------------

import { create } from 'zustand';

const KEY = 'builder5e:settings';

const DEFAULTS = { guidance: 'ask' };

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

function persist(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ guidance: state.guidance }));
  } catch {
    // localStorage indisponível (modo privado): as preferências ficam só em memória.
  }
}

const useSettingsStore = create((set, get) => ({
  ...load(),

  /** Define a preferência de Character Guidance ('ask', 'on' ou 'off'). */
  setGuidance: (guidance) => {
    set({ guidance });
    persist(get());
  },
}));

export default useSettingsStore;
