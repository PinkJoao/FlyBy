// =============================================================================
// playHealth.test: testes de dano, cura, temporário, morte e concentração
// =============================================================================
// FUNÇÕES
//   seq(...values): um rng que devolve os valores em ordem e falha se acabarem.
//   st(patch): um estado de jogo com o patch por cima do descansado.
//   after(state, outcome): o estado depois das operações de um resultado.
//   catalog(hpMax, defenses): um catálogo mínimo com o HP e as defesas.
//
// DECISÕES E ARMADILHAS
//   - Cada regra do XPHB tem o seu teste com o exemplo do próprio livro quando
//     ele dá um (5 de temporário e 7 de dano; HP máximo 12 com 6 e 18 de dano).
//   - O estado depois é sempre o do REDUTOR (applyOp): o que se testa é o que a
//     tela vai gravar, não um número calculado à parte.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { sequenceRng } from './dice';
import { emptyPlayState, applyOp, hpView } from './playState';
import {
  vitals, traitFor, adjustDamage, concentrationDc, damageOutcome, healOutcome, tempHpOutcome, deathSaveOutcome,
  damageEvent, deathSaveEvent, concentrationEvent, concentrationCheckEvent,
} from './playHealth';

const seq = (...values) => sequenceRng(values, () => {
  throw new Error('rolou um dado a mais');
});
const st = (patch = {}) => ({ ...emptyPlayState(), ...patch });
const after = (state, outcome) => outcome.ops.reduce(applyOp, state);
const catalog = (hpMax = 12, defenses = {}) => ({
  stats: { hpMax },
  defenses: { resist: [], immune: [], vulnerable: [], ...defenses },
  checks: { concentration: { bonus: 3 } },
  rollData: {},
});

describe('defesas', () => {
  it('lê a defesa pelo tipo, sem caixa', () => {
    const c = catalog(12, { resist: ['fire'], immune: ['poison'], vulnerable: ['cold', 'fire'] });
    expect(traitFor(c, 'Poison')).toBe('immune');
    expect(traitFor(c, 'fire')).toBe('resist+vulnerable');
    expect(traitFor(c, 'cold')).toBe('vulnerable');
    expect(traitFor(c, '')).toBeNull();
  });

  it('imunidade zera, resistência divide para baixo, vulnerabilidade dobra depois', () => {
    expect(adjustDamage(9, 'immune')).toBe(0);
    expect(adjustDamage(9, 'resist')).toBe(4);
    expect(adjustDamage(9, 'vulnerable')).toBe(18);
    expect(adjustDamage(9, 'resist+vulnerable')).toBe(8);
    expect(adjustDamage(9, null)).toBe(9);
  });

  it('CD de concentração: 10 ou metade, o maior, até 30', () => {
    expect(concentrationDc(7)).toBe(10);
    expect(concentrationDc(25)).toBe(12);
    expect(concentrationDc(100)).toBe(30);
  });
});

describe('dano', () => {
  it('o temporário vai primeiro (o exemplo do livro: 5 de temporário, 7 de dano)', () => {
    const s = st({ tempHp: 5 });
    const o = damageOutcome(s, catalog(), { amount: 7 });
    expect(o.summary).toMatchObject({ taken: 7, toTemp: 5, toHp: 2 });
    const next = after(s, o);
    expect(hpView(next, 12)).toEqual({ max: 12, current: 10, temp: 0 });
  });

  it('o dano não deixa o HP negativo e marca a queda a 0', () => {
    const o = damageOutcome(st({ damage: 9 }), catalog(), { amount: 5 });
    expect(o.summary.toHp).toBe(3);
    expect(o.summary.notes).toEqual(['Drops to 0 hit points']);
  });

  it('dano maciço mata (o exemplo do livro: máximo 12, com 6, toma 18)', () => {
    const o = damageOutcome(st({ damage: 6 }), catalog(), { amount: 18 });
    expect(after(st({ damage: 6 }), o).death.dead).toBe(true);
    expect(o.summary.notes).toEqual(['Dies from massive damage']);
  });

  it('com 0 HP, dano é uma falha, duas no crítico, e tira a estabilidade', () => {
    const zero = st({ damage: 12, death: { success: 0, failure: 0, stable: true, dead: false } });
    const one = after(zero, damageOutcome(zero, catalog(), { amount: 3 }));
    expect(one.death).toEqual({ success: 0, failure: 1, stable: false, dead: false });
    const two = after(one, damageOutcome(one, catalog(), { amount: 3, critical: true }));
    expect(two.death).toMatchObject({ failure: 3, dead: true });
  });

  it('com 0 HP, dano maior ou igual ao máximo mata', () => {
    const zero = st({ damage: 12 });
    expect(after(zero, damageOutcome(zero, catalog(), { amount: 12 })).death.dead).toBe(true);
  });

  it('a defesa entra antes do temporário, e a CD de concentração sai do dano sofrido', () => {
    const s = st({ concentration: { name: 'Bless' } });
    const o = damageOutcome(s, catalog(40, { resist: ['fire'] }), { amount: 30, type: 'fire' });
    expect(o.summary).toMatchObject({ taken: 15, trait: 'resist', concentrationDc: 10 });
    expect(damageOutcome(st(), catalog(), { amount: 30 }).summary.concentrationDc).toBeNull();
  });
});

