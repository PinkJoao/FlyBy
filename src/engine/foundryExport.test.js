// Valida o exporter contra o `system` da ficha REAL do Étienne (etienne.json),
// fechando o laço: decisões → derivação → ator Foundry. Os valores esperados são
// o gabarito extraído do export real (D&D/.../Character Sheets/etienne.json).
import { describe, it, expect } from 'vitest';
import { etienneFixture, etienneContext } from './fixtures/etienne';
import { deriveCharacter } from './index';
import { buildActorSystem, buildFoundryActor, foundrySize } from './foundryExport';

describe('foundryExport - Étienne (Fighter 6) vs gabarito etienne.json', () => {
  const c = etienneFixture();
  const derived = deriveCharacter(c, etienneContext);
  const sys = buildActorSystem(c, derived, { size: 'med' });

  it('abilities: value + proficiência de save batem com o Foundry', () => {
    const vals = Object.fromEntries(Object.entries(sys.abilities).map(([k, v]) => [k, v.value]));
    expect(vals).toEqual({ str: 15, dex: 20, con: 14, int: 13, wis: 10, cha: 8 });
    const prof = Object.fromEntries(Object.entries(sys.abilities).map(([k, v]) => [k, v.proficient]));
    expect(prof).toEqual({ str: 1, dex: 0, con: 1, int: 0, wis: 0, cha: 0 });
  });

  it('skills: conjunto proficiente = acr/ath/his/itm/prc (value 1)', () => {
    const proficient = Object.keys(sys.skills)
      .filter((k) => sys.skills[k].value > 0)
      .sort();
    expect(proficient).toEqual(['acr', 'ath', 'his', 'itm', 'prc']);
    expect(sys.skills.acr.ability).toBe('dex'); // ability preservada
  });

  it('tools: game:dice → id "dice"', () => {
    expect(sys.tools).toEqual({ dice: { value: 1, ability: '', bonuses: { check: '' } } });
  });

  it('traits: size + languages em códigos Foundry', () => {
    expect(sys.traits.size).toBe('med');
    expect(sys.traits.languages.value).toEqual(['common', 'elvish']);
  });

  it('attributes.hp.value = 59; details.xp = 14000 (nível 6)', () => {
    expect(sys.attributes.hp.value).toBe(59);
    expect(sys.details.xp.value).toBe(14000);
  });

  it('hp.max é null; ajuste manual (hpBonus) vai em bonuses.overall', () => {
    expect(sys.attributes.hp.max).toBeNull();
    expect(sys.attributes.hp.bonuses).toEqual({}); // sem hpBonus
    const withBonus = buildActorSystem({ ...c, hpBonus: 5 }, derived, { size: 'med' });
    expect(withBonus.attributes.hp.bonuses).toEqual({ overall: '5', level: '' });
  });
});

describe('foundryExport - mapeamento e scaffold', () => {
  it('mapeia armas/armaduras/maestria para códigos Foundry', () => {
    const c = { name: 'X', classes: [{ choices: { weaponMastery: { kind: 'weapon', picks: ['Longsword|XPHB', 'Warhammer|XPHB'] } } }] };
    const derived = {
      scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficientSaves: [],
      skills: {},
      tools: [],
      languages: [],
      weapons: ['Simple Weapons', 'Martial Weapons'],
      armor: ['Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields'],
      level: 1,
    };
    const sys = buildActorSystem(c, derived);
    expect(sys.traits.weaponProf.value).toEqual(['sim', 'mar']);
    expect(sys.traits.weaponProf.mastery.value).toEqual(['longsword', 'warhammer']);
    expect(sys.traits.armorProf.value).toEqual(['lgt', 'med', 'hvy', 'shl']);
  });

  it('texto de arma especial (não-token) vira custom', () => {
    const derived = { scores: {}, proficientSaves: [], skills: {}, tools: [], languages: [], weapons: ['Martial weapons with the Finesse property'], armor: [], level: 1 };
    const sys = buildActorSystem({ name: 'X' }, derived);
    expect(sys.traits.weaponProf.value).toEqual([]);
    expect(sys.traits.weaponProf.custom).toMatch(/Finesse/);
  });

  it('buildFoundryActor: scaffold de ator type character', () => {
    const actor = buildFoundryActor({ name: 'Hero' }, { scores: {}, proficientSaves: [], skills: {}, tools: [], languages: [], level: 1 });
    expect(actor.type).toBe('character');
    expect(actor.name).toBe('Hero');
    expect(actor.items).toEqual([]);
    expect(actor.system.abilities.str.value).toBe(10);
  });

  it('foundrySize: 5etools → código', () => {
    expect(foundrySize(['M'])).toBe('med');
    expect(foundrySize(['S'])).toBe('sm');
    expect(foundrySize(undefined)).toBe('med');
  });
});
