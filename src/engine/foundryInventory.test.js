import { describe, it, expect } from 'vitest';
import { buildInventoryItems, buildFeatItem } from './foundryItems';
import { foundryToCharacter } from './foundryImport';
import { effectChangesFor } from './foundryEffects';

// db mínimo: itens base (armas/armadura/ferramenta) + catálogo (mágicos/consumível).
const db = {
  'items-base': {
    baseitem: [
      { name: 'Longsword', source: 'XPHB', type: 'M|XPHB', weaponCategory: 'martial', dmg1: '1d8', dmg2: '1d10', dmgType: 'S', property: ['V|XPHB'], weight: 3, value: 1500 },
      { name: 'Leather Armor', source: 'XPHB', type: 'LA|XPHB', ac: 11, weight: 10, value: 1000 },
      { name: 'Chain Mail', source: 'XPHB', type: 'HA|XPHB', ac: 16, strength: '13', stealth: true, weight: 55, value: 7500 },
      { name: "Thieves' Tools", source: 'XPHB', type: 'AT|XPHB', weight: 1, value: 2500 },
    ],
  },
  items: {
    item: [
      { name: 'Ring of Protection', source: 'DMG', type: 'RG|DMG', rarity: 'rare', reqAttune: true, bonusAc: '+1', bonusSavingThrow: '+1', weight: 0 },
      { name: 'Potion of Healing', source: 'XPHB', type: 'P|XPHB', rarity: 'common', weight: 0.5, value: 5000 },
    ],
  },
  'fluff-items': { itemFluff: [] },
};

const character = {
  inventory: [
    { uid: 'a', itemId: 'Longsword', source: 'XPHB', quantity: 1, equipped: true, attuned: false },
    { uid: 'b', itemId: 'Leather Armor', source: 'XPHB', quantity: 1, equipped: true, attuned: false },
    { uid: 'c', itemId: 'Chain Mail', source: 'XPHB', quantity: 1, equipped: false, attuned: false },
    { uid: 'd', itemId: "Thieves' Tools", source: 'XPHB', quantity: 1, equipped: false, attuned: false },
    { uid: 'e', itemId: 'Ring of Protection', source: 'DMG', quantity: 1, equipped: false, attuned: true, customImg: 'data:image/png;base64,AAAA' },
    { uid: 'f', itemId: 'Potion of Healing', source: 'XPHB', quantity: 3, equipped: false, attuned: false },
  ],
};

const byName = (items, name) => items.find((i) => i.name === name);

describe('buildInventoryItems (export)', () => {
  const items = buildInventoryItems(character, db);

  it('one Foundry Item per inventory entry', () => {
    expect(items).toHaveLength(6);
    for (const it of items) expect(it._id).toMatch(/^[A-Za-z0-9]{16}$/);
  });

  it('weapon: type/damage/versatile/properties/equipped', () => {
    const w = byName(items, 'Longsword');
    expect(w.type).toBe('weapon');
    expect(w.system.type.value).toBe('martialM');
    expect(w.system.damage.base).toMatchObject({ number: 1, denomination: 8, types: ['slashing'] });
    expect(w.system.damage.versatile).toMatchObject({ number: 1, denomination: 10 });
    expect(w.system.properties).toEqual(['ver']);
    expect(w.system.equipped).toBe(true);
  });

  it('weapon: has a melee attack activity that includes the base damage', () => {
    const w = byName(items, 'Longsword');
    const act = Object.values(w.system.activities)[0];
    expect(act.type).toBe('attack');
    expect(act.attack.type).toEqual({ value: 'melee', classification: 'weapon' });
    expect(act.damage.includeBase).toBe(true);
    expect(act.attack.ability).toBe(''); // Foundry escolhe str/dex
  });

  it('light armor: equipment with armor.value + unlimited dex', () => {
    const a = byName(items, 'Leather Armor');
    expect(a.type).toBe('equipment');
    expect(a.system.type.value).toBe('light');
    expect(a.system.armor).toEqual({ value: 11, dex: null });
    expect(a.system.equipped).toBe(true);
  });

  it('heavy armor: dex cap 0, str req, stealth disadvantage', () => {
    const a = byName(items, 'Chain Mail');
    expect(a.system.type.value).toBe('heavy');
    expect(a.system.armor).toEqual({ value: 16, dex: 0 });
    expect(a.system.strength).toBe(13);
    expect(a.system.properties).toContain('stealthDisadvantage');
  });

  it('tool: type tool with a tool type.value', () => {
    const t = byName(items, "Thieves' Tools");
    expect(t.type).toBe('tool');
    expect(t.system.type.value).toBe('art');
  });

  it('attunement item: equipment, attunement required + attuned, custom img wins', () => {
    const r = byName(items, 'Ring of Protection');
    expect(r.type).toBe('equipment');
    expect(r.system.type.value).toBe('ring');
    expect(r.system.attunement).toBe('required');
    expect(r.system.attuned).toBe(true);
    expect(r.system.rarity).toBe('rare');
    expect(r.img).toBe('data:image/png;base64,AAAA');
  });

  it('consumable: potion with quantity + price denomination', () => {
    const p = byName(items, 'Potion of Healing');
    expect(p.type).toBe('consumable');
    expect(p.system.type.value).toBe('potion');
    expect(p.system.quantity).toBe(3);
    expect(p.system.price).toEqual({ value: 50, denomination: 'gp' });
  });
});

