import { describe, it, expect } from 'vitest';
import { abilityModifier, proficiencyBonus, formatBonus } from './math';

describe('abilityModifier', () => {
  it('calcula o modificador padrão', () => {
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(11)).toBe(0);
    expect(abilityModifier(12)).toBe(1);
    expect(abilityModifier(8)).toBe(-1);
    expect(abilityModifier(20)).toBe(5);
    expect(abilityModifier(1)).toBe(-5);
    expect(abilityModifier(30)).toBe(10);
  });
});

describe('proficiencyBonus', () => {
  it('segue a tabela por nível total', () => {
    expect(proficiencyBonus(1)).toBe(2);
    expect(proficiencyBonus(4)).toBe(2);
    expect(proficiencyBonus(5)).toBe(3);
    expect(proficiencyBonus(6)).toBe(3);
    expect(proficiencyBonus(8)).toBe(3);
    expect(proficiencyBonus(9)).toBe(4);
    expect(proficiencyBonus(17)).toBe(6);
    expect(proficiencyBonus(20)).toBe(6);
  });

  it('trata nível 0 como +2 (defensivo)', () => {
    expect(proficiencyBonus(0)).toBe(2);
  });
});

describe('formatBonus', () => {
  it('põe sinal', () => {
    expect(formatBonus(5)).toBe('+5');
    expect(formatBonus(0)).toBe('+0');
    expect(formatBonus(-1)).toBe('−1');
  });
});
