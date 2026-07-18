// =============================================================================
// Fixtures de dados de classe (mocks)
// =============================================================================
// Objetos mínimos que espelham a FORMA real do 5etools (valores tirados dos
// dados reais), para os testes rodarem offline e puros, sem redistribuir o
// dataset completo nem depender de rede.
// -----------------------------------------------------------------------------

export const fighterClassData = {
  name: 'Fighter',
  source: 'XPHB',
  hd: { number: 1, faces: 10 },
  proficiency: ['str', 'con'],
  startingProficiencies: {
    armor: ['light', 'medium', 'heavy', 'shield'],
    weapons: ['simple', 'martial'],
    skills: [
      {
        choose: {
          from: ['acrobatics', 'animal handling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'],
          count: 2,
        },
      },
    ],
  },
  subclassTitle: 'Martial Archetype',
  classFeatures: [
    'Fighting Style|Fighter||1',
    'Second Wind|Fighter||1',
    'Weapon Mastery|Fighter||1',
    'Action Surge|Fighter||2',
    'Tactical Mind|Fighter||2',
    { classFeature: 'Martial Archetype|Fighter||3', gainSubclassFeature: true },
    'Ability Score Improvement|Fighter||4',
    'Extra Attack|Fighter||5',
    'Tactical Shift|Fighter||5',
    'Ability Score Improvement|Fighter||6',
    'Indomitable|Fighter||9', // acima do nível 6 - deve ser filtrado
  ],
};

export const warlockClassData = {
  name: 'Warlock',
  source: 'XPHB',
  hd: { number: 1, faces: 8 },
  proficiency: ['wis', 'cha'],
  spellcastingAbility: 'cha',
  casterProgression: 'pact',
  startingProficiencies: {
    armor: ['light'],
    weapons: ['simple'],
    skills: [{ choose: { from: ['arcana', 'deception', 'history', 'intimidation'], count: 2 } }],
  },
  subclassTitle: 'Otherworldly Patron',
  classFeatures: [
    'Pact Magic|Warlock||1',
    { classFeature: 'Otherworldly Patron|Warlock||1', gainSubclassFeature: true },
    'Eldritch Invocations|Warlock||2',
    'Pact Boon|Warlock||3',
  ],
};

export const rogueClassData = {
  name: 'Rogue',
  source: 'XPHB',
  hd: { number: 1, faces: 8 },
  proficiency: ['dex', 'int'],
  startingProficiencies: {
    armor: ['light'],
    weapons: ['simple'],
    skills: [
      {
        choose: {
          from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight of hand', 'stealth'],
          count: 4,
        },
      },
    ],
  },
  subclassTitle: 'Roguish Archetype',
  classFeatures: [
    'Expertise|Rogue||1',
    'Sneak Attack|Rogue||1',
    "Thieves' Cant|Rogue||1",
    'Cunning Action|Rogue||2',
    { classFeature: 'Roguish Archetype|Rogue||3', gainSubclassFeature: true },
  ],
};
