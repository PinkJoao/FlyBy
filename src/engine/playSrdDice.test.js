// =============================================================================
// playSrdDice.test: as features de dado que sobravam no SRD
// =============================================================================
// O QUE FAZ
//   Prova o DDL-0217 com as frases do XPHB: o Supreme Healing (cada dado de cura no máximo),
//   o Cunning Strike e o Devious Strikes (dados do Sneak Attack que se tiram), o Smooth Talker
//   do Arcane Eloquence, o "Use" do Use Magic Device e o limite de atunement pela prosa; e o
//   Disciple of Life (2 mais o círculo na cura de magia, DDL-0219).
//
// FUNÇÕES
//   catalog(features): um catálogo mínimo de ladino com Sneak Attack 3d6, DES +4 e PB 3.
//
// DECISÕES E ARMADILHAS
//   - O rng fixo (sequenceRng) faz cada dado cair onde o teste quer.
// -----------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { emptyPlayState } from './playState';
import { sequenceRng } from './dice';
import { spellHealEvent, healParts } from './playCast';
import { rollDamageEvent, forgoDice, withDiceMax } from './playActions';
import { featureRiders, featureUseOf } from './playFeatureRolls';
import { rollEffects, applyEffects } from './playEffects';
import { attunementMaxFor, unmetAttunement } from './attunement';

const catalog = (features = []) => ({
  features,
  stats: { hpMax: 30 },
  rollData: { prof: 3, abilities: { dex: { mod: 4 }, wis: { mod: 3 } }, 'scale.rogue.sneak-attack': '3d6' },
  resources: [],
});

describe('Supreme Healing', () => {
  it('cada dado da cura de magia vale o máximo, e a parte diz por quê', () => {
    const spell = { key: 's', name: 'Cure Wounds', level: 1, mechanics: { heal: { dice: '2d8', addMod: true } } };
    const origin = { abilityMod: 3 };
    const ev = spellHealEvent({ catalog: catalog(['supreme healing']), state: emptyPlayState(), origin, spell, level: 1 });
    expect(ev.rolls.total).toBe(19);
    expect(ev.rolls.parts[0].label).toBe('Cure Wounds (Supreme Healing)');
    expect(withDiceMax('2d8 + 1d4')).toBe('2d8min8 + 1d4min4');
  });
});

describe('Disciple of Life', () => {
  it('a cura de magia ganha 2 mais o círculo do espaço; o cantrip não', () => {
    const spell = { key: 's', name: 'Cure Wounds', level: 1, mechanics: { heal: { dice: '2d8', addMod: true }, upcast: '2d8' } };
    const origin = { abilityMod: 3 };
    expect(healParts(origin, spell, 2, catalog(['disciple of life']))).toContainEqual({ label: 'Disciple of Life', formula: 4 });
    const ev = spellHealEvent({ catalog: catalog(['disciple of life', 'supreme healing']), state: emptyPlayState(), origin, spell, level: 1 });
    expect(ev.rolls.total).toBe(16 + 3 + 3);
    expect(healParts(origin, { ...spell, level: 0 }, 0, catalog(['disciple of life'])).some((p) => p.label === 'Disciple of Life')).toBe(false);
    expect(healParts(origin, spell, 1).some((p) => p.label === 'Disciple of Life')).toBe(false);
  });
});

describe('Cunning Strike e Devious Strikes', () => {
  it('cada efeito é um extra que tira dados do Sneak Attack, com a CD 8 + DES + PB', () => {
    const riders = featureRiders(emptyPlayState(), catalog(['cunning strike', 'devious strikes']), { kind: 'damage', weapon: true }).filter((r) => r.id !== 'rider:sneak-attack');
    expect(riders.map((r) => r.forgo)).toEqual([1, 1, 1, 2, 6, 3]);
    expect(riders[0].note).toMatch(/DC 15 Constitution/);
  });

  it('o dano com Poison ligado rola 2d6 de Sneak Attack em vez de 3d6', () => {
    const c = catalog(['cunning strike']);
    const effects = rollEffects(emptyPlayState(), c, { kind: 'damage', weapon: true, melee: true });
    const on = effects.filter((e) => e.id === 'rider:sneak-attack' || e.id === 'rider:cunning-strike').map((e) => e.id);
    const applied = applyEffects(effects, on);
    expect(applied.forgo).toBe(1);
    const attack = { key: 'a', name: 'Rapier', damage: { dice: '1d8', bonus: 4, types: ['piercing'] } };
    const ev = rollDamageEvent({ catalog: c, attack, options: { applied }, rng: sequenceRng([5, 6, 6]) });
    expect(ev.rolls.parts.find((p) => /Sneak Attack/.test(p.label))).toMatchObject({ formula: '2d6', total: 12 });
    expect(forgoDice('3d6', 6)).toBe('0d6');
  });
});

describe('Arcane Eloquence, Use Magic Device e o atunement', () => {
  it('Smooth Talker soma 1d4 só em Deception, Intimidation e Persuasion', () => {
    const c = catalog(['arcane eloquence']);
    expect(featureRiders(emptyPlayState(), c, { kind: 'check', ability: 'cha', skill: 'per' })).toMatchObject([{ part: { formula: '1d4' }, defaultOn: true }]);
    expect(featureRiders(emptyPlayState(), c, { kind: 'check', ability: 'cha', skill: 'prf' })).toEqual([]);
  });

  it('o Use do Use Magic Device rola o d6 das cargas', () => {
    expect(featureUseOf({ name: 'Use Magic Device' }, catalog([]))).toMatchObject({ roll: { formula: '1d6' } });
  });

  it('o limite de atunement sobe pela frase da feature alcançada', () => {
    const db = { 'class-rogue': { subclassFeature: [{ name: 'Use Magic Device', className: 'Rogue', subclassShortName: 'Thief', subclassSource: 'XPHB', level: 13, entries: ['Attunement You can attune to up to four magic items at once.'] }] } };
    const thief = (level) => [{ classId: 'rogue', className: 'Rogue', classSource: 'XPHB', level, subclassShortName: 'Thief', subclassSource: 'XPHB' }];
    expect(attunementMaxFor(db, thief(12))).toBe(3);
    expect(attunementMaxFor(db, thief(13))).toBe(4);
    expect(unmetAttunement(3, { reqAttune: true }, 4)).toBeNull();
    expect(unmetAttunement(4, { reqAttune: true }, 4)).toMatch(/4 items/);
  });
});
