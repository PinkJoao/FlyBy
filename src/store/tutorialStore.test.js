import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import useTutorialStore, { maybeStartTutorial, startTutorial, seedTutorials } from './tutorialStore';

// A suite roda no ambiente node (sem jsdom no projeto). O store ja guarda o
// acesso a window/localStorage; aqui damos stubs minimos p/ os testes de
// persistencia e de dispositivo. O store le esses globais em tempo de chamada,
// entao trocar os stubs por teste basta.
function makeLocalStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}

beforeEach(() => {
  globalThis.localStorage = makeLocalStorage();
  globalThis.window = { matchMedia: undefined }; // default: desktop
  useTutorialStore.setState({ enabled: true, seen: {}, tourId: null, steps: [], index: 0 });
});

afterEach(() => {
  delete globalThis.window;
  delete globalThis.localStorage;
});

/** Simula o dispositivo p/ o filtro de passos por `only`. */
function setDevice(mobile) {
  globalThis.window.matchMedia = () => ({ matches: mobile });
}

describe('startTour / auto-trigger', () => {
  it('inicia quando ligado e nao visto', () => {
    expect(maybeStartTutorial('selector')).toBe(true);
    expect(useTutorialStore.getState().tourId).toBe('selector');
    expect(useTutorialStore.getState().index).toBe(0);
  });

  it('nao dispara duas vezes ao mesmo tempo (um por vez)', () => {
    expect(maybeStartTutorial('selector')).toBe(true);
    expect(maybeStartTutorial('selector')).toBe(false);
  });

  it('nao auto-dispara um tour ja visto', () => {
    useTutorialStore.setState({ seen: { selector: true } });
    expect(maybeStartTutorial('selector')).toBe(false);
  });

  it('nao auto-dispara com o tutorial desligado', () => {
    useTutorialStore.getState().setEnabled(false);
    expect(maybeStartTutorial('selector')).toBe(false);
  });

  it('startTutorial (replay) forca mesmo ja visto', () => {
    useTutorialStore.setState({ seen: { selector: true } });
    expect(startTutorial('selector')).toBe(true);
    expect(useTutorialStore.getState().tourId).toBe('selector');
  });

  it('id desconhecido nao inicia', () => {
    expect(maybeStartTutorial('nope')).toBe(false);
  });
});

describe('filtro de passos por dispositivo', () => {
  it('desktop e mobile produzem contagens diferentes', () => {
    setDevice(false);
    startTutorial('selector');
    const desktop = useTutorialStore.getState().steps.length;
    useTutorialStore.getState().finish();

    setDevice(true);
    startTutorial('selector');
    const steps = useTutorialStore.getState().steps;
    const mobile = steps.length;

    expect(desktop).toBeGreaterThan(0);
    expect(mobile).toBeGreaterThan(0);
    expect(desktop).not.toBe(mobile);
    // Nenhum passo `only` do outro dispositivo sobra.
    for (const s of steps) {
      expect(s.only === undefined || s.only === 'mobile').toBe(true);
    }
  });
});

describe('navegacao', () => {
  it('next avanca e no ultimo encerra marcando visto', () => {
    startTutorial('selector');
    const n = useTutorialStore.getState().steps.length;
    for (let i = 0; i < n; i++) useTutorialStore.getState().next();
    const st = useTutorialStore.getState();
    expect(st.tourId).toBe(null);
    expect(st.seen.selector).toBe(true);
  });

  it('back nao passa de zero', () => {
    startTutorial('selector');
    useTutorialStore.getState().back();
    expect(useTutorialStore.getState().index).toBe(0);
    useTutorialStore.getState().next();
    useTutorialStore.getState().back();
    expect(useTutorialStore.getState().index).toBe(0);
  });

  it('finish marca visto e persiste', () => {
    startTutorial('selector');
    useTutorialStore.getState().finish();
    expect(useTutorialStore.getState().seen.selector).toBe(true);
    expect(JSON.parse(localStorage.getItem('flyby:tutorial')).seen.selector).toBe(true);
  });
});

describe('enabled / resetSeen', () => {
  it('desligar fecha um tour aberto', () => {
    startTutorial('selector');
    useTutorialStore.getState().setEnabled(false);
    expect(useTutorialStore.getState().tourId).toBe(null);
  });

  it('resetSeen limpa e reativa o auto-disparo', () => {
    useTutorialStore.setState({ seen: { selector: true } });
    useTutorialStore.getState().resetSeen();
    expect(useTutorialStore.getState().seen).toEqual({});
    expect(maybeStartTutorial('selector')).toBe(true);
  });
});

describe('seedTutorials (1a execucao)', () => {
  it('usuario com personagens nasce com tudo visto', () => {
    seedTutorials(3);
    expect(useTutorialStore.getState().seen.selector).toBe(true);
    expect(maybeStartTutorial('selector')).toBe(false);
  });

  it('instalacao nova mantem os tours ligados', () => {
    seedTutorials(0);
    expect(useTutorialStore.getState().seen).toEqual({});
    expect(maybeStartTutorial('selector')).toBe(true);
  });

  it('e idempotente (nao re-semeia apos persistir)', () => {
    seedTutorials(0); // persiste estado vazio
    useTutorialStore.setState({ seen: { selector: true } }); // simula progresso
    seedTutorials(5); // ja persistido: no-op, nao marca tudo
    expect(useTutorialStore.getState().seen).toEqual({ selector: true });
  });
});