describe('cura e temporário', () => {
  it('cura até o máximo e, saindo do zero, limpa a morte', () => {
    const s = st({ damage: 12, death: { success: 1, failure: 2, stable: false, dead: false } });
    const o = healOutcome(s, catalog(), 20);
    expect(o.summary).toMatchObject({ from: 0, to: 12, healed: 12 });
    expect(after(s, o)).toMatchObject({ damage: 0, death: { success: 0, failure: 0 } });
  });

  it('cura com o dano guardado acima do máximo (a ficha desceu de nível)', () => {
    const s = st({ damage: 30 });
    expect(hpView(after(s, healOutcome(s, catalog(12), 5)), 12).current).toBe(5);
  });

  it('temporário não soma: fica o maior, ou o novo com replace', () => {
    expect(after(st({ tempHp: 10 }), tempHpOutcome(st({ tempHp: 10 }), 12)).tempHp).toBe(12);
    const keep = tempHpOutcome(st({ tempHp: 10 }), 4);
    expect(keep.ops).toEqual([]);
    expect(keep.summary.kept).toBe(true);
    expect(after(st({ tempHp: 10 }), tempHpOutcome(st({ tempHp: 10 }), 4, { replace: true })).tempHp).toBe(4);
  });
});

describe('teste contra a morte', () => {
  const zero = (death = {}) => st({ damage: 12, death: { success: 0, failure: 0, stable: false, dead: false, ...death } });

  it('10 ou mais é sucesso; o terceiro deixa estável e zera', () => {
    expect(after(zero(), deathSaveOutcome(zero(), catalog(), { natural: 12, total: 12 })).death.success).toBe(1);
    const o = deathSaveOutcome(zero({ success: 2 }), catalog(), { natural: 15, total: 15 });
    expect(o.result).toBe('Stable');
    expect(after(zero({ success: 2 }), o).death).toEqual({ success: 0, failure: 0, stable: true, dead: false });
  });

  it('menos de 10 é falha; 1 natural conta duas; a terceira mata', () => {
    expect(deathSaveOutcome(zero(), catalog(), { natural: 9, total: 9 }).result).toBe('Failure');
    expect(after(zero(), deathSaveOutcome(zero(), catalog(), { natural: 1, total: 1 })).death.failure).toBe(2);
    expect(after(zero({ failure: 2 }), deathSaveOutcome(zero({ failure: 2 }), catalog(), { natural: 5, total: 5 })).death.dead).toBe(true);
  });

  it('20 natural recupera 1 HP e zera a contagem', () => {
    const s = zero({ failure: 2 });
    const next = after(s, deathSaveOutcome(s, catalog(), { natural: 20, total: 20 }));
    expect(hpView(next, 12).current).toBe(1);
    expect(next.death).toEqual({ success: 0, failure: 0, stable: false, dead: false });
    expect(vitals(next, catalog()).dying).toBe(false);
  });

  it('o evento rola o d20 e grava o resultado', () => {
    const e = deathSaveEvent({ state: zero(), catalog: catalog(), rng: seq(14) });
    expect(e).toMatchObject({ kind: 'deathSave', payload: { result: 'Success' } });
    expect(e.rolls.natural).toBe(14);
  });
});

describe('concentração', () => {
  it('começar e terminar viram uma operação cada', () => {
    expect(concentrationEvent({ name: 'Bless' }).ops).toEqual([{ op: 'concentration', value: { name: 'Bless' } }]);
    expect(concentrationEvent({}).ops).toEqual([{ op: 'concentration', value: null }]);
  });

  it('o save mantém com total igual ou maior que a CD, e a falha termina no mesmo evento', () => {
    const s = st({ concentration: { name: 'Bless' } });
    const kept = concentrationCheckEvent({ state: s, catalog: catalog(), dc: 12, rng: seq(9) });
    expect(kept.payload).toMatchObject({ dc: 12, kept: true });
    expect(kept.ops).toEqual([]);
    const lost = concentrationCheckEvent({ state: s, catalog: catalog(), dc: 12, rng: seq(8) });
    expect(lost.payload.kept).toBe(false);
    expect(lost.ops).toEqual([{ op: 'concentration', value: null }]);
  });

  it('o evento de dano leva o resumo para o cartão', () => {
    const e = damageEvent({ state: st({ concentration: { name: 'Bless' } }), catalog: catalog(), amount: 22, type: 'fire', critical: false });
    expect(e).toMatchObject({ kind: 'damage', payload: { taken: 22, concentrationDc: 11, type: 'fire' } });
  });
});

describe('dano com efeitos', () => {
  it('a resistência da Rage divide o dano físico', () => {
    const s = st({ modifiers: [{ id: 'r', label: 'Rage', resist: ['slashing'], effects: [] }] });
    expect(damageOutcome(s, catalog(), { amount: 9, type: 'slashing' }).summary).toMatchObject({ taken: 4, trait: 'resist' });
  });

  it('terminar a concentração tira o que dependia dela', () => {
    const s = st({ concentration: { name: 'Bless' }, modifiers: [{ id: 'b', label: 'Bless', concentration: 'k', effects: [] }] });
    expect(after(s, concentrationEvent({ state: s })).modifiers).toEqual([]);
  });
});
