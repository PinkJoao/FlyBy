import { describe, it, expect } from 'vitest';
import { featureOptionChoices, subclassFeatureOptionChoices } from './featureOptions';

// db mínimo: Divine Order (nv1) com options → Protector/Thaumaturge (refClassFeature).
const db = {
  'class-cleric': {
    classFeature: [
      {
        name: 'Divine Order',
        source: 'XPHB',
        classSource: 'XPHB',
        level: 1,
        entries: [
          'Choose one.',
          {
            type: 'options',
            count: 1,
            entries: [
              { type: 'refClassFeature', classFeature: 'Protector|Cleric|XPHB|1|XPHB' },
              { type: 'refClassFeature', classFeature: 'Thaumaturge|Cleric|XPHB|1|XPHB' },
            ],
          },
        ],
      },
      { name: 'Protector', source: 'XPHB', classSource: 'XPHB', level: 1, entries: ['Martial weapons + Heavy armor.'] },
      { name: 'Thaumaturge', source: 'XPHB', classSource: 'XPHB', level: 1, entries: ['Extra cantrip.'] },
      // uma feature de nível 7 com options (não deve aparecer p/ nível 3)
      {
        name: 'Late Choice',
        source: 'XPHB',
        classSource: 'XPHB',
        level: 7,
        entries: [{ type: 'options', count: 1, entries: [{ type: 'refClassFeature', classFeature: 'Protector|Cleric|XPHB|1|XPHB' }] }],
      },
    ],
  },
};

const clericObj = {
  name: 'Cleric',
  source: 'XPHB',
  classFeatures: ['Divine Order|Cleric|XPHB|1', 'Late Choice|Cleric|XPHB|7'],
};

describe('featureOptionChoices', () => {
  it('gera choice de sub-feature com opções resolvidas (nome + entries)', () => {
    const out = featureOptionChoices(db, 'cleric', clericObj, 3);
    expect(out).toHaveLength(1);
    const c = out[0];
    expect(c).toMatchObject({ id: 'featopt@Divine Order@1', kind: 'featureoption', count: 1, label: 'Divine Order' });
    expect(c.pool.options.map((o) => o.label)).toEqual(['Protector', 'Thaumaturge']);
    expect(c.pool.options[0]).toEqual({ value: 'Protector|XPHB', label: 'Protector', entries: ['Martial weapons + Heavy armor.'] });
  });

  it('omite options acima do nível atual', () => {
    const out = featureOptionChoices(db, 'cleric', clericObj, 3);
    expect(out.find((c) => c.id.includes('Late Choice'))).toBeUndefined();
    const out7 = featureOptionChoices(db, 'cleric', clericObj, 7);
    expect(out7.find((c) => c.id === 'featopt@Late Choice@7')).toBeTruthy();
  });

  it('ignora options de refOptionalfeature (tratadas pelo optionalfeatureProgression)', () => {
    const db2 = {
      'class-warlock': {
        classFeature: [
          {
            name: 'Eldritch Invocation Options',
            source: 'XPHB',
            classSource: 'XPHB',
            level: 1,
            entries: [{ type: 'options', count: 1, entries: [{ type: 'refOptionalfeature', optionalfeature: 'Agonizing Blast|XPHB' }] }],
          },
        ],
      },
    };
    const obj = { name: 'Warlock', source: 'XPHB', classFeatures: ['Eldritch Invocation Options|Warlock|XPHB|1'] };
    expect(featureOptionChoices(db2, 'warlock', obj, 1)).toEqual([]);
  });

  it('feature curada em prosa (Blessed Strikes): extrai opções de refClassFeature', () => {
    const db3 = {
      'class-cleric': {
        classFeature: [
          {
            name: 'Blessed Strikes', source: 'XPHB', classSource: 'XPHB', level: 7,
            entries: ['You gain one of the following options of your choice.', { type: 'entries', entries: [
              { type: 'refClassFeature', classFeature: 'Divine Strike|Cleric|XPHB|7|XPHB' },
              { type: 'refClassFeature', classFeature: 'Potent Spellcasting|Cleric|XPHB|7|XPHB' },
            ] }],
          },
          { name: 'Divine Strike', source: 'XPHB', classSource: 'XPHB', level: 7, entries: ['dmg'] },
          { name: 'Potent Spellcasting', source: 'XPHB', classSource: 'XPHB', level: 7, entries: ['cantrip+wis'] },
        ],
      },
    };
    const obj = { name: 'Cleric', source: 'XPHB', classFeatures: ['Blessed Strikes|Cleric|XPHB|7'] };
    const out = featureOptionChoices(db3, 'cleric', obj, 7);
    expect(out).toHaveLength(1);
    expect(out[0].pool.options.map((o) => o.label)).toEqual(['Divine Strike', 'Potent Spellcasting']);
  });
});

