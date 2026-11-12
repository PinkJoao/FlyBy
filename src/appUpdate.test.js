// =============================================================================
// appUpdate.test: o aviso de versão nova, a checagem e a recarga por pedaço
// =============================================================================
// O QUE FAZ
//   Garante que o aviso aparece só quando o worker novo assume, que a checagem
//   ao voltar ao app respeita o intervalo, e que a recarga por pedaço perdido
//   acontece uma vez e não entra em laço.
//
// FUNÇÕES
//   memoryStorage(): um sessionStorage em memória.
//   fakeWindow(): a janela falsa, que guarda os ouvintes para o teste chamar.
// -----------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import {
  installAppUpdates,
  getUpdateState,
  dismissUpdate,
  shouldCheck,
  chunkReloadAllowed,
  CHECK_GAP,
  CHUNK_RELOAD_GAP,
} from './appUpdate';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

function fakeWindow() {
  const handlers = {};
  const docHandlers = {};
  return {
    handlers,
    docHandlers,
    addEventListener: (t, fn) => (handlers[t] = fn),
    document: { visibilityState: 'visible', addEventListener: (t, fn) => (docHandlers[t] = fn) },
    navigator: { onLine: true },
    location: { reload: vi.fn() },
    sessionStorage: memoryStorage(),
    setInterval: vi.fn(),
  };
}

describe('shouldCheck', () => {
  it('waits the minimum gap between two checks', () => {
    expect(shouldCheck(1000, 1000 + CHECK_GAP - 1)).toBe(false);
    expect(shouldCheck(1000, 1000 + CHECK_GAP)).toBe(true);
  });
});

describe('chunkReloadAllowed', () => {
  it('allows one reload, then blocks inside the window', () => {
    const s = memoryStorage();
    expect(chunkReloadAllowed(s, 50_000)).toBe(true);
    expect(chunkReloadAllowed(s, 50_000 + CHUNK_RELOAD_GAP - 1)).toBe(false);
    expect(chunkReloadAllowed(s, 50_000 + CHUNK_RELOAD_GAP)).toBe(true);
  });

  it('still allows the reload without storage', () => {
    expect(chunkReloadAllowed(null, 50_000)).toBe(true);
  });
});

describe('installAppUpdates', () => {
  it('shows the notice when the new worker takes over, and checks on return', () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const win = fakeWindow();
    const update = vi.fn(() => Promise.resolve());
    let opts;
    installAppUpdates((o) => (opts = o), win);
    expect(opts.immediate).toBe(true);
    expect(getUpdateState().ready).toBe(false);

    opts.onRegisteredSW('/sw.js', { update });
    expect(win.setInterval).toHaveBeenCalledTimes(1);
    win.docHandlers.visibilitychange();
    expect(update).not.toHaveBeenCalled();
    vi.setSystemTime(100_000 + CHECK_GAP);
    win.docHandlers.visibilitychange();
    expect(update).toHaveBeenCalledTimes(1);

    opts.onNeedReload();
    expect(getUpdateState()).toEqual({ ready: true, dismissed: false });
    dismissUpdate();
    expect(getUpdateState().dismissed).toBe(true);
    opts.onNeedReload();
    expect(getUpdateState().dismissed).toBe(false);
    vi.useRealTimers();
  });

  it('reloads once when a lazy chunk is gone', () => {
    const win = fakeWindow();
    installAppUpdates(() => {}, win);
    const first = { preventDefault: vi.fn() };
    win.handlers['vite:preloadError'](first);
    expect(first.preventDefault).toHaveBeenCalled();
    expect(win.location.reload).toHaveBeenCalledTimes(1);
    const again = { preventDefault: vi.fn() };
    win.handlers['vite:preloadError'](again);
    expect(again.preventDefault).not.toHaveBeenCalled();
    expect(win.location.reload).toHaveBeenCalledTimes(1);
  });
});
