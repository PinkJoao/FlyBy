// =============================================================================
// playOpenFamilies.test: as dez famílias que o levantamento deixava em aberto
// =============================================================================
// O QUE FAZ
//   Prova cada caminho novo do DDL-0215 com as frases do texto: o espaço de magia (Blessed
//   Healer, Abjuration Adept), a CA (Soul of the Forge, Taunka), o dado de vida (Troll
//   Healing, Inner Peace, Black Blood Healing, Iron Stomach), o modificador de toda cura
//   (Boon of Fortitude, Augmented Health), o reroll de alguns dados (Piercer, Flames of
//   Phlegethos), o bônus depois da rolagem (Arcane Deflection), o piso do dado (Clean Hits)
//   e os registros curados (Devouring Plague, Soul of Artifice, Conjuration Adept).
//
// FUNÇÕES
//   catalog(features, extra): um catálogo mínimo com PV 30, CON +2 e PB 3.
//   cast(payload): um evento de magia lançada.
//
// DECISÕES E ARMADILHAS
//   - O rng fixo (sequenceRng) faz cada dado cair onde o teste quer.
// -----------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { emptyPlayState } from './playState';
import { sequenceRng } from './dice';
import { castTriggers, spellRecallEvent } from './playCast';
import { spellMechanics } from './playCatalog';
import { resolveSubclassFeatures } from './foundryItems';
import { rollHitDie, shortRestEvent } from './playRest';
import { healOutcome, tempHpOutcome } from './playHealth';
import { rerollOptions, rerollEvent, rerollDiceOptions, rerollDiceEvent, rerollableDice } from './playRerolls';
import { withDiceMin } from './playActions';
import { featureUseOf, featureRiders } from './playFeatureRolls';
import { acFeatureBonuses } from './featureEffects';
import { naturalArmorFor } from './naturalArmor';

const catalog = (features = [], extra = {}) => ({
  features,
  stats: { hpMax: 30 },
  rollData: { prof: 3, abilities: { con: { mod: 2 }, cha: { mod: 3 }, int: { mod: 4 } }, attunement: { value: 2 }, featAbility: { 'conjuration adept': 'int' } },
  resources: [{ key: 'pool:font', kind: 'pool', item: 'Font of Magic', name: 'Sorcery Points', max: 5 }],
  attacks: [{ key: 'attack:spear', kind: 'weapon' }],
  ...extra,
});
const cast = (payload) => ({ id: 'c', kind: 'cast', label: 'Cure Wounds', payload, ops: [] });

describe('o espaço de magia: o botão do card da magia', () => {
  it('Blessed Healer: a magia de cura com espaço dá 2 + o círculo; com uso concedido, nada', () => {
    expect(castTriggers(cast({ heal: true, slotted: true, level: 3 }), catalog(['blessed healer']))).toMatchObject([{ apply: 'heal', formula: '5' }]);
    expect(castTriggers(cast({ heal: true, slotted: false, level: 3 }), catalog(['blessed healer']))).toEqual([]);
  });

  it('Abjuration Adept: a magia de Abjuração com espaço dá o dobro do círculo em temporários', () => {
    expect(castTriggers(cast({ school: 'A', slotted: true, level: 2 }), catalog(['abjuration adept']))).toMatchObject([{ apply: 'temp', formula: '4' }]);
    expect(castTriggers(cast({ school: 'V', slotted: true, level: 2 }), catalog(['abjuration adept']))).toEqual([]);
  });
});

describe('a CA da ficha', () => {
  it('Soul of the Forge no Forge 6, pedindo armadura pesada', () => {
    const forge = (level) => acFeatureBonuses({ classes: [{ subclassId: 'Forge', subclassSource: 'XGE', level }] });
    expect(forge(5)).toEqual([]);
    expect(forge(6)).toMatchObject([{ value: 1, requiresHeavy: true }]);
  });

  it('a linhagem Taunka do Tauren soma +1', () => {
    expect(naturalArmorFor({ name: 'Tauren; Taunka Lineage', source: 'WoW' })).toMatchObject({ type: 'bonus', bonus: 1 });
    expect(naturalArmorFor({ name: 'Tauren; Mulgore Lineage', source: 'WoW' })).toBeNull();
  });
});

