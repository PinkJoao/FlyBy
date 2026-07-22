import { describe, it, expect } from 'vitest';
import { isFoundryActor, foundryToCharacter } from './foundryImport';

// db mínimo p/ reverter chaves de weapon mastery.
const db = {
  'items-base': { baseitem: [
    { name: 'Halberd', source: 'XPHB', weaponCategory: 'martial' },
    { name: 'Greatsword', source: 'XPHB', weaponCategory: 'martial' },
    { name: 'Longsword', source: 'XPHB', weaponCategory: 'martial' },
    { name: 'Maul', source: 'XPHB', weaponCategory: 'martial' },
    { name: 'Dice Set', source: 'XPHB', type: 'GS' },
  ] },
  languages: { language: [{ name: 'Common', type: 'standard' }] },
  feats: { feat: [{ name: 'Alert', source: 'XPHB', category: 'O' }] },
  races: { race: [
    {
      name: 'Elf', source: 'XPHB',
      // Keen Senses: a raça OFERECE a escolha de perícia - o back-fill do import
      // agora é gated por parseChoices(raceObj) (TC-0010).
      skillProficiencies: [{ choose: { from: ['insight', 'perception', 'survival'], count: 1 } }],
      _versions: [
        { name: 'Elf; Drow Lineage', source: 'XPHB' },
        { name: 'Elf; High Elf Lineage', source: 'XPHB' },
        { name: 'Elf; Wood Elf Lineage', source: 'XPHB' },
      ],
    },
    {
      name: 'Gnome', source: 'XPHB',
      _versions: [
        { name: 'Gnome; Forest Gnome Lineage', source: 'XPHB' },
        { name: 'Gnome; Rock Gnome Lineage', source: 'XPHB' },
      ],
    },
    {
      name: 'Tiefling', source: 'XPHB',
      _versions: [
        { name: 'Tiefling; Abyssal Legacy', source: 'XPHB' },
        { name: 'Tiefling; Chthonic Legacy', source: 'XPHB' },
        { name: 'Tiefling; Infernal Legacy', source: 'XPHB' },
      ],
    },
    { name: 'Human', source: 'XPHB' },
  ] },
};

/** Monta um ator Foundry mínimo (Fighter 6, Elf Drow, origem custom). */
function makeActor() {
  return {
    name: 'Hero',
    type: 'character',
    img: 'portrait.webp',
    system: {
      abilities: { str: { value: 19 }, dex: { value: 14 }, con: { value: 15 }, int: { value: 8 }, wis: { value: 10 }, cha: { value: 12 } },
      details: { originalClass: 'CLASSID000000001' },
    },
    items: [
      {
        _id: 'RACE0000000000001', name: 'Elf; Drow Lineage', type: 'race',
        system: { identifier: 'elf', source: { book: 'XPHB' }, advancement: {
          r1: { _id: 'r1', type: 'Trait', title: 'Keen Senses', value: { chosen: ['skills:prc'] } },
        } },
      },
      {
        _id: 'BG00000000000001', name: 'Custom Background', type: 'background',
        system: { advancement: {
          a1: { _id: 'a1', type: 'AbilityScoreImprovement', value: { type: 'asi', assignments: { str: 2, con: 1 } } },
          a2: { _id: 'a2', type: 'Trait', title: 'Skill Proficiencies', value: { chosen: ['skills:ath', 'skills:itm'] } },
          a2b: { _id: 'a2b', type: 'Trait', title: 'Tool Proficiencies', value: { chosen: ['tool:game:dice'] } },
          a2c: { _id: 'a2c', type: 'Trait', title: 'Languages', value: { chosen: ['languages:standard:common'] } },
          a3: { _id: 'a3', type: 'ItemGrant', value: { added: { FEAT_ALERT00001: '.FEAT_ALERT00001' } } },
        } },
      },
      { _id: 'FEAT_ALERT00001', name: 'Alert', type: 'feat', system: { type: { value: 'feat', subtype: 'origin' }, source: { book: 'XPHB' }, advancement: {} } },
      { _id: 'FEAT_GWM0000001', name: 'Great Weapon Master', type: 'feat', system: { type: { value: 'feat', subtype: 'general' }, source: { book: 'XPHB' }, advancement: {
        g: { _id: 'g', type: 'AbilityScoreImprovement', configuration: { fixed: { str: 1, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } }, value: { type: 'asi' } },
      } } },
      { _id: 'FEAT_DEF0000001', name: 'Defense', type: 'feat', system: { type: { value: 'feat', subtype: 'fightingStyle' }, source: { book: 'XPHB' }, advancement: {} } },
      {
        _id: 'CLASSID000000001', name: 'Fighter', type: 'class',
        system: {
          identifier: 'fighter', levels: 6, source: { book: 'XPHB' },
          advancement: {
            h: { _id: 'h', type: 'HitPoints', value: { 1: 'max', 2: 7, 3: 'avg', 4: 'avg', 5: 'avg', 6: 'avg' } },
            t1: { _id: 't1', type: 'Trait', title: 'Skill Proficiencies', value: { chosen: ['skills:acr', 'skills:prc'] } },
            t2: { _id: 't2', type: 'Trait', title: 'Weapon Mastery', value: { chosen: ['weapon:mar:greatsword', 'weapon:mar:halberd'] } },
            ic: { _id: 'ic', type: 'ItemChoice', title: 'Fighting Style', value: { added: { 1: { FEAT_DEF0000001: '.FEAT_DEF0000001' } } } },
            asi4: { _id: 'asi4', type: 'AbilityScoreImprovement', level: 4, value: { type: 'feat', feat: { FEAT_GWM0000001: '.FEAT_GWM0000001' } } },
            asi6: { _id: 'asi6', type: 'AbilityScoreImprovement', level: 6, value: { type: 'asi', assignments: { con: 1, wis: 1 } } },
          },
        },
      },
      { _id: 'SUB00000000001', name: 'Battle Master', type: 'subclass', system: { identifier: 'battle-master', classIdentifier: 'fighter', source: { book: 'XPHB' } } },
    ],
  };
}

