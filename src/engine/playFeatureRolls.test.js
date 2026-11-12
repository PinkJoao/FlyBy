// =============================================================================
// playFeatureRolls.test: o registro curado das features que entram numa rolagem
// =============================================================================
// O QUE FAZ
//   Confere as fórmulas pelo nível (o texto do XPHB), quando cada extra aparece
//   (arma, FOR, corpo a corpo, Rage), o gasto dos extras ligados e o "Use" das
//   features de efeito e de gasto.
//
// FUNÇÕES
//   st(patch): um estado de jogo com o que o teste muda.
//   cat(features, extra): um catálogo com as features dadas.
//   ids(list): os ids de uma lista de extras.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { emptyPlayState } from './playState';
import { applyEffects } from './playEffects';
import { featureRiders, riderSpendOps, featureUseOf, featureRollOf, formulaOf } from './playFeatureRolls';
import { isActiveFeature } from './playFeatures';

const st = (patch = {}) => ({ ...emptyPlayState(), ...patch });
const cat = (features, extra = {}) => ({
  features,
  rollData: { prof: 3, abilities: { wis: { mod: 3 } }, classes: { barbarian: { levels: 9 }, ranger: { levels: 11 } }, 'scale.barbarian.rage-damage': 3, 'scale.bard.inspiration': '1d8', spells: { pact: { level: 3, max: 2 } } },
  resources: [
    { key: 'pool:bardic-inspiration', kind: 'pool', item: 'Bardic Inspiration', name: 'Bardic Inspiration', max: 3 },
    { key: 'pool:monks-focus', kind: 'pool', item: "Monk's Focus", name: 'Focus Points', max: 5 },
    { key: 'pact', kind: 'pact', name: 'Pact slots', max: 2 },
  ],
  ...extra,
});
const ids = (list) => list.map((e) => e.id);

describe('extras na rolagem', () => {
  it('as fórmulas seguem o nível', () => {
    const rd = cat([]).rollData;
    expect(formulaOf(featureRollOf('Frenzy'), rd)).toBe('3d6');
    expect(formulaOf(featureRollOf('Dreadful Strikes'), rd)).toBe('1d6');
    expect(formulaOf(featureRollOf('Dreadful Strikes'), { classes: { ranger: { levels: 10 } } })).toBe('1d4');
    expect(formulaOf(featureRollOf('Eldritch Smite'), rd)).toBe('4d8');
    expect(formulaOf(featureRollOf('Divine Strike'), { 'scale.cleric.divine-strike': '2d8' })).toBe('@scale.cleric.divine-strike');
  });

  it('o dano de arma só com arma; o de FOR só com FOR; o corpo a corpo começa ligado', () => {
    const c = cat(['radiant strikes', 'brutal strike'], { rollData: { ...cat([]).rollData, 'scale.barbarian.brutal-strike': '1d10' } });
    expect(ids(featureRiders(st(), c, { kind: 'damage', weapon: false }))).toEqual([]);
    const melee = featureRiders(st(), c, { kind: 'damage', weapon: true, melee: true, attackAbility: 'dex' });
    expect(ids(melee)).toEqual(['rider:radiant-strikes']);
    expect(melee[0].defaultOn).toBe(true);
    expect(ids(featureRiders(st(), c, { kind: 'damage', weapon: true, melee: false, attackAbility: 'str' }))).toEqual(['rider:brutal-strike']);
  });

  it('Frenzy e Divine Fury só com a Rage ligada', () => {
    const c = cat(['frenzy', 'divine fury']);
    const roll = { kind: 'damage', weapon: true, melee: true, attackAbility: 'str' };
    expect(featureRiders(st(), c, roll)).toEqual([]);
    const raging = st({ modifiers: [{ id: 'r', label: 'Rage', effects: [] }] });
    expect(ids(featureRiders(raging, c, roll))).toEqual(['rider:frenzy', 'rider:divine-fury']);
  });

  it('o extra que gasta leva a chave, e applyEffects devolve o gasto só ligado', () => {
    const c = cat(['peerless skill', 'eldritch smite']);
    const [peer] = featureRiders(st(), c, { kind: 'check' });
    expect(peer).toMatchObject({ id: 'rider:peerless-skill', defaultOn: false, spend: { key: 'pool:bardic-inspiration', amount: 1 }, part: { formula: '@scale.bard.inspiration' } });
    expect(applyEffects([peer]).spends).toEqual([]);
    const applied = applyEffects([peer], [peer.id]);
    expect(riderSpendOps(applied, c)).toEqual({ ops: [{ op: 'spend', key: 'pool:bardic-inspiration', amount: 1 }], lines: [{ name: 'Bardic Inspiration', amount: 1 }] });
    const [smite] = featureRiders(st(), c, { kind: 'damage', weapon: true });
    expect(smite.spend.key).toBe('pact');
  });

  it('sem o que gastar, o extra avisa e continua', () => {
    const c = cat(['peerless skill']);
    const [peer] = featureRiders(st({ spent: { 'pool:bardic-inspiration': 3 } }), c, { kind: 'attack' });
    expect(peer.label).toBe('Peerless Skill (none left)');
  });
});

