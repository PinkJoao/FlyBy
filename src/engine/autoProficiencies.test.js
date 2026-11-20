// =============================================================================
// autoProficiencies.test: testes das proficiências automáticas
// =============================================================================
// O QUE FAZ
//   Grants fixos de classe e espécie, a escolha de ferramenta que NÃO vira grant
//   (nem vaza a prosa "of your choice"), e a regra condicional de arma enumerada a
//   partir do dado (TC-0078); a perícia fixa de uma opção de classe (DDL-0237); a classe
//   secundária dá só o `proficienciesGained` do multiclasse (TC-0217).
//
// FUNÇÕES
//   charWith(opts): um personagem mínimo com classe e espécie.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { deriveGrantedProficiencies, conditionalWeaponNames } from './autoProficiencies';
import { createCharacter } from '../schema/character';

const db = {
  'class-fighter': {
    class: [
      {
        name: 'Fighter',
        source: 'XPHB',
        startingProficiencies: { armor: ['light', 'medium', 'heavy', 'shield'], weapons: ['simple', 'martial'] },
        multiclassing: { proficienciesGained: { armor: ['light', 'medium', 'shield'], weapons: ['martial'] } },
      },
    ],
  },
  'class-rogue': {
    class: [
      {
        name: 'Rogue',
        source: 'XPHB',
        startingProficiencies: {
          armor: ['light'],
          weapons: ['simple', "Martial weapons that have the {@filter Finesse or Light|items|...} property"],
          tools: ["{@item Thieves' Tools|XPHB}"],
          weaponProficiencies: [{ simple: true, all: { fromFilter: 'type=martial weapon|property=light;finesse' } }],
        },
        multiclassing: { proficienciesGained: { armor: ['light'], tools: ["{@item Thieves' Tools|XPHB}"], toolProficiencies: [{ "thieves' tools": true }] } },
      },
    ],
  },
  'class-artificer': {
    class: [
      {
        name: 'Artificer',
        source: 'TCE',
        startingProficiencies: {
          armor: ['light', 'medium', 'shield'],
          tools: ["{@item thieves' tools|PHB}", "one type of {@item artisan's tools|PHB} of your choice"],
          toolProficiencies: [{ "thieves' tools": true, "tinker's tools": true, anyArtisansTool: 1 }],
        },
      },
    ],
  },
  races: {
    race: [
      { name: 'Bugbear', source: 'MPMM', size: ['M'], skillProficiencies: [{ stealth: true }] },
      { name: 'Elf', source: 'XPHB', size: ['M'], skillProficiencies: [{ choose: { from: ['perception'] } }] },
    ],
  },
};

function charWith({ classId, source = 'XPHB', raceName } = {}) {
  const c = createCharacter({ name: 'T' });
  c.classes = [{ classId, source, level: 3, isOriginalClass: true, hitPoints: {}, choices: {} }];
  if (raceName) c.species = { id: raceName.toLowerCase(), source: raceName === 'Elf' ? 'XPHB' : 'MPMM', choices: {} };
  return c;
}