describe('parseSpecies (via foundryToCharacter): nome de linhagem', () => {
  const raceActor = (name) => ({
    name: 'Hero', type: 'character', system: { abilities: {} },
    items: [{ _id: 'R1', name, type: 'race', system: { source: { book: 'XPHB' }, advancement: {} } }],
  });

  it('nosso próprio export ("Base; Variante") - match exato', () => {
    const ch = foundryToCharacter(raceActor('Elf; Drow Lineage'), db);
    expect(ch.species).toMatchObject({ id: 'elf', lineage: 'Elf; Drow Lineage' });
  });

  it('premade oficial abreviado ("Base, Palavra-chave") - casa por palavra-chave contra os _versions reais', () => {
    expect(foundryToCharacter(raceActor('Elf, High'), db).species.lineage).toBe('Elf; High Elf Lineage');
    expect(foundryToCharacter(raceActor('Elf, Wood'), db).species.lineage).toBe('Elf; Wood Elf Lineage');
    expect(foundryToCharacter(raceActor('Gnome, Rock'), db).species.lineage).toBe('Gnome; Rock Gnome Lineage');
    expect(foundryToCharacter(raceActor('Tiefling, Infernal'), db).species.lineage).toBe('Tiefling; Infernal Legacy');
  });

  it('forma com parênteses - casa por palavra-chave também', () => {
    expect(foundryToCharacter(raceActor('Elf (Drow)'), db).species.lineage).toBe('Elf; Drow Lineage');
  });

  it('raça base sem linhagem → lineage null', () => {
    expect(foundryToCharacter(raceActor('Human'), db).species).toMatchObject({ id: 'human', lineage: null });
  });

  it('sem db ou raça desconhecida → cai pro formato "Base; Resto"', () => {
    const ch = foundryToCharacter(raceActor('Aasimar, Protector'), {});
    expect(ch.species).toMatchObject({ id: 'aasimar', lineage: 'Aasimar; Protector' });
  });

  it('nome de raça COM parênteses/; casa EXATO antes da heurística (TC-0008)', () => {
    const db8 = { races: { race: [
      { name: 'Human (Ixalan)', source: 'PSX' },
      { name: 'Aetherborn', source: 'PSK', _versions: [{ name: 'Variant; Gifted Aetherborn', source: 'PSK' }] },
    ] } };
    // Raça base cujo nome canônico tem parênteses: NÃO vira base+linhagem inventada.
    expect(foundryToCharacter(raceActor('Human (Ixalan)'), db8).species)
      .toMatchObject({ id: 'human (ixalan)', lineage: null });
    // Nome que é uma _version: resolve para a base + a linhagem canônica.
    expect(foundryToCharacter(raceActor('Variant; Gifted Aetherborn'), db8).species)
      .toMatchObject({ id: 'aetherborn', lineage: 'Variant; Gifted Aetherborn' });
  });

  it('flags builder5e voltam: spellAbility/size da raça e sub-bag do talento de origem (TC-0002/0009)', () => {
    const a = raceActor('Human');
    a.items[0].flags = { builder5e: { choices: {
      'spellAbility-0': { kind: 'spellAbility', picks: ['cha'] },
      'size-0': { kind: 'size', picks: ['S'] },
    } } };
    a.items.push(
      { _id: 'BG1', name: 'Custom Background', type: 'background', system: { advancement: {
        g: { _id: 'g', type: 'ItemGrant', value: { added: { OF1: '.OF1' } } },
      } } },
      { _id: 'OF1', name: 'Alert', type: 'feat', system: { source: { book: 'XPHB' }, advancement: {} },
        flags: { builder5e: { choices: { 'ability-0': { kind: 'ability', alt: 0, picks: [{ ability: 'wis', amount: 1 }] } } } } },
    );
    a.system.abilities = { wis: { value: 11 } };
    const ch = foundryToCharacter(a, db);
    expect(ch.species.choices['spellAbility-0']).toEqual({ kind: 'spellAbility', picks: ['cha'] });
    expect(ch.species.choices['size-0']).toEqual({ kind: 'size', picks: ['S'] });
    expect(ch.origin.originFeat.choices['ability-0'].picks).toEqual([{ ability: 'wis', amount: 1 }]);
    // O +1 wis escolhido dentro do talento conta na reconstrução da base: 11 − 1 = 10.
    expect(ch.scores.wis).toBe(10);
  });
});

