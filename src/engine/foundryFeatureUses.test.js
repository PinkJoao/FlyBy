import { describe, it, expect } from 'vitest';
import { featureUses } from './foundryFeatureUses';

describe('featureUses', () => {
  it('feature de escala → max @scale.<class>.<slug> + recovery', () => {
    expect(featureUses('Second Wind', 'fighter')).toEqual({
      max: '@scale.fighter.second-wind',
      spent: 0,
      recovery: [{ period: 'lr', type: 'recoverAll' }, { period: 'sr', type: 'formula', formula: '1' }],
    });
    expect(featureUses('Rage', 'barbarian').max).toBe('@scale.barbarian.rages');
    expect(featureUses("Monk's Focus", 'monk').max).toBe('@scale.monk.focus-points');
  });

  it('a mesma feature em classes diferentes usa o classId (Channel Divinity)', () => {
    expect(featureUses('Channel Divinity', 'cleric').max).toBe('@scale.cleric.channel-divinity');
    expect(featureUses('Channel Divinity', 'paladin').max).toBe('@scale.paladin.channel-divinity');
  });

  it('feature com fórmula literal (sem escala)', () => {
    expect(featureUses('Bardic Inspiration', 'bard')).toMatchObject({ max: 'max(1, @abilities.cha.mod)' });
    expect(featureUses('Lay on Hands', 'paladin').max).toBe('5 * @classes.paladin.levels');
    expect(featureUses('Arcane Recovery', 'wizard').max).toBe('1');
  });

  it('feature sem recurso curado → null (case-insensitive)', () => {
    expect(featureUses('Extra Attack', 'fighter')).toBeNull();
    expect(featureUses('SECOND WIND', 'fighter')).not.toBeNull();
  });
});
