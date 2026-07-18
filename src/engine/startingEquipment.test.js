import { describe, it, expect } from 'vitest';
import {
  parseStartingEquipment,
  isGoldOnlyOption,
  optionGoldGp,
  startingKitInventory,
  startingKitCurrency,
} from './startingEquipment';

// db mínimo: uns poucos itens base p/ resolver refs case-insensitive.
const db = {
  'items-base': {
    baseitem: [
      { name: 'Chain Mail', source: 'XPHB', type: 'HA|XPHB' },
      { name: 'Greatsword', source: 'XPHB', type: 'M|XPHB' },
      { name: 'Javelin', source: 'XPHB', type: 'M|XPHB' },
    ],
  },
  items: { item: [{ name: "Dungeoneer's Pack", source: 'XPHB', type: 'G|XPHB' }] },
};

// Recorte do Fighter XPHB.
const fighter = {
  startingEquipment: {
    defaultData: [
      {
        A: [
          { item: 'chain mail|xphb' },
          { item: 'greatsword|xphb' },
          { item: 'javelin|xphb', quantity: 8 },
          { item: "dungeoneer's pack|xphb" },
          { value: 400 },
        ],
        C: [{ value: 15500 }],
      },
    ],
  },
};

describe('parseStartingEquipment', () => {
  const options = parseStartingEquipment(db, fighter);

  it('lê as opções A e C', () => {
    expect(options.map((o) => o.key)).toEqual(['A', 'C']);
  });

  it('resolve refs case-insensitive p/ nome+fonte canônicos, com quantidade', () => {
    const a = options[0];
    expect(a.items).toEqual([
      { name: 'Chain Mail', source: 'XPHB', quantity: 1 },
      { name: 'Greatsword', source: 'XPHB', quantity: 1 },
      { name: 'Javelin', source: 'XPHB', quantity: 8 },
      { name: "Dungeoneer's Pack", source: 'XPHB', quantity: 1 },
    ]);
    expect(a.valueCp).toBe(400);
  });

  it('ref não resolvido cai no title-case + fonte maiúscula', () => {
    const [o] = parseStartingEquipment(db, {
      startingEquipment: { defaultData: [{ A: [{ item: 'mystery gizmo|hb' }] }] },
    });
    expect(o.items[0]).toEqual({ name: 'Mystery Gizmo', source: 'HB', quantity: 1 });
  });

  it('detecta a opção só-ouro (C = 155 GP)', () => {
    const c = options[1];
    expect(isGoldOnlyOption(c)).toBe(true);
    expect(isGoldOnlyOption(options[0])).toBe(false);
    expect(optionGoldGp(c)).toBe(155);
  });

  it('classe sem defaultData → vazio', () => {
    expect(parseStartingEquipment(db, {})).toEqual([]);
  });
});

describe('aplicar uma opção', () => {
  const options = parseStartingEquipment(db, fighter);

  it('inventário: um item por entrada, com a quantidade certa', () => {
    const inv = startingKitInventory(options[0]);
    expect(inv.map((i) => [i.itemId, i.source, i.quantity])).toEqual([
      ['Chain Mail', 'XPHB', 1],
      ['Greatsword', 'XPHB', 1],
      ['Javelin', 'XPHB', 8],
      ["Dungeoneer's Pack", 'XPHB', 1],
    ]);
  });

  it('sem db, nada nasce equipado (compatibilidade)', () => {
    const inv = startingKitInventory(options[0]);
    expect(inv.every((i) => i.equipped === false)).toBe(true);
  });

  it('com db, armadura e armas nascem equipadas; o resto não (TC-0015)', () => {
    const inv = startingKitInventory(options[0], db);
    expect(inv.map((i) => [i.itemId, i.equipped])).toEqual([
      ['Chain Mail', true],
      ['Greatsword', true],
      ['Javelin', true],
      ["Dungeoneer's Pack", false],
    ]);
  });

  it('carteira: 50 GP do background + o ouro da opção', () => {
    expect(startingKitCurrency(options[0])).toEqual({ pp: 0, gp: 54, ep: 0, sp: 0, cp: 0 }); // 400cp = 4gp
    expect(startingKitCurrency(options[1])).toEqual({ pp: 0, gp: 205, ep: 0, sp: 0, cp: 0 }); // 15500cp = 155gp
  });
});