describe('isFoundryActor', () => {
  it('reconhece um ator Foundry', () => {
    expect(isFoundryActor({ type: 'character', system: {}, items: [] })).toBe(true);
  });
  it('rejeita um personagem do builder', () => {
    expect(isFoundryActor({ classes: [], scores: {} })).toBe(false);
    expect(isFoundryActor(null)).toBe(false);
  });
});

describe('foundryToCharacter', () => {
  const ch = foundryToCharacter(makeActor(), db);

  it('nome e retrato', () => {
    expect(ch.meta.name).toBe('Hero');
    expect(ch.meta.portrait).toBe('portrait.webp');
  });

  it('espécie: base + lineage do nome', () => {
    expect(ch.species).toMatchObject({ id: 'elf', source: 'XPHB', lineage: 'Elf; Drow Lineage' });
  });

  it('espécie: sub-escolha de perícia (Keen Senses) volta pro choice-bag', () => {
    expect(ch.species.choices['skill-0']).toEqual({ kind: 'skill', picks: ['prc'] });
  });

  it('origem: boosts, perícias e talento de origem', () => {
    expect(ch.origin.abilityBoosts).toEqual([{ ability: 'str', amount: 2 }, { ability: 'con', amount: 1 }]);
    expect(ch.origin.skillProficiencies).toEqual(['ath', 'itm']);
    expect(ch.origin.toolProficiencies).toEqual(['Dice Set']);
    expect(ch.origin.languages).toEqual(['Common']);
    expect(ch.origin.originFeat).toMatchObject({ id: 'Alert', source: 'XPHB' });
  });

  it('classe: id, level, subclasse, HP rolado', () => {
    const c = ch.classes[0];
    expect(c).toMatchObject({ classId: 'fighter', source: 'XPHB', level: 6, subclassId: 'Battle Master', isOriginalClass: true });
    expect(c.hitPoints).toEqual({ 2: 7 }); // só rolagens manuais; 'max'/'avg' ficam de fora
  });

  it('choice-bag: perícias, weapon mastery (chave→nome), fighting style, feat de ASI, ASI cru', () => {
    const c = ch.classes[0].choices;
    expect(c.skill).toEqual({ kind: 'skill', picks: ['acr', 'prc'] });
    // Nome PURO (canônico da UI, TC-0003) - não mais "Nome|Fonte".
    expect(c.weaponMastery.picks).toEqual(['Greatsword', 'Halberd']);
    expect(c['feat@1']).toEqual({ kind: 'feat', picks: ['Defense|XPHB'], sub: {} });
    expect(c['feat@4']).toMatchObject({ kind: 'feat', picks: ['Great Weapon Master|XPHB'] });
    // ASI cru (nível 6): +1 con +1 wis → talento ASI, alt 1 (+1 em dois)
    expect(c['feat@6'].picks).toEqual(['Ability Score Improvement|XPHB']);
    const sub = c['feat@6'].sub['Ability Score Improvement|XPHB']['ability-0'];
    expect(sub.alt).toBe(1);
    expect(sub.picks).toEqual([{ ability: 'con', amount: 1 }, { ability: 'wis', amount: 1 }]);
  });

  it('weapon mastery: ACUMULA os Traits de todos os breakpoints, em ordem de nível', () => {
    // O SRD dá um Trait por nível em que a contagem cresce, cada um com o DELTA
    // (Barbarian 2@1 → +1@4 → +1@10). Ler só um perderia as maestrias dos outros.
    const a = makeActor();
    const adv = a.items.find((i) => i.type === 'class').system.advancement;
    adv.t2 = { ...adv.t2, level: 1, configuration: { mode: 'mastery' } };
    adv.t2b = { _id: 't2b', type: 'Trait', level: 10, title: 'Weapon Mastery', configuration: { mode: 'mastery' }, value: { chosen: ['weapon:mar:maul'] } };
    adv.t2a = { _id: 't2a', type: 'Trait', level: 4, title: 'Weapon Mastery', configuration: { mode: 'mastery' }, value: { chosen: ['weapon:mar:longsword'] } };
    const picks = foundryToCharacter(a, db).classes[0].choices.weaponMastery.picks;
    expect(picks).toEqual(['Greatsword', 'Halberd', 'Longsword', 'Maul']);
  });

  it('scores BASE = final − todos os boosts (origem + GWM fixo + ASI cru)', () => {
    // str: 19 − 2(origem) − 1(GWM) = 16; con: 15 − 1(origem) − 1(ASI) = 13; wis: 10 − 1(ASI) = 9
    expect(ch.scores).toMatchObject({ str: 16, con: 13, wis: 9, dex: 14, int: 8, cha: 12 });
  });

  it('nunca deixa classes vazio (ator sem classe → classe em branco)', () => {
    const empty = foundryToCharacter({ name: 'X', type: 'character', system: { abilities: {} }, items: [] }, db);
    expect(Array.isArray(empty.classes)).toBe(true);
    expect(empty.classes.length).toBe(1);
  });

  it('ajuste manual de HP: hp.bonuses.overall → hpBonus', () => {
    const a = makeActor();
    a.system.attributes = { hp: { bonuses: { overall: '5' } } };
    expect(foundryToCharacter(a, db).hpBonus).toBe(5);
    expect(foundryToCharacter(makeActor(), db).hpBonus).toBe(0); // sem overall
  });

  it('espécie: forma do premade real do Human (ItemGrant estrutural + ItemChoice do talento) + boost legado', () => {
    const a = makeActor();
    // Traços placeholder (Resourceful/Skillful) - NÃO existem em feats.feat, então
    // um ItemGrant que os concede não deve virar pick de talento (só a estrutura
    // real, `ItemChoice`, deve).
    a.items.push(
      { _id: 'TRAIT_RESOURCE01', name: 'Resourceful', type: 'feat', system: { source: { book: 'XPHB' }, advancement: {} } },
      { _id: 'TRAIT_SKILLFUL01', name: 'Skillful', type: 'feat', system: { source: { book: 'XPHB' }, advancement: {} } },
    );
    a.items.find((i) => i._id === 'RACE0000000000001').system.advancement = {
      r1: { _id: 'r1', type: 'AbilityScoreImprovement', value: { type: 'asi', assignments: { dex: 1 } } },
      r2: {
        _id: 'r2', type: 'ItemGrant', title: 'Human Traits',
        value: { added: { TRAIT_RESOURCE01: '.TRAIT_RESOURCE01', TRAIT_SKILLFUL01: '.TRAIT_SKILLFUL01' } },
      },
      r3: { _id: 'r3', type: 'ItemChoice', title: 'Versatile', value: { added: { FEAT_ALERT00001: '.FEAT_ALERT00001' } } },
    };
    const ch2 = foundryToCharacter(a, db);
    expect(ch2.species.choices['ability-0']).toEqual({ kind: 'ability', picks: [{ ability: 'dex', amount: 1 }] });
    expect(ch2.species.choices['feat-0']).toEqual({ kind: 'feat', picks: ['Alert|XPHB'], sub: {} });
    // dex final 14 − 1(boost de espécie legado) = 13
    expect(ch2.scores.dex).toBe(13);
  });
});