describe('Use das features de efeito e de gasto', () => {
  it('Reckless Attack liga a vantagem em ataques de FOR por uma rodada', () => {
    const use = featureUseOf({ name: 'Reckless Attack' }, cat([]));
    expect(use.modifier).toMatchObject({ label: 'Reckless Attack', maxRounds: 1, effects: [{ targets: ['attack'], mode: 'advantage', when: 'strAttack' }] });
    expect(use.spend).toBeNull();
  });

  it('Stunning Strike gasta Focus e mostra a CD de CON (8 + PB + SAB)', () => {
    expect(featureUseOf({ name: 'Stunning Strike' }, cat([]))).toEqual({ modifier: null, spend: 'pool:monks-focus', save: { abilities: ['con'], dc: 14 }, roll: null, apply: null, restore: null });
  });

  it('o extra de rolagem não tem Use próprio', () => {
    expect(featureUseOf({ name: 'Divine Strike' }, cat([]))).toBeNull();
  });
});

describe('segunda leva: manobras, sorte, Goliath, monge', () => {
  const bm = (extra = {}) => cat(['goading attack', 'ambush', 'hand of harm'], {
    rollData: { prof: 4, abilities: { str: { mod: 4 }, dex: { mod: 1 }, wis: { mod: 2 } }, 'scale.battle-master.superiority.die': 'd10', 'scale.monk.die': '1d8' },
    resources: [{ key: 'pool:combat-superiority', kind: 'pool', item: 'Combat Superiority', name: 'Superiority Dice', max: 5 }, { key: 'pool:monks-focus', kind: 'pool', item: "Monk's Focus", name: 'Focus Points', max: 6 }],
    ...extra,
  });

  it('a manobra soma o dado de superioridade ao dano, gasta e diz a CD (8 + PB + FOR ou DES)', () => {
    const [goad] = featureRiders(st(), bm(), { kind: 'damage', weapon: true, melee: true });
    expect(goad).toMatchObject({ id: 'rider:goading-attack', part: { formula: '1d10' }, spend: { key: 'pool:combat-superiority' } });
    expect(goad.note).toContain('DC 16 Wisdom');
  });

  it('Ambush vale em Stealth e na iniciativa, não em Athletics', () => {
    expect(ids(featureRiders(st(), bm(), { kind: 'check', skill: 'ste' }))).toEqual(['rider:ambush']);
    expect(ids(featureRiders(st(), bm(), { kind: 'initiative', ability: 'dex' }))).toEqual(['rider:ambush']);
    expect(ids(featureRiders(st(), bm(), { kind: 'check', skill: 'ath' }))).toEqual([]);
  });

  it('Hand of Harm só no desarmado', () => {
    expect(ids(featureRiders(st(), bm(), { kind: 'damage', weapon: true, unarmed: true }))).toContain('rider:hand-of-harm');
    expect(ids(featureRiders(st(), bm(), { kind: 'damage', weapon: true, unarmed: false }))).not.toContain('rider:hand-of-harm');
  });

  it("Commander's Strike gasta e rola o dado para o aliado", () => {
    expect(featureUseOf({ name: "Commander's Strike" }, bm())).toMatchObject({ spend: 'pool:combat-superiority', roll: { formula: '1d10' } });
    expect(featureUseOf({ name: 'Inspiring Smite' }, bm()).roll.formula).toBe('2d8 + @classes.paladin.levels');
  });

  it('a que só melhora outra fica passiva mesmo com gatilho', () => {
    expect(isActiveFeature({ name: 'Improved Blessed Strikes', costs: [], trigger: 'rider', roll: featureRollOf('Improved Blessed Strikes').kind }, null, [])).toBe(false);
    expect(isActiveFeature({ name: 'Goading Attack', costs: [], trigger: null, roll: 'rider' }, null, [])).toBe(true);
  });
});

