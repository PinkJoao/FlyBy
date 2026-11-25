// =============================================================================
// classChoices.test: testes dos descritores de escolha de classe
// =============================================================================
// O QUE FAZ
//   Um Fighter XPHB com Weapon Mastery e um grant de subclasse (Battle Master): o
//   `ruleEntry` anexado aos descritores que têm `feature`, e a nenhum outro.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { buildClassChoices } from './classChoices';

const db = {
  'class-fighter': {
    class: [
      {
        name: 'Fighter',
        source: 'XPHB',
        classFeatures: ['Weapon Mastery|Fighter|XPHB|1', 'Ability Score Improvement|Fighter|XPHB|4'],
        classTableGroups: [],
      },
    ],
    subclass: [
      {
        name: 'Battle Master',
        shortName: 'Battle Master',
        source: 'XPHB',
        className: 'Fighter',
        classSource: 'XPHB',
        subclassFeatures: [],
      },
    ],
    classFeature: [
      { name: 'Weapon Mastery', className: 'Fighter', source: 'XPHB', level: 1, entries: ['Your training with weapons…'] },
      { name: 'Ability Score Improvement', className: 'Fighter', source: 'XPHB', level: 4, entries: ['You gain the ASI feat…'] },
    ],
    subclassFeature: [
      { name: 'Student of War', className: 'Fighter', subclassShortName: 'Battle Master', source: 'XPHB', level: 3, entries: ['You gain proficiency…'] },
    ],
  },
};

const character = { classes: [] };

describe('buildClassChoices - ruleEntry (título do seletor vira link do glossário)', () => {
  const cls = { classId: 'fighter', source: 'XPHB', level: 4, isOriginalClass: true, subclassId: 'Battle Master', subclassSource: 'XPHB', choices: {} };
  const choices = buildClassChoices(db, cls, character);

  it('escolha de feature de classe carrega o texto da feature', () => {
    const wm = choices.find((c) => c.id === 'weaponMastery');
    expect(wm.ruleEntry).toMatchObject({ type: 'classFeature', name: 'Weapon Mastery', source: 'XPHB' });
    expect(wm.ruleEntry.entries[0]).toBe('Your training with weapons…');
  });

  it('ASI/feat aponta para a feature Ability Score Improvement do nível', () => {
    const feat = choices.find((c) => c.id === 'feat@4');
    expect(feat.ruleEntry).toMatchObject({ type: 'classFeature', name: 'Ability Score Improvement' });
  });

  it('grant de subclasse resolve a subclassFeature', () => {
    const sub = choices.find((c) => c.id.startsWith('sub:'));
    expect(sub.ruleEntry).toMatchObject({ type: 'subclassFeature', name: 'Student of War' });
  });

  it('escolha sem feature de origem (perícias iniciais) fica sem link', () => {
    const skill = choices.find((c) => c.id === 'skill');
    expect(choices.filter((c) => !c.feature).every((c) => !c.ruleEntry)).toBe(true);
    expect(skill?.ruleEntry).toBeUndefined();
  });
});

describe('buildClassChoices - classe secundária (multiclasse, TC-0218)', () => {
  const mdb = {
    ...db,
    'class-bard': {
      class: [{
        name: 'Bard',
        source: 'XPHB',
        classFeatures: [],
        classTableGroups: [],
        startingProficiencies: { skills: [{ any: 3 }], toolProficiencies: [{ anyMusicalInstrument: 3 }] },
        multiclassing: { proficienciesGained: { skills: [{ choose: { from: ['stealth', 'arcana'], count: 1 } }], toolProficiencies: [{ anyMusicalInstrument: 1 }] } },
      }],
    },
  };
  const fighter = { uid: 'f', classId: 'fighter', source: 'XPHB', level: 3, isOriginalClass: true, choices: {} };
  const bard = { uid: 'b', classId: 'bard', source: 'XPHB', level: 1, isOriginalClass: false, choices: {} };
  const multi = { classes: [fighter, bard] };

  it('a secundária oferece a perícia e o instrumento do multiclasse, com o id da inicial', () => {
    const choices = buildClassChoices(mdb, bard, multi);
    const skill = choices.find((c) => c.id === 'skill');
    expect(skill.count).toBe(1);
    expect(skill.pool.options.map((o) => o.value)).toEqual(['ste', 'arc']);
    expect(choices.filter((c) => c.kind === 'tool').map((c) => c.count)).toEqual([1]);
  });

  it('a mesma classe como inicial oferece as três perícias e os três instrumentos', () => {
    const solo = { ...bard, isOriginalClass: true };
    const choices = buildClassChoices(mdb, solo, { classes: [solo] });
    expect(choices.find((c) => c.id === 'skill').count).toBe(3);
    expect(choices.filter((c) => c.kind === 'tool').map((c) => c.count)).toEqual([3]);
  });
});
