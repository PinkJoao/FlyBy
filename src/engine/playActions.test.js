// =============================================================================
// playActions.test: testes das rolagens do play mode como eventos
// =============================================================================
// FUNÇÕES
//   seq(...values): um rng que devolve os valores em ordem e falha se acabarem.
//
// DECISÕES E ARMADILHAS
//   - O catálogo é uma fixture com a forma do derivePlayCatalog (checks, rollData,
//     ataques): o teste mira a montagem das partes e do evento.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { sequenceRng } from './dice';
import {
  testParts, bonusParts, rngFor, modeFlags, rollTestEvent, rollAttackEvent, damageParts, rollDamageEvent,
} from './playActions';

const seq = (...values) => sequenceRng(values, () => {
  throw new Error('rolou um dado a mais');
});

const catalog = {
  rollData: { prof: 2, abilities: { str: { mod: 3 } } },
  checks: {
    abilities: [{ ability: 'str', mod: 3, save: 5, saveProf: true }],
    skills: [{ skill: 'ath', ability: 'str', bonus: 5, prof: 1 }],
    initiative: { bonus: 2 },
  },
};
const longsword = {
  key: 'weapon:u1', kind: 'weapon', name: 'Longsword',
  toHit: { total: 5, parts: [{ label: 'Strength', formula: 3 }, { label: 'Proficiency', formula: 2 }] },
  damage: { dice: '1d8', bonus: 3, types: ['slashing'] }, versatile: '1d10',
};

describe('partes e opções', () => {
  it('cada tipo de teste lê o número certo do catálogo', () => {
    expect(testParts(catalog, { type: 'ability', id: 'str' })).toEqual([{ label: 'Modifier', formula: 3 }]);
    expect(testParts(catalog, { type: 'save', id: 'str' })).toEqual([{ label: 'Save bonus', formula: 5 }]);
    expect(testParts(catalog, { type: 'skill', id: 'ath' })).toEqual([{ label: 'Skill bonus', formula: 5 }]);
    expect(testParts(catalog, { type: 'initiative' })).toEqual([{ label: 'Initiative bonus', formula: 2 }]);
  });

  it('o bônus livre vira uma parte só quando há texto', () => {
    expect(bonusParts({ bonus: ' 1d4 ' })).toEqual([{ label: 'Bonus', formula: '1d4' }]);
    expect(bonusParts({ bonus: '' })).toEqual([]);
  });

  it('o modo vira vantagem ou desvantagem', () => {
    expect(modeFlags('advantage')).toEqual({ advantage: 1, disadvantage: 0 });
    expect(modeFlags('normal')).toEqual({ advantage: 0, disadvantage: 0 });
  });

  it('dado físico vem antes; o que faltar, o app rola', () => {
    const rng = rngFor({ manual: [15] }, () => 4);
    expect([rng(20), rng(20)]).toEqual([15, 4]);
  });

  it('o dano usa o dado versátil quando pedido', () => {
    expect(damageParts(longsword, { versatile: true })).toEqual([{ label: 'Longsword', formula: '1d10' }, { label: 'Modifier', formula: 3 }]);
    expect(damageParts({ name: 'Unarmed Strike', damage: { dice: null, bonus: 4 } })).toEqual([{ label: 'Modifier', formula: 4 }]);
  });
});

describe('eventos', () => {
  const now = new Date(Date.UTC(2026, 9, 24, 20));

  it('teste de perícia com vantagem e bônus vira evento "check" sem operações', () => {
    const e = rollTestEvent({ catalog, test: { type: 'skill', id: 'ath' }, name: 'Athletics', options: { mode: 'advantage', bonus: '1d4' }, rng: seq(6, 14, 3), now });
    expect(e).toMatchObject({ kind: 'check', label: 'Athletics', ops: [], payload: { test: { type: 'skill', id: 'ath' }, mode: 'advantage' } });
    expect(e.rolls.natural).toBe(14);
    expect(e.rolls.total).toBe(22);
  });

  it('o ataque marca o crítico pelo limiar e leva a chave do ataque', () => {
    const e = rollAttackEvent({ catalog, attack: longsword, options: { critThreshold: 19 }, rng: seq(19), now });
    expect(e).toMatchObject({ kind: 'attack', label: 'Longsword', payload: { attackKey: 'weapon:u1', critical: true } });
    expect(e.rolls.total).toBe(24);
  });

  it('o ataque de magia usa o bônus de ataque da origem', () => {
    const e = rollAttackEvent({ catalog, attack: { key: 'spell:x', name: 'Fire Bolt', attack: { bonus: 6 } }, rng: seq(10), now });
    expect(e.rolls.total).toBe(16);
  });

  it('o dano crítico dobra os dados e guarda tipos e flags', () => {
    const e = rollDamageEvent({ catalog, attack: longsword, options: { critical: true, bonus: '1d4' }, rng: seq(8, 2, 4, 1), now });
    expect(e).toMatchObject({ kind: 'damageRoll', payload: { types: ['slashing'], critical: true, versatile: false } });
    expect(e.rolls.total).toBe(8 + 2 + 3 + 4 + 1);
  });

  it('o dano de cantrip de save leva a CD no payload', () => {
    const flame = { key: 'spell:c|Sacred Flame', name: 'Sacred Flame', save: { ability: 'dex', dc: 13 }, damage: { dice: '1d8', types: ['radiant'] } };
    const e = rollDamageEvent({ catalog, attack: flame, rng: seq(5), now });
    expect(e.payload.save).toEqual({ ability: 'dex', dc: 13 });
    expect(e.rolls.total).toBe(5);
  });
});

describe('efeitos aplicados', () => {
  it('os efeitos somam vantagem e partes, e o limiar do crítico vem deles', () => {
    const applied = { advantage: 1, disadvantage: 0, parts: [{ label: 'Bless', formula: '1d4' }], d20Min: null, critThreshold: 19, autoFail: false, labels: ['Bless'] };
    const e = rollAttackEvent({ catalog, attack: longsword, options: { mode: 'normal', applied }, rng: seq(5, 19, 2) });
    expect(e.rolls.mode).toBe('advantage');
    expect(e.rolls.isCritical).toBe(true);
    expect(e.rolls.total).toBe(19 + 5 + 2);
    expect(e.payload.effects).toEqual(['Bless']);
  });

  it('o piso do Reliable Talent entra no teste, e a falha automática vai no payload', () => {
    const applied = { advantage: 0, disadvantage: 0, parts: [], d20Min: 10, critThreshold: null, autoFail: true, labels: ['Paralyzed: automatic failure'] };
    const e = rollTestEvent({ catalog, test: { type: 'skill', id: 'ath' }, name: 'Athletics', options: { applied }, rng: seq(3), now: new Date() });
    expect(e.rolls.total).toBe(15);
    expect(e.payload.autoFail).toBe(true);
  });
});