describe('terceira leva: magia, distância, dois extras, cura e devolução', () => {
  const rd = { prof: 3, abilities: { wis: { mod: 3 }, con: { mod: 2 } }, classes: { ranger: { levels: 11 }, druid: { levels: 6 }, fighter: { levels: 10 }, monk: { levels: 5 } }, 'scale.monk.die': '1d8' };
  const c = (features, resources = []) => ({ features, rollData: rd, resources });

  it('o extra de magia só no dano de magia; o de distância só à distância', () => {
    const cat2 = c(['empowered channeling', "kensei's shot"]);
    expect(ids(featureRiders(st(), cat2, { kind: 'damage', spell: true }))).toEqual(['rider:empowered-channeling']);
    expect(ids(featureRiders(st(), cat2, { kind: 'damage', weapon: true, melee: false }))).toEqual(['rider:kenseis-shot']);
    expect(ids(featureRiders(st(), cat2, { kind: 'damage', weapon: true, melee: true }))).toEqual([]);
  });

  it('o Dread Ambusher tem dois extras: o dano que gasta e a iniciativa ligada', () => {
    const cat2 = c(['dread ambusher'], [{ key: 'pool:dread-ambusher:dreadful-strike', kind: 'pool', item: 'Dread Ambusher', name: 'Dreadful Strike', max: 3 }]);
    expect(featureRiders(st(), cat2, { kind: 'damage', weapon: true })).toMatchObject([{ id: 'rider:dread-ambusher', part: { formula: '2d6' }, spend: { key: 'pool:dread-ambusher:dreadful-strike' } }]);
    expect(featureRiders(st(), cat2, { kind: 'initiative', ability: 'dex' })).toMatchObject([{ id: 'rider:dread-ambusher-1', defaultOn: true, part: { formula: '@abilities.wis.mod' } }]);
  });

  it('as fórmulas pelo nível (Polar Strikes no 11, Halo of Spores no 6, duas rolagens de Martial Arts)', () => {
    expect(formulaOf(featureRollOf('Frigid Explorer'), rd)).toBe('1d6');
    expect(formulaOf(featureRollOf('Halo of Spores').roll, rd)).toBe('1d6');
    expect(formulaOf(featureRollOf('Arms of the Astral Self').roll, rd)).toBe('@scale.monk.die + @scale.monk.die');
    expect(formulaOf(featureRollOf('Breath of the Dragon').roll, rd)).toBe('@scale.monk.die + @scale.monk.die');
  });

  it("Giant's Might liga vantagem de FOR e o dado do nível (1d8 no Fighter 10)", () => {
    const use = featureUseOf({ name: "Giant's Might" }, c([]));
    expect(use.modifier.maxRounds).toBe(10);
    expect(use.modifier.effects[1]).toMatchObject({ targets: ['damage'], formula: '1d8', optional: true });
  });

  it('Uncanny Metabolism cura e devolve o Focus; Symbiotic Entity dá temporários e gasta Wild Shape', () => {
    const res = [{ key: 'pool:monks-focus', kind: 'pool', item: "Monk's Focus", name: 'Focus Points', max: 5 }, { key: 'pool:wild-shape', kind: 'pool', item: 'Wild Shape', name: 'Wild Shape', max: 2 }];
    expect(featureUseOf({ name: 'Uncanny Metabolism' }, c([], res))).toMatchObject({ apply: 'heal', restore: 'pool:monks-focus' });
    expect(featureUseOf({ name: 'Symbiotic Entity' }, c([], res))).toMatchObject({ apply: 'temp', spend: 'pool:wild-shape', roll: { formula: '4 * @classes.druid.levels' } });
    expect(ids(featureRiders(st(), c(['symbiotic entity'], res), { kind: 'damage', weapon: true, melee: true }))).toEqual(['rider:symbiotic-entity-1']);
  });
});
