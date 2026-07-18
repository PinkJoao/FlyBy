import { describe, it, expect } from 'vitest';
import { deriveArmorClass, deriveSaveBonusFromItems } from './armorClass';

// Helpers p/ montar entradas de inventário no formato do deriveInventory.
const armor = (name, slot, ac, extra = {}) => ({
  group: 'armor', armorSlot: slot, equipped: true, attuned: false, required: false,
  raw: { name, ac, ...extra },
});
const shield = (extra = {}) => ({
  group: 'armor', armorSlot: 'shield', equipped: true, attuned: false, required: false,
  raw: { name: 'Shield', ac: 2, ...extra },
});
const accessory = (name, bonuses, state = {}) => ({
  group: 'ring', armorSlot: null, equipped: false, attuned: false, required: true,
  raw: { name, ...bonuses }, ...state,
});
const char = (...classIds) => ({ classes: classIds.map((classId) => ({ classId })) });

describe('deriveArmorClass', () => {
  it('unarmored = 10 + Dex', () => {
    expect(deriveArmorClass(char(), [], { dex: 3 }).total).toBe(13);
  });

  it('Barbarian Unarmored Defense adds Con', () => {
    expect(deriveArmorClass(char('barbarian'), [], { dex: 2, con: 3 }).total).toBe(15);
  });

  it('Monk Unarmored Defense adds Wis (no shield)', () => {
    expect(deriveArmorClass(char('monk'), [], { dex: 2, wis: 4 }).total).toBe(16);
  });

  it('Monk Unarmored Defense does NOT apply with a shield', () => {
    const ac = deriveArmorClass(char('monk'), [shield()], { dex: 2, wis: 4 });
    expect(ac.total).toBe(10 + 2 + 2); // 10 + Dex + shield, sem +Wis
  });

  it('light armor adds full Dex', () => {
    expect(deriveArmorClass(char(), [armor('Leather', 'light', 11)], { dex: 3 }).total).toBe(14);
  });

  it('medium armor caps Dex at +2', () => {
    expect(deriveArmorClass(char(), [armor('Half Plate', 'medium', 15)], { dex: 4 }).total).toBe(17);
  });

  it('heavy armor ignores Dex', () => {
    expect(deriveArmorClass(char(), [armor('Plate', 'heavy', 18)], { dex: 3 }).total).toBe(18);
  });

  it('shield adds its AC on top', () => {
    const ac = deriveArmorClass(char(), [armor('Leather', 'light', 11), shield()], { dex: 2 });
    expect(ac.total).toBe(11 + 2 + 2);
  });

  it('Ring of Protection adds +1 only when attuned', () => {
    const ring = accessory('Ring of Protection', { bonusAc: '+1' }, { attuned: true });
    expect(deriveArmorClass(char(), [armor('Plate', 'heavy', 18), ring], {}).total).toBe(19);

    const unattuned = accessory('Ring of Protection', { bonusAc: '+1' }, { attuned: false });
    expect(deriveArmorClass(char(), [armor('Plate', 'heavy', 18), unattuned], {}).total).toBe(18);
  });

  it('unequipped armor falls back to unarmored', () => {
    const notWorn = { ...armor('Plate', 'heavy', 18), equipped: false };
    expect(deriveArmorClass(char(), [notWorn], { dex: 1 }).total).toBe(11);
  });

  it('breakdown lists the parts', () => {
    const ac = deriveArmorClass(char(), [armor('Leather', 'light', 11), shield()], { dex: 2 });
    expect(ac.breakdown.map((b) => b.note)).toEqual(['armor', 'dex', 'shield']);
  });
});

describe('deriveArmorClass - armadura natural de espécie', () => {
  const flat = { type: 'flat', ac: 17, label: 'Natural Armor' }; // Tortle
  const unarmored = { type: 'unarmored', base: 13, ability: 'dex', label: 'Armored Casing' }; // Autognome
  const bonus = { type: 'bonus', bonus: 1, label: 'Integrated Protection' }; // Warforged

  it('Tortle: CA fixa 17, Dex não conta', () => {
    const ac = deriveArmorClass(char(), [], { dex: 4 }, flat);
    expect(ac.total).toBe(17);
    expect(ac.breakdown.map((b) => b.note)).toEqual(['natural']);
  });

  it('Tortle: escudo soma por cima do 17', () => {
    expect(deriveArmorClass(char(), [shield()], { dex: 4 }, flat).total).toBe(19);
  });

  it('Autognome: 13 + Dex sem armadura, vale mais que 10 + Dex', () => {
    expect(deriveArmorClass(char(), [], { dex: 2 }, unarmored).total).toBe(15);
  });

  it('Autognome: armadura vestida (melhor) prevalece sobre a fórmula', () => {
    // Plate 18 > 13 + Dex(0) → usa a armadura.
    expect(deriveArmorClass(char(), [armor('Plate', 'heavy', 18)], { dex: 0 }, unarmored).total).toBe(18);
  });

  it('Warforged: +1 por cima de 10 + Dex', () => {
    expect(deriveArmorClass(char(), [], { dex: 2 }, bonus).total).toBe(13);
  });

  it('Warforged: +1 por cima de armadura vestida', () => {
    expect(deriveArmorClass(char(), [armor('Plate', 'heavy', 18)], {}, bonus).total).toBe(19);
  });

  it('Barbarian Autognome: escolhe a maior entre Unarmored Defense e Armored Casing', () => {
    // barb 10 + dex2 + con3 = 15; autognome 13 + dex2 = 15 → empate, ambos 15.
    expect(deriveArmorClass(char('barbarian'), [], { dex: 2, con: 3 }, unarmored).total).toBe(15);
    // com Con alto, Unarmored Defense ganha.
    expect(deriveArmorClass(char('barbarian'), [], { dex: 2, con: 5 }, unarmored).total).toBe(17);
  });
});

describe('deriveSaveBonusFromItems', () => {
  it('sums bonusSavingThrow of active items', () => {
    const ring = accessory('Ring of Protection', { bonusSavingThrow: '+1' }, { attuned: true });
    const cloak = accessory('Cloak of Protection', { bonusSavingThrow: '+1' }, { attuned: true });
    expect(deriveSaveBonusFromItems([ring, cloak]).bonus).toBe(2);
  });

  it('ignores items needing attunement that are not attuned', () => {
    const ring = accessory('Ring of Protection', { bonusSavingThrow: '+1' }, { attuned: false });
    expect(deriveSaveBonusFromItems([ring]).bonus).toBe(0);
  });
});
