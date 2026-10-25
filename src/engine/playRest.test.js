// =============================================================================
// playRest.test: testes dos descansos do play mode
// =============================================================================
// FUNÇÕES
//   seq(...values): um rng que devolve os valores em ordem e falha se acabarem.
//   st(patch): um estado de jogo com o patch por cima do descansado.
//   run(state, event): o estado depois das operações do evento.
//
// DECISÕES E ARMADILHAS
//   - O catálogo é uma fixture com um recurso de cada forma de recuperação: tudo
//     no longo e 1 no curto (Second Wind), tudo no curto (pacto), uma vez por dia
//     (magia concedida), e o dado de vida, que só volta no longo.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { sequenceRng } from './dice';
import { emptyPlayState, applyOp, hpView } from './playState';
import { recoveryFor, rollHitDie, hitDiceLeft, shortRestEvent, longRestEvent, hitDiceEvent } from './playRest';

const seq = (...values) => sequenceRng(values, () => {
  throw new Error('rolou um dado a mais');
});
const st = (patch = {}) => ({ ...emptyPlayState(), ...patch });
const run = (state, event) => event.ops.reduce(applyOp, state);

const LR = { period: 'lr', type: 'recoverAll' };
const catalog = {
  stats: { hpMax: 30 },
  rollData: { abilities: { con: { mod: 2 } } },
  resources: [
    { key: 'hd:d10', kind: 'hitDice', name: 'd10 Hit Dice', faces: 10, max: 3, recovery: [LR] },
    { key: 'hd:d8', kind: 'hitDice', name: 'd8 Hit Dice', faces: 8, max: 2, recovery: [LR] },
    { key: 'pact', kind: 'pact', name: 'Pact slots', max: 2, recovery: [{ period: 'sr', type: 'recoverAll' }] },
    { key: 'pool:second-wind', kind: 'pool', name: 'Second Wind', max: 3, recovery: [LR, { period: 'sr', type: 'formula', formula: '1' }] },
    { key: 'granted:race|Misty Step', kind: 'granted', name: 'Misty Step', max: 1, recovery: [{ period: 'day', type: 'recoverAll' }] },
  ],
};

describe('recoveryFor', () => {
  const spent = st({ spent: { pact: 2, 'pool:second-wind': 3, 'granted:race|Misty Step': 1, 'hd:d10': 2 } });

  it('o curto devolve o que é de curto: tudo do pacto, 1 do Second Wind', () => {
    const r = recoveryFor(catalog, spent, 'sr');
    expect(r.ops).toEqual([{ op: 'restore', key: 'pact' }, { op: 'restore', key: 'pool:second-wind', amount: 1 }]);
    expect(run(spent, { ops: r.ops }).spent).toEqual({ 'pool:second-wind': 2, 'granted:race|Misty Step': 1, 'hd:d10': 2 });
  });

  it('o longo devolve tudo, inclusive o diário e os dados de vida', () => {
    expect(run(spent, { ops: recoveryFor(catalog, spent, 'lr').ops }).spent).toEqual({});
  });

  it('nada gasto, nada a devolver', () => {
    expect(recoveryFor(catalog, st(), 'lr')).toEqual({ ops: [], lines: [], groups: [] });
  });
});

describe('dados de vida', () => {
  it('rola com a CON e cura no mínimo 1', () => {
    expect(rollHitDie({ catalog, faces: 10, rng: seq(7) }).healed).toBe(9);
    const low = rollHitDie({ catalog: { ...catalog, rollData: { abilities: { con: { mod: -3 } } } }, faces: 8, rng: seq(1) });
    expect(low.rolls.total).toBe(-2);
    expect(low.healed).toBe(1);
  });

  it('conta o que sobra por face', () => {
    expect(hitDiceLeft(catalog, st({ spent: { 'hd:d10': 1 } }))).toEqual([
      { key: 'hd:d10', faces: 10, max: 3, left: 2 },
      { key: 'hd:d8', faces: 8, max: 2, left: 2 },
    ]);
  });
});

