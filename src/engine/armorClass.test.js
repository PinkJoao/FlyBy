// =============================================================================
// armorClass.test: testes da Classe de Armadura
// =============================================================================
// O QUE FAZ
//   A disputa entre as fórmulas de CA (Defesa sem Armadura de Bárbaro e Monge, a
//   armadura natural de Tortle, Autognome e Warforged, a armadura vestida), o
//   escudo que exclui o Monge, e os bônus de acessórios ativos.
//
// FUNÇÕES
//   armor(name, slot, ac, extra), shield(extra), accessory(name, bonuses, state):
//     entradas de inventário no formato do deriveInventory.
//   char(...classIds), charX(...entries): personagens com subclasse e nível.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { deriveArmorClass, deriveSaveBonusFromItems } from './armorClass';

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
const char = (...classIds) => ({ classes: classIds.map((classId) => ({ classId, level: 20 })) });
const charX = (...entries) => ({ classes: entries });

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
    expect(ac.total).toBe(10 + 2 + 2);
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

  it('Monk/Barbarian: sem escudo escolhe Wis se render mais', () => {
    expect(deriveArmorClass(char('monk', 'barbarian'), [], { dex: 2, con: 1, wis: 4 }).total).toBe(16);
  });

  it('Monk/Barbarian: com escudo, Monk é inválido e Barbarian+escudo vence', () => {
    const ac = deriveArmorClass(char('monk', 'barbarian'), [shield()], { dex: 2, con: 1, wis: 4 });
    expect(ac.total).toBe(15);
  });

  it('Draconic Sorcerer: 10 + Dex + Cha sem armadura (nível 3+)', () => {
    const c = charX({ classId: 'sorcerer', subclassId: 'Draconic', level: 3 });
    expect(deriveArmorClass(c, [], { dex: 2, cha: 4 }).total).toBe(16);
  });

  it('Draconic Sorcerer: escudo soma por cima (permitido)', () => {
    const c = charX({ classId: 'sorcerer', subclassId: 'Draconic', level: 3 });
    expect(deriveArmorClass(c, [shield()], { dex: 2, cha: 4 }).total).toBe(18);
  });

  it('Draconic Resilience não vale abaixo do nível 3 nem sem a subclasse', () => {
    const low = charX({ classId: 'sorcerer', subclassId: 'Draconic', level: 2 });
    expect(deriveArmorClass(low, [], { dex: 2, cha: 4 }).total).toBe(12);
    const noSub = charX({ classId: 'sorcerer', subclassId: null, level: 5 });
    expect(deriveArmorClass(noSub, [], { dex: 2, cha: 4 }).total).toBe(12);
  });

  it('breakdown lists the parts', () => {
    const ac = deriveArmorClass(char(), [armor('Leather', 'light', 11), shield()], { dex: 2 });
    expect(ac.breakdown.map((b) => b.note)).toEqual(['armor', 'dex', 'shield']);
  });
});

describe('deriveArmorClass - armadura natural de espécie', () => {
  const flat = { type: 'flat', ac: 17, label: 'Natural Armor' };
  const unarmored = { type: 'unarmored', base: 13, ability: 'dex', label: 'Armored Casing' };
  const bonus = { type: 'bonus', bonus: 1, label: 'Integrated Protection' };

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
    expect(deriveArmorClass(char(), [armor('Plate', 'heavy', 18)], { dex: 0 }, unarmored).total).toBe(18);
  });

  it('Warforged: +1 por cima de 10 + Dex', () => {
    expect(deriveArmorClass(char(), [], { dex: 2 }, bonus).total).toBe(13);
  });

  it('Warforged: +1 por cima de armadura vestida', () => {
    expect(deriveArmorClass(char(), [armor('Plate', 'heavy', 18)], {}, bonus).total).toBe(19);
  });

  it('Barbarian Autognome: escolhe a maior entre Unarmored Defense e Armored Casing', () => {
    expect(deriveArmorClass(char('barbarian'), [], { dex: 2, con: 3 }, unarmored).total).toBe(15);
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
