// Testes do sheetModel - o tradutor personagem+derivação → valores da ficha PDF.
import { describe, it, expect } from 'vitest';
import {
  signed, timeAbbrev, speciesLabel, slotTotals, weaponRows, buildSheetModel,
  featureAnnotations, speciesTraitParagraphs,
} from './sheetModel';
import { createCharacter, createClassEntry } from '../schema/character';

const spell = (name, level, extra = {}) => ({
  name,
  level,
  time: [{ number: 1, unit: 'action' }],
  range: { type: 'point', distance: { type: 'feet', amount: 60 } },
  components: {},
  duration: [],
  ...extra,
});

describe('helpers', () => {
  it('signed formata com sinal', () => {
    expect(signed(3)).toBe('+3');
    expect(signed(0)).toBe('+0');
    expect(signed(-1)).toBe('-1');
    expect(signed(null)).toBe('');
  });

  it('timeAbbrev abrevia como o exemplo preenchido', () => {
    expect(timeAbbrev(spell('X', 1))).toBe('A');
    expect(timeAbbrev({ time: [{ number: 1, unit: 'bonus' }] })).toBe('BA');
    expect(timeAbbrev({ time: [{ number: 1, unit: 'reaction' }] })).toBe('R');
    expect(timeAbbrev({ time: [{ number: 10, unit: 'minute' }] })).toBe('10 Min');
    expect(timeAbbrev({})).toBe('');
  });

  it('speciesLabel resolve linhagens "Elf; Drow Lineage" → "Elf (Drow)"', () => {
    expect(speciesLabel({ name: 'Elf; Drow Lineage' })).toBe('Elf (Drow)');
    expect(speciesLabel({ name: 'Goblin' })).toBe('Goblin');
    expect(speciesLabel(null, 'human')).toBe('human');
  });

  it('slotTotals soma o pacto no círculo dele', () => {
    expect(slotTotals({ slots: { 1: 4, 2: 3 }, pactSlots: { slots: 2, level: 2 } }))
      .toEqual({ 1: 4, 2: 5 });
    expect(slotTotals({ slots: {}, pactSlots: null })).toEqual({});
  });
});

describe('weaponRows', () => {
  const derived = {
    proficiencyBonus: 2,
    modifiers: { str: 3, dex: 1 },
    weapons: ['Simple Weapons'],
    inventory: [
      {
        group: 'weapon', kind: 'melee', category: 'simple', equipped: true,
        raw: { name: 'Mace', dmg1: '1d6', dmgType: 'B', property: [] },
      },
      {
        group: 'weapon', kind: 'melee', category: 'martial', equipped: false,
        raw: { name: 'Rapier', dmg1: '1d8', dmgType: 'P', property: ['F'] },
      },
      { group: 'armor', raw: { name: 'Shield' } },
    ],
  };

  it('melee usa STR + proficiência quando proficiente; equipadas vêm primeiro', () => {
    const rows = weaponRows({ classes: [] }, derived);
    expect(rows[0]).toMatchObject({ name: 'Mace', bonus: '+5', damage: '1d6+3 B' });
  });

  it('finesse usa o melhor de STR/DEX; sem proficiência não soma o bônus', () => {
    const rows = weaponRows({ classes: [] }, derived);
    // Rapier: finesse → max(str 3, dex 1) = 3; marcial NÃO proficiente → sem +2.
    expect(rows[1]).toMatchObject({ name: 'Rapier', bonus: '+3', damage: '1d8+3 P' });
  });

  it('anota a Weapon Mastery escolhida', () => {
    const character = {
      classes: [{ choices: { weaponMastery: { kind: 'weapon', picks: ['Mace|XPHB'] } } }],
    };
    const withMastery = {
      ...derived,
      inventory: [{
        group: 'weapon', kind: 'melee', category: 'simple', equipped: true,
        raw: { name: 'Mace', dmg1: '1d6', dmgType: 'B', property: [], mastery: ['Sap|XPHB'] },
      }],
    };
    expect(weaponRows(character, withMastery)[0].notes).toContain('Mastery: Sap');
  });
});

