import { describe, it, expect } from 'vitest';
import { classFeatureLevels, isLongFeature, classTable } from './classProgression';

// db mínimo no formato 5etools.
const db = {
  'class-fighter': {
    classFeature: [
      { name: 'Fighting Style', className: 'Fighter', classSource: 'XPHB', level: 1, entries: ['fs text'] },
      { name: 'Second Wind', className: 'Fighter', classSource: 'XPHB', level: 1, entries: ['sw text'] },
      { name: 'Action Surge', className: 'Fighter', classSource: 'XPHB', level: 2, entries: ['as text'] },
      { name: 'Fighter Subclass', className: 'Fighter', classSource: 'XPHB', level: 3, entries: ['pick one'] },
    ],
    subclassFeature: [
      {
        name: 'Champion',
        subclassShortName: 'Champion',
        subclassSource: 'XPHB',
        level: 3,
        entries: ['champ intro'],
      },
      {
        name: 'Heroic Warrior',
        subclassShortName: 'Champion',
        subclassSource: 'XPHB',
        level: 10,
        entries: ['heroic text'],
      },
    ],
  },
};

const classObj = {
  name: 'Fighter',
  source: 'XPHB',
  classFeatures: [
    'Fighting Style|Fighter|XPHB|1',
    'Second Wind|Fighter|XPHB|1',
    'Action Surge|Fighter|XPHB|2',
    { classFeature: 'Fighter Subclass|Fighter|XPHB|3', gainSubclassFeature: true },
  ],
  classTableGroups: [
    { colLabels: ['Second Wind'], rows: Array.from({ length: 20 }, (_, i) => [i < 3 ? 2 : 3]) },
    {
      colLabels: ['1st', '2nd'],
      rowsSpellProgression: Array.from({ length: 20 }, (_, i) => [Math.min(4, i + 1), i > 2 ? 2 : 0]),
    },
  ],
};

const champion = {
  shortName: 'Champion',
  source: 'XPHB',
  subclassFeatures: ['Champion|Fighter|XPHB|Champion|XPHB|3', 'Heroic Warrior|Fighter|XPHB|Champion|XPHB|10'],
};

describe('classFeatureLevels', () => {
  it('agrupa features de classe por nível, em ordem', () => {
    const out = classFeatureLevels(db, 'fighter', classObj);
    expect(out.map((l) => l.level)).toEqual([1, 2, 3]);
    expect(out[0].features.map((f) => f.name)).toEqual(['Fighting Style', 'Second Wind']);
    expect(out[0].features.every((f) => f.from === 'class')).toBe(true);
  });

  it('inlina refClassFeature nas opções (Divine/Primal Order → sub-features)', () => {
    const db2 = {
      'class-cleric': {
        classFeature: [
          {
            name: 'Divine Order',
            classSource: 'XPHB',
            level: 1,
            entries: [
              'Choose one.',
              { type: 'options', count: 1, entries: [{ type: 'refClassFeature', classFeature: 'Protector|Cleric|XPHB|1|XPHB' }] },
            ],
          },
          { name: 'Protector', classSource: 'XPHB', level: 1, entries: ['You train for combat.'] },
        ],
      },
    };
    const clericObj = { name: 'Cleric', source: 'XPHB', classFeatures: ['Divine Order|Cleric|XPHB|1'] };
    const out = classFeatureLevels(db2, 'cleric', clericObj);
    const divineOrder = out[0].features[0];
    // A opção resolvida deve conter a sub-feature "Protector" com seu texto.
    const json = JSON.stringify(divineOrder.entries);
    expect(json).toContain('Protector');
    expect(json).toContain('You train for combat');
  });

  it('mescla as features da subclasse nos níveis certos', () => {
    const out = classFeatureLevels(db, 'fighter', classObj, champion);
    const lvl3 = out.find((l) => l.level === 3);
    expect(lvl3.features.map((f) => `${f.from}:${f.name}`)).toEqual([
      'class:Fighter Subclass',
      'subclass:Champion',
    ]);
    const lvl10 = out.find((l) => l.level === 10);
    expect(lvl10.features[0]).toMatchObject({ name: 'Heroic Warrior', from: 'subclass' });
  });
});

describe('isLongFeature', () => {
  it('detecta clusters de options e muitos refOptionalfeature', () => {
    expect(isLongFeature([{ type: 'options', entries: [] }])).toBe(true);
    const refs = Array.from({ length: 6 }, () => ({ type: 'refOptionalfeature', optionalfeature: 'X|TCE' }));
    expect(isLongFeature([{ type: 'entries', entries: refs }])).toBe(true);
    expect(isLongFeature(['short text'])).toBe(false);
  });
});

describe('classTable', () => {
  it('achata grupos + spell slots em 20 linhas com Level/PB', () => {
    const t = classTable(classObj);
    expect(t.cols).toEqual(['Level', 'PB', 'Second Wind', '1st', '2nd']);
    expect(t.rows).toHaveLength(20);
    expect(t.rows[0]).toEqual(['1', '+2', '2', '1', '-']); // slot 0 → -
    expect(t.rows[4]).toEqual(['5', '+3', '3', '4', '2']);
    expect(t.rows[19][1]).toBe('+6');
  });

  it('null sem classTableGroups', () => {
    expect(classTable({})).toBe(null);
  });
});

describe('resolveOptionalRefs (via classFeatureLevels/subclass)', () => {
  it('troca refOptionalfeature pelo texto completo quando existe no db', async () => {
    const { resolveOptionalRefs } = await import('./optionalFeatures');
    const db2 = {
      optionalfeatures: {
        optionalfeature: [{ name: 'Ambush', source: 'TCE', entries: ['ambush full text'] }],
      },
    };
    const out = resolveOptionalRefs(
      [{ type: 'entries', entries: [{ type: 'refOptionalfeature', optionalfeature: 'Ambush|TCE' }] }],
      db2,
    );
    expect(out[0].entries[0]).toEqual({ type: 'entries', name: 'Ambush', entries: ['ambush full text'] });
  });

  it('mantém a ref quando não há match (fallback de nome no EntryContent)', async () => {
    const { resolveOptionalRefs } = await import('./optionalFeatures');
    const out = resolveOptionalRefs([{ type: 'refOptionalfeature', optionalfeature: 'Nope|XXX' }], {});
    expect(out[0].type).toBe('refOptionalfeature');
  });
});
