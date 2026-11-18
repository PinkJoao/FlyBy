// =============================================================================
// playFeatureRolls.test: o registro curado das features que entram numa rolagem
// =============================================================================
// O QUE FAZ
//   Confere as fórmulas pelo nível (o texto do XPHB), quando cada extra aparece
//   (arma, FOR, corpo a corpo, Rage), o gasto dos extras ligados e o "Use" das
//   features de efeito e de gasto; as opções de classe (Agonizing Blast, Arcane Shots do AU,
//   manobras com o dado no teste e no dano, DDL-0237).
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
    const c = cat(['frenzy', 'divine fury'], { featureList: [{ name: 'Frenzy', source: 'XPHB' }] });
    const roll = { kind: 'damage', weapon: true, melee: true, attackAbility: 'str' };
    expect(featureRiders(st(), c, roll)).toEqual([]);
    const raging = st({ modifiers: [{ id: 'r', label: 'Rage', effects: [] }] });
    expect(ids(featureRiders(raging, c, roll))).toEqual(['rider:frenzy', 'rider:divine-fury']);
    const old = cat(['frenzy'], { featureList: [{ name: 'Frenzy', source: 'PHB' }] });
    expect(ids(featureRiders(raging, old, roll))).toEqual([]);
  });

  it('Great Weapon Fighting: ligado na arma de duas mãos, desligado na Versatile, fora na de uma mão (DDL-0221)', () => {
    const c = cat(['great weapon fighting']);
    const base = { kind: 'damage', weapon: true, melee: true, attackAbility: 'str' };
    expect(featureRiders(st(), c, { ...base, twoHanded: true })).toMatchObject([{ diceMin: 3, defaultOn: true }]);
    expect(featureRiders(st(), c, { ...base, versatile: true })).toMatchObject([{ diceMin: 3, defaultOn: false }]);
    expect(featureRiders(st(), c, base)).toEqual([]);
    expect(featureRiders(st(), c, { ...base, melee: false, twoHanded: true })).toEqual([]);
  });

  it("o Colossus Slayer genérico some quando a opção do Hunter's Prey está na ficha (DDL-0221)", () => {
    const roll = { kind: 'damage', weapon: true };
    expect(ids(featureRiders(st(), cat(["hunter's prey"]), roll))).toEqual(["rider:hunters-prey"]);
    expect(ids(featureRiders(st(), cat(["hunter's prey", "hunter's prey: giant killer"]), roll))).toEqual([]);
  });

  it('o extra que gasta leva a chave, e applyEffects devolve o gasto só ligado', () => {
    const c = cat(['peerless skill', 'eldritch smite']);
    const [peer] = featureRiders(st(), c, { kind: 'check' });
    expect(peer).toMatchObject({ id: 'rider:peerless-skill', defaultOn: false, spend: { key: 'pool:bardic-inspiration', amount: 1 }, part: { formula: '@scale.bard.inspiration' } });
    expect(applyEffects([peer]).spends).toEqual([]);
    const applied = applyEffects([peer], [peer.id]);
    expect(riderSpendOps(applied, c)).toEqual({ ops: [{ op: 'spend', key: 'pool:bardic-inspiration', amount: 1 }], lines: [{ name: 'Bardic Inspiration', amount: 1 }] });
    expect(featureRiders(st(), c, { kind: 'damage', weapon: true })).toEqual([]);
    const [smite] = featureRiders(st(), c, { kind: 'damage', weapon: true, pact: true });
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
    expect(featureUseOf({ name: 'Stunning Strike' }, cat([]))).toEqual({ modifier: null, spend: 'pool:monks-focus', amount: 1, spent: 1, save: { abilities: ['con'], dc: 14 }, roll: null, apply: null, restore: null, restoreUpTo: null });
  });

  it('o ki das subclasses antigas gasta Focus na quantidade do texto (DDL-0224)', () => {
    const c = cat([]);
    const touch = featureUseOf({ name: 'Touch of the Long Death' }, c, 4);
    expect(touch).toMatchObject({ spend: 'pool:monks-focus', amount: { min: 1, max: 10 }, spent: 4, roll: { formula: '8d10' } });
    expect(featureUseOf({ name: 'Touch of the Long Death' }, c, 99).spent).toBe(10);
    expect(featureUseOf({ name: 'Searing Sunburst' }, c, 0)).toMatchObject({ spent: 0, roll: { formula: '2d6' } });
    expect(featureUseOf({ name: 'Awakened Astral Self' }, c)).toMatchObject({ amount: 5, spent: 5 });
    expect(featureUseOf({ name: 'Mastery of Death' }, c)).toMatchObject({ spent: 1, apply: 'heal', roll: { formula: '1' } });
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
    expect(isActiveFeature({ name: 'Improved Elemental Fury', costs: [], trigger: 'rider', roll: featureRollOf('Improved Elemental Fury').kind }, null, [])).toBe(false);
    expect(isActiveFeature({ name: 'Goading Attack', costs: [], trigger: null, roll: 'rider' }, null, [])).toBe(true);
  });

  it('Improved Blessed Strikes e Heightened Focus dão os PV temporários do texto no Use (DDL-0214)', () => {
    const rd = { abilities: { wis: { mod: 4 } }, 'scale.monk.die': '1d8' };
    expect(featureUseOf({ name: 'Improved Blessed Strikes' }, { rollData: rd })).toMatchObject({ apply: 'temp', roll: { formula: '2 * @abilities.wis.mod' } });
    expect(featureUseOf({ name: 'Heightened Focus' }, { rollData: rd })).toMatchObject({ apply: 'temp', roll: { formula: '@scale.monk.die + @scale.monk.die' } });
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

describe('Savage Attacker: o dado da arma rolado duas vezes', () => {
  it('liga `twice` na arma, nunca no desarmado, e o dano fica com a melhor rolagem', async () => {
    const { rollDamageEvent } = await import('./playActions');
    const { sequenceRng } = await import('./dice');
    const c = cat(['savage attacker']);
    expect(featureRiders(st(), c, { kind: 'damage', weapon: true, unarmed: true })).toEqual([]);
    const riders = featureRiders(st(), c, { kind: 'damage', weapon: true, melee: true });
    expect(ids(riders)).toEqual(['rider:savage-attacker']);
    expect(riders[0].part).toBeUndefined();
    const applied = applyEffects(riders, ['rider:savage-attacker']);
    expect(applied.twice).toBe(true);
    const attack = { key: 'a', name: 'Greatsword', kind: 'weapon', damage: { dice: '2d6', bonus: 3, types: ['slashing'] } };
    const e = rollDamageEvent({ catalog: c, attack, options: { applied }, rng: sequenceRng([1, 2, 6, 5]) });
    expect(e.rolls.total).toBe(14);
    const [first, second] = e.rolls.parts[0].groups;
    expect(first.results.every((r) => !r.kept)).toBe(true);
    expect(second.results.every((r) => r.kept)).toBe(true);
    const crit = rollDamageEvent({ catalog: c, attack, options: { applied, critical: true }, rng: sequenceRng([6, 6, 6, 6, 1, 1, 1, 1]) });
    expect(crit.rolls.total).toBe(27);
  });
});

describe('options no Use (DDL-0235)', () => {
  it('Raging Elements: cada opção com o seu dado pela Rage e a sua salvaguarda', () => {
    const catalog = { rollData: { 'scale.barbarian.rage-damage': 3, prof: 4, abilities: { con: { mod: 3 } } }, resources: [] };
    const f = { name: 'Raging Elements' };
    expect(featureUseOf(f, catalog).options).toEqual(['Icefury', 'Lava Burst', 'Lightning Bolt']);
    expect(featureUseOf(f, catalog, null, 0).roll.formula).toBe('3d8');
    expect(featureUseOf(f, catalog, null, 1)).toMatchObject({ roll: { formula: '3d4' }, save: { abilities: ['dex'], dc: 15 } });
    expect(featureUseOf(f, catalog, null, 2).roll.formula).toBe('3d6');
  });
});

describe('opções de classe (DDL-0237)', () => {
  const opt = (features) => cat(features, {
    rollData: { prof: 4, abilities: { str: { mod: 4 }, dex: { mod: 2 }, int: { mod: 3 }, cha: { mod: 5 } }, 'scale.battle-master.superiority.die': 'd10', 'scale.arcane-archer.arcane-shot.die': 'd8' },
    resources: [{ key: 'pool:sup', kind: 'pool', item: 'Combat Superiority', max: 5 }, { key: 'pool:shot', kind: 'pool', item: 'Arcane Shot', max: 3 }],
  });

  it('o Agonizing Blast só no dano de cantrip, ligado', () => {
    const c = opt(['agonizing blast']);
    expect(featureRiders(st(), c, { kind: 'damage', spell: true })).toEqual([]);
    const [r] = featureRiders(st(), c, { kind: 'damage', spell: true, cantrip: true });
    expect(r).toMatchObject({ defaultOn: true, part: { formula: '@abilities.cha.mod' } });
  });

  it('o Arcane Shot do AU usa o dado da escala e a CD de INT', () => {
    const [r] = featureRiders(st(), opt(['beguiling shot']), { kind: 'damage', weapon: true, melee: false });
    expect(r).toMatchObject({ spend: { key: 'pool:shot', amount: 1 }, part: { formula: '2d8' } });
    expect(r.note).toContain('DC 15 Wisdom');
  });

  it('a manobra de teste vale só nas perícias dela; a de dano tem a CD de FOR ou DES', () => {
    const c = opt(['commanding presence', 'trip attack']);
    expect(ids(featureRiders(st(), c, { kind: 'check', skill: 'per' }))).toEqual(['rider:commanding-presence']);
    expect(featureRiders(st(), c, { kind: 'check', skill: 'ath' })).toEqual([]);
    const [trip] = featureRiders(st(), c, { kind: 'damage', weapon: true });
    expect(trip).toMatchObject({ spend: { key: 'pool:sup', amount: 1 }, part: { formula: '1d10' } });
    expect(trip.note).toContain('DC 16 Strength');
  });

  it('Fire Rune e Health Funnel (DDL-0238)', () => {
    const c = opt(['fire rune']);
    c.resources.push({ key: 'pool:fire-rune', kind: 'pool', item: 'Fire Rune', max: 1 }, { key: 'hd:d8', kind: 'hitDice', faces: 8, max: 5 });
    c.rollData.abilities.con = { mod: 2 };
    const [r] = featureRiders(st(), c, { kind: 'damage', weapon: true });
    expect(r).toMatchObject({ spend: { key: 'pool:fire-rune' }, part: { formula: '2d6' } });
    expect(r.note).toContain('DC 14 Strength');
    const use = featureUseOf({ name: 'Health Funnel' }, { ...c, rollData: { ...c.rollData, classes: { warlock: { levels: 5 } } } }, 3);
    expect(use).toMatchObject({ spend: 'hd:d8', spent: 3, roll: { formula: '3d8 + 15' } });
  });
});

describe('TC-0170 (DDL-0243)', () => {
  it('Elemental Adept só na magia do tipo escolhido', () => {
    const c = cat(['elemental adept'], { damageTypePicks: ['fire'] });
    expect(ids(featureRiders(st(), c, { kind: 'damage', spell: true, types: ['cold'] }))).toEqual([]);
    const on = featureRiders(st(), c, { kind: 'damage', spell: true, types: ['fire'] });
    expect(ids(on)).toEqual(['rider:elemental-adept']);
  });

  it('Aura of Elemental Shielding: uma opção por tipo, cada uma uma resistência', () => {
    const use = featureUseOf({ name: 'Aura of Elemental Shielding' }, cat(['aura of elemental shielding']));
    expect(use.options.length).toBe(5);
    const fire = featureUseOf({ name: 'Aura of Elemental Shielding' }, cat(['aura of elemental shielding']), null, 2);
    expect(fire.modifier.resist).toEqual(['fire']);
  });
});