describe('reconstrói escolhas de sub-feature (Divine Order / Blessed Strikes)', () => {
  const clericDb = {
    'class-cleric': {
      class: [{ name: 'Cleric', source: 'XPHB', classFeatures: ['Divine Order|Cleric|XPHB|1', 'Blessed Strikes|Cleric|XPHB|7'] }],
      classFeature: [
        {
          name: 'Divine Order', source: 'XPHB', classSource: 'XPHB', level: 1,
          entries: [{ type: 'options', count: 1, entries: [
            { type: 'refClassFeature', classFeature: 'Protector|Cleric|XPHB|1|XPHB' },
            { type: 'refClassFeature', classFeature: 'Thaumaturge|Cleric|XPHB|1|XPHB' },
          ] }],
        },
        { name: 'Protector', source: 'XPHB', classSource: 'XPHB', level: 1, entries: ['Martial + Heavy.'] },
        { name: 'Thaumaturge', source: 'XPHB', classSource: 'XPHB', level: 1, entries: ['Cantrip.'] },
        {
          name: 'Blessed Strikes', source: 'XPHB', classSource: 'XPHB', level: 7,
          entries: [{ type: 'options', count: 1, entries: [
            { type: 'refClassFeature', classFeature: 'Divine Strike|Cleric|XPHB|7|XPHB' },
            { type: 'refClassFeature', classFeature: 'Potent Spellcasting|Cleric|XPHB|7|XPHB' },
          ] }],
        },
        { name: 'Divine Strike', source: 'XPHB', classSource: 'XPHB', level: 7, entries: ['+dmg'] },
        { name: 'Potent Spellcasting', source: 'XPHB', classSource: 'XPHB', level: 7, entries: ['+wis cantrip'] },
      ],
      subclass: [],
    },
  };
  const actor = {
    name: 'Cleric', type: 'character',
    system: { abilities: {}, details: { originalClass: 'CLS1' } },
    items: [
      { _id: 'CLS1', name: 'Cleric', type: 'class', system: { identifier: 'cleric', levels: 7, source: { book: 'XPHB' }, advancement: {} } },
      { name: 'Divine Order', type: 'feat', system: { identifier: 'divine-order' } },
      // casa por NOME "<Feature>: <Opção>"
      { name: 'Divine Order: Protector', type: 'feat', system: { identifier: 'x' } },
      // casa por IDENTIFIER "<feature>-<opção>"
      { name: 'Something Else', type: 'feat', system: { identifier: 'blessed-strikes-potent-spellcasting' } },
    ],
  };

  it('mapeia os feats concedidos de volta ao choice-bag (por nome e por identifier)', () => {
    const char = foundryToCharacter(actor, clericDb);
    const cls = char.classes[0];
    expect(cls.choices['featopt@Divine Order@1']).toEqual({ kind: 'featureoption', picks: ['Protector|XPHB'] });
    expect(cls.choices['featopt@Blessed Strikes@7']).toEqual({ kind: 'featureoption', picks: ['Potent Spellcasting|XPHB'] });
  });
});