describe('subclassFeatureOptionChoices', () => {
  const db = {
    'class-barbarian': {
      subclassFeature: [
        {
          name: 'Rage of the Wilds', source: 'XPHB', classSource: 'XPHB',
          subclassShortName: 'Wild Heart', subclassSource: 'XPHB', level: 3,
          entries: ['Your Rage taps into primal power.',
            { type: 'entries', name: 'Bear', entries: ['resistance'] },
            { type: 'entries', name: 'Eagle', entries: ['disengage'] },
            { type: 'entries', name: 'Wolf', entries: ['advantage'] },
          ],
        },
        {
          name: 'Elemental Epitome', source: 'XPHB', classSource: 'XPHB',
          subclassShortName: 'Elements', subclassSource: 'XPHB', level: 17,
          entries: ['Resistance to one of the following damage types of your choice: Acid, Cold...'],
        },
      ],
    },
  };

  it('extrai sub-features nomeadas (Wild Heart Bear/Eagle/Wolf)', () => {
    const sub = { shortName: 'Wild Heart', source: 'XPHB' };
    const out = subclassFeatureOptionChoices(db, 'barbarian', sub, 3);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('sub:featopt@Rage of the Wilds@3');
    expect(out[0].pool.options.map((o) => o.label)).toEqual(['Bear', 'Eagle', 'Wolf']);
  });

  it('extrai refSubclassFeature de bloco options curado (Storm Aura Desert/Sea/Tundra - TC-0019)', () => {
    const db2 = {
      'class-barbarian': {
        subclassFeature: [
          {
            name: 'Storm Aura', source: 'XGE', classSource: 'PHB',
            subclassShortName: 'Storm Herald', subclassSource: 'XGE', level: 3,
            entries: ['Choose desert, sea, or tundra.', { type: 'options', entries: [
              { type: 'refSubclassFeature', subclassFeature: 'Desert|Barbarian|PHB|Storm Herald|XGE|3' },
              { type: 'refSubclassFeature', subclassFeature: 'Sea|Barbarian|PHB|Storm Herald|XGE|3' },
              { type: 'refSubclassFeature', subclassFeature: 'Tundra|Barbarian|PHB|Storm Herald|XGE|3' },
            ] }],
          },
          { name: 'Desert', source: 'XGE', classSource: 'PHB', subclassShortName: 'Storm Herald', subclassSource: 'XGE', level: 3, entries: ['fire'] },
          { name: 'Sea', source: 'XGE', classSource: 'PHB', subclassShortName: 'Storm Herald', subclassSource: 'XGE', level: 3, entries: ['lightning'] },
          { name: 'Tundra', source: 'XGE', classSource: 'PHB', subclassShortName: 'Storm Herald', subclassSource: 'XGE', level: 3, entries: ['temp hp'] },
        ],
      },
    };
    const sub = { shortName: 'Storm Herald', source: 'XGE' };
    const out = subclassFeatureOptionChoices(db2, 'barbarian', sub, 3);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('sub:featopt@Storm Aura@3');
    expect(out[0].pool.options.map((o) => o.label)).toEqual(['Desert', 'Sea', 'Tundra']);
  });

  it('usa lista explícita quando não há sub-features (Elemental Epitome → tipos de dano)', () => {
    const sub = { shortName: 'Elements', source: 'XPHB' };
    const out = subclassFeatureOptionChoices(db, 'barbarian', sub, 17);
    expect(out[0].pool.options.map((o) => o.label)).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']);
  });

  it('gate por nível e subclasse nula', () => {
    expect(subclassFeatureOptionChoices(db, 'barbarian', { shortName: 'Wild Heart', source: 'XPHB' }, 2)).toEqual([]);
    expect(subclassFeatureOptionChoices(db, 'barbarian', null, 3)).toEqual([]);
  });
});
