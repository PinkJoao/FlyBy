import { describe, it, expect } from 'vitest';
import { resolveSubclassEntries } from './subclassPreview';

// db mínimo no formato do 5etools: a subclasse referencia features por string, e
// uma feature de nível 3 inclui sub-features via `refSubclassFeature`.
const db = {
  'class-fighter': {
    subclassFeature: [
      {
        name: 'Battle Master',
        subclassShortName: 'Battle Master',
        subclassSource: 'XPHB',
        level: 3,
        entries: [
          'Intro text.',
          { type: 'refSubclassFeature', subclassFeature: 'Combat Superiority|Fighter|XPHB|Battle Master|XPHB|3' },
        ],
      },
      {
        name: 'Combat Superiority',
        subclassShortName: 'Battle Master',
        subclassSource: 'XPHB',
        level: 3,
        entries: ['You learn maneuvers fueled by Superiority Dice.'],
      },
      {
        name: 'Know Your Enemy',
        subclassShortName: 'Battle Master',
        subclassSource: 'XPHB',
        level: 7,
        entries: ['You can study another creature.'],
      },
    ],
  },
};

const subclass = {
  shortName: 'Battle Master',
  source: 'XPHB',
  subclassFeatures: [
    'Battle Master|Fighter|XPHB|Battle Master|XPHB|3',
    'Know Your Enemy|Fighter|XPHB|Battle Master|XPHB|7',
  ],
};

describe('resolveSubclassEntries', () => {
  it('separa refSubclassFeature DIRETOS em features próprias (não empacota)', () => {
    const out = resolveSubclassEntries(db, 'fighter', subclass);
    // A umbrella "Battle Master" vira um card só com a intro; Combat Superiority
    // é uma feature à parte, no mesmo nível (como as de níveis maiores).
    expect(out.map((s) => s.name)).toEqual([
      'Level 3: Battle Master',
      'Level 3: Combat Superiority',
      'Level 7: Know Your Enemy',
    ]);
    expect(out[0].entries).toEqual(['Intro text.']); // umbrella = só a intro
    expect(out[1].entries[0]).toMatch(/Superiority Dice/);
  });

  it('não duplica uma feature que também está no topo da subclasse', () => {
    const withDup = {
      ...subclass,
      subclassFeatures: [
        ...subclass.subclassFeatures,
        'Combat Superiority|Fighter|XPHB|Battle Master|XPHB|3',
      ],
    };
    const names = resolveSubclassEntries(db, 'fighter', withDup).map((s) => s.name);
    // Aparece UMA vez (via ref direto da umbrella; o ref de topo é pulado por `seen`).
    expect(names.filter((n) => n === 'Level 3: Combat Superiority')).toHaveLength(1);
  });

  it('returns [] when data missing', () => {
    expect(resolveSubclassEntries({}, 'fighter', subclass)).toEqual([]);
    expect(resolveSubclassEntries(db, 'fighter', {})).toEqual([]);
  });

  // Regressão: features que são STUBS `_copy` (corpo vazio herdado de outra) -
  // caso das domains de clérigo XPHB, que copiam o texto das versões PHB.
  it('resolves _copy stub features (empty body inherited from another)', () => {
    const copyDb = {
      'class-cleric': {
        subclassFeature: [
          // corpo real (nível 1, fonte PHB)
          {
            name: 'Nature Domain',
            source: 'PHB',
            classSource: 'PHB',
            subclassShortName: 'Nature',
            subclassSource: 'PHB',
            level: 1,
            entries: ['Gods of nature are varied.'],
          },
          // stub _copy (nível 3, XPHB) sem entries → herda do corpo acima
          {
            name: 'Nature Domain',
            source: 'PHB',
            classSource: 'XPHB',
            subclassShortName: 'Nature',
            subclassSource: 'PHB',
            level: 3,
            _copy: {
              name: 'Nature Domain',
              source: 'PHB',
              classSource: 'PHB',
              subclassShortName: 'Nature',
              subclassSource: 'PHB',
              level: 1,
            },
          },
        ],
      },
    };
    const nature = {
      shortName: 'Nature',
      source: 'PHB',
      subclassFeatures: ['Nature Domain|Cleric|XPHB|Nature||3'],
    };
    const out = resolveSubclassEntries(copyDb, 'cleric', nature);
    expect(out).toHaveLength(1);
    expect(out[0].entries).toEqual(['Gods of nature are varied.']);
  });
});

describe('nível herdado da umbrella (TC-0045)', () => {
  // Subclasse legada num chassi 2024: o stub `_copy` reaponta a umbrella para o
  // nível 3, mas os refSubclassFeature dentro dela seguem apontando as
  // sub-features no nível 2 original.
  const legacyDb = {
    'class-wizard': {
      subclassFeature: [
        {
          name: 'School of Conjuration',
          subclassShortName: 'Conjuration',
          subclassSource: 'PHB',
          level: 2,
          entries: [
            'As a conjurer, you favor spells that produce objects.',
            { type: 'refSubclassFeature', subclassFeature: 'Minor Conjuration|Wizard||Conjuration||2' },
          ],
        },
        {
          name: 'Minor Conjuration',
          subclassShortName: 'Conjuration',
          subclassSource: 'PHB',
          level: 2,
          entries: ['You conjure an inanimate object.'],
        },
        {
          name: 'School of Conjuration',
          subclassShortName: 'Conjuration',
          subclassSource: 'PHB',
          classSource: 'XPHB',
          level: 3,
          _copy: {
            name: 'School of Conjuration',
            subclassShortName: 'Conjuration',
            subclassSource: 'PHB',
            level: 2,
          },
        },
      ],
    },
  };

  it('a sub-feature inlinada herda o nível da umbrella reapontada', () => {
    const conjuration = {
      shortName: 'Conjuration',
      source: 'PHB',
      subclassFeatures: ['School of Conjuration|Wizard|XPHB|Conjuration||3'],
    };
    const out = resolveSubclassEntries(legacyDb, 'wizard', conjuration);
    expect(out.map((f) => f.name)).toEqual([
      'Level 3: School of Conjuration',
      'Level 3: Minor Conjuration', // era "Level 2" antes do fix
    ]);
  });

  it('na cadeia legada original os níveis continuam sendo os próprios', () => {
    const conjuration = {
      shortName: 'Conjuration',
      source: 'PHB',
      subclassFeatures: ['School of Conjuration|Wizard||Conjuration||2'],
    };
    const out = resolveSubclassEntries(legacyDb, 'wizard', conjuration);
    expect(out.map((f) => f.name)).toEqual([
      'Level 2: School of Conjuration',
      'Level 2: Minor Conjuration',
    ]);
  });
});
