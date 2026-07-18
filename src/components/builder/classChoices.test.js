import { describe, it, expect } from 'vitest';
import { buildClassChoices } from './classChoices';

// db mínimo: um Fighter XPHB com Weapon Mastery (nível 1) e uma subclasse com
// grant curado (Battle Master / Student of War) - o suficiente para exercitar
// o anexo de ruleEntry (título do seletor → popup da feature no glossário).
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
    // Fighter sem skillChoice neste fixture reduzido - basta garantir que nada
    // sem `feature` ganhou ruleEntry.
    expect(choices.filter((c) => !c.feature).every((c) => !c.ruleEntry)).toBe(true);
    expect(skill?.ruleEntry).toBeUndefined();
  });
});
