// =============================================================================
// foundryFeatureUses.test: testes do pool de recurso
// =============================================================================
// O QUE FAZ
//   A referência casa com o identificador exportado, não com o slug do título
//   (TC-0068; o Wild Shape é o caso), e um traço de espécie sem classId cai na
//   tabela plana. A reserva da prosa (DDL-0106): por classe e plana, nunca com
//   pool na activity, e de precedência mais baixa no item exportado.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { featureUses, featUses, proseUses, firstUses, NOT_A_POOL, NO_POOL } from './foundryFeatureUses';
import { buildSpeciesTraitItems } from './foundryItems';

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

describe('proseUses (o pool que só a prosa declara)', () => {
  it('traço e talento pela tabela plana; feature pela classe', () => {
    expect(proseUses('Healing Hands')).toEqual({ max: '1', spent: 0, recovery: [{ period: 'lr', type: 'recoverAll' }] });
    expect(proseUses('Fey Step').max).toBe('@prof');
    expect(proseUses('Accursed Specter', 'warlock').max).toBe('1');
    expect(proseUses('Accursed Specter')).toBeNull();
    expect(proseUses("Hexblade's Curse", 'warlock').recovery).toEqual([{ period: 'sr', type: 'recoverAll' }]);
  });

  it('nunca soma um pool no item quando a activity já tem o dela (a forma do SRD)', () => {
    expect(proseUses('Healing Hands', null, { a: { uses: { max: '1' } } })).toBeNull();
    expect(proseUses('Healing Hands', null, { a: { uses: { max: '' } } })).not.toBeNull();
  });

  it('o que não é pool próprio fica de fora', () => {
    expect(NOT_A_POOL.has('superior inspiration')).toBe(true);
    expect(proseUses('Superior Inspiration', 'bard')).toBeNull();
  });

  it('firstUses: o primeiro com máximo; sem nenhum, o primeiro que existe', () => {
    const overlayEmpty = { max: '', spent: 0, recovery: [{ period: 'lr', type: 'recoverAll' }] };
    expect(firstUses(null, overlayEmpty, proseUses('Healing Hands')).max).toBe('1');
    expect(firstUses({ max: '@prof' }, proseUses('Healing Hands')).max).toBe('@prof');
    expect(firstUses(null, overlayEmpty, null)).toBe(overlayEmpty);
    expect(firstUses(null, undefined)).toEqual({ max: '', spent: 0, recovery: [] });
  });

  it('o Healing Hands do Aasimar sai com o pool no export', () => {
    const aasimar = {
      name: 'Aasimar', source: 'XPHB',
      entries: [{ type: 'entries', name: 'Healing Hands', entries: ["Once you use this trait, you can't use it again until you finish a Long Rest."] }],
    };
    const [item] = buildSpeciesTraitItems(aasimar, null);
    expect(item.system.uses).toMatchObject({ max: '1', recovery: [{ period: 'lr', type: 'recoverAll' }] });
  });
});

describe('pool compartilhado e pools por classe (TC-0093, TC-0094)', () => {
  it('o pool mora no DONO, pela escala da subclasse, com a recuperação do XPHB', () => {
    expect(featureUses('Psionic Power', 'fighter')).toMatchObject({ max: '@scale.psi-warrior.die.number', recovery: [{ period: 'lr', type: 'recoverAll' }, { period: 'sr', type: 'formula', formula: '1' }] });
    expect(featureUses('Psionic Power', 'rogue').max).toBe('@scale.soulknife.die.number');
    expect(featureUses('Combat Superiority', 'fighter')).toMatchObject({ max: '@scale.battle-master.superiority.number', recovery: [{ period: 'sr', type: 'recoverAll' }] });
    expect(featureUses('Warrior of the Gods', 'barbarian').max).toBe('@scale.zealot.warrior-of-the-gods');
  });

  it('a sub-feature que gasta o pool do dono não tem pool próprio, mesmo com o overlay copiando', () => {
    expect(featureUses('Protective Field', 'fighter')).toBe(NO_POOL);
    const overlayCopy = { max: '@scale.psi-warrior.die.number', spent: 0, recovery: [] };
    expect(firstUses(featureUses('Protective Field', 'fighter'), overlayCopy, null)).toEqual({ max: '', spent: 0, recovery: [] });
  });

  it('sem NO_POOL na frente, o firstUses segue como antes', () => {
    const a = { max: '2', spent: 0, recovery: [] };
    expect(firstUses(null, a)).toBe(a);
    expect(firstUses(null, { max: '', spent: 0, recovery: [] }).max).toBe('');
  });

  it('o talento ganha o pool curado (Ritual Caster, Boon of Recovery)', () => {
    expect(featUses('Ritual Caster')).toMatchObject({ max: '1', recovery: [{ period: 'lr', type: 'recoverAll' }] });
    expect(featUses('Boon of Recovery').max).toBe('10');
    expect(featUses('Alert')).toBeNull();
  });
});
