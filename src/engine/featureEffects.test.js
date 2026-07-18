import { describe, it, expect } from 'vitest';
import { deriveFeatureGrants } from './featureEffects';
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
