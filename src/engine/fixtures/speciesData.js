// =============================================================================
// speciesData: fixtures de espécie e subclasse para os testes
// =============================================================================
// O QUE FAZ
//   elfSpecies: o Elfo XPHB na forma real (perícia à escolha, darkvision, traços
//   nomeados). archfeySubclass: a The Archfey do Warlock, com refs por nível.
// -----------------------------------------------------------------------------

export const elfSpecies = {
  name: 'Elf',
  source: 'XPHB',
  size: ['M'],
  speed: 30,
  darkvision: 60,
  traitTags: ['Improved Resting'],
  skillProficiencies: [{ choose: { from: ['insight', 'perception', 'survival'] } }],
  entries: [
    { type: 'entries', name: 'Darkvision', entries: ['...'] },
    { type: 'entries', name: 'Fey Ancestry', entries: ['...'] },
    { type: 'entries', name: 'Keen Senses', entries: ['...'] },
    { type: 'entries', name: 'Trance', entries: ['...'] },
  ],
};

export const archfeySubclass = {
  name: 'The Archfey',
  shortName: 'Archfey',
  source: 'PHB',
  className: 'Warlock',
  subclassFeatures: [
    'The Archfey|Warlock||Archfey||1',
    'Misty Escape|Warlock||Archfey||6',
    'Beguiling Defenses|Warlock||Archfey||10',
    'Dark Delirium|Warlock||Archfey||14',
  ],
};
