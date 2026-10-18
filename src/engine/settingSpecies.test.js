// =============================================================================
// settingSpecies.test: testes das espécies de cenário
// =============================================================================
// O QUE FAZ
//   As vazias (e o Human de Innistrad, que tem linhagens reais), a redundância do
//   Aven com a doação de arte, as variantes por colisão de nome, e o LFL e o
//   Dragonborn (Gem) que ficam fora de todas as listas.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  EMPTY_SPECIES,
  EMPTY_SUBRACES,
  SETTING_VARIANTS,
  REDUNDANT_SPECIES,
  isEmptySpecies,
  isEmptySubrace,
  isRedundantSpecies,
  isRemovedSpecies,
  isSettingVariant,
  imageDonorFor,
} from './settingSpecies';

describe('isEmptySpecies', () => {
  it('reconhece as três espécies de cenário sem mecânica nenhuma', () => {
    expect(isEmptySpecies({ name: 'Human (Ixalan)', source: 'PSX' })).toBe(true);
    expect(isEmptySpecies({ name: 'Human (Kaladesh)', source: 'PSK' })).toBe(true);
    expect(isEmptySpecies({ name: 'Human (Zendikar)', source: 'PSZ' })).toBe(true);
    expect(EMPTY_SPECIES.size).toBe(3);
  });

  it('não pega uma espécie de cenário COM mecânica, nem a base 2024', () => {
    expect(isEmptySpecies({ name: 'Human (Innistrad)', source: 'PSI' })).toBe(false);
    expect(isEmptySpecies({ name: 'Human (Keldon)', source: 'PSD' })).toBe(false);
    expect(isEmptySpecies({ name: 'Dwarf (Kaladesh)', source: 'PSK' })).toBe(false);
    expect(isEmptySpecies({ name: 'Human', source: 'XPHB' })).toBe(false);
  });

  it('a fonte faz parte da chave (nome sozinho não basta)', () => {
    expect(isEmptySpecies({ name: 'Human (Ixalan)', source: 'XPHB' })).toBe(false);
    expect(isEmptySpecies(null)).toBe(false);
    expect(isEmptySpecies({})).toBe(false);
  });
});

describe('isEmptySubrace', () => {
  it('reconhece a Gavony pela chave de 4 campos', () => {
    expect(
      isEmptySubrace({
        name: 'Gavony',
        source: 'PSI',
        raceName: 'Human (Innistrad)',
        raceSource: 'PSI',
      }),
    ).toBe(true);
    expect(EMPTY_SUBRACES.size).toBe(1);
  });

  it('não pega as irmãs de Innistrad, que têm conteúdo', () => {
    for (const name of ['Kessig', 'Nephalia', 'Stensia']) {
      expect(
        isEmptySubrace({ name, source: 'PSI', raceName: 'Human (Innistrad)', raceSource: 'PSI' }),
      ).toBe(false);
    }
  });

  it('exige a raça-mãe certa (nome+fonte da sub-raça não são únicos)', () => {
    expect(
      isEmptySubrace({ name: 'Gavony', source: 'PSI', raceName: 'Human', raceSource: 'PHB' }),
    ).toBe(false);
    expect(isEmptySubrace(null)).toBe(false);
  });
});

describe('isRedundantSpecies / imageDonorFor', () => {
  it('o Aven|PSD sai: o Aven|PSA cobre o mesmo e tem duas linhagens', () => {
    expect(isRedundantSpecies({ name: 'Aven', source: 'PSD' })).toBe(true);
    expect(isRedundantSpecies({ name: 'Aven', source: 'PSA' })).toBe(false);
    expect(REDUNDANT_SPECIES).toHaveLength(1);
  });

  it('a arte do removido vai para a linhagem que ela retrata', () => {
    expect(imageDonorFor({ name: 'Aven (Hawk-Headed)', source: 'PSA' })).toBe('Aven|PSD');
    expect(imageDonorFor({ name: 'Aven (Ibis-Headed)', source: 'PSA' })).toBe(null);
    expect(imageDonorFor({ name: 'Aven', source: 'PSA' })).toBe(null);
    expect(imageDonorFor(null)).toBe(null);
  });

  it('isRemovedSpecies junta os dois motivos de remoção', () => {
    expect(isRemovedSpecies({ name: 'Aven', source: 'PSD' })).toBe(true);
    expect(isRemovedSpecies({ name: 'Human (Ixalan)', source: 'PSX' })).toBe(true);
    expect(isRemovedSpecies({ name: 'Aven', source: 'PSA' })).toBe(false);
  });
});

describe('isSettingVariant', () => {
  it('marca só as que COLIDEM de nome com outra espécie do catálogo', () => {
    expect(SETTING_VARIANTS.size).toBe(9);
    for (const id of [
      'Dwarf (Kaladesh)|PSK',
      'Elf (Kaladesh)|PSK',
      'Elf (Zendikar)|PSZ',
      'Goblin|PSZ',
      'Human (Innistrad)|PSI',
      'Human (Keldon)|PSD',
      'Minotaur (Amonkhet)|PSA',
      'Orc (Ixalan)|PSX',
      'Vedalken|PSK',
    ]) {
      const i = id.lastIndexOf('|');
      expect(isSettingVariant({ name: id.slice(0, i), source: id.slice(i + 1) })).toBe(true);
    }
  });

  it('NÃO marca as espécies ÚNICAS de Plane Shift: elas não confundem ninguém', () => {
    const unicas = [
      ['Aetherborn', 'PSK'],
      ['Aven', 'PSA'],
      ['Khenra', 'PSA'],
      ['Kor', 'PSZ'],
      ['Merfolk', 'PSZ'],
      ['Naga', 'PSA'],
      ['Siren', 'PSX'],
      ['Vampire', 'PSZ'],
    ];
    for (const [name, source] of unicas) {
      expect(isSettingVariant({ name, source })).toBe(false);
    }
  });

  it('NÃO marca o conteúdo atual de livro, incluindo o LFL (2024)', () => {
    expect(isSettingVariant({ name: 'Elf', source: 'LFL' })).toBe(false);
    expect(isSettingVariant({ name: 'Kithkin', source: 'LFL' })).toBe(false);
    expect(isSettingVariant({ name: 'Elf', source: 'XPHB' })).toBe(false);
    expect(isSettingVariant({ name: 'Astral Elf', source: 'AAG' })).toBe(false);
    expect(isSettingVariant({ name: 'Vedalken', source: 'GGR' })).toBe(false);
    expect(isSettingVariant({ name: 'Dragonborn (Gem)', source: 'FTD' })).toBe(false);
    expect(isSettingVariant(null)).toBe(false);
  });
});
