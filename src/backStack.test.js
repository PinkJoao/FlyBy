// =============================================================================
// backStack.test: o voltar fecha a camada de cima, e as entradas gastas pulam
// =============================================================================
// O QUE FAZ
//   Uma janela falsa com histórico de verdade (pilha de entradas, ponteiro,
//   popstate assíncrono como o do navegador) e os casos: voltar fecha só a de
//   cima; fechar pela interface deixa a entrada gasta, que o voltar pula sem
//   mudar de página; camadas aninhadas; depois de recarregar; o forward; e o
//   popRoute, que desempilha a página inteira até a anterior.
//
// FUNÇÕES
//   fakeWindow(): a janela falsa; `goBack()` e `goForward()` imitam o aparelho e
//     `flush()` entrega os popstate pendentes.
// -----------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { createBackStack } from './backStack';

function fakeWindow(initialState = null) {
  const entries = [{ state: initialState }];
  let at = 0;
  const listeners = new Set();
  const queue = [];
  const move = (delta) => {
    queue.push(() => {
      const next = at + delta;
      if (next < 0 || next >= entries.length) return;
      at = next;
      for (const fn of listeners) fn();
    });
  };
  const win = {
    history: {
      get state() {
        return entries[at].state;
      },
      pushState(state) {
        entries.splice(at + 1);
        entries.push({ state });
        at = entries.length - 1;
      },
      back: () => move(-1),
    },
    addEventListener: (type, fn) => listeners.add(fn),
    removeEventListener: (type, fn) => listeners.delete(fn),
    goBack: () => move(-1),
    goForward: () => move(1),
    flush() {
      while (queue.length) queue.shift()();
    },
    position: () => at,
    length: () => entries.length,
  };
  return win;
}

describe('backStack', () => {
  it('o voltar fecha só a camada de cima', () => {
    const win = fakeWindow();
    const stack = createBackStack(win);
    const closeA = vi.fn();
    const closeB = vi.fn();
    stack.push(closeA);
    stack.push(closeB);
    win.goBack();
    win.flush();
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
    expect(stack.liveCount()).toBe(1);
  });

  it('o estado do router é copiado para a entrada da camada', () => {
    const win = fakeWindow({ key: 'abc', idx: 2 });
    const stack = createBackStack(win);
    stack.push(() => {});
    expect(win.history.state).toMatchObject({ key: 'abc', idx: 2 });
  });

  it('fechar pela interface deixa a entrada gasta, e o voltar a pula até a base', () => {
    const win = fakeWindow();
    const stack = createBackStack(win);
    const id = stack.push(() => {});
    stack.release(id);
    const closeB = vi.fn();
    stack.push(closeB);
    win.goBack();
    win.flush();
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(win.position()).toBe(0);
  });

  it('entrada gasta entre duas vivas: um voltar fecha a de cima e para na de baixo', () => {
    const win = fakeWindow();
    const stack = createBackStack(win);
    const closePanel = vi.fn();
    stack.push(closePanel);
    stack.release(stack.push(() => {}));
    const closeDrawer = vi.fn();
    stack.push(closeDrawer);
    win.goBack();
    win.flush();
    expect(closeDrawer).toHaveBeenCalledTimes(1);
    expect(closePanel).not.toHaveBeenCalled();
    expect(win.position()).toBe(1);
  });

  it('voltar até a base fecha todas as vivas acima dela', () => {
    const win = fakeWindow();
    const stack = createBackStack(win);
    const closes = [vi.fn(), vi.fn(), vi.fn()];
    for (const fn of closes) stack.push(fn);
    win.goBack();
    win.goBack();
    win.goBack();
    win.flush();
    for (const fn of closes) expect(fn).toHaveBeenCalledTimes(1);
    expect(stack.liveCount()).toBe(0);
  });

  it('depois de recarregar, uma camada nova fica acima das entradas gastas antigas', () => {
    const win = fakeWindow();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const before = createBackStack(win);
    before.push(() => {});
    before.dispose();
    vi.setSystemTime(1_000_050);
    const after = createBackStack(win);
    vi.useRealTimers();
    const close = vi.fn();
    after.push(close);
    win.goBack();
    win.flush();
    expect(close).toHaveBeenCalledTimes(1);
    expect(win.position()).toBe(0);
  });

  it('avançar para uma entrada gasta não pula de volta', () => {
    const win = fakeWindow();
    const stack = createBackStack(win);
    const id = stack.push(() => {});
    win.goBack();
    win.flush();
    expect(stack.liveCount()).toBe(0);
    win.goForward();
    win.flush();
    expect(win.position()).toBe(1);
    expect(id).toBeGreaterThan(0);
  });

  it('popRoute desempilha a página atual inteira (camadas e passos) e para na anterior', () => {
    const win = fakeWindow({ idx: 0 });
    const stack = createBackStack(win);
    win.history.pushState({ idx: 1 });
    stack.release(stack.push(() => {}));
    win.history.pushState({ idx: 2 });
    const steps = [vi.fn(), vi.fn()];
    for (const fn of steps) stack.push(fn);
    const then = vi.fn();
    stack.popRoute(then);
    win.flush();
    expect(win.history.state.idx).toBe(1);
    expect(win.history.state.flybyLayer).toBeUndefined();
    expect(then).toHaveBeenCalledTimes(1);
    for (const fn of steps) expect(fn).toHaveBeenCalledTimes(1);
  });
});
