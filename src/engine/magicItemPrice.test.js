import { describe, it, expect } from 'vitest';
import { itemValue, derivedMagicValue, isValueDerived } from './magicItemPrice';

// db com um item base (Plate Armor 1500 gp) p/ o caso do exemplo do usuário.
const db = {
  'items-base': {
    baseitem: [{ name: 'Plate Armor', source: 'PHB', value: 150000 }], // 1500 gp em cobre
  },
};

describe('derivedMagicValue', () => {
  it('listed value wins (não deriva)', () => {
    expect(itemValue({ value: 5000, rarity: 'rare' }, db)).toBe(5000);
  });

  it('item mágico sem raridade/valor → null', () => {
    expect(itemValue({ name: 'Mystery' }, db)).toBeNull();
  });

  it('Common sem item base: 50 gp + 5 dias × 2 gp = 60 gp', () => {
    expect(derivedMagicValue({ rarity: 'common' }, db)).toBe(6000); // 60 gp em cobre
  });

  it('Rare sem item base: 2000 gp + 50 dias × 2 gp = 2100 gp', () => {
    expect(derivedMagicValue({ rarity: 'rare' }, db)).toBe(210000);
  });

  it('exemplo do usuário - Cast-Off Plate Armor (Common + base Plate): 1500 + 50 + 5×2 = 1560 gp', () => {
    const castOff = { name: 'Cast-Off Plate Armor', rarity: 'common', baseItem: 'plate armor|phb' };
    expect(derivedMagicValue(castOff, db)).toBe(156000); // 1560 gp
  });

  it('Spell Scroll usa a tabela de scrolls por nível (2nd → 250 gp + 3 dias × 2 = 256 gp)', () => {
    expect(derivedMagicValue({ name: 'Spell Scroll (2nd Level)', rarity: 'uncommon' }, db)).toBe(25600);
  });

  it('Spell Scroll (Cantrip) → 15 gp + 1 dia × 2 = 17 gp', () => {
    expect(derivedMagicValue({ name: 'Spell Scroll (Cantrip)', rarity: 'common' }, db)).toBe(1700);
  });

  it('artifact não tem custo de criação → null', () => {
    expect(derivedMagicValue({ rarity: 'artifact' }, db)).toBeNull();
  });

  it('isValueDerived: true só quando não há value listado', () => {
    expect(isValueDerived({ rarity: 'rare' })).toBe(true);
    expect(isValueDerived({ value: 100 })).toBe(false);
  });
});
