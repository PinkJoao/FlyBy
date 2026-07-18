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

describe('raceEntity.card', () => {
  it('badges show human-readable labels, not keys', () => {
    const badges = raceEntity.card(elfSpecies).badges;
    expect(badges).toContain('Darkvision'); // not 'darkvision'
  });
});
