// =============================================================================
// portraitSuggestions.test: testes da extração de tags e ranqueamento
// =============================================================================
// O QUE FAZ
//   Cobre portraitUrlFromHash, speciesTagsOf, classTagsOf, equipmentTagsOf,
//   identityTagsOf, characterPortraitTags e rankPortraits.
//
// FUNÇÕES
//   (nenhuma: suíte Vitest).
//
// DECISÕES E ARMADILHAS
//   - Verifica explicitamente que um retrato de outra espécie incompatível ou do
//     gênero oposto perde para um retrato da espécie e gênero corretos mesmo que o
//     incompatível tenha mais armas em comum.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  portraitUrlFromHash,
  speciesTagsOf,
  classTagsOf,
  equipmentTagsOf,
  identityTagsOf,
  characterPortraitTags,
  tagCategoryOf,
  tagLabelOf,
  rankPortraits,
} from './portraitSuggestions';

describe('portraitSuggestions', () => {
  it('reconstrói a URL da CDN do Pinterest a partir do hash de 32 caracteres', () => {
    const hash = 'abcdef0123456789abcdef0123456789';
    expect(portraitUrlFromHash(hash)).toBe(
      'https://i.pinimg.com/736x/ab/cd/ef/abcdef0123456789abcdef0123456789.jpg',
    );
    expect(portraitUrlFromHash('curto')).toBe('');
  });

  it('extrai tags de espécie e linhagem incluindo a espécie pai', () => {
    expect(speciesTagsOf({ id: 'Elf', lineage: 'Elf; Drow Lineage' })).toEqual(['drow', 'elf']);
    expect(speciesTagsOf({ id: 'Dragonborn', lineage: 'Dragonborn (Red)' })).toEqual([
      'red-dragonborn',
      'dragonborn',
    ]);
    expect(speciesTagsOf({ id: 'Tiefling', lineage: 'Tiefling; Winged Legacy' })).toEqual([
      'winged-tiefling',
      'tiefling',
    ]);
    expect(speciesTagsOf({ id: 'Deep Gnome', lineage: null })).toEqual(['deep-gnome', 'gnome']);
  });

  it('extrai tags de classe e subclasse mapeando shortNames do 5etools', () => {
    const classes = [
      { classId: 'warlock', subclassId: 'Hexblade' },
      { classId: 'paladin', subclassId: 'Vengeance' },
    ];
    expect(classTagsOf(classes)).toEqual([
      'hexblade',
      'warlock',
      'vengeance-paladin',
      'paladin',
    ]);
  });

  it('extrai tags de armadura, armas e focos a partir do inventário', () => {
    const inv = [
      { itemId: 'Plate Armor', equipped: true, quantity: 1 },
      { itemId: 'Greatsword', equipped: true, quantity: 1 },
      { itemId: 'Holy Symbol', equipped: true, quantity: 1 },
    ];
    expect(equipmentTagsOf(inv, [{ classId: 'paladin' }])).toEqual([
      'heavy-armor',
      'greatsword',
      'holy-symbol',
    ]);

    expect(
      equipmentTagsOf(
        [
          { itemId: 'Half Plate Armor', equipped: true, quantity: 1 },
          { itemId: 'Longbow', equipped: true, quantity: 1 },
        ],
        [{ classId: 'ranger' }],
      ),
    ).toEqual(['medium-armor', 'bow']);

    expect(
      equipmentTagsOf(
        [{ itemId: 'Studded Leather Armor', equipped: true, quantity: 1 }],
        [{ classId: 'rogue' }],
      ),
    ).toEqual(['light-armor']);

    expect(equipmentTagsOf([], [{ classId: 'wizard' }])).toEqual(['robes']);
  });

  it('extrai tags de identidade quando idade ou gênero são informados', () => {
    expect(identityTagsOf({ age: '19', appearance: 'Young female mage' })).toEqual([
      'young',
      'female',
    ]);
    expect(identityTagsOf({ age: '70', appearance: 'Grizzled bearded veteran' })).toEqual([
      'mature',
      'male',
    ]);
  });

  it('combina todas as tags da ficha sem duplicatas em characterPortraitTags', () => {
    const ch = {
      identity: { age: '20', appearance: 'Female adventurer' },
      species: { id: 'Tiefling', lineage: 'Tiefling; Infernal Legacy' },
      classes: [{ classId: 'warlock', subclassId: 'Hexblade' }],
      inventory: [{ itemId: 'Longsword', equipped: true, quantity: 1 }],
    };
    expect(characterPortraitTags(ch)).toEqual([
      'young',
      'female',
      'tiefling',
      'hexblade',
      'warlock',
      'longsword',
    ]);
  });

  it('classifica e formata rótulos de tags corretamente', () => {
    expect(tagCategoryOf('female')).toBe('gender');
    expect(tagCategoryOf('medium-armor')).toBe('armor');
    expect(tagCategoryOf('drow')).toBe('lineage');
    expect(tagCategoryOf('tiefling')).toBe('species');
    expect(tagCategoryOf('hexblade')).toBe('subclass');
    expect(tagCategoryOf('warlock')).toBe('class');
    expect(tagCategoryOf('greatsword')).toBe('weapon');
    expect(tagLabelOf('high-elf')).toBe('High Elf');
    expect(tagLabelOf('yuan-ti')).toBe('Yuan-Ti');
  });

  it('ranqueia priorizando espécie e gênero corretos e penalizando incompatíveis', () => {
    const mockIndex = {
      tags: ['female', 'male', 'human', 'tiefling', 'warlock', 'hexblade', 'longsword', 'light-armor'],
      items: [
        ['11111111111111111111111111111111', [1, 2, 4, 5, 6, 7]],
        ['22222222222222222222222222222222', [0, 3, 4]],
        ['33333333333333333333333333333333', [0, 3, 4, 5, 6]],
      ],
    };

    const res = rankPortraits(mockIndex, ['female', 'tiefling', 'warlock', 'hexblade', 'longsword']);
    expect(res.items.map((x) => x.hash)).toEqual([
      '33333333333333333333333333333333',
      '22222222222222222222222222222222',
    ]);
  });
});