describe('inventory round-trip (export → import)', () => {
  const actor = {
    name: 'X',
    type: 'character',
    system: { abilities: {}, currency: { gp: 12, sp: 3, cp: 7 } },
    items: buildInventoryItems(character, db),
  };
  const back = foundryToCharacter(actor, db);

  it('preserves every item (name, quantity, equipped, attuned)', () => {
    const map = Object.fromEntries(back.inventory.map((e) => [e.itemId, e]));
    expect(Object.keys(map).sort()).toEqual(
      ['Chain Mail', 'Leather Armor', 'Longsword', 'Potion of Healing', 'Ring of Protection', "Thieves' Tools"],
    );
    expect(map['Longsword'].equipped).toBe(true);
    expect(map['Ring of Protection'].attuned).toBe(true);
    expect(map['Potion of Healing'].quantity).toBe(3);
  });

  it('re-resolves the 5etools source by name', () => {
    const ring = back.inventory.find((e) => e.itemId === 'Ring of Protection');
    expect(ring.source).toBe('DMG');
  });

  it('keeps the custom image, drops Foundry icon paths', () => {
    const ring = back.inventory.find((e) => e.itemId === 'Ring of Protection');
    expect(ring.customImg).toBe('data:image/png;base64,AAAA');
    const sword = back.inventory.find((e) => e.itemId === 'Longsword');
    expect(sword.customImg).toBeUndefined(); // ícone genérico Foundry (icons/…), não é custom
  });

  it('imports currency', () => {
    expect(back.currency).toMatchObject({ gp: 12, sp: 3, cp: 7 });
  });
});

describe('custom (non-catalog) items round-trip', () => {
  // Item que NÃO existe no db: componente de magia, como nos premades do Foundry.
  const foundryItem = {
    _id: 'CUSTOM0000000001',
    name: 'Component: Diamond',
    type: 'loot',
    img: 'icons/commodities/gems/gem-cut-diamond.webp',
    system: {
      type: { value: 'treasure', subtype: '' },
      quantity: 5,
      weight: { value: 0.1, units: 'lb' },
      price: { value: 300, denomination: 'gp' },
      rarity: '',
      attunement: '',
      description: { value: '<p>A material component worth 300 gp.</p>' },
    },
  };
  const actor = { name: 'X', type: 'character', system: { abilities: {} }, items: [foundryItem] };
  const char = foundryToCharacter(actor, db);

  it('import: attaches a custom snapshot (not resolved against the catalog)', () => {
    const e = char.inventory[0];
    expect(e.itemId).toBe('Component: Diamond');
    expect(e.quantity).toBe(5);
    expect(e.custom).toMatchObject({
      fType: 'loot', typeValue: 'treasure', weight: 0.1, rarity: '',
      description: '<p>A material component worth 300 gp.</p>',
    });
  });

  it('export: re-emits a faithful Foundry item from the snapshot', () => {
    const out = buildInventoryItems(char, db);
    const it = out.find((i) => i.name === 'Component: Diamond');
    expect(it).toMatchObject({ type: 'loot', img: 'icons/commodities/gems/gem-cut-diamond.webp' });
    expect(it.system).toMatchObject({
      quantity: 5,
      weight: { value: 0.1, units: 'lb' },
      price: { value: 300, denomination: 'gp' },
      type: { value: 'treasure', subtype: '' },
    });
    expect(it.system.description.value).toContain('300 gp');
  });
});

