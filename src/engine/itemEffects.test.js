// =============================================================================
// itemEffects.test: o que um item mágico ativo muda na ficha
// =============================================================================
// O QUE FAZ
//   Prova os dois lados de cada família (DDL-0256): o item ativo muda o atributo, o ataque e a CD
//   de magia, o teste e o deslocamento; o inativo (sem atunar) e o de ativação (Boots of Speed,
//   Winged Boots) não; o bônus restrito por classe só vale nela; o "fixa em N" é um piso.
//
// FUNÇÕES
//   active(raw, extra): a entrada de inventário equipada e atunada.
// -----------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { itemAbilityEffects, itemSpellBonuses, itemCheckBonus, itemSpeeds, spellClassOf, isActiveItem, weaponExtraDamage, boundSpellRule, storeRuleOf, storedLevels, itemChargeMax, chargeCostOf } from './itemEffects';
import { finalScores } from './abilities';

const active = (raw, extra = {}) => ({ raw, equipped: true, attuned: true, ...extra });
const amulet = { name: 'Amulet of Health', reqAttune: true, ability: { static: { con: 19 } }, entries: ['Your Constitution score is 19 while you wear this amulet.'] };
const ioun = { name: 'Ioun Stone, Fortitude', reqAttune: true, ability: { con: 2 }, entries: ['Your Constitution score increases by 2, to a maximum of 20.'] };
const book = { name: 'Book of Exalted Deeds', reqAttune: true, ability: { wis: 2 }, entries: ['your Wisdom score increases by 2, to a maximum of 24.'] };
const rod = { name: '+1 Rod of the Pact Keeper', reqAttune: true, bonusSpellAttack: '+1', bonusSpellSaveDc: '+1', entries: ['you gain a bonus to spell attack rolls and to the saving throw DCs of your {@filter warlock spells|spells|class=warlock}.'] };
const robe = { name: 'Robe of the Archmagi', reqAttune: true, bonusSpellAttack: '+2', bonusSpellSaveDc: '+2', entries: ['Your spell save DC and spell attack bonus each increase by 2.'] };

describe('itemEffects (DDL-0256)', () => {
  it('o atributo: o piso do Amulet e o +2 com o teto do texto', () => {
    const fx = itemAbilityEffects([active(amulet), active(ioun), active(book)]);
    expect(fx).toEqual([
      { ability: 'con', set: 19, source: 'Amulet of Health' },
      { ability: 'con', amount: 2, max: 20, source: 'Ioun Stone, Fortitude' },
      { ability: 'wis', amount: 2, max: 24, source: 'Book of Exalted Deeds' },
    ]);
    const c = { scores: { str: 10, dex: 10, con: 12, int: 10, wis: 22, cha: 10 } };
    const s = finalScores(c, fx);
    expect(s.con).toBe(19);
    expect(s.wis).toBe(24);
    expect(finalScores({ scores: { ...c.scores, con: 20 } }, fx.slice(0, 1)).con).toBe(20);
  });

  it('sem atunar o item que pede atunamento não vale', () => {
    expect(isActiveItem({ raw: amulet, equipped: true, attuned: false })).toBe(false);
    expect(itemAbilityEffects([{ raw: amulet, equipped: true, attuned: false }])).toEqual([]);
  });

  it('o bônus de magia: por classe quando o texto restringe', () => {
    expect(spellClassOf(rod)).toBe('warlock');
    expect(spellClassOf(robe)).toBeNull();
    expect(itemSpellBonuses([active(rod), active(robe)])).toEqual([
      { source: '+1 Rod of the Pact Keeper', attack: 1, dc: 1, cls: 'warlock' },
      { source: 'Robe of the Archmagi', attack: 2, dc: 2, cls: null },
    ]);
  });

  it('o teste e o deslocamento sempre ligado; o de ativação fica fora', () => {
    expect(itemCheckBonus([active({ name: 'Stone of Good Luck', reqAttune: true, bonusAbilityCheck: '+1' })]).bonus).toBe(1);
    const gloves = { name: 'Gloves of Thievery', entries: ['These gloves are imperceptible while worn. While wearing them, you gain a +5 bonus to Dexterity ({@skill Sleight of Hand|XPHB}) checks.'] };
    const climbing = { name: 'Gloves of Swimming and Climbing', entries: ['you gain a +5 bonus to Strength ({@skill Athletics|XPHB}) checks made to climb or swim.'] };
    expect(itemCheckBonus([active(gloves), active(climbing)]).skills).toEqual({ slt: [{ name: 'Gloves of Thievery', value: 5 }] });
    const speeds = itemSpeeds([
      active({ name: 'Slippers of Spider Climbing', reqAttune: true, modifySpeed: { equal: { climb: 'walk' } } }),
      active({ name: 'Ring of Swimming', modifySpeed: { static: { swim: 40 } } }),
      active({ name: 'Boots of Speed', reqAttune: true, modifySpeed: { multiply: { walk: 2 } } }),
      active({ name: 'Winged Boots', reqAttune: true, charges: 4, modifySpeed: { static: { fly: 30 } } }),
    ], 30);
    expect(speeds).toEqual({ climb: { feet: 30, note: 'Slippers of Spider Climbing' }, swim: { feet: 40, note: 'Ring of Swimming' } });
  });
});

