// =============================================================================
// spellStats.test: testes dos números do topo do grimório
// =============================================================================
// FUNÇÕES
//   sum(n): a soma das parcelas de um número.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { slotSummary, slotsAt, spellLimits, spellNumbers, spellTimes } from './spellStats';

const wizard = {
  ability: 'int',
  abilityMod: 4,
  saveDc: 16,
  attackBonus: 8,
  slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  pactSlots: null,
  cantripLimit: 4,
  prepareLimit: 14,
  knownLimit: 22,
  cantrips: [1, 2, 3, 4],
  prepared: Array.from({ length: 13 }, () => ({})),
  unprepared: [...Array.from({ length: 11 }, () => ({})), { free: 'Evoker' }],
  arcana: [],
  uses: [{ name: 'Shield', label: '1/Long Rest' }],
};
const warlock = {
  ability: 'cha',
  abilityMod: 3,
  saveDc: 13,
  attackBonus: 5,
  slots: {},
  pactSlots: { level: 5, slots: 3 },
  cantripLimit: 4,
  prepareLimit: 11,
  cantrips: [],
  prepared: [],
  arcana: [{ level: 6, spell: {} }, { level: 7, spell: null }],
  uses: [],
};

const sum = (n) => n.parts.reduce((t, p) => t + p.value, 0);

describe('spellNumbers', () => {
  it('a CD é 8 + proficiência + atributo e o ataque não tem a base', () => {
    const [dc, atk] = spellNumbers(wizard, 4);
    expect(dc.parts.map((p) => [p.key, p.value])).toEqual([['base', 8], ['prof', 4], ['int', 4]]);
    expect(atk.parts.map((p) => [p.key, p.value])).toEqual([['prof', 4], ['int', 4]]);
  });

  it('o que sobra é dos itens, com o nome deles, e as parcelas somam o valor', () => {
    const o = { ...wizard, saveDc: 18, attackBonus: 10, itemBonuses: [{ source: 'Robe of the Archmagi', attack: 2, dc: 2 }] };
    const [dc, atk] = spellNumbers(o, 4);
    expect(dc.parts.at(-1)).toEqual({ key: 'items', value: 2, sources: ['Robe of the Archmagi'] });
    expect(sum(dc)).toBe(18);
    expect(sum(atk)).toBe(10);
  });

  it('origem sem atributo não tem número', () => {
    expect(spellNumbers({ ability: null }, 4)).toEqual([]);
  });
});

describe('spellLimits', () => {
  it('falta e passa; a magia de graça do grimório não conta', () => {
    const by = Object.fromEntries(spellLimits(wizard).map((l) => [l.key, l]));
    expect(by.cantrips).toMatchObject({ have: 4, max: 4, over: false, missing: false });
    expect(by.prepared).toMatchObject({ have: 13, max: 14, missing: true });
    expect(by.known).toMatchObject({ have: 24, max: 22, over: false });
  });

  it('acima do limite acende, até com limite zero', () => {
    const [c] = spellLimits({ cantripLimit: 0, cantrips: [1] });
    expect(c).toMatchObject({ key: 'cantrips', over: true });
  });

  it('o arcanum sem magia falta', () => {
    expect(spellLimits(warlock).find((l) => l.key === 'arcana')).toMatchObject({ have: 1, max: 2, missing: true });
  });
});

describe('espaços', () => {
  it('soma os círculos e separa o pacto', () => {
    expect(slotSummary(wizard)).toMatchObject({ total: 14, pact: null });
    expect(slotSummary(warlock)).toMatchObject({ total: 0, pact: { level: 5, count: 3 } });
  });

  it('o grupo do círculo mostra o espaço dele', () => {
    expect(slotsAt(wizard, 5)).toEqual([{ kind: 'slot', level: 5, count: 1 }]);
    expect(slotsAt(wizard, 6)).toEqual([]);
    expect(slotsAt(wizard, 0)).toEqual([]);
  });

  it('o pacto vale até o círculo dele e o arcanum no próprio', () => {
    expect(slotsAt(warlock, 1)).toEqual([{ kind: 'pact', level: 5, count: 3 }]);
    expect(slotsAt(warlock, 6)).toEqual([{ kind: 'arcanum', level: 6, count: 1 }]);
  });

  it('no multiclasse a classe conjuradora mostra os espaços do personagem', () => {
    const all = { slots: { 1: 4, 2: 3, 3: 2 }, pactSlots: { level: 5, slots: 3 } };
    const wiz = { ...wizard, kind: 'class', casterCode: 'full', slots: all.slots };
    expect(slotSummary(wiz, all)).toMatchObject({ total: 9, pact: { level: 5, count: 3 } });
    expect(slotSummary(wiz)).toMatchObject({ total: 9, pact: null });
    expect(slotsAt(wiz, 1, all).map((p) => [p.kind, p.count])).toEqual([['slot', 4], ['pact', 3]]);
    expect(slotsAt(wiz, 5, all).map((p) => p.kind)).toEqual(['pact']);
    expect(slotSummary({ ...warlock, kind: 'class', casterCode: 'pact' }, all)).toMatchObject({ total: 9, pact: { count: 3 } });
    expect(slotSummary({ kind: 'feat', slots: {} }, all)).toMatchObject({ total: 0, pact: null });
  });

  it('os usos próprios', () => {
    expect(spellTimes(wizard)).toEqual([{ name: 'Shield', label: '1/Long Rest', note: null }]);
  });
});
