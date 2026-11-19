// =============================================================================
// playWeapons.test: o estado da arma, as magias de golpe e a nota das masteries
// =============================================================================
// O QUE FAZ
//   Prova o Shillelagh (atributo de conjuração se maior, o dado pelo nível, Force à escolha), o Magic
//   Weapon e o Elemental Weapon (só arma não mágica, o bônus pelo espaço, o dano extra tipado), o Shadow
//   Blade (um ataque novo), os STRIKE (True Strike com o atributo sempre, Booming Blade e Green-Flame Blade
//   com o extra e a nota) e a nota da mastery com o Graze e a CD do Topple (DDL-0242).
//
// FUNÇÕES
//   catalog(level): um catálogo com um cajado e uma espada +1, no nível dado.
// -----------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { weaponRuleOf, eligibleWeapons, weaponModifier, withWeaponStates, strikeAttack, masteryNote, withMasteryAttacks, armorBlessing, itemExtraEffects } from './playWeapons';
import { damageParts } from './playActions';

const staff = { key: 'w:staff', kind: 'weapon', name: 'Quarterstaff', uid: 's1', range: 'melee', ability: 'str', proficient: true, toHit: { total: 3, parts: [{ label: 'Strength', formula: 0 }, { label: 'Proficiency', formula: 3 }] }, damage: { dice: '1d6', bonus: 0, types: ['bludgeoning'] }, versatile: '1d8', properties: ['V'], mastery: 'Topple' };
const sword = { key: 'w:sword', kind: 'weapon', name: '+1 Longsword', uid: 's2', range: 'melee', ability: 'str', magical: true, proficient: true, toHit: { total: 4, parts: [{ label: 'Strength', formula: 0 }, { label: 'Proficiency', formula: 3 }, { label: 'Magic', formula: 1 }] }, damage: { dice: '1d8', bonus: 1, types: ['slashing'] }, properties: ['V'] };
const catalog = (level = 5) => ({ stats: { level, profBonus: 3 }, rollData: { abilities: { str: { mod: 0 }, dex: { mod: 2 }, wis: { mod: 4 }, cha: { mod: 3 } }, details: { level } }, attacks: [staff, sword] });

describe('o estado da arma', () => {
  it('Shillelagh: só cajado ou clava, SAB no lugar de FOR, o dado pelo nível e Force à escolha', () => {
    const rule = weaponRuleOf('Shillelagh');
    expect(eligibleWeapons(rule, catalog()).map((a) => a.name)).toEqual(['Quarterstaff']);
    const mod = weaponModifier({ rule, attack: staff, catalog: catalog(5), abilityKey: 'wis' });
    const a = withWeaponStates(catalog(5), [mod]).attacks.find((x) => x.uid === 's1');
    expect(a).toMatchObject({ name: 'Quarterstaff (Shillelagh)', ability: 'wis', toHit: { total: 7 }, damage: { dice: '1d10', bonus: 4, typeOptions: ['bludgeoning', 'force'] } });
  });

  it('Magic Weapon e Elemental Weapon: só arma não mágica, o bônus pelo espaço, o extra tipado', () => {
    expect(eligibleWeapons(weaponRuleOf('Magic Weapon'), catalog()).map((a) => a.name)).toEqual(['Quarterstaff']);
    const magic = withWeaponStates(catalog(), [weaponModifier({ rule: weaponRuleOf('Magic Weapon'), attack: staff, catalog: catalog(), slot: 4 })]).attacks[0];
    expect(magic).toMatchObject({ toHit: { total: 5 }, damage: { bonus: 2 }, magical: true });
    const elem = withWeaponStates(catalog(), [weaponModifier({ rule: weaponRuleOf('Elemental Weapon'), attack: staff, catalog: catalog(), slot: 5, type: 'cold' })]).attacks[0];
    expect(elem.toHit.total).toBe(5);
    expect(damageParts(elem).map((p) => p.formula)).toEqual(['1d6', '2d4']);
  });

  it('Shadow Blade cria um ataque com o dado pelo espaço', () => {
    const out = withWeaponStates(catalog(), [weaponModifier({ rule: weaponRuleOf('Shadow Blade'), catalog: catalog(), slot: 3 })]);
    expect(out.attacks[0]).toMatchObject({ name: 'Shadow Blade', ability: 'dex', toHit: { total: 5 }, damage: { dice: '3d8', bonus: 2, types: ['psychic'] } });
  });
});

