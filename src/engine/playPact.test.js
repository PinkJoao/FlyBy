// =============================================================================
// playPact.test: a arma de pacto do Pact of the Blade no play mode
// =============================================================================
// O QUE FAZ
//   Confere sobre um catálogo montado à mão (warlock 12, CAR +4, PB +4): a arma
//   vinculada vira ataque com CAR e proficiência e SUBSTITUI a original na lista; o
//   +1 do Improved Pact Weapon só sem bônus mágico; a arma invocada pelos dados da
//   arma-base; o Devouring Blade com três ataques; o evento do vínculo e o estado; só arma mágica
//   no vínculo, a conjurada no inventário e os tipos de dano (DDL-0240).
//
// FUNÇÕES
//   catalogWith(features): o catálogo do warlock com as features dadas.
//
// DECISÕES E ARMADILHAS
//   - Os números são os do passe ao vivo (DDL-0236): +1 Longsword vinculada a +9 e
//     1d8+5, Longbow invocado a +9 e 1d8+5 com o Improved Pact Weapon.
// -----------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { pactAttack, conjuredAttack, withPactWeapon, pactEvent, hasPactOfTheBlade, pactChoices } from './playPact';
import { attacksPerAction } from './playBasicActions';
import { applyOp, emptyPlayState } from './playState';

const sword = {
  key: 'w:sword', kind: 'weapon', name: '+1 Longsword', uid: 'u1', range: 'melee', ability: 'str', proficient: false,
  toHit: { total: 0, parts: [{ label: 'Strength', formula: -1 }, { label: 'Magic', formula: 1 }] },
  damage: { dice: '1d8', bonus: 0, types: ['slashing'] }, versatile: '1d10', properties: ['V'],
};
const rapier = {
  key: 'w:rapier', kind: 'weapon', name: 'Rapier', uid: 'u2', range: 'melee', ability: 'dex', proficient: false,
  toHit: { total: 1, parts: [{ label: 'Dexterity', formula: 1 }] }, damage: { dice: '1d8', bonus: 1, types: ['piercing'] }, properties: ['F'],
};

/** O catálogo do warlock com as features dadas. */
function catalogWith(features) {
  return {
    features,
    stats: { profBonus: 4 },
    rollData: { abilities: { str: { mod: -1 }, dex: { mod: 1 }, cha: { mod: 4 } } },
    attacks: [sword, rapier],
  };
}

describe('arma de pacto', () => {
  it('a arma vinculada usa CAR e proficiência, guarda o bônus mágico e substitui a original', () => {
    const c = catalogWith(['pact of the blade', 'improved pact weapon']);
    const out = withPactWeapon(c, { kind: 'bond', uid: 'u1', name: '+1 Longsword' });
    expect(out.attacks.map((a) => a.name)).toEqual(['+1 Longsword (pact weapon)', 'Rapier']);
    const [pact] = out.attacks;
    expect(pact).toMatchObject({ pact: true, ability: 'cha', proficient: true, toHit: { total: 9 } });
    expect(pact.toHit.parts.map((p) => p.label)).toEqual(['Charisma', 'Proficiency', 'Magic']);
    expect(pact.damage).toMatchObject({ dice: '1d8', bonus: 5 });
  });

  it('o Improved Pact Weapon soma +1 só na arma sem bônus mágico', () => {
    const c = catalogWith(['pact of the blade', 'improved pact weapon']);
    expect(pactAttack(rapier, c)).toMatchObject({ toHit: { total: 9 }, damage: { bonus: 5 } });
    expect(pactAttack(rapier, catalogWith(['pact of the blade']))).toMatchObject({ toHit: { total: 8 }, damage: { bonus: 4 } });
  });

  it('a arma invocada sai dos dados da arma-base', () => {
    const c = catalogWith(['pact of the blade', 'improved pact weapon']);
    const bow = conjuredAttack({ name: 'Longbow', dmg1: '1d8', dmgType: 'P', props: ['A', 'H', '2H'], ranged: true, distance: '150/600' }, c);
    expect(bow).toMatchObject({ name: 'Longbow (pact weapon)', range: 'ranged', ability: 'cha', ammunition: false, toHit: { total: 9 }, damage: { dice: '1d8', bonus: 5 } });
  });

  it('sem o Pact of the Blade o catálogo não muda', () => {
    const c = catalogWith([]);
    expect(hasPactOfTheBlade(c)).toBe(false);
    expect(withPactWeapon(c, { kind: 'bond', uid: 'u1' })).toBe(c);
  });

  it('o evento grava e desfaz o vínculo no estado', () => {
    const bond = pactEvent({ choice: { kind: 'bond', uid: 'u1', name: '+1 Longsword' } });
    const on = bond.ops.reduce(applyOp, emptyPlayState());
    expect(on.pactWeapon).toEqual({ kind: 'bond', uid: 'u1', name: '+1 Longsword' });
    expect(pactEvent({ choice: null }).ops.reduce(applyOp, on).pactWeapon).toBeNull();
  });

  it('Thirsting Blade dá dois ataques e Devouring Blade três', () => {
    expect(attacksPerAction({ features: ['thirsting blade'] })).toBe(2);
    expect(attacksPerAction({ features: ['thirsting blade', 'devouring blade'] })).toBe(3);
  });
});

