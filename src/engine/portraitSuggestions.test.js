// =============================================================================
// portraitSuggestions.test: testes da extração de tags e ranqueamento
// =============================================================================
// O QUE FAZ
//   Cobre portraitUrlFromHash, speciesTagsOf, classTagsOf, armorTagsOf,
//   identityTagsOf, characterPortraitTags, rankPortraits (com o núcleo e o degrau
//   de prioridade do DDL-0137) e portraitTagGroups.
//
// FUNÇÕES
//   (nenhuma: suíte Vitest).
//
// DECISÕES E ARMADILHAS
//   - Verifica explicitamente que um retrato de outra espécie incompatível ou do
//     gênero oposto perde para um retrato da espécie e gênero corretos mesmo que o
//     incompatível tenha mais tags em comum.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  portraitUrlFromHash,
  speciesTagsOf,
  classTagsOf,
  armorTagsOf,
  portraitTagAllowed,
  identityTagsOf,
  characterPortraitTags,
  tagCategoryOf,
  tagLabelOf,
  rankPortraits,
  portraitTagGroups,
  subclassClassOf,
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

  it('extrai só a armadura do inventário (armas e focos não viram tag)', () => {
    const inv = [
      { itemId: 'Plate Armor', equipped: true, quantity: 1 },
      { itemId: 'Greatsword', equipped: true, quantity: 1 },
      { itemId: 'Holy Symbol', equipped: true, quantity: 1 },
    ];
    expect(armorTagsOf(inv, [{ classId: 'paladin' }])).toEqual(['heavy-armor']);

    expect(
      armorTagsOf(
        [
          { itemId: 'Half Plate Armor', equipped: true, quantity: 1 },
          { itemId: 'Longbow', equipped: true, quantity: 1 },
        ],
        [{ classId: 'ranger' }],
      ),
    ).toEqual(['medium-armor']);

    expect(
      armorTagsOf(
        [{ itemId: 'Studded Leather Armor', equipped: true, quantity: 1 }],
        [{ classId: 'rogue' }],
      ),
    ).toEqual(['light-armor']);

    expect(armorTagsOf([], [{ classId: 'wizard' }])).toEqual(['clothes']);
    expect(armorTagsOf([{ itemId: 'Longsword', equipped: true }], [{ classId: 'fighter' }])).toEqual(['clothes']);
    expect(armorTagsOf([], [{ classId: 'fighter' }])).toEqual([]);
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
      'clothes',
    ]);
  });

  it('classifica e formata rótulos de tags corretamente', () => {
    expect(tagCategoryOf('female')).toBe('gender');
    expect(tagCategoryOf('medium-armor')).toBe('armor');
    expect(tagCategoryOf('drow')).toBe('lineage');
    expect(tagCategoryOf('tiefling')).toBe('species');
    expect(tagCategoryOf('hexblade')).toBe('subclass');
    expect(tagCategoryOf('warlock')).toBe('class');
    expect(tagCategoryOf('clothes')).toBe('armor');
    expect(tagCategoryOf('greatsword')).toBe('equipment');
    expect(portraitTagAllowed('greatsword')).toBe(false);
    expect(portraitTagAllowed('robes')).toBe(false);
    expect(portraitTagAllowed('heavy-armor')).toBe(true);
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

  it('mapeia as subclasses legadas pelo shortName do 5etools', () => {
    expect(classTagsOf([{ classId: 'wizard', subclassId: 'Abjuration' }])).toEqual(['abjurer', 'wizard']);
    expect(classTagsOf([{ classId: 'wizard', subclassId: 'Bladesinging' }])).toEqual(['bladesinger', 'wizard']);
    expect(classTagsOf([{ classId: 'sorcerer', subclassId: 'Aberrant Mind' }])).toEqual([
      'aberrant-sorcerer',
      'sorcerer',
    ]);
    expect(classTagsOf([{ classId: 'sorcerer', subclassId: 'Wild' }])).toEqual(['wild-magic-sorcerer', 'sorcerer']);
  });

  it('resolve a espécie pai de forma transitiva e os nomes alternativos', () => {
    expect(speciesTagsOf({ id: 'flamekin', lineage: null })).toEqual(['flamekin', 'fire-genasi', 'genasi']);
    expect(speciesTagsOf({ id: 'yuan-ti pureblood', lineage: null })).toEqual(['yuan-ti']);
  });

  it('escolhe uma armadura só, a mais pesada', () => {
    const unequipped = [
      { itemId: "Traveler's Clothes", equipped: false, quantity: 1 },
      { itemId: 'Chain Mail', equipped: false, quantity: 1 },
      { itemId: 'Shortsword', equipped: false, quantity: 1 },
    ];
    expect(armorTagsOf(unequipped, [{ classId: 'fighter' }])).toEqual(['heavy-armor']);
  });

  it('não marca jovem e maduro juntos quando a idade numérica vem com texto', () => {
    expect(identityTagsOf({ age: '19 years old', appearance: '' })).toEqual(['young']);
    expect(identityTagsOf({ age: '', appearance: 'Gray skin and a calm stare', hair: 'black' })).toEqual([]);
    expect(identityTagsOf({ age: '', appearance: '', hair: 'Greying, short' })).toEqual(['mature']);
  });

  it('penaliza outra espécie mesmo quando a ativa é uma linhagem de dois níveis', () => {
    const mockIndex = {
      tags: ['flamekin', 'fire-genasi', 'genasi', 'human', 'wizard'],
      items: [
        ['11111111111111111111111111111111', [3, 4]],
        ['22222222222222222222222222222222', [2, 4]],
      ],
    };
    const res = rankPortraits(mockIndex, ['flamekin', 'wizard']);
    expect(res.items.map((x) => x.hash)).toEqual(['22222222222222222222222222222222']);
  });

  it('separa quem casa todas as tags (full) e conta só esses em fullMatched', () => {
    const mockIndex = {
      tags: ['female', 'elf', 'wizard'],
      items: [
        ['11111111111111111111111111111111', [0, 1]],
        ['22222222222222222222222222222222', [0, 1, 2]],
        ['33333333333333333333333333333333', [2]],
      ],
    };
    const res = rankPortraits(mockIndex, ['female', 'elf', 'wizard']);
    expect(res.fullMatched).toBe(1);
    expect(res.totalMatched).toBe(3);
    expect(res.items[0]).toMatchObject({ hash: '22222222222222222222222222222222', full: true });
    expect(res.items.slice(1).every((x) => !x.full)).toBe(true);
  });

  it('tag desconhecida é neutra e contradição tira da primeira faixa (DDL-0137)', () => {
    const mockIndex = {
      tags: ['female', 'male', 'elf', 'wizard', 'staff'],
      items: [
        { key: 'reddit:a', idxs: [2, 3], bucket: 5, thumb: 't', url: 'u', credit: { by: 'u/a', link: 'l' } },
        { key: 'pin:b', idxs: [0, 2, 3, 4], bucket: 1, thumb: 't', url: 'u', credit: null },
        { key: 'pin:c', idxs: [1, 2, 3, 4], bucket: 1, thumb: 't', url: 'u', credit: null },
      ],
    };
    const res = rankPortraits(mockIndex, ['female', 'elf', 'wizard', 'staff']);
    expect(res.items.map((x) => [x.hash, x.full])).toEqual([
      ['reddit:a', true],
      ['pin:b', true],
      ['pin:c', false],
    ]);
    expect(res.items[0].credit).toEqual({ by: 'u/a', link: 'l' });
    expect(res.fullMatched).toBe(2);
  });

  it('a subclasse ativa aceita a classe dona no núcleo', () => {
    const mockIndex = {
      tags: ['tiefling', 'warlock', 'hexblade'],
      items: [{ key: 'r:1', idxs: [0, 1], bucket: 4, thumb: 't', url: 'u', credit: null }],
    };
    expect(rankPortraits(mockIndex, ['tiefling', 'hexblade', 'warlock']).items[0].full).toBe(true);
  });

  it('agrupa as tags do seletor com contagem e o representante mais limpo', () => {
    const mockIndex = {
      tags: ['elf', 'human', 'drow', 'warlock', 'hexblade', 'male', 'longsword'],
      items: [
        ['11111111111111111111111111111111', [0, 1, 3]],
        ['22222222222222222222222222222222', [0, 3, 4]],
        ['33333333333333333333333333333333', [2, 0, 5, 6]],
      ],
    };
    const groups = portraitTagGroups(mockIndex);
    expect(groups.map((g) => g.id)).toEqual(['species', 'lineage', 'class', 'subclass']);
    const elf = groups[0].tags.find((t) => t.tag === 'elf');
    expect(elf.count).toBe(3);
    expect(elf.thumb).toContain('/236x/22/22/22/');
    expect(groups.find((g) => g.id === 'subclass').tags[0]).toMatchObject({ tag: 'hexblade', parent: 'warlock' });
    expect(groups.find((g) => g.id === 'lineage').tags[0].parent).toBe('elf');
    expect(portraitTagGroups(mockIndex)).toBe(groups);
    expect(subclassClassOf('battle-master')).toBe('fighter');
  });
});