describe('buildSheetModel', () => {
  const baseDerived = {
    level: 6,
    proficiencyBonus: 3,
    scores: { str: 10, dex: 14, con: 14, int: 10, wis: 18, cha: 14 },
    modifiers: { str: 0, dex: 2, con: 2, int: 0, wis: 4, cha: 2 },
    saves: { str: 0, dex: 2, con: 2, int: 0, wis: 7, cha: 5 },
    proficientSaves: ['wis', 'cha'],
    skills: { prc: { ability: 'wis', proficiency: 1, bonus: 7 } },
    tools: ['Herbalism Kit'],
    languages: ['Common', 'Elvish'],
    armor: ['Light Armor', 'Medium Armor', 'Shields'],
    weapons: ['Simple Weapons'],
    classBreakdown: [
      { classId: 'cleric', level: 5, hitDie: 8 },
      { classId: 'warlock', level: 1, hitDie: 8 },
    ],
    maxHp: 45,
    armorClass: { total: 18, hasShield: true },
    inventory: [
      { itemId: 'Mace', quantity: 1, attuned: false, raw: { name: 'Mace' }, group: 'weapon' },
      { itemId: 'Ring of Protection', quantity: 1, attuned: true, raw: { name: 'Ring of Protection' }, group: 'ring' },
    ],
    spellcasting: {
      slots: { 1: 4, 2: 3 },
      pactSlots: { slots: 1, level: 1 },
      origins: [],
    },
  };

  function twoClassCharacter() {
    const c = createCharacter({ name: 'Lyra' });
    c.identity.alignment = 'Neutral Good';
    c.currency = { cp: 0, sp: 30, ep: 0, gp: 125, pp: 2 };
    const cleric = { ...createClassEntry(true), classId: 'cleric', source: 'XPHB', level: 5 };
    const warlock = { ...createClassEntry(false), classId: 'warlock', source: 'XPHB', level: 1 };
    c.classes = [cleric, warlock];
    return { c, cleric, warlock };
  }

  it('multiclasse: uma ficha POR CLASSE, iguais fora de classe/subclasse/conjuração', () => {
    const { c } = twoClassCharacter();
    const model = buildSheetModel(c, baseDerived, {});
    expect(model.sheets).toHaveLength(2);
    const [s1, s2] = model.sheets;
    expect(s1.classText).toBe('Cleric 5');
    expect(s2.classText).toBe('Warlock 1');
    // blocos compartilhados idênticos
    expect(s1.abilities).toEqual(s2.abilities);
    expect(s1.hpMax).toBe(45);
    expect(s1.hitDice).toBe('6d8'); // 5d8 + 1d8 agregados por face
    expect(s1.level).toBe(6);
  });

  it('campos deliberadamente em branco: background e XP são do jogador', () => {
    const { c } = twoClassCharacter();
    const s = buildSheetModel(c, baseDerived, {}).sheets[0];
    expect(s.background).toBe('');
  });

  it('conjuração vem da ORIGEM da classe da ficha; magias de espécie vão em todas', () => {
    const { c, cleric } = twoClassCharacter();
    const derived = {
      ...baseDerived,
      spellcasting: {
        slots: { 1: 4 },
        pactSlots: { slots: 1, level: 1 },
        origins: [
          {
            kind: 'class', uid: cleric.uid, ability: 'wis', abilityMod: 4,
            saveDc: 15, attackBonus: 7,
            cantrips: [{ raw: spell('Guidance', 0) }],
            prepared: [{ raw: spell('Spirit Guardians', 3), }, { raw: spell('Bless', 1) }],
            alwaysPrepared: [], arcanumSpells: [],
          },
          {
            kind: 'race', label: 'Elf',
            alwaysPrepared: [{ raw: spell('Faerie Fire', 1), castType: 'daily', count: 1 }],
          },
        ],
      },
    };
    const [clericSheet, warlockSheet] = buildSheetModel(c, derived, {}).sheets;
    expect(clericSheet.spellAbilityCode).toBe('WIS');
    expect(clericSheet.spellDc).toBe('15');
    // escolhidas ordenadas por círculo, depois as concedidas da espécie
    expect(clericSheet.spellRows.map((r) => r.name))
      .toEqual(['Guidance', 'Bless', 'Spirit Guardians', 'Faerie Fire']);
    expect(clericSheet.spellRows[3].notes).toContain('Elf');
    // o Warlock (sem origem própria aqui) ainda vê as magias da espécie
    expect(warlockSheet.spellAbilityCode).toBe('');
    expect(warlockSheet.spellRows.map((r) => r.name)).toEqual(['Faerie Fire']);
    // slots compartilhados nas duas fichas, com o pacto somado no círculo 1
    expect(clericSheet.slotTotals).toEqual({ 1: 5 });
    expect(warlockSheet.slotTotals).toEqual({ 1: 5 });
  });

  it('sem classe: uma ficha única com os campos de classe vazios', () => {
    const c = createCharacter({ name: 'Novato' });
    const model = buildSheetModel(c, baseDerived, {});
    expect(model.sheets).toHaveLength(1);
    expect(model.sheets[0].classText).toBe('');
    expect(model.sheets[0].name).toBe('Novato');
  });

  it('treino de armadura marcado a partir das proficiências derivadas', () => {
    const { c } = twoClassCharacter();
    const s = buildSheetModel(c, baseDerived, {}).sheets[0];
    expect(s.armorTraining).toEqual({ light: true, medium: true, heavy: false, shields: true });
  });

  it('atunados e moedas', () => {
    const { c } = twoClassCharacter();
    const s = buildSheetModel(c, baseDerived, {}).sheets[0];
    expect(s.attunedNames).toEqual(['Ring of Protection']);
    expect(s.coins.gp).toBe(125);
    expect(s.equipmentLines).toEqual(['Mace', 'Ring of Protection']);
  });

  it('alignment por extenso a partir do código; texto livre passa como está', () => {
    const { c } = twoClassCharacter();
    c.identity.alignment = 'CG';
    expect(buildSheetModel(c, baseDerived, {}).sheets[0].alignment).toBe('Chaotic Good');
    c.identity.alignment = 'Neutral Good'; // import antigo / fixture
    expect(buildSheetModel(c, baseDerived, {}).sheets[0].alignment).toBe('Neutral Good');
  });

  it('linhas concedidas levam o DC/ataque da PRÓPRIA origem (raça/talento)', () => {
    const { c } = twoClassCharacter();
    const derived = {
      ...baseDerived,
      spellcasting: {
        slots: {},
        pactSlots: null,
        origins: [
          {
            kind: 'feat', label: 'Fey-Touched', ability: 'cha', abilityMod: 2,
            saveDc: 13, attackBonus: 5,
            alwaysPrepared: [{ raw: spell('Misty Step', 2), castType: 'daily', count: 1 }],
          },
        ],
      },
    };
    const s = buildSheetModel(c, derived, {}).sheets[0];
    expect(s.spellRows[0].notes).toContain('Fey-Touched (DC 13/+5)');
    // ficha sem origem de CLASSE: o bloco de conjuração cai na origem concedida
    expect(s.spellAbilityCode).toBe('CHA');
    expect(s.spellDc).toBe('13');
    expect(s.spellAtk).toBe('+5');
  });

  it('a origem de CLASSE vence o fallback no bloco de conjuração', () => {
    const { c, cleric } = twoClassCharacter();
    const derived = {
      ...baseDerived,
      spellcasting: {
        slots: { 1: 2 },
        pactSlots: null,
        origins: [
          {
            kind: 'class', uid: cleric.uid, ability: 'wis', abilityMod: 4,
            saveDc: 15, attackBonus: 7, cantrips: [], prepared: [], alwaysPrepared: [], arcanumSpells: [],
          },
          { kind: 'race', label: 'Drow', ability: 'cha', abilityMod: 2, saveDc: 13, attackBonus: 5, alwaysPrepared: [] },
        ],
      },
    };
    const s = buildSheetModel(c, derived, {}).sheets[0];
    expect(s.spellAbilityCode).toBe('WIS');
    expect(s.spellDc).toBe('15');
  });
});

