// =============================================================================
// settingsStore: as preferências do app (Zustand e localStorage)
// =============================================================================
// O QUE FAZ
//   Preferências que NÃO são de um personagem: a Character Guidance (o assistente
//   de criação e level-up, Fase D), o tema e o aviso do Samsung Internet. Ficam no
//   localStorage (síncrono, e não é dado de jogo), não no IndexedDB.
//
//   guidance: 'ask' pergunta a cada criação (o padrão); 'on' guia sempre; 'off'
//   nunca guia.
//   samsungHintDismissed: o aviso de instalação do Samsung Internet (installHint,
//   DDL-0095) foi dispensado.
//   theme: 'system' (o padrão, segue o aparelho), 'dark', 'light' ou 'paper'
//   (src/theme.js). ATENÇÃO à chave KEY: o script inline do index.html a lê.
//   pdf: as opções da ficha PDF (src/pdf/pdfOptions.js, DDL-0105), a última
//   escolha do jogador; normalizadas na leitura, então um valor antigo não quebra.
//   playHistory: a janela do histórico do play mode ({ maxEvents, maxAgeDays },
//   engine/playState); o que passa dela é dobrado no estado-base (DDL-0108).
//   experimental: os recursos ainda em desenvolvimento ligados (DDL-0111); hoje,
//   o play mode. Desligado por padrão.
//
// FUNÇÕES
//   load(), persist(state): leitura e escrita no localStorage. Sem localStorage
//     (modo privado), as preferências ficam só em memória.
//   useSettingsStore: o store. setGuidance(value) muda a preferência;
//     dismissSamsungHint() esconde o aviso de instalação do Samsung Internet;
//     setTheme(value) grava o tema e o aplica no documento; setPdfOptions(opts)
//     grava as opções da ficha PDF; setPlayHistory(patch) muda a janela do
//     histórico do play mode; setExperimental(on) liga ou desliga os recursos em
//     desenvolvimento.
// -----------------------------------------------------------------------------

import { create } from 'zustand';
import { applyTheme } from '../theme';
import { normalizePdfOptions } from '../pdf/pdfOptions';
import { normalizeLimits } from '../engine/playState';

const KEY = 'builder5e:settings';

const DEFAULTS = { guidance: 'ask', samsungHintDismissed: false, theme: 'system', experimental: false };

function load() {
  try {
    const saved = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
    return { ...saved, pdf: normalizePdfOptions(saved.pdf), playHistory: normalizeLimits(saved.playHistory) };
  } catch {
    return { ...DEFAULTS, pdf: normalizePdfOptions(), playHistory: normalizeLimits() };
  }
}

function persist(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ guidance: state.guidance, samsungHintDismissed: state.samsungHintDismissed, theme: state.theme, pdf: state.pdf, playHistory: state.playHistory, experimental: !!state.experimental}));
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

  /** Grava o tema ('system', 'dark', 'light' ou 'paper') e o aplica. */
  setTheme: (theme) => {
    set({ theme });
    persist(get());
    applyTheme(theme);
  },

  /** Grava as opções da ficha PDF (normalizadas). */
  setPdfOptions: (opts) => {
    set({ pdf: normalizePdfOptions(opts) });
    persist(get());
  },

  /** Muda a janela do histórico do play mode (normalizada). */
  setPlayHistory: (patch) => {
    set({ playHistory: normalizeLimits({ ...get().playHistory, ...patch }) });
    persist(get());
  },

  /** Liga ou desliga os recursos em desenvolvimento (o play mode). */
  setExperimental: (on) => {
    set({ experimental: !!on });
    persist(get());
  },

  /** Esconde o aviso de instalação do Samsung Internet, de vez. */
  dismissSamsungHint: () => {
    set({ samsungHintDismissed: true });
    persist(get());
  },
}));

export default useSettingsStore;
