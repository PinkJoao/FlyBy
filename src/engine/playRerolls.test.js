// =============================================================================
// playRerolls.test: rolar de novo um teste gravado, pela regra de uma feature
// =============================================================================
// O QUE FAZ
//   Prova quais regras cada evento oferece (a salvaguarda ao Disciplined Survivor, o ataque
//   de magia ao Seeking Spell, a Rage ao Fanatical Focus), o gasto e o bônus da nova
//   rolagem, e que o evento de morte fica de fora.
//
// FUNÇÕES
//   check(type, id), catalog(features), attack(key): um evento de teste gravado, um
//     catálogo mínimo e um evento de ataque.
//
// DECISÕES E ARMADILHAS
//   - O rng fixo (sequenceRng) faz o d20 cair onde o teste quer.
// -----------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { rerollOptions, rerollEvent } from './playRerolls';
import { emptyPlayState } from './playState';
import { sequenceRng } from './dice';

const check = (type, id) => ({ id: 'e1', kind: 'check', label: 'Wisdom save', payload: { test: { type, id } }, rolls: { mode: 'normal', total: 5, parts: [{ label: 'd20', formula: '1d20', total: 3 }, { label: 'Save bonus', formula: '2', total: 2 }] }, ops: [] });
const catalog = (features) => ({
  features,
  rollData: { 'scale.barbarian.rage-damage': 3 },
  resources: [{ key: 'pool:focus', kind: 'pool', item: "Monk's Focus", name: 'Focus Points', max: 4 }],
  attacks: [{ key: 'attack:fire-bolt', kind: 'cantrip' }, { key: 'attack:dagger', kind: 'weapon' }],
});
const attack = (key) => ({ id: 'a', kind: 'attack', label: 'x', payload: { attackKey: key }, rolls: { parts: [] } });

describe('as regras de cada evento', () => {
  it('a salvaguarda oferece o Disciplined Survivor com o Focus; o teste de perícia não', () => {
    const c = catalog(['disciplined survivor']);
    const opts = rerollOptions(check('save', 'wis'), c, emptyPlayState('x'));
    expect(opts.map((o) => o.id)).toEqual(['disciplined survivor', 'rule']);
    expect(opts[0]).toMatchObject({ spendKey: 'pool:focus', left: 4 });
    expect(rerollOptions(check('skill', 'ath'), c, emptyPlayState('x')).map((o) => o.id)).toEqual(['rule']);
  });

  it('o Seeking Spell só no ataque de magia; o Fanatical Focus só com a Rage', () => {
    const c = catalog(['seeking spell', 'fanatical focus']);
    expect(rerollOptions(attack('attack:fire-bolt'), c, emptyPlayState('x')).map((o) => o.id)).toContain('seeking spell');
    expect(rerollOptions(attack('attack:dagger'), c, emptyPlayState('x')).map((o) => o.id)).not.toContain('seeking spell');
    const raging = { ...emptyPlayState('x'), modifiers: [{ label: 'Rage' }] };
    expect(rerollOptions(check('save', 'con'), c, emptyPlayState('x')).map((o) => o.id)).not.toContain('fanatical focus');
    expect(rerollOptions(check('save', 'con'), c, raging).find((o) => o.id === 'fanatical focus').bonus).toBe('@scale.barbarian.rage-damage');
  });

  it('o teste de morte não se rola de novo', () => {
    expect(rerollOptions({ kind: 'deathSave', rolls: {} }, catalog([]), emptyPlayState('x'))).toEqual([]);
  });
});

describe('a nova rolagem', () => {
  it('rola o mesmo d20 e as mesmas partes, soma o bônus, gasta e marca de onde veio', () => {
    const option = { id: 'fanatical focus', label: 'Fanatical Focus', spendKey: null, bonus: '@scale.barbarian.rage-damage' };
    const ev = rerollEvent({ event: check('save', 'con'), catalog: catalog(['fanatical focus']), option, rng: sequenceRng([15]) });
    expect(ev).toMatchObject({ kind: 'check', label: 'Wisdom save (reroll)', payload: { reroll: { of: 'e1', source: 'Fanatical Focus' } }, rolls: { natural: 15, total: 20 } });
    const focus = rerollEvent({ event: check('save', 'wis'), catalog: catalog([]), option: { label: 'Disciplined Survivor', spendKey: 'pool:focus' }, rng: sequenceRng([20]) });
    expect(focus.ops).toEqual([{ op: 'spend', key: 'pool:focus', amount: 1 }]);
    expect(focus.payload.spent).toEqual([{ name: 'Focus Points', amount: 1 }]);
    expect(focus.rolls.isCritical).toBe(true);
  });
});