describe('speciesTraitParagraphs (parágrafos com lead em negrito, como a tela de Species)', () => {
  // Recorte do Aasimar XPHB: traço simples + traço com lista de itens nomeados.
  const raceObj = {
    entries: [
      {
        type: 'entries',
        name: 'Darkvision',
        entries: ['You have {@sense Darkvision|XPHB} with a range of 60 feet.'],
      },
      {
        type: 'entries',
        name: 'Celestial Revelation',
        entries: [
          'When you reach character level 3, you can transform.',
          'Here are the transformation options:',
          {
            type: 'list',
            style: 'list-hang-notitle',
            items: [
              { type: 'item', name: 'Heavenly Wings', entries: ['Two spectral wings sprout.'] },
              { type: 'item', name: 'Inner Radiance', entries: ['Searing light radiates.'] },
            ],
          },
        ],
      },
    ],
  };

  it('traço simples vira um parágrafo com o nome como lead (tags removidas)', () => {
    const paras = speciesTraitParagraphs(raceObj);
    expect(paras[0]).toEqual({
      lead: 'Darkvision',
      text: 'You have Darkvision with a range of 60 feet.',
    });
  });

  it('itens de lista nomeados viram parágrafos próprios com lead', () => {
    const paras = speciesTraitParagraphs(raceObj);
    expect(paras.slice(1)).toEqual([
      {
        lead: 'Celestial Revelation',
        text: 'When you reach character level 3, you can transform. Here are the transformation options:',
      },
      { lead: 'Heavenly Wings', text: 'Two spectral wings sprout.' },
      { lead: 'Inner Radiance', text: 'Searing light radiates.' },
    ]);
  });

  it('sub-entradas nomeadas (sem lista) também quebram parágrafo', () => {
    const paras = speciesTraitParagraphs({
      entries: [
        {
          type: 'entries',
          name: 'Trait',
          entries: [
            'Intro.',
            { type: 'entries', name: 'Sub', entries: ['Sub text.'] },
            'After the sub.',
          ],
        },
      ],
    });
    expect(paras).toEqual([
      { lead: 'Trait', text: 'Intro.' },
      { lead: 'Sub', text: 'Sub text.' },
      { lead: null, text: 'After the sub.' },
    ]);
  });

  it('sem raça / sem entries → vazio', () => {
    expect(speciesTraitParagraphs(null)).toEqual([]);
    expect(speciesTraitParagraphs({})).toEqual([]);
  });
});

