import { describe, it, expect } from 'vitest';
import {
  parseStartingEquipment,
  isGoldOnlyOption,
  optionGoldGp,
  startingKitInventory,
  startingKitCurrency,
  kitChooseLabel,
  kitChooseAllows,
  kitChoosesComplete,
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

describe('chooses do kit ({equipmentType} - TC-0024)', () => {
  // Recorte do Bard XPHB: o kit A tem um instrumento musical A ESCOLHER.
  const bard = {
    startingEquipment: {
      defaultData: [
        {
          A: [{ item: 'chain mail|xphb' }, { equipmentType: 'instrumentMusical' }, { value: 1900 }],
          B: [{ value: 9000 }],
        },
      ],
    },
  };
  const dbWithLute = {
    ...db,
    items: { item: [...db.items.item, { name: 'Lute', source: 'XPHB', type: 'INS|XPHB' }] },
  };
  const [a, b] = parseStartingEquipment(dbWithLute, bard);

  it('a entrada vira um choose com rótulo e não some do kit', () => {
    expect(a.chooses).toEqual([{ type: 'instrumentMusical', quantity: 1 }]);
    expect(kitChooseLabel(a.chooses[0])).toBe('Musical Instrument of your choice');
  });

  it('B continua só-ouro; A não completa sem o pick', () => {
    expect(isGoldOnlyOption(b)).toBe(true);
    expect(kitChoosesComplete(a, {})).toBe(false);
    expect(kitChoosesComplete(a, { 0: ['Lute|XPHB'] })).toBe(true);
    expect(kitChoosesComplete(b, {})).toBe(true);
  });

  it('o filtro do seletor aceita só a categoria do choose', () => {
    expect(kitChooseAllows(a.chooses[0], { name: 'Lute', type: 'INS|XPHB' })).toBe(true);
    expect(kitChooseAllows(a.chooses[0], { name: 'Greatsword', type: 'M|XPHB', weaponCategory: 'martial' })).toBe(false);
  });

  it('o pick entra no inventário (sem equipar instrumento)', () => {
    const inv = startingKitInventory(a, dbWithLute, { 0: ['Lute|XPHB'] });
    expect(inv.map((i) => [i.itemId, i.equipped])).toEqual([
      ['Chain Mail', true],
      ['Lute', false],
    ]);
  });

  it('quantity > 1 exige todos os picks (Artificer TCE: 2 armas simples)', () => {
    const ch = { type: 'weaponSimple', quantity: 2 };
    expect(kitChooseLabel(ch)).toBe('Simple weapon of your choice ×2');
    expect(kitChoosesComplete({ chooses: [ch] }, { 0: ['Club|XPHB'] })).toBe(false);
    expect(kitChoosesComplete({ chooses: [ch] }, { 0: ['Club|XPHB', 'Dagger|XPHB'] })).toBe(true);
  });
});

describe('chooses de item group (Druidic Focus / Holy Symbol - sessão T1a Druid)', () => {
  // Recorte do Druid XPHB: "druidic focus|xphb" é um ITEM GROUP, não um item.
  const druid = {
    startingEquipment: {
      defaultData: [{ A: [{ item: 'chain mail|xphb' }, { item: 'druidic focus|xphb' }, { value: 900 }] }],
    },
  };
  const dbWithGroup = {
    ...db,
    items: {
      item: [
        ...db.items.item,
        { name: 'Wooden Staff', source: 'XPHB', type: 'SCF|XPHB', scfType: 'druid' },
        { name: 'Yew Wand', source: 'XPHB', type: 'SCF|XPHB', scfType: 'druid' },
      ],
      itemGroup: [
        { name: 'Druidic Focus', source: 'XPHB', items: ['wooden staff|XPHB', 'yew wand|XPHB'] },
      ],
    },
  };
  const [a] = parseStartingEquipment(dbWithGroup, druid);

  it('o grupo vira um choose de pool fechado, não um item "unresolved"', () => {
    expect(a.items.map((i) => i.name)).toEqual(['Chain Mail']);
    expect(a.chooses).toHaveLength(1);
    expect(a.chooses[0].type).toBe('itemGroup');
    expect(kitChooseLabel(a.chooses[0])).toBe('Druidic Focus of your choice');
  });

  it('o filtro aceita só membros do grupo', () => {
    const ch = a.chooses[0];
    expect(kitChooseAllows(ch, { name: 'Wooden Staff', source: 'XPHB' })).toBe(true);
    expect(kitChooseAllows(ch, { name: 'Greatsword', source: 'XPHB' })).toBe(false);
  });

  it('o kit não completa sem o pick; o pick entra no inventário', () => {
    expect(kitChoosesComplete(a, {})).toBe(false);
    expect(kitChoosesComplete(a, { 0: ['Wooden Staff|XPHB'] })).toBe(true);
    const inv = startingKitInventory(a, dbWithGroup, { 0: ['Wooden Staff|XPHB'] });
    expect(inv.map((i) => i.itemId)).toEqual(['Chain Mail', 'Wooden Staff']);
  });
});