describe('o dado de vida', () => {
  it('Troll Healing usa o máximo só no descanso curto; Inner Peace soma 1', () => {
    const c = catalog(['troll healing', 'inner peace']);
    expect(rollHitDie({ catalog: c, faces: 10, rest: true, rng: sequenceRng([1]) }).healed).toBe(13);
    expect(rollHitDie({ catalog: c, faces: 10, rest: false, rng: sequenceRng([1]) }).healed).toBe(3);
  });

  it('Black Blood Healing rola de novo o 1 e o 2 no descanso curto', () => {
    expect(rollHitDie({ catalog: catalog(['black blood healing']), faces: 8, rest: true, rng: sequenceRng([2, 6]) }).healed).toBe(8);
  });

  it('Iron Stomach soma CON + PB uma vez no descanso curto com dado gasto', () => {
    const c = catalog(['vigor of the hill giant']);
    const spends = [rollHitDie({ catalog: c, faces: 8, rest: true, rng: sequenceRng([4]) })];
    const ev = shortRestEvent({ state: { ...emptyPlayState(), damage: 20 }, catalog: c, spends });
    expect(ev.rolls.total).toBe(11);
  });
});

describe('o modificador de toda cura', () => {
  it('Boon of Fortitude soma o CON a cada cura; Augmented Health soma 5 aos temporários', () => {
    const state = { ...emptyPlayState(), damage: 20 };
    expect(healOutcome(state, catalog(['boon of fortitude']), 4).summary).toMatchObject({ healed: 6, bonus: { value: 2 } });
    expect(healOutcome(state, catalog([]), 4).summary.healed).toBe(4);
    expect(tempHpOutcome(emptyPlayState(), 3, { catalog: catalog(['boon of bountiful health']) }).summary.to).toBe(8);
  });
});

describe('o bônus depois da rolagem e o reroll de alguns dados', () => {
  it('Arcane Deflection soma 4 sem rolar de novo', () => {
    const event = { id: 'e', kind: 'check', label: 'Wisdom save', payload: { test: { type: 'save', id: 'wis' } }, rolls: { mode: 'normal', total: 9, parts: [{ label: 'd20', formula: '1d20', total: 7 }, { label: 'Save', formula: '2', total: 2 }] }, ops: [] };
    const option = rerollOptions(event, catalog(['arcane deflection']), emptyPlayState()).find((o) => o.id === 'arcane deflection');
    const ev = rerollEvent({ event, catalog: catalog([]), option });
    expect(ev).toMatchObject({ label: 'Wisdom save (raised)', rolls: { total: 13 }, payload: { reroll: { keep: true } } });
  });

  it('Piercer rola de novo um dado do dano perfurante e só ele muda', () => {
    const event = { id: 'd', kind: 'damageRoll', label: 'Spear', payload: { attackKey: 'attack:spear', types: ['piercing'] }, ops: [], rolls: { total: 5, parts: [{ label: 'Spear', formula: '1d6', total: 1, groups: [{ faces: 6, results: [{ value: 1, kept: true }], total: 1 }] }, { label: 'Modifier', formula: '4', total: 4, groups: [] }] } };
    const c = catalog(['piercer']);
    const option = rerollDiceOptions(event, c, emptyPlayState()).find((o) => o.id === 'piercer');
    expect(option.max).toBe(1);
    const ev = rerollDiceEvent({ event, catalog: c, option, picks: rerollableDice(event).map((d) => d.id), rng: sequenceRng([6]) });
    expect(ev.rolls.total).toBe(10);
    expect(ev.rolls.parts[0].groups[0].results).toEqual([{ value: 1, kept: false, rerolled: true }, { value: 6, kept: true }]);
  });

  it('Flames of Phlegethos só no dano de magia de fogo', () => {
    const fire = { kind: 'damageRoll', payload: { attackKey: 'spell:x|Fire Bolt', types: ['fire'] }, ops: [], rolls: { parts: [{ groups: [{ faces: 10, results: [{ value: 1, kept: true }] }] }] } };
    expect(rerollDiceOptions(fire, catalog(['flames of phlegethos']), emptyPlayState()).find((o) => o.id === 'flames of phlegethos')).toMatchObject({ ones: true });
    expect(rerollDiceOptions({ ...fire, payload: { attackKey: 'attack:spear', types: ['piercing'] } }, catalog(['flames of phlegethos']), emptyPlayState()).map((o) => o.id)).toEqual(['rule']);
  });
});

