// Valida o gerador de advancement do item de classe. Os valores esperados são o
// gabarito extraído dos exports REAIS (premade Randal / Plutonium etienne) e do
// source MIT do sistema dnd5e - ver CLAUDE.md §5 e DDL-0003.
import { describe, it, expect } from 'vitest';
import { buildClassAdvancement, scaleValueAdvancements } from './foundryAdvancement';

// Fighter XPHB - recorte completo o bastante p/ o gerador (campos que ele lê).
const fighterObj = {
  name: 'Fighter',
  source: 'XPHB',
  hd: { number: 1, faces: 10 },
  proficiency: ['str', 'con'],
  startingProficiencies: {
    armor: ['light', 'medium', 'heavy', 'shield'],
    weapons: ['simple', 'martial'],
    skills: [{ choose: { from: ['acrobatics', 'animal handling', 'athletics', 'history', 'insight', 'intimidation', 'persuasion', 'perception', 'survival'], count: 2 } }],
  },
  classTableGroups: [{ colLabels: ['Weapon Mastery'], rows: [[3], [3], [3], [4]] }],
  classFeatures: [
    'Fighting Style|Fighter||1',
    'Weapon Mastery|Fighter||1',
    { classFeature: 'Martial Archetype|Fighter||3', gainSubclassFeature: true },
    'Ability Score Improvement|Fighter||4',
    'Ability Score Improvement|Fighter||6',
    'Ability Score Improvement|Fighter||8',
    'Ability Score Improvement|Fighter||12',
    'Ability Score Improvement|Fighter||14',
    'Ability Score Improvement|Fighter||16',
    'Epic Boon|Fighter||19',
  ],
};

describe('buildClassAdvancement - Fighter (gabarito Randal/etienne/dnd5e)', () => {
  const adv = buildClassAdvancement(fighterObj);
  const trait = (pfx) => adv.find((a) => a.type === 'Trait' && a.title.startsWith(pfx));

  it('inclui HitPoints', () => {
    expect(adv.filter((a) => a.type === 'HitPoints')).toHaveLength(1);
  });

  it('Trait de saves concede os saves da classe', () => {
    expect(trait('Saving').configuration.grants).toEqual(['saves:str', 'saves:con']);
  });

  it('Trait de perícias: escolha count 2 do pool da classe', () => {
    const ch = trait('Skill').configuration.choices[0];
    expect(ch.count).toBe(2);
    expect(ch.pool).toEqual(['skills:acr', 'skills:ani', 'skills:ath', 'skills:his', 'skills:ins', 'skills:itm', 'skills:per', 'skills:prc', 'skills:sur']);
  });

  it('Traits de armas e armadura (grant fixo)', () => {
    expect(trait('Weapon Prof').configuration.grants).toEqual(['weapon:sim', 'weapon:mar']);
    expect(trait('Armor').configuration.grants).toEqual(['armor:lgt', 'armor:med', 'armor:hvy', 'armor:shl']);
  });

  it('Trait de Weapon Mastery: count da coluna da tabela (3 no nv1)', () => {
    const ch = trait('Weapon Mastery').configuration.choices[0];
    expect(ch.count).toBe(3);
    expect(ch.pool).toEqual(['weapon:sim:*', 'weapon:mar:*']);
  });

  it('AbilityScoreImprovement em cada nível de ASI + Epic Boon', () => {
    const levels = adv.filter((a) => a.type === 'AbilityScoreImprovement').map((a) => a.level);
    expect(levels).toEqual([4, 6, 8, 12, 14, 16, 19]); // = Randal (premade oficial)
    expect(adv.find((a) => a.type === 'AbilityScoreImprovement').configuration.points).toBe(2);
  });

  it('Subclass no nível nativo (3)', () => {
    expect(adv.find((a) => a.type === 'Subclass').level).toBe(3);
  });
});