describe('weaponExtraDamage: o dano extra do texto da arma (DDL-0258)', () => {
  it('sem condição vem ligado; com o tipo de criatura, desligado com a frase', () => {
    expect(weaponExtraDamage({ entries: ['When you hit with an attack roll using this weapon, the target takes an extra 1d6 Cold damage.'] }))
      .toEqual([{ formula: '1d6', type: 'cold', condition: null, charge: false }]);
    const [x] = weaponExtraDamage({ entries: ['When you hit a Fiend or an Undead with this magic weapon, that creature takes an extra 2d6 Radiant damage.'] });
    expect(x).toMatchObject({ formula: '2d6', type: 'radiant' });
    expect(x.condition).toMatch(/Fiend/);
  });

  it('a carga só com cargas no item; "or an extra" deixa os dois desligados', () => {
    const staff = { charges: 10, entries: ['When you hit with a melee attack using the staff, you can expend 1 charge to deal an extra 1d6 force damage to the target.'] };
    expect(weaponExtraDamage(staff)[0]).toMatchObject({ formula: '1d6', charge: true });
    expect(weaponExtraDamage({ ...staff, charges: undefined })[0].charge).toBe(false);
    const thrower = weaponExtraDamage({ entries: ['When you hit with a ranged attack using this weapon, it deals an extra 1d8 Force damage, or an extra 2d8 Force damage if the target is a Giant.'] });
    expect(thrower.map((e) => [e.formula, !!e.condition])).toEqual([['1d8', true], ['2d8', true]]);
  });

  it('a salvaguarda do acerto (Dagger of Venom) vira extra desligado com a CD', () => {
    const [x] = weaponExtraDamage({ entries: ['That creature must succeed on a {@dc 15} Constitution saving throw or take {@damage 2d10} Poison damage and have the {@condition Poisoned|XPHB} condition for 1 minute.'] });
    expect(x).toMatchObject({ formula: '2d10', type: 'poison' });
    expect(x.condition).toMatch(/^DC 15 Constitution save/);
  });
});

describe('Enspelled e guardar magia (DDL-0258)', () => {
  it('boundSpellRule: o círculo do texto e as escolas da tag do filtro', () => {
    expect(boundSpellRule({ entries: ['Bound into this armor is a level 1 spell. The spell must belong to the {@filter Abjuration or Illusion|spells|school=A;I|level=1} school of magic.'] }))
      .toEqual({ level: 1, schools: ['A', 'I'] });
    expect(boundSpellRule({ entries: ['Bound into this staff is a cantrip. The cantrip can be of any school of magic.'] })).toEqual({ level: 0, schools: null });
    expect(boundSpellRule({ entries: ['A plain staff.'] })).toBeNull();
  });

  it('storeRuleOf: o anel soma círculos; a garrafa e a gema guardam uma', () => {
    expect(storeRuleOf({ entries: ['The ring can store up to 5 levels worth of spells at a time.', 'Any creature can cast a spell of 1st through 5th level into the ring.'] }))
      .toEqual({ cap: 5, one: false, maxLevel: 5 });
    expect(storeRuleOf({ entries: ['This glass bottle can store one spell of up to 5th level at a time.'] })).toEqual({ cap: null, one: true, maxLevel: 5 });
    expect(storeRuleOf({ entries: ['A ruby spell gem can contain one spell from any class\'s spell list.', 'A ruby spell gem can store up to 8th level spells.'] }))
      .toEqual({ cap: null, one: true, maxLevel: 8 });
    expect(storedLevels({ stored: [{ level: 1 }, { level: 3 }] })).toBe(4);
  });
});

describe('cargas pelo texto (DDL-0262)', () => {
  it('o campo, o máximo do dado e o número do texto', () => {
    expect(itemChargeMax({ charges: 7 })).toBe(7);
    expect(itemChargeMax({ charges: '{@dice 1d3}' })).toBe(3);
    expect(itemChargeMax({ entries: ['While wearing this ring, you can expend 1 of its 3 charges to cast Wish from it.'] })).toBe(3);
    expect(itemChargeMax({ entries: ['A planar key begins existence with 1d4 + 1 charges and cannot regain charges.'] })).toBe(5);
    expect(itemChargeMax({ entries: ['The staff has 2d4 + 1 charges.'] })).toBe(9);
    expect(itemChargeMax({ entries: ['No charges here.'] })).toBe(0);
  });

  it('o custo do lançamento', () => {
    expect(chargeCostOf('you can expend 1 charge as an action to cast the speak with plants spell')).toEqual({ cost: 1, any: false });
    expect(chargeCostOf('You can expend any number of charges to cast Cure Wounds from the bauble')).toEqual({ cost: 1, any: true });
    expect(chargeCostOf('expend two of its charges to cast')).toEqual({ cost: 2, any: false });
    expect(chargeCostOf('You can cast Knock.')).toBeNull();
  });
});