describe('descanso curto', () => {
  it('gasta os dados por face, cura a soma e recupera o que é de curto, num evento só', () => {
    const s = st({ damage: 25, spent: { pact: 1 } });
    const spends = [rollHitDie({ catalog, faces: 10, rng: seq(6) }), rollHitDie({ catalog, faces: 10, rng: seq(3) }), rollHitDie({ catalog, faces: 8, rng: seq(8) })];
    const e = shortRestEvent({ state: s, catalog, spends });
    const next = run(s, e);
    expect(next.spent).toEqual({ 'hd:d10': 2, 'hd:d8': 1 });
    expect(hpView(next, 30).current).toBe(5 + 8 + 5 + 10);
    expect(e.payload.lines[0]).toEqual({ name: 'Hit Point Dice', detail: '1d8 + 2d10 spent, 23 HP regained' });
    expect(e.rolls.total).toBe(23);
  });

  it('a cura não passa do máximo', () => {
    const s = st({ damage: 3 });
    const e = shortRestEvent({ state: s, catalog, spends: [rollHitDie({ catalog, faces: 10, rng: seq(10) })] });
    expect(hpView(run(s, e), 30).current).toBe(30);
    expect(e.rolls.total).toBe(3);
  });
});

describe('descanso longo', () => {
  it('devolve HP, dados de vida e recursos; tira temporário, exaustão, morte e concentração', () => {
    const s = st({
      damage: 25, tempHp: 4, spent: { 'hd:d10': 3, pact: 2 },
      conditions: { exhaustion: 2 }, death: { success: 0, failure: 0, stable: true, dead: false },
      concentration: { name: 'Bless' },
    });
    const e = longRestEvent({ state: s, catalog });
    const next = run(s, e);
    expect(hpView(next, 30)).toEqual({ max: 30, current: 30, temp: 0 });
    expect(next.spent).toEqual({});
    expect(next.conditions).toEqual({ exhaustion: 1 });
    expect(next.death).toEqual({ success: 0, failure: 0, stable: false, dead: false });
    expect(next.concentration).toBeNull();
    expect(e.payload.lines.map((l) => l.name)).toEqual(['Hit points', 'd10 Hit Dice', 'Pact slots', 'Exhaustion', 'Concentration']);
  });

  it('descansado, o longo não muda nada', () => {
    expect(longRestEvent({ state: st(), catalog }).ops).toEqual([]);
  });
});

describe('hitDiceEvent', () => {
  it('gasta da maior face para a menor e cura', () => {
    const s = st({ damage: 20 });
    const ev = hitDiceEvent({ state: s, catalog, count: 4, rng: seq(5, 6, 7, 3) });
    expect(ev.ops.filter((o) => o.op === 'spend')).toEqual([{ op: 'spend', key: 'hd:d10', amount: 3 }, { op: 'spend', key: 'hd:d8', amount: 1 }]);
    expect(ev.rolls.parts.map((p) => p.total)).toEqual([7, 8, 9, 5]);
    expect(ev.payload.healed).toBe(20);
    expect(hpView(run(s, ev), 30).current).toBe(30);
  });

  it('pedir mais do que sobra gasta o que houver', () => {
    const s = st({ damage: 5, spent: { 'hd:d10': 3, 'hd:d8': 1 } });
    const ev = hitDiceEvent({ state: s, catalog, count: 3, rng: seq(1) });
    expect(ev.payload.spent).toBe(1);
    expect(run(s, ev).spent).toEqual({ 'hd:d10': 3, 'hd:d8': 2 });
  });

  it('negativo devolve os gastos, a maior face primeiro', () => {
    const s = st({ spent: { 'hd:d10': 1, 'hd:d8': 2 } });
    const ev = hitDiceEvent({ state: s, catalog, count: -2 });
    expect(ev.payload.restored).toBe(2);
    expect(run(s, ev).spent).toEqual({ 'hd:d8': 1 });
  });

  it('o descanso longo desfaz o ajuste do máximo', () => {
    const s = st({ maxHpDelta: 5, damage: 10 });
    const s1 = run(s, longRestEvent({ state: s, catalog }));
    expect(s1.maxHpDelta).toBe(0);
    expect(hpView(s1, 30)).toEqual({ max: 30, current: 30, temp: 0 });
  });
});