describe('scaleValueAdvancements', () => {
  it('coluna numérica → ScaleValue number com breakpoints (só onde muda)', () => {
    const obj = { name: 'Fighter', classTableGroups: [{ colLabels: ['Second Wind'], rows: [[2], [2], [2], [3], [3], [4]] }] };
    const sv = scaleValueAdvancements(obj).find((a) => a.title === 'Second Wind');
    expect(sv.configuration.type).toBe('number');
    expect(sv.configuration.scale).toEqual({ 1: { value: 2 }, 4: { value: 3 }, 6: { value: 4 } });
  });

  it('coluna de DADO (Sneak Attack) → type dice {number,faces}', () => {
    const obj = { name: 'Rogue', classTableGroups: [{ colLabels: ['Sneak Attack'], rows: [
      [{ type: 'dice', toRoll: [{ number: 1, faces: 6 }] }], [{ type: 'dice', toRoll: [{ number: 1, faces: 6 }] }],
      [{ type: 'dice', toRoll: [{ number: 2, faces: 6 }] }],
    ] }] };
    const sv = scaleValueAdvancements(obj)[0];
    expect(sv.configuration.type).toBe('dice');
    expect(sv.configuration.scale).toEqual({ 1: { number: 1, faces: 6 }, 3: { number: 2, faces: 6 } });
  });

  it('bônus (Rage Damage) → number; deslocamento → distance/ft', () => {
    const obj = { name: 'X', classTableGroups: [{ colLabels: ['Rage Damage', 'Unarmored Movement'], rows: [
      [{ type: 'bonus', value: 2 }, { type: 'bonusSpeed', value: 0 }],
      [{ type: 'bonus', value: 2 }, { type: 'bonusSpeed', value: 10 }],
    ] }] };
    const [rage, move] = scaleValueAdvancements(obj);
    expect(rage).toMatchObject({ title: 'Rage Damage', configuration: { type: 'number', scale: { 1: { value: 2 } } } });
    expect(move.configuration).toMatchObject({ type: 'distance', distance: { units: 'ft' }, scale: { 1: { value: 0 }, 2: { value: 10 } } });
  });

  it('IGNORA colunas de magia/invocations e o grupo de spell slots', () => {
    const obj = { name: 'Warlock', classTableGroups: [
      { colLabels: ['{@filter Invocations|optionalfeatures|feature type=ei}', '{@filter Cantrips|spells|level=0}', 'Slot Level'], rows: [[1, 2, '1st']] },
      { title: 'Spell Slots per Spell Level', colLabels: ['{@filter 1st|spells|level=1}'], rows: [[1]] },
    ] };
    expect(scaleValueAdvancements(obj)).toEqual([]);
  });

  it('escalas curadas em prosa do Fighter (Action Surge, Indomitable)', () => {
    const titles = scaleValueAdvancements({ name: 'Fighter', classTableGroups: [] }).map((a) => a.title);
    expect(titles).toEqual(['Action Surge', 'Indomitable']);
  });

  it('escala curada em prosa do Clérigo (Divine Spark - d8 da Channel Divinity)', () => {
    const sv = scaleValueAdvancements({ name: 'Cleric', classTableGroups: [] }).find((a) => a.title === 'Divine Spark');
    expect(sv.configuration.scale).toEqual({
      2: { value: 1 }, 7: { value: 2 }, 13: { value: 3 }, 18: { value: 4 },
    });
  });
});

describe('buildClassAdvancement - casos gerais', () => {
  it('skills {any:N} (Bard) → pool aberto skills:*', () => {
    const bard = {
      name: 'Bard', hd: { faces: 8 }, proficiency: ['dex', 'cha'],
      startingProficiencies: { armor: ['light'], weapons: ['simple'], skills: [{ any: 3 }] },
      classFeatures: ['Bard Subclass|Bard||3'],
    };
    const skills = buildClassAdvancement(bard).find((a) => a.type === 'Trait' && a.title.startsWith('Skill'));
    expect(skills.configuration.choices[0]).toEqual({ count: 3, pool: ['skills:*'] });
  });

  it('classe sem Weapon Mastery não gera esse Trait', () => {
    const wizard = {
      name: 'Wizard', hd: { faces: 6 }, proficiency: ['int', 'wis'],
      startingProficiencies: { armor: [], weapons: ['simple'], skills: [{ choose: { from: ['arcana'], count: 2 } }] },
      classFeatures: ['Wizard Subclass|Wizard||3'],
    };
    const adv = buildClassAdvancement(wizard);
    expect(adv.find((a) => a.type === 'Trait' && a.title === 'Weapon Mastery')).toBeUndefined();
  });

  it('objeto nulo → vazio', () => {
    expect(buildClassAdvancement(null)).toEqual([]);
  });
});
