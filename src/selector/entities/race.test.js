import { describe, it, expect } from 'vitest';
import raceEntity from './race';
import { applyFilters } from '../filterModel';
import { elfSpecies } from '../../engine/fixtures/speciesData';

// Minimal flying race (real shape) to test the Fly filter.
const aarakocra = {
  name: 'Aarakocra',
  source: 'XPHB',
  size: ['M'],
  speed: { walk: 30, fly: 50 },
};

describe('raceEntity.precompute', () => {
  it('Elf (XPHB): size, speed and traits as stable keys', () => {
    const p = raceEntity.precompute(elfSpecies);
    expect(p.searchText).toContain('elf');
    expect(p.filterValues.size).toEqual(['M']);
    expect(p.filterValues.speed).toEqual(['walk']); // speed 30, no fly
    expect(p.filterValues.trait).toContain('darkvision'); // darkvision 60
    expect(p.filterValues.trait).toContain('skill-proficiency'); // skillProficiencies
  });

  it('flying race marks fly under speed (not duplicated in traits)', () => {
    const p = raceEntity.precompute(aarakocra);
    expect(p.filterValues.speed).toContain('fly');
    expect(p.filterValues.trait).not.toContain('fly');
  });
});

describe('species selector - end to end (precompute → filter)', () => {
  const raw = [elfSpecies, aarakocra];
  const items = raw.map((r) => ({ id: raceEntity.idOf(r), raw: r, ...raceEntity.precompute(r) }));

  it('including "fly" returns only the Aarakocra', () => {
    const out = applyFilters(items, { filterState: { speed: { fly: 'include' } } });
    expect(out.map((i) => i.id)).toEqual(['Aarakocra|XPHB']);
  });

  it('excluding "fly" returns only the Elf', () => {
    const out = applyFilters(items, { filterState: { speed: { fly: 'exclude' } } });
    expect(out.map((i) => i.id)).toEqual(['Elf|XPHB']);
  });
});

describe('variantes de CENÁRIO (engine/settingSpecies)', () => {
  const zendikarElf = { name: 'Elf (Zendikar)', source: 'PSZ', size: ['M'], speed: 30 };
  const lorwynElf = { name: 'Elf', source: 'LFL', size: ['M'], speed: 30 };
  const raw = [elfSpecies, zendikarElf, lorwynElf];
  const items = raw.map((r) => ({ id: raceEntity.idOf(r), raw: r, ...raceEntity.precompute(r) }));

  it('só a Plane Shift é marcada como variante', () => {
    expect(raceEntity.precompute(zendikarElf).filterValues.variant).toEqual(['setting']);
    expect(raceEntity.precompute(lorwynElf).filterValues.variant).toEqual([]);
    expect(raceEntity.precompute(elfSpecies).filterValues.variant).toEqual([]);
  });

  it('o padrão da entity esconde a variante e preserva o resto', () => {
    const out = applyFilters(items, { filterState: raceEntity.initialFilterState });
    expect(out.map((i) => i.id)).toEqual(['Elf|XPHB', 'Elf|LFL']);
  });

  it('sem o filtro (o usuário o removeu) todas voltam', () => {
    expect(applyFilters(items, { filterState: {} })).toHaveLength(3);
  });

  it('a lista não oferece as espécies vazias', () => {
    const db = {
      races: {
        race: [
          { name: 'Human', source: 'XPHB' },
          { name: 'Human (Ixalan)', source: 'PSX' },
          { name: 'Human (Kaladesh)', source: 'PSK' },
          { name: 'Human (Zendikar)', source: 'PSZ' },
          { name: 'Human (Innistrad)', source: 'PSI' },
        ],
      },
    };
    expect(raceEntity.list(db).map(raceEntity.idOf)).toEqual([
      'Human|XPHB',
      'Human (Innistrad)|PSI', // vazia na base, mas tem linhagens com conteúdo
    ]);
  });
});

describe('raceEntity.card', () => {
  it('badges show human-readable labels, not keys', () => {
    const badges = raceEntity.card(elfSpecies).badges;
    expect(badges).toContain('Darkvision'); // not 'darkvision'
  });
});