describe('featureAnnotations (escolhas do jogador anotadas nas features)', () => {
  it('weapon mastery, sub-features e optional features sem alvo', () => {
    const cls = {
      classId: 'barbarian', level: 4,
      choices: {
        weaponMastery: { kind: 'weapon', picks: ['Greataxe|XPHB', 'Javelin|XPHB'] },
        'featopt@Primal Order@1': { kind: 'featureoption', picks: ['Warden|XPHB'] },
        'optfeat@EI': { kind: 'optionalfeature', picks: ['Pact of the Blade|XPHB'] },
      },
    };
    const anns = featureAnnotations(cls, null, null, {});
    expect(anns).toContainEqual(
      expect.objectContaining({ target: 'Weapon Mastery', text: 'Greataxe, Javelin' }),
    );
    expect(anns).toContainEqual(
      expect.objectContaining({ target: 'Primal Order', level: 1, text: 'Warden' }),
    );
    // sem classObj o rótulo do seletor não existe → label genérico p/ linha extra
    expect(anns).toContainEqual(
      expect.objectContaining({ label: 'Options', text: 'Pact of the Blade' }),
    );
  });

  it('optional features usam o rótulo do seletor quando o classObj está presente', () => {
    const classObj = {
      optionalfeatureProgression: [
        { name: 'Eldritch Invocations', featureType: ['EI'], progression: [1, 3] },
      ],
    };
    const cls = {
      classId: 'warlock', level: 1,
      choices: { 'optfeat@EI': { kind: 'optionalfeature', picks: ['Pact of the Blade|XPHB'] } },
    };
    const anns = featureAnnotations(cls, classObj, null, {});
    expect(anns).toContainEqual(
      expect.objectContaining({ target: 'Eldritch Invocations', text: 'Pact of the Blade' }),
    );
  });

  it('feat de nível: nome do talento; ASI cru vira os aumentos escolhidos', () => {
    const db = {
      feats: {
        feat: [
          { name: 'War Caster', source: 'XPHB', category: 'G' },
          { name: 'Ability Score Improvement', source: 'XPHB', category: 'G' },
        ],
      },
    };
    const feat = featureAnnotations(
      { classId: 'cleric', level: 4, choices: { 'feat@4': { kind: 'feat', picks: ['War Caster|XPHB'] } } },
      null, null, db,
    );
    expect(feat[0]).toMatchObject({ level: 4, text: 'War Caster' });
    expect(feat[0].targets).toContain('Ability Score Improvement');

    const asi = featureAnnotations(
      {
        classId: 'cleric', level: 4,
        choices: {
          'feat@4': {
            kind: 'feat',
            picks: ['Ability Score Improvement|XPHB'],
            sub: {
              'Ability Score Improvement|XPHB': {
                'ability-0': { kind: 'ability', picks: [{ ability: 'wis', amount: 2 }] },
              },
            },
          },
        },
      },
      null, null, db,
    );
    expect(asi[0].text).toBe('+2 Wis');
  });

  it('expertise e grants nomeados (Primal Knowledge) anotam a feature certa', () => {
    const cls = {
      classId: 'rogue', level: 3,
      choices: {
        'expertise@1': { kind: 'expertise', picks: ['ste', 'slt'] },
        'skill@primal knowledge@3': { kind: 'skill', picks: ['nat'] },
        skill: { kind: 'skill', picks: ['ath'] }, // proficiência inicial: NÃO anota
      },
    };
    const anns = featureAnnotations(cls, null, null, {});
    expect(anns).toContainEqual(
      expect.objectContaining({ target: 'Expertise', level: 1, text: 'Stealth, Sleight of Hand' }),
    );
    expect(anns).toContainEqual(
      expect.objectContaining({ target: 'primal knowledge', text: 'Nature' }),
    );
    expect(anns).toHaveLength(2);
  });
});