describe('vínculo e arma conjurada (DDL-0240)', () => {
  const c = { ...catalogWith(['pact of the blade']), attacks: [{ ...sword, magical: true }, rapier] };

  it('só arma mágica entra no vínculo', () => {
    expect(pactChoices({}, c).carried.map((x) => x.name)).toEqual(['+1 Longsword']);
  });

  it('conjurar põe a arma no inventário e vincula a ela; outra conjurada troca o item', () => {
    const weapon = { name: 'Longsword', source: 'XPHB' };
    const ev = pactEvent({ choice: { kind: 'conjure', weapon }, state: emptyPlayState(), character: { inventory: [] } });
    const add = ev.ops.find((o) => o.op === 'inventory');
    expect(add).toMatchObject({ before: null, after: { itemId: 'Longsword', equipped: true, customName: 'Longsword (pact weapon)', pactConjured: true } });
    const state = ev.ops.reduce(applyOp, emptyPlayState());
    expect(state.pactWeapon).toMatchObject({ kind: 'bond', uid: add.uid, conjured: true });
    const again = pactEvent({ choice: { kind: 'conjure', weapon: { name: 'Mace', source: 'XPHB' } }, state, character: { inventory: [add.after] } });
    expect(again.ops.filter((o) => o.op === 'inventory').map((o) => [o.before?.itemId ?? null, o.after?.itemId ?? null])).toEqual([['Longsword', null], [null, 'Mace']]);
    const end = pactEvent({ choice: null, state, character: { inventory: [add.after] } });
    expect(end.ops.map((o) => o.op)).toEqual(['inventory', 'pact']);
  });

  it('o dano da arma de pacto oferece o tipo dela ou necrótico, psíquico ou radiante', () => {
    expect(pactAttack(sword, c).damage.typeOptions).toEqual(['slashing', 'necrotic', 'psychic', 'radiant']);
  });
});

describe('a opção do Pact of the Blade no histórico (DDL-0243)', () => {
  it('Bond, Conjure e End the bond ficam no evento', () => {
    expect(pactEvent({ choice: { kind: 'bond', uid: 'u1', name: '+1 Longsword' } }).payload).toMatchObject({ feature: 'Pact of the Blade', option: 'Bond' });
    expect(pactEvent({ choice: { kind: 'conjure', weapon: { name: 'Longsword', source: 'XPHB' } } }).payload.option).toBe('Conjure');
    expect(pactEvent({ choice: null }).payload.option).toBe('End the bond');
  });
});
