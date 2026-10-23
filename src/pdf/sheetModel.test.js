// =============================================================================
// sheetModel.test: testes do modelo da ficha PDF
// =============================================================================
// O QUE FAZ
//   Armas (finesse e proficiência), o documento único na multiclasse com os dados
//   de vida agregados, a conjuração por origem com o pacto à parte e os cartões,
//   os grupos de features conforme o detalhe e o flavour pedidos (com a ref de
//   feature trocada pelo texto), o inventário por contêiner e as anotações de
//   escolha, e os recursos com usos (a fórmula do export avaliada).
//
// FUNÇÕES
//   spell(name, level, extra): uma magia de teste.
//   miniDb(): um compêndio mínimo com o Cleric, uma subclasse e o fluff.
//   twoClassCharacter(): o Cleric 5 / Warlock 1 de teste.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  signed, timeAbbrev, speciesLabel, slotTotals, weaponRows, buildSheetModel, featureAnnotations,
  evalUses, recoveryText, resourceRows,
} from './sheetModel';
import { applyPreset } from './pdfOptions';
import { createCharacter, createClassEntry } from '../schema/character';

const spell = (name, level, extra = {}) => ({
  name,
  level,
  source: 'XPHB',
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

  it('speciesLabel resolve linhagens: "Elf; Drow Lineage" vira "Elf (Drow)"', () => {
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
    expect(rows[0]).toMatchObject({ name: 'Mace', bonus: '+5', damage: '1d6+3 bludgeoning', equipped: true });
  });

  it('finesse usa o melhor de STR/DEX; sem proficiência não soma o bônus', () => {
    const rows = weaponRows({ classes: [] }, derived);
    expect(rows[1]).toMatchObject({ name: 'Rapier', bonus: '+3', damage: '1d8+3 piercing' });
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
    skills: {
      prc: { ability: 'wis', proficiency: 1, bonus: 7 },
      ste: { ability: 'dex', proficiency: 2, bonus: 8 },
      ath: { ability: 'str', proficiency: 0.5, bonus: 1 },
    },
    tools: ['Herbalism Kit'],
    languages: ['Common', 'Elvish'],
    armor: ['Light Armor', 'Shields'],
    weapons: ['Simple Weapons'],
    classBreakdown: [
      { classId: 'cleric', level: 5, hitDie: 8 },
      { classId: 'warlock', level: 1, hitDie: 8 },
    ],
    maxHp: 45,
    armorClass: { total: 18, hasShield: true },
    damageTraits: { resist: ['necrotic'], immune: [], vulnerable: [] },
    inventory: [],
    spellcasting: { slots: { 1: 4, 2: 3 }, pactSlots: { slots: 1, level: 1 }, origins: [] },
  };

  function miniDb() {
    return {
      'class-cleric': {
        class: [{ name: 'Cleric', source: 'XPHB', classFeatures: ['Spellcasting|Cleric|XPHB|1', 'Channel Divinity|Cleric|XPHB|2'] }],
        classFeature: [
          { name: 'Spellcasting', className: 'Cleric', classSource: 'XPHB', source: 'XPHB', level: 1, entries: ['You cast spells.'] },
          {
            name: 'Channel Divinity', className: 'Cleric', classSource: 'XPHB', source: 'XPHB', level: 2,
            entries: ['You channel.', { type: 'refClassFeature', classFeature: 'Divine Spark|Cleric|XPHB|2' }],
          },
          { name: 'Divine Spark', className: 'Cleric', classSource: 'XPHB', source: 'XPHB', level: 2, entries: ['Roll {@dice 1d8}.'] },
        ],
        subclass: [{ name: 'Life Domain', shortName: 'Life', source: 'XPHB', className: 'Cleric', classSource: 'XPHB', subclassFeatures: [] }],
        subclassFeature: [
          {
            name: 'Life Domain', subclassShortName: 'Life', subclassSource: 'XPHB', source: 'XPHB', level: 3,
            entries: ['Soothe the hurts of the world.', { type: 'refSubclassFeature', subclassFeature: 'Disciple of Life|Cleric|XPHB|Life|XPHB|3' }],
          },
          { name: 'Disciple of Life', subclassShortName: 'Life', subclassSource: 'XPHB', source: 'XPHB', level: 3, entries: ['Extra healing.'] },
        ],
      },
      'fluff-class-cleric': {
        classFluff: [{ name: 'Cleric', source: 'XPHB', entries: ['Clerics draw power from the gods.'] }],
        subclassFluff: [{ name: 'Life Domain', shortName: 'Life', source: 'XPHB', images: [] }],
      },
    };
  }

  function twoClassCharacter() {
    const c = createCharacter({ name: 'Lyra' });
    c.identity.alignment = 'NG';
    c.identity.age = '27';
    c.currency = { cp: 0, sp: 30, ep: 0, gp: 125, pp: 2 };
    const cleric = { ...createClassEntry(true), classId: 'cleric', source: 'XPHB', level: 5, subclassId: 'Life', subclassSource: 'XPHB' };
    const warlock = { ...createClassEntry(false), classId: 'warlock', source: 'XPHB', level: 1 };
    c.classes = [cleric, warlock];
    return { c, cleric, warlock };
  }

  it('multiclasse: UM documento, com a linha de classes e os dados de vida agregados', () => {
    const { c } = twoClassCharacter();
    const m = buildSheetModel(c, baseDerived, miniDb());
    expect(m.header.classLine).toBe('Cleric 5 (Life Domain) / Warlock 1');
    expect(m.header.alignment).toBe('Neutral Good');
    expect(m.combat.hitDice).toBe('6d8');
    expect(m.combat.hpMax).toBe(45);
    expect(m.abilities.find((a) => a.code === 'wis')).toMatchObject({ mod: '+4', save: '+7', saveProf: true });
    expect(m.combat.defenses.resist).toEqual(['necrotic']);
    expect(m.biography.details).toEqual([{ label: 'Age', value: '27' }]);
  });

  it('perícias em ordem alfabética; meia proficiência não marca o círculo', () => {
    const { c } = twoClassCharacter();
    const m = buildSheetModel(c, baseDerived, {});
    expect(m.skills).toHaveLength(18);
    expect(m.skills[0].name).toBe('Acrobatics');
    expect(m.skills.find((s) => s.code === 'prc').prof).toBe(1);
    expect(m.skills.find((s) => s.code === 'ste')).toMatchObject({ prof: 2, value: '+8' });
    expect(m.skills.find((s) => s.code === 'ath').prof).toBe(0);
  });

  it('features completas trazem o texto, com a ref de feature trocada pela citada', () => {
    const { c } = twoClassCharacter();
    const m = buildSheetModel(c, baseDerived, miniDb(), { detail: { classFeatures: 'full' } });
    const cleric = m.featureGroups.find((g) => g.kind === 'class');
    const channel = cleric.items.find((i) => i.name === 'Channel Divinity');
    expect(channel.tag).toBe('Level 2');
    expect(channel.blocks.some((b) => b.lead === 'Divine Spark')).toBe(true);
  });

  it('o detalhe por grupo: só títulos não leva texto, desligado some', () => {
    const { c } = twoClassCharacter();
    const m = buildSheetModel(c, baseDerived, miniDb(), { detail: { classFeatures: 'titles', subclassFeatures: 'off' } });
    expect(m.featureGroups.find((g) => g.kind === 'class').items.every((i) => i.blocks == null)).toBe(true);
    expect(m.featureGroups.some((g) => g.kind === 'subclass')).toBe(false);
  });

  it('flavour: da classe pelo fluff; da subclasse pela guarda-chuva quando o fluff só tem arte', () => {
    const { c } = twoClassCharacter();
    const on = buildSheetModel(c, baseDerived, miniDb(), { flavor: { classes: true, subclasses: true } });
    const sub = on.featureGroups.find((g) => g.kind === 'subclass');
    expect(sub.flavor[0].runs[0].text).toBe('Soothe the hurts of the world.');
    expect(sub.items.map((i) => i.name)).toEqual(['Disciple of Life']);
    expect(on.featureGroups.find((g) => g.kind === 'class').flavor[0].runs[0].text).toContain('gods');
    const off = buildSheetModel(c, baseDerived, miniDb(), { flavor: { classes: false, subclasses: false } });
    expect(off.featureGroups.every((g) => g.flavor == null)).toBe(true);
  });

  it('o talento de nível sem feature vira a linha "Ability Score Improvement" do nível', () => {
    const { c, cleric } = twoClassCharacter();
    cleric.choices = { 'feat@4': { kind: 'feat', picks: ['War Caster|XPHB'] } };
    const db = { ...miniDb(), feats: { feat: [{ name: 'War Caster', source: 'XPHB', category: 'G', entries: ['Concentrate.'] }] } };
    const m = buildSheetModel(c, baseDerived, db, { detail: { classFeatures: 'titles', feats: 'full' } });
    const asi = m.featureGroups.find((g) => g.kind === 'class').items.find((i) => i.level === 4);
    expect(asi).toMatchObject({ name: 'Ability Score Improvement', notes: ['War Caster'] });
    const feats = m.featureGroups.find((g) => g.kind === 'feats');
    expect(feats.items[0]).toMatchObject({ name: 'War Caster', tag: 'Cleric 4' });
    expect(feats.items[0].blocks).toHaveLength(1);
  });

  it('conjuração: um bloco por origem, o pacto à parte, a origem concedida com o próprio DC', () => {
    const { c, cleric } = twoClassCharacter();
    const derived = {
      ...baseDerived,
      spellcasting: {
        slots: { 1: 4 },
        pactSlots: { slots: 1, level: 1 },
        origins: [
          {
            kind: 'class', uid: cleric.uid, ability: 'wis', abilityMod: 4, saveDc: 15, attackBonus: 7,
            cantrips: [{ raw: spell('Guidance', 0) }],
            prepared: [{ raw: spell('Spirit Guardians', 3) }, { raw: spell('Bless', 1) }],
            unprepared: [{ raw: spell('Command', 1) }],
            alwaysPrepared: [], arcanumSpells: [],
          },
          {
            kind: 'feat', label: 'Fey-Touched', ability: 'cha', abilityMod: 2, saveDc: 13, attackBonus: 5,
            alwaysPrepared: [{ raw: spell('Misty Step', 2), castType: 'daily', count: 1 }],
          },
        ],
      },
    };
    const sc = buildSheetModel(c, derived, {}, { detail: { spells: 'table' } }).spellcasting;
    expect(sc.slots).toEqual([{ level: 1, total: 4 }]);
    expect(sc.pact).toEqual({ level: 1, total: 1 });
    const [cls, feat] = sc.origins;
    expect(cls).toMatchObject({ title: 'Cleric Spells', ability: 'Wisdom', dc: '15', attack: '+7' });
    expect(cls.rows.map((r) => [r.name, r.prepared])).toEqual([
      ['Guidance', null], ['Bless', 'yes'], ['Command', 'no'], ['Spirit Guardians', 'yes'],
    ]);
    expect(feat.note).toBe('Fey-Touched (DC 13/+5)');
    expect(feat.rows[0].prepared).toBe('always');
    expect(sc.cards).toBeNull();
  });

  it('cartões de magia: um por magia, por círculo, com o texto e o "At Higher Levels"', () => {
    const { c, cleric } = twoClassCharacter();
    const bless = spell('Bless', 1, {
      school: 'E',
      entries: ['Bless them.'],
      entriesHigherLevel: [{ type: 'entries', name: 'Using a Higher-Level Spell Slot', entries: ['One more.'] }],
    });
    const derived = {
      ...baseDerived,
      spellcasting: {
        slots: {}, pactSlots: null,
        origins: [{
          kind: 'class', uid: cleric.uid, ability: 'wis', abilityMod: 4, saveDc: 15, attackBonus: 7,
          cantrips: [{ raw: spell('Guidance', 0, { school: 'D', entries: ['Add {@dice 1d4}.'] }) }],
          prepared: [{ raw: bless }],
          alwaysPrepared: [{ raw: bless }],
        }],
      },
    };
    const { cards } = buildSheetModel(c, derived, {}, { detail: { spells: 'cards' } }).spellcasting;
    expect(cards.map((k) => k.name)).toEqual(['Guidance', 'Bless']);
    expect(cards[0].levelLine).toBe('Divination Cantrip');
    expect(cards[0].blocks[0].runs.map((r) => r.text).join('')).toBe('Add 1d4.');
    expect(cards[1].higher[0].lead).toBe('Using a Higher-Level Spell Slot');
  });

  it('cantrip de ataque entra na tabela de ataques com o dado do nível', () => {
    const { c, cleric } = twoClassCharacter();
    const derived = {
      ...baseDerived,
      spellcasting: {
        slots: {}, pactSlots: null,
        origins: [{
          kind: 'class', uid: cleric.uid, saveDc: 15, attackBonus: 7,
          cantrips: [
            { raw: spell('Sacred Flame', 0, { damageInflict: ['radiant'], savingThrow: ['dexterity'], scalingLevelDice: { scaling: { 1: '1d8', 5: '2d8', 11: '3d8' } } }) },
            { raw: spell('Eldritch Blast', 0, { damageInflict: ['force'], spellAttack: ['R'], entries: ['takes {@damage 1d10} Force damage'] }) },
          ],
        }],
      },
    };
    const rows = buildSheetModel(c, derived, {}).attacks;
    expect(rows.find((r) => r.name === 'Sacred Flame')).toMatchObject({ bonus: 'DC 15 Dex', damage: '2d8 radiant' });
    expect(rows.find((r) => r.name === 'Eldritch Blast')).toMatchObject({ bonus: '+7', damage: '1d10 force' });
  });

  it('inventário por contêiner; texto só dos mágicos no modo "magic"; descrição importada sem HTML', () => {
    const { c } = twoClassCharacter();
    const derived = {
      ...baseDerived,
      encumbrance: { totalWeight: 32.5, capacity: 150 },
      inventory: [
        { uid: 'a', itemId: 'Mace', quantity: 1, equipped: true, lineWeight: 4, raw: { name: 'Mace', entries: ['A mace.'] } },
        { uid: 'b', itemId: 'Ring of Protection', quantity: 1, attuned: true, rarity: 'rare', raw: { name: 'Ring of Protection', reqAttune: true, entries: ['+1 to AC.'] } },
        { uid: 'c', itemId: 'Backpack', quantity: 1, isContainer: true, raw: { name: 'Backpack' } },
        {
          uid: 'd', itemId: 'Trinket', quantity: 2, container: 'c', isCustom: true,
          custom: { name: 'Trinket', description: '<p>A @UUID[Compendium.x]{Lucky Coin} worth [[/r 1d4]] gp.</p><p>Shiny.</p>' },
        },
      ],
    };
    const inv = buildSheetModel(c, derived, {}, { detail: { items: 'magic' } }).inventory;
    expect(inv.groups.map((g) => g.title)).toEqual(['Carried', 'Backpack']);
    const [mace, ring] = inv.groups[0].items;
    expect(mace.blocks).toBeNull();
    expect(mace.tags).toEqual(['Equipped']);
    expect(ring.tags).toEqual(['Attuned', 'Rare']);
    expect(ring.blocks).toHaveLength(1);
    const trinket = inv.groups[1].items[0];
    expect(trinket.blocks.map((b) => b.runs[0].text)).toEqual(['A Lucky Coin worth 1d4 gp.', 'Shiny.']);
    expect(inv.attuned).toEqual(['Ring of Protection']);
    expect(inv.coins.gp).toBe(125);
  });

  it('as opções gravadas chegam normalizadas no modelo', () => {
    const { c } = twoClassCharacter();
    const m = buildSheetModel(c, baseDerived, {}, applyPreset({ theme: 'white' }, 'compact'));
    expect(m.options.theme).toBe('white');
    expect(m.options.detail.spells).toBe('table');
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
    expect(anns).toContainEqual(
      expect.objectContaining({ label: 'Options', text: 'Pact of the Blade', kind: 'optionalfeature' }),
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
        skill: { kind: 'skill', picks: ['ath'] },
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

describe('recursos (os usos que o export deriva, com os números da ficha)', () => {
  const actor = {
    items: [
      {
        type: 'class', name: 'Cleric',
        system: {
          identifier: 'cleric', levels: 5,
          advancement: {
            a: { type: 'ScaleValue', configuration: { identifier: 'channel-divinity', scale: { 2: { value: 2 }, 6: { value: 3 } } } },
          },
        },
      },
      {
        type: 'feat', name: 'Channel Divinity',
        system: { uses: { max: '@scale.cleric.channel-divinity', recovery: [{ period: 'lr', type: 'recoverAll' }, { period: 'sr', type: 'formula', formula: '1' }] } },
      },
      { type: 'feat', name: 'Bardic Inspiration', system: { uses: { max: 'max(1, @abilities.cha.mod)', recovery: [{ period: 'sr', type: 'recoverAll' }] } } },
      { type: 'feat', name: 'Lay on Hands', system: { uses: { max: '5 * @classes.cleric.levels', recovery: [{ period: 'lr', type: 'recoverAll' }] } } },
      { type: 'feat', name: 'Mystery', system: { uses: { max: '@scale.cleric.nope', recovery: [] } } },
      { type: 'feat', name: 'No Pool', system: { uses: { max: '', recovery: [] } } },
      { type: 'spell', name: 'Misty Step', system: { uses: { max: '1', recovery: [{ period: 'day', type: 'recoverAll' }] } } },
      {
        type: 'feat', name: 'Natural Recovery',
        system: {
          uses: { max: '', recovery: [] },
          activities: {
            a: { name: 'Cast Spell', uses: { max: '1', recovery: [{ period: 'lr', type: 'recoverAll' }] } },
            b: { name: 'Recover Spell Slots', uses: { max: '1', recovery: [{ period: 'lr', type: 'recoverAll' }] } },
          },
        },
      },
    ],
  };
  const derived = { level: 5, proficiencyBonus: 3, modifiers: { cha: -1 } };

  it('avalia a escala da classe no nível dela, o atributo, o nível de classe e o pool da activity', () => {
    expect(resourceRows(actor, derived)).toEqual([
      { name: 'Channel Divinity', max: 2, recovery: 'Long Rest, 1 on Short Rest' },
      { name: 'Bardic Inspiration', max: 1, recovery: 'Short Rest' },
      { name: 'Lay on Hands', max: 25, recovery: 'Long Rest' },
      { name: 'Natural Recovery: Cast Spell', max: 1, recovery: 'Long Rest' },
      { name: 'Natural Recovery: Recover Spell Slots', max: 1, recovery: 'Long Rest' },
    ]);
  });

  it('fórmula que cita o que não resolve fica de fora, nunca vira número inventado', () => {
    expect(evalUses('@scale.cleric.nope', {})).toBeNull();
    expect(evalUses('@abilities.str.mod', {})).toBeNull();
    expect(evalUses('@prof * 2', { prof: 3 })).toBe(6);
    expect(evalUses('alert(1)', {})).toBeNull();
  });

  it('recuperação por extenso', () => {
    expect(recoveryText([{ period: 'sr', type: 'recoverAll' }])).toBe('Short Rest');
    expect(recoveryText([])).toBe('');
  });
});
