// =============================================================================
// playCombat.test: testes do modo combate leve
// =============================================================================
// FUNÇÕES
//   seq(...values): um rng que devolve os valores em ordem e falha se acabarem.
//   st(patch): um estado de jogo com o patch por cima do descansado.
//   run(state, event): o estado depois das operações do evento.
//
// DECISÕES E ARMADILHAS
//   - A expiração é testada nas duas bordas: a rodada em que o efeito ainda vale
//     e a primeira em que já não vale.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { sequenceRng } from './dice';
import { emptyPlayState, applyOp } from './playState';
import { roundsOf, costOfActivation, startCombatEvent, nextTurnEvent, endCombatEvent, economyOp, withRounds } from './playCombat';
import { castEvent } from './playCast';

const seq = (...values) => sequenceRng(values, () => {
  throw new Error('rolou um dado a mais');
});
const st = (patch = {}) => ({ ...emptyPlayState(), ...patch });
const run = (state, event) => event.ops.reduce(applyOp, state);
const catalog = { checks: { initiative: { bonus: 3 } }, rollData: {}, resources: [{ key: 'slot:1', kind: 'slot', level: 1, max: 2 }] };

describe('durações e custos', () => {
  it('lê a duração do 5etools em rodadas', () => {
    expect(roundsOf([{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }])).toBe(10);
    expect(roundsOf([{ type: 'timed', duration: { type: 'hour', amount: 1 } }])).toBe(600);
    expect(roundsOf([{ type: 'timed', duration: { type: 'round', amount: 1 } }])).toBe(1);
    expect(roundsOf([{ type: 'instant' }])).toBeNull();
  });

  it('o custo do turno de uma ativação', () => {
    expect(costOfActivation('bonus')).toBe('bonus');
    expect(costOfActivation('minute')).toBeNull();
  });
});

describe('combate', () => {
  it('começar rola a iniciativa e abre a rodada 1', () => {
    const e = startCombatEvent({ catalog, rng: seq(12) });
    expect(e.rolls.total).toBe(15);
    expect(run(st(), e).combat).toEqual({ round: 1, initiative: 15, used: {} });
  });

  it('a economia é marcada em combate e nada fora dele', () => {
    const s = st({ combat: { round: 2, initiative: 10, used: {} } });
    expect(applyOp(s, economyOp(s, 'action')).combat.used).toEqual({ action: true });
    expect(economyOp(st(), 'action')).toBeNull();
    expect(economyOp(s, 'minute')).toBeNull();
  });

  it('o turno seguinte avança a rodada e devolve ação, bônus e reação', () => {
    const s = st({ combat: { round: 2, initiative: 10, used: { action: true, reaction: true } } });
    expect(run(s, nextTurnEvent({ state: s })).combat).toEqual({ round: 3, initiative: 10, used: {} });
  });

  it('um efeito de 1 minuto lançado na rodada 2 vale até a 11 e some no começo da 12', () => {
    const fx = withRounds({ id: 'f', label: 'Divine Favor', effects: [] }, st({ combat: { round: 2, used: {} } }), 10);
    expect(fx).toMatchObject({ rounds: 10, startRound: 2 });
    const at = (round) => st({ combat: { round, used: {} }, modifiers: [fx] });
    expect(run(at(10), nextTurnEvent({ state: at(10) })).modifiers).toHaveLength(1);
    expect(run(at(11), nextTurnEvent({ state: at(11) })).modifiers).toEqual([]);
    expect(withRounds(fx, st(), 10)).toBe(fx);
  });

  it('a concentração lançada em combate expira com a duração, levando os efeitos dela', () => {
    const bless = { key: 'spell:c|Bless', name: 'Bless', level: 1, concentration: true, durationRounds: 10, mechanics: {} };
    const s0 = st({ combat: { round: 1, used: {} } });
    const s1 = run(s0, castEvent({ state: s0, origin: { key: 'c' }, spell: bless, way: { id: 'slot:1', key: 'slot:1', level: 1, left: 2 }, onSelf: true }));
    expect(s1.concentration.expiresRound).toBe(11);
    const s10 = { ...s1, combat: { ...s1.combat, round: 10 } };
    const s11 = run(s10, nextTurnEvent({ state: s10 }));
    expect(s11.concentration).toBeNull();
    expect(s11.modifiers).toEqual([]);
  });

  it('terminar fecha o combate', () => {
    const s = st({ combat: { round: 4, used: {} } });
    const e = endCombatEvent({ state: s });
    expect(run(s, e).combat).toBeNull();
    expect(e.payload.rounds).toBe(4);
  });
});
