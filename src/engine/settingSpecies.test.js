import { describe, it, expect } from 'vitest';
import {
  EMPTY_SPECIES,
  EMPTY_SUBRACES,
  SETTING_SOURCES,
  isEmptySpecies,
  isEmptySubrace,
  isSettingVariant,
} from './settingSpecies';

describe('isEmptySpecies', () => {
  it('reconhece as três espécies de cenário sem mecânica nenhuma', () => {
    expect(isEmptySpecies({ name: 'Human (Ixalan)', source: 'PSX' })).toBe(true);
    expect(isEmptySpecies({ name: 'Human (Kaladesh)', source: 'PSK' })).toBe(true);
    expect(isEmptySpecies({ name: 'Human (Zendikar)', source: 'PSZ' })).toBe(true);
    expect(EMPTY_SPECIES.size).toBe(3);
  });

  it('não pega uma espécie de cenário COM mecânica, nem a base 2024', () => {
    // Human (Innistrad) é vazio na base mas tem 3 linhagens com conteúdo real
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

describe('isSettingVariant', () => {
  it('marca as seis fontes Plane Shift', () => {
    expect(SETTING_SOURCES.size).toBe(6);
    for (const source of ['PSA', 'PSD', 'PSI', 'PSK', 'PSX', 'PSZ']) {
      expect(isSettingVariant({ name: 'X', source })).toBe(true);
    }
  });

  it('NÃO marca o conteúdo atual de livro, incluindo o LFL (2024)', () => {
    // LFL = "Lorwyn: First Light" (2025-11-18): livro oficial em regras 2024,
    // já no formato moderno. É espécie irmã como o Astral Elf, não variante.
    expect(isSettingVariant({ name: 'Elf', source: 'LFL' })).toBe(false);
    expect(isSettingVariant({ name: 'Kithkin', source: 'LFL' })).toBe(false);
    expect(isSettingVariant({ name: 'Elf', source: 'XPHB' })).toBe(false);
    expect(isSettingVariant({ name: 'Astral Elf', source: 'AAG' })).toBe(false);
    expect(isSettingVariant({ name: 'Vedalken', source: 'GGR' })).toBe(false);
    expect(isSettingVariant({ name: 'Dragonborn (Gem)', source: 'FTD' })).toBe(false);
    expect(isSettingVariant(null)).toBe(false);
  });
});
