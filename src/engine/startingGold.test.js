import { describe, it, expect } from 'vitest';
import { createCharacter } from '../schema/character';
import { classStartingGold, seedStartingGold, BACKGROUND_STARTING_GOLD } from './startingGold';

const clericObj = { name: 'Cleric', source: 'XPHB', startingEquipment: { entries: ['{@i Choose A or B:} (A) {@item Mace|XPHB}, 7 GP; or (B) 110 GP'] } };
const fighterObj = { name: 'Fighter', source: 'XPHB', startingEquipment: { entries: ['{@i Choose A, B, or C:} (A) …4 GP; (B) …11 GP; or (C) 155 GP'] } };
const db = { 'class-cleric': { class: [clericObj] }, 'class-fighter': { class: [fighterObj] } };

describe('classStartingGold', () => {
  it('extrai a última opção só-ouro da prosa', () => {
    expect(classStartingGold(clericObj)).toBe(110);
    expect(classStartingGold(fighterObj)).toBe(155);
  });
  it('0 quando não há starting equipment', () => {
    expect(classStartingGold({ name: 'X' })).toBe(0);
    expect(classStartingGold(null)).toBe(0);
  });
});

describe('seedStartingGold', () => {
  const withCleric = () => {
    const c = createCharacter();
    c.classes[0].classId = 'cleric';
    c.classes[0].source = 'XPHB';
    return c;
  };

  it('soma o ouro da classe original quando a carteira está no padrão (50 → 160)', () => {
    const seeded = seedStartingGold(withCleric(), db);
    expect(seeded).toEqual({ pp: 0, gp: BACKGROUND_STARTING_GOLD + 110, ep: 0, sp: 0, cp: 0 });
  });

  it('não mexe se a carteira já foi alterada', () => {
    const c = withCleric();
    c.currency.gp = 200;
    expect(seedStartingGold(c, db)).toBeNull();
  });

  it('não mexe se há itens no inventário', () => {
    const c = withCleric();
    c.inventory = [{ uid: 'x', itemId: 'Mace', source: 'XPHB', quantity: 1 }];
    expect(seedStartingGold(c, db)).toBeNull();
  });

  it('não mexe sem classe original definida', () => {
    expect(seedStartingGold(createCharacter(), db)).toBeNull();
  });

  it('idempotente: já somado (≠50) não soma de novo', () => {
    const seeded = seedStartingGold(withCleric(), db);
    const c = withCleric();
    c.currency = seeded;
    expect(seedStartingGold(c, db)).toBeNull();
  });
});