describe('as magias de golpe', () => {
  it('True Strike usa o atributo de conjuração sempre e soma o Radiant no 5', () => {
    const a = strikeAttack(staff, weaponRuleOf('True Strike'), catalog(5), 'wis');
    expect(a).toMatchObject({ ability: 'wis', toHit: { total: 7 }, damage: { typeOptions: ['bludgeoning', 'radiant'] } });
    expect(damageParts(a).map((p) => p.formula)).toEqual(['1d6', 4, '1d6']);
  });

  it('Booming Blade e Green-Flame Blade: o extra no 5 e a nota', () => {
    const bb = strikeAttack(staff, weaponRuleOf('Booming Blade'), catalog(11), 'wis');
    expect(damageParts(bb).map((p) => p.formula)).toEqual(['1d6', '2d8']);
    expect(bb.note).toContain('3d8 Thunder');
    const gfb = strikeAttack(staff, weaponRuleOf('Green-Flame Blade'), catalog(1), 'wis');
    expect(damageParts(gfb).map((p) => p.formula)).toEqual(['1d6']);
    expect(gfb.note).toContain('takes 4 Fire');
  });
});

describe('a nota da mastery', () => {
  it('Topple com a CD e Graze com o dano', () => {
    expect(masteryNote(staff, catalog())).toContain('DC 11 Constitution');
    expect(masteryNote({ ...staff, mastery: 'Graze', ability: 'dex' }, catalog())).toContain('takes 2 bludgeoning');
    expect(masteryNote({ ...staff, mastery: null }, catalog())).toBeNull();
  });
});

describe('DDL-0243: Cleave, a armadura abençoada e o Magic Stone', () => {
  it('o Cleave vira uma variante sem o modificador positivo', () => {
    const axe = { ...sword, key: 'w:axe', name: 'Greataxe', uid: 's3', mastery: 'Cleave', damage: { dice: '1d12', bonus: 3, types: ['slashing'] } };
    const c = { ...catalog(), rollData: { abilities: { str: { mod: 3 } } }, attacks: [axe] };
    const out = withMasteryAttacks(c).attacks;
    expect(out.map((a) => a.name)).toEqual(['Greataxe', 'Greataxe (Cleave)']);
    expect(out[1]).toMatchObject({ mastery: null, cleave: true, damage: { bonus: 0 } });
  });

  it('o Blessing of the Forge pergunta arma ou armadura e a armadura dá +1 de CA', () => {
    expect(weaponRuleOf('Blessing of the Forge').armorOption).toBe(true);
    expect(armorBlessing('Blessing of the Forge')).toMatchObject({ ac: 1, duration: 'longRest' });
  });

  it('o Magic Stone cria a pedra com o ataque de magia do lançador', () => {
    const mod = weaponModifier({ rule: weaponRuleOf('Magic Stone'), catalog: catalog(), origin: { attackBonus: 7, abilityMod: 4 } });
    const stone = withWeaponStates(catalog(), [mod]).attacks[0];
    expect(stone).toMatchObject({ kind: 'created', name: 'Magic Stone', range: 'ranged', toHit: { total: 7 }, damage: { dice: '1d6', bonus: 4, types: ['bludgeoning'] } });
  });
});

describe("Tasha's Otherworldly Guise (TC-0171, DDL-0245)", () => {
  it('toda arma usa o atributo de conjuração se maior, e a ação Attack dá dois ataques', () => {
    const rule = weaponRuleOf("Tasha's Otherworldly Guise");
    expect(rule).toMatchObject({ all: true, kind: 'imbue' });
    const mod = weaponModifier({ rule, catalog: catalog(), slot: 6, type: 'upper', abilityKey: 'cha' });
    expect(mod).toMatchObject({ ac: 2, immune: ['radiant', 'necrotic'] });
    const out = withWeaponStates(catalog(), [mod]);
    expect(out.attacksMin).toBe(2);
    expect(out.attacks.find((a) => a.uid === 's2')).toMatchObject({ ability: 'cha', magical: true, damage: { bonus: 4 } });
    expect(weaponModifier({ rule, catalog: catalog(), type: 'lower', abilityKey: 'cha' }).immune).toEqual(['fire', 'poison']);
  });
});

describe('itemExtraEffects: o dano extra da arma no diálogo (DDL-0258)', () => {
  it('ligado sem condição, desligado com a nota, a carga no gasto', () => {
    const attack = { key: 'weapon:s1', uid: 's1', name: 'Staff of Striking', itemExtras: [
      { formula: '1d6', type: 'cold', condition: null, charge: null },
      { formula: '1d6', type: 'force', condition: 'For each charge you expend', charge: 'charges:s1' },
    ] };
    const [a, b] = itemExtraEffects(attack);
    expect(a).toMatchObject({ defaultOn: true, part: { formula: '1d6' } });
    expect(a.note).toBeUndefined();
    expect(b).toMatchObject({ defaultOn: false, note: 'For each charge you expend', spend: { key: 'charges:s1', amount: 1 } });
    expect(itemExtraEffects({ name: 'Club' })).toEqual([]);
  });
});