describe('o piso do dado e os registros curados', () => {
  it('Clean Hits põe min2 em cada dado, com a referência resolvida', () => {
    expect(withDiceMin('1d8 + 2d6', 2)).toBe('1d8min2 + 2d6min2');
    expect(withDiceMin('@scale.monk.die', 2, { 'scale.monk.die': '1d8' })).toBe('(1d8min2)');
  });

  it('Devouring Plague rola o necrótico e cura o mesmo número', () => {
    expect(featureUseOf({ name: 'Devouring Plague' }, catalog([]))).toMatchObject({ apply: 'heal', roll: { formula: '1d10' } });
  });

  it('Soul of Artifice só a do TCE, com o número de itens atunados; Conjuration Adept pelo atributo do talento', () => {
    const tce = catalog(['soul of artifice'], { featureList: [{ name: 'Soul of Artifice', source: 'TCE' }] });
    const efa = catalog(['soul of artifice'], { featureList: [{ name: 'Soul of Artifice', source: 'EFA' }] });
    expect(featureRiders(emptyPlayState(), tce, { kind: 'save', ability: 'dex' })).toMatchObject([{ part: { formula: '@attunement.value' }, defaultOn: true }]);
    expect(featureRiders(emptyPlayState(), efa, { kind: 'save', ability: 'dex' })).toEqual([]);
    expect(featureRiders(emptyPlayState(), catalog(['conjuration adept']), { kind: 'concentration' })).toMatchObject([{ part: { formula: '@abilities.int.mod' } }]);
  });
});

describe('o que os personagens modelo acharam (DDL-0218)', () => {
  it('Spell Recall: o botão aparece no espaço de círculo 1 a 4, e o 1d4 igual ao círculo devolve o espaço', () => {
    const [t] = castTriggers(cast({ slotted: true, level: 2, slotKey: 'slot:2' }), catalog(['boon of spell recall']));
    expect(t).toMatchObject({ recall: true, level: 2, slotKey: 'slot:2' });
    expect(spellRecallEvent({ trigger: t, rng: sequenceRng([2]) }).ops).toEqual([{ op: 'restore', key: 'slot:2', amount: 1 }]);
    expect(spellRecallEvent({ trigger: t, rng: sequenceRng([3]) }).ops).toEqual([]);
    expect(castTriggers(cast({ slotted: true, level: 5, slotKey: 'slot:5' }), catalog(['boon of spell recall']))).toEqual([]);
  });

  it('o escalonamento com marcador ({{spellcasting_mod}}) fica de fora do dado do cantrip', () => {
    const gfb = { level: 0, damageInflict: ['fire'], scalingLevelDice: [{ scaling: { 1: '{{spellcasting_mod}}', 5: '1d8 + {{spellcasting_mod}}' } }, { scaling: { 5: '1d8', 11: '2d8' } }], entries: [] };
    expect(spellMechanics(gfb, 11).damage.dice).toBe('2d8');
  });

  it('a feature opcional de subclasse (Blessed Strikes do TCE) não entra sozinha', () => {
    const db = { 'class-cleric': { subclassFeature: [
      { name: 'Divine Strike', source: 'PHB', subclassShortName: 'Life', subclassSource: 'PHB', level: 8, entries: [] },
      { name: 'Blessed Strikes', source: 'TCE', subclassShortName: 'Life', subclassSource: 'PHB', level: 8, isClassFeatureVariant: true, entries: [] },
    ] } };
    expect(resolveSubclassFeatures({ name: 'Life Domain', shortName: 'Life', source: 'PHB' }, 'cleric', db, { max: 8 }).map((f) => f.name)).toEqual(['Divine Strike']);
  });

  it("Storm's Thunder e Stone's Endurance rolam no Use", () => {
    expect(featureUseOf({ name: "Storm's Thunder" }, catalog([]))).toMatchObject({ roll: { formula: '1d8' } });
    expect(featureUseOf({ name: "Stone's Endurance" }, catalog([]))).toMatchObject({ roll: { formula: '1d12 + @abilities.con.mod' } });
  });
});
