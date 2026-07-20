import { describe, it, expect } from 'vitest';
import { deriveFeatureGrants, cantripLimitBonus } from './featureEffects';
import { createCharacter } from '../schema/character';

function clericWith(featureoptionPicks) {
  const c = createCharacter({ name: 'T' });
  c.classes = [
    {
      classId: 'cleric',
      source: 'XPHB',
      level: 3,
      isOriginalClass: true,
      hitPoints: {},
      choices: { 'featopt@Divine Order@1': { kind: 'featureoption', picks: featureoptionPicks } },
    },
  ];
  return c;
}

describe('deriveFeatureGrants', () => {
  it('Protector → armas marciais + armadura pesada', () => {
    expect(deriveFeatureGrants(clericWith(['Protector|XPHB']))).toEqual({
      armor: ['Heavy Armor'],
      weapons: ['Martial Weapons'],
      grantedSkills: [],
      grantedTools: [],
    });
  });

  it('Warden → armas marciais + armadura média', () => {
    const c = clericWith(['Warden|XPHB']);
    const out = deriveFeatureGrants(c);
    expect(out.weapons).toEqual(['Martial Weapons']);
    expect(out.armor).toEqual(['Medium Armor']);
  });

  it('Thaumaturge (só cantrip/checks) → sem proficiências', () => {
    expect(deriveFeatureGrants(clericWith(['Thaumaturge|XPHB']))).toEqual({
      armor: [],
      weapons: [],
      grantedSkills: [],
      grantedTools: [],
    });
  });

  it('sem escolhas → tudo vazio', () => {
    expect(deriveFeatureGrants(createCharacter())).toEqual({ armor: [], weapons: [], grantedSkills: [], grantedTools: [] });
  });
});

// TC-0028: "you know one extra cantrip" das featureoptions soma no limite.
describe('cantripLimitBonus', () => {
  it('Thaumaturge → +1', () => {
    expect(cantripLimitBonus(clericWith(['Thaumaturge|XPHB']).classes[0])).toBe(1);
  });
  it('Magician (Primal Order) → +1', () => {
    expect(cantripLimitBonus(clericWith(['Magician|XPHB']).classes[0])).toBe(1);
  });
  it('Protector → 0; sem bag → 0', () => {
    expect(cantripLimitBonus(clericWith(['Protector|XPHB']).classes[0])).toBe(0);
    expect(cantripLimitBonus(null)).toBe(0);
  });
});
