// =============================================================================
// settingsStore - preferências do app (Zustand + localStorage)
// =============================================================================
// Preferências que NÃO pertencem a um personagem: por ora só a "Character
// Guidance" (o assistente de criação/level-up, Fase D). Fica em localStorage
// (síncrono, não é dado de jogo) em vez do IndexedDB dos personagens.
//
//   guidance: 'ask' | 'on' | 'off'
//     'ask' - pergunta a cada criação se o jogador quer ser guiado (padrão).
//     'on'  - sempre guiado, sem perguntar.
//     'off' - nunca guiado, sem perguntar.
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

  /** Define a preferência de Character Guidance ('ask' | 'on' | 'off'). */
  setGuidance: (guidance) => {
    set({ guidance });
    persist(get());
  },
}));

export default useSettingsStore;