describe('deriveGrantedProficiencies', () => {
  it('mapeia armor/weapons da classe p/ labels legíveis', () => {
    const out = deriveGrantedProficiencies(charWith({ classId: 'fighter' }), db);
    expect(out.armor).toEqual(['Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields']);
    expect(out.weapons).toEqual(['Simple Weapons', 'Martial Weapons']);
  });

  it('limpa tags de ferramenta e texto de arma especial', () => {
    const out = deriveGrantedProficiencies(charWith({ classId: 'rogue' }), db);
    expect(out.grantedTools).toEqual(["Thieves' Tools"]);
    expect(out.weapons[0]).toBe('Simple Weapons');
    expect(out.weapons[1]).toMatch(/Martial weapons that have the Finesse or Light property/);
  });

  it('deriva tools FIXOS do campo estruturado; ignora o token de escolha (Artificer)', () => {
    const out = deriveGrantedProficiencies(charWith({ classId: 'artificer', source: 'TCE' }), db);
    expect(out.grantedTools).toEqual(["Thieves' Tools", "Tinker's Tools"]);
    expect(out.grantedTools.join(' ')).not.toMatch(/of your choice/i);
  });

  it('coleta perícia FIXA da espécie (Bugbear → Stealth); ignora choose (Elf)', () => {
    expect(deriveGrantedProficiencies(charWith({ classId: 'rogue', raceName: 'Bugbear' }), db).grantedSkills).toEqual(['ste']);
    expect(deriveGrantedProficiencies(charWith({ classId: 'rogue', raceName: 'Elf' }), db).grantedSkills).toEqual([]);
  });

  it('coleta a perícia FIXA de uma opção de classe escolhida (Beguiling Influence, DDL-0237)', () => {
    const c = charWith({ classId: 'rogue' });
    c.classes[0].choices = { 'optfeat@EI': { kind: 'optionalfeature', picks: ['Beguiling Influence|PHB'] } };
    const withOpt = { ...db, optionalfeatures: { optionalfeature: [{ name: 'Beguiling Influence', source: 'PHB', featureType: ['EI'], skillProficiencies: [{ deception: true, persuasion: true }] }] } };
    expect(deriveGrantedProficiencies(c, withOpt).grantedSkills).toEqual(['dec', 'per']);
  });

  it('classe secundária dá só o proficienciesGained: quem entra no guerreiro não ganha armadura pesada (TC-0217)', () => {
    const c = createCharacter({ name: 'T' });
    c.classes = [
      { classId: 'rogue', source: 'XPHB', level: 3, isOriginalClass: true, hitPoints: {}, choices: {} },
      { classId: 'fighter', source: 'XPHB', level: 1, isOriginalClass: false, hitPoints: {}, choices: {} },
    ];
    const out = deriveGrantedProficiencies(c, db);
    expect(out.armor).toEqual(['Light Armor', 'Medium Armor', 'Shields']);
    expect(out.weapons).toContain('Martial Weapons');
  });

  it('o Ladino secundário não dá a regra condicional de arma, só a ferramenta (TC-0217)', () => {
    const c = createCharacter({ name: 'T' });
    c.classes = [
      { classId: 'fighter', source: 'XPHB', level: 3, isOriginalClass: true, hitPoints: {}, choices: {} },
      { classId: 'rogue', source: 'XPHB', level: 1, isOriginalClass: false, hitPoints: {}, choices: {} },
    ];
    const withWeapons = { ...db, 'items-base': { baseitem: [{ name: 'Rapier', weaponCategory: 'martial', property: [{ uid: 'F|XPHB' }] }] } };
    const out = deriveGrantedProficiencies(c, withWeapons);
    expect(out.weaponNames).toEqual([]);
    expect(out.grantedTools).toEqual(["Thieves' Tools"]);
  });

  it('sem classe/espécie → tudo vazio', () => {
    expect(deriveGrantedProficiencies(createCharacter(), db)).toEqual({ armor: [], weapons: [], weaponNames: [], grantedSkills: [], grantedTools: [], languages: [] });
  });
});

describe('conditionalWeaponNames', () => {
  const weaponDb = { 'items-base': { baseitem: [
    { name: 'Club', weaponCategory: 'simple', property: [{ uid: 'L|XPHB' }] },
    { name: 'Scimitar', weaponCategory: 'martial', property: [{ uid: 'L|XPHB' }, { uid: 'F|XPHB' }] },
    { name: 'Rapier', weaponCategory: 'martial', property: [{ uid: 'F|XPHB' }] },
    { name: 'Greatsword', weaponCategory: 'martial', property: [{ uid: 'H|XPHB' }] },
    { name: 'Shield', armor: true },
  ] } };
  const withFilter = (fromFilter) => ({ startingProficiencies: { weaponProficiencies: [{ simple: true, all: { fromFilter } }] } });

  it('Monge: só as MARCIAIS com a propriedade Light', () => {
    expect(conditionalWeaponNames(withFilter('type=martial weapon|property=light'), weaponDb)).toEqual(['Scimitar']);
  });
  it('Ladino: as propriedades do filtro são ALTERNATIVAS (Finesse OU Light)', () => {
    expect(conditionalWeaponNames(withFilter('type=martial weapon|property=light;finesse'), weaponDb))
      .toEqual(['Scimitar', 'Rapier']);
  });
  it('classe sem regra condicional não enumera nada', () => {
    expect(conditionalWeaponNames({ startingProficiencies: { weapons: ['simple', 'martial'] } }, weaponDb)).toEqual([]);
    expect(conditionalWeaponNames(null, weaponDb)).toEqual([]);
  });
});
