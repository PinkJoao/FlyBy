// =============================================================================
// foundryFeatureUses.test: testes do pool de recurso
// =============================================================================
// O QUE FAZ
//   A referência casa com o identificador exportado, não com o slug do título
//   (TC-0068; o Wild Shape é o caso), e um traço de espécie sem classId cai na
//   tabela plana.
// -----------------------------------------------------------------------------

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
  });

  it('identificador curto do SRD: `id` vence o slug do título', () => {
    expect(featureUses("Monk's Focus", 'monk').max).toBe('@scale.monk.focus');
    expect(featureUses('Font of Magic', 'sorcerer').max).toBe('@scale.sorcerer.points');
    expect(featureUses('Wild Shape', 'druid').max).toBe('@scale.druid.wild-shape-uses');
  });

  it('feature não curada vem da tabela GERADA do SRD (por classe e plana)', () => {
    expect(featureUses('Uncanny Metabolism', 'monk')).toEqual({
      max: '1', spent: 0, recovery: [{ period: 'lr', type: 'recoverAll' }],
    });
    expect(featureUses('Relentless Endurance').max).toBe('1');
    expect(featureUses('Breath Weapon').max).toBe('@prof');
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

  it('feature sem recurso nenhum → null (case-insensitive)', () => {
    expect(featureUses('Extra Attack', 'fighter')).toBeNull();
    expect(featureUses('SECOND WIND', 'fighter')).not.toBeNull();
  });
});
