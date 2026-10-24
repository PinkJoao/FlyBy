// =============================================================================
// playInventory.test: testes do inventário e do dinheiro em jogo
// =============================================================================
// FUNÇÕES
//   seq(...values): um rng que devolve os valores em ordem e falha se acabarem.
//   st(patch): um estado de jogo com o patch por cima do descansado.
//   onChar(character, event): o personagem depois das operações de personagem.
//
// DECISÕES E ARMADILHAS
//   - As operações de inventário e moeda são aplicadas pelo applyCharacterOps, o
//     mesmo do usePlayDoc: o teste vê o que a ficha vai gravar.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { sequenceRng } from './dice';
import { emptyPlayState, applyOp, hpView, applyCharacterOps, characterOps } from './playState';
import {
  typeCode, isUsable, healOf, quantityOp, ammoEntry, itemUseEvent, quantityEvent, ammoOps, currencyEvent, chargeResources,
} from './playInventory';

const seq = (...values) => sequenceRng(values, () => {
  throw new Error('rolou um dado a mais');
});
const st = (patch = {}) => ({ ...emptyPlayState(), ...patch });
const onChar = (character, event) => applyCharacterOps(character, characterOps(event), 'forward').character;

const potionRaw = { name: 'Potion of Healing', source: 'XPHB', type: 'P|XPHB', entries: ['You regain {@dice 2d4 + 2} Hit Points when you drink this potion.'] };
const arrowRaw = { name: 'Arrow', source: 'XPHB', type: 'A|XPHB' };
const character = {
  inventory: [
    { uid: 'p', itemId: 'Potion of Healing', source: 'XPHB', quantity: 2, equipped: false, attuned: false },
    { uid: 'a', itemId: 'Arrow', source: 'XPHB', quantity: 1, equipped: false, attuned: false },
  ],
  currency: { gp: 10, sp: 0 },
};
const derivedInventory = [{ uid: 'p', raw: potionRaw }, { uid: 'a', raw: arrowRaw }];
const catalog = { stats: { hpMax: 20 }, rollData: {} };

describe('itens', () => {
  it('lê o tipo, o que se gasta e a cura da poção', () => {
    expect(typeCode(potionRaw)).toBe('P');
    expect(isUsable(potionRaw)).toBe(true);
    expect(isUsable(arrowRaw)).toBe(false);
    expect(healOf(potionRaw)).toBe('2d4 + 2');
    expect(healOf(arrowRaw)).toBeNull();
  });

  it('quantidade zero tira o item, guardando o lugar para desfazer', () => {
    expect(quantityOp(character, 'a', -1)).toMatchObject({ op: 'inventory', uid: 'a', after: null, index: 1 });
    expect(quantityOp(character, 'p', 3).after.quantity).toBe(5);
    expect(quantityOp(character, 'zz', 1)).toBeNull();
  });

  it('beber a poção tira uma da pilha e cura no mesmo evento', () => {
    const s = st({ damage: 15 });
    const e = itemUseEvent({ catalog, state: s, character, entry: derivedInventory[0], rng: seq(3, 4) });
    expect(e.rolls.total).toBe(9);
    expect(hpView(e.ops.reduce(applyOp, s), 20).current).toBe(14);
    expect(onChar(character, e).inventory[0].quantity).toBe(1);
    expect(e.payload).toMatchObject({ used: true, left: 1, healed: { healed: 9 } });
  });

  it('mudar a quantidade à mão', () => {
    expect(onChar(character, quantityEvent({ character, entry: derivedInventory[1], delta: 19 })).inventory[1].quantity).toBe(20);
  });
});

describe('munição', () => {
  const bow = { ammunition: true, ammoType: 'arrow|xphb' };

  it('acha a munição pelo ammoType e gasta uma no ataque', () => {
    expect(ammoEntry(character, derivedInventory, bow).uid).toBe('a');
    const r = ammoOps({ character, derivedInventory, attack: bow });
    expect(r).toMatchObject({ ammo: 'Arrow', left: 0, missing: false });
    expect(r.ops[0].after).toBeNull();
  });

  it('sem munição, avisa; arma sem munição não gasta nada', () => {
    const empty = { ...character, inventory: [character.inventory[0]] };
    expect(ammoOps({ character: empty, derivedInventory, attack: bow }).missing).toBe(true);
    expect(ammoOps({ character, derivedInventory, attack: { ammunition: false } })).toEqual({ ops: [], ammo: null, missing: false });
  });
});

describe('dinheiro e cargas', () => {
  it('gastar e ganhar moedas viram o delta; negativo além do que há conflita', () => {
    const pay = currencyEvent({ delta: { gp: -3, sp: 5 }, label: 'Inn' });
    expect(pay).toMatchObject({ kind: 'currency', label: 'Inn', ops: [{ op: 'currency', delta: { gp: -3, sp: 5 } }] });
    expect(onChar(character, pay).currency).toEqual({ gp: 7, sp: 5 });
    const broke = applyCharacterOps(character, characterOps(currencyEvent({ delta: { gp: -11 } })), 'forward');
    expect(broke.conflicts).toHaveLength(1);
    expect(currencyEvent({ delta: { gp: 0 } }).ops).toEqual([]);
  });

  it('as cargas da varinha viram recurso, com a recarga do amanhecer pelo dado', () => {
    const wand = { uid: 'w', raw: { name: 'Wand of Magic Missiles', charges: 7, recharge: 'dawn', rechargeAmount: '{@dice 1d6 + 1}' } };
    expect(chargeResources([wand, derivedInventory[0]])).toEqual([{
      key: 'charges:w', kind: 'charges', name: 'Wand of Magic Missiles charges', uid: 'w', max: 7,
      recovery: [{ period: 'dawn', type: 'formula', formula: '1d6 + 1' }],
    }]);
  });
});