describe('magic item effects (export)', () => {
  it('Ring of Protection: transfer effect with +AC and +save changes', () => {
    const items = buildInventoryItems(character, db);
    const ring = byName(items, 'Ring of Protection');
    expect(ring.effects).toHaveLength(1);
    const eff = ring.effects[0];
    expect(eff.transfer).toBe(true);
    const keys = eff.changes.map((c) => c.key);
    expect(keys).toContain('system.attributes.ac.bonus');
    expect(keys).toContain('system.bonuses.abilities.save');
  });

  it('mundane items carry no effects', () => {
    const items = buildInventoryItems(character, db);
    expect(byName(items, 'Longsword').effects).toEqual([]);
    expect(byName(items, 'Leather Armor').effects).toEqual([]);
  });

  it('magic weapon: system.magicalBonus from bonusWeapon (attack + damage)', () => {
    const magicChar = { inventory: [{ uid: 'm', itemId: 'Flame Blade', source: 'HB', quantity: 1, equipped: true, attuned: true }] };
    const magicDb = {
      ...db,
      items: {
        item: [{ name: 'Flame Blade', source: 'HB', type: 'M|XPHB', weaponCategory: 'martial', dmg1: '1d8', dmgType: 'S', bonusWeapon: '+2', rarity: 'rare', reqAttune: true }],
      },
    };
    const w = buildInventoryItems(magicChar, magicDb)[0];
    expect(w.system.magicalBonus).toBe('2');
  });

  it('ranged weapon: attack activity is ranged with the weapon range', () => {
    const items = buildInventoryItems(
      { inventory: [{ uid: 'b', itemId: 'Shortbow', source: 'XPHB', quantity: 1, equipped: false, attuned: false }] },
      { ...db, 'items-base': { baseitem: [{ name: 'Shortbow', source: 'XPHB', type: 'R|XPHB', weaponCategory: 'simple', dmg1: '1d6', dmgType: 'P', range: '80/320', weight: 2, value: 2500 }] } },
    );
    const act = Object.values(items[0].system.activities)[0];
    expect(act.attack.type.value).toBe('ranged');
    expect(act.range.value).toBe('80');
  });
});

describe('feature Active Effects', () => {
  const archery = { name: 'Archery', source: 'XPHB', category: 'FS', entries: ['+2 to ranged attack rolls.'] };

  it('Fighting Style feat carries its curated effect (Archery → +2 ranged attack)', () => {
    const item = buildFeatItem(archery, { level: 1 });
    expect(item.effects).toHaveLength(1);
    expect(item.effects[0].changes[0]).toMatchObject({ key: 'system.bonuses.rwak.attack', value: '2' });
  });

  it('Unarmored Defense resolves per class (barbarian vs monk)', () => {
    expect(effectChangesFor('Unarmored Defense', 'barbarian')[0].value).toBe('unarmoredBarb');
    expect(effectChangesFor('Unarmored Defense', 'monk')[0].value).toBe('unarmoredMonk');
    expect(effectChangesFor('Unarmored Defense')).toBeNull(); // sem classe → sem efeito ambíguo
  });
});
