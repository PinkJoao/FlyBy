import { describe, it, expect } from 'vitest';
import { applyFilters, passesFilter, cycleOption, deriveOptions } from './filterModel';

const items = [
  { id: 'elf', searchText: 'elf xphb', filterValues: { size: ['M'], trait: ['darkvision'] } },
  { id: 'aarakocra', searchText: 'aarakocra xphb', filterValues: { size: ['M'], trait: ['fly'] } },
  { id: 'goliath', searchText: 'goliath xphb', filterValues: { size: ['L'], trait: ['powerful-build'] } },
];

describe('cycleOption', () => {
  it('cicla off → include → exclude → off', () => {
    expect(cycleOption(undefined)).toBe('include');
    expect(cycleOption('include')).toBe('exclude');
    expect(cycleOption('exclude')).toBe(undefined);
  });
});

describe('passesFilter', () => {
  it('inclui por OR', () => {
    expect(passesFilter(['Voo'], { include: ['Voo'], exclude: [] })).toBe(true);
    expect(passesFilter(['Visão no Escuro'], { include: ['Voo'], exclude: [] })).toBe(false);
  });
  it('exclui sempre veta', () => {
    expect(passesFilter(['Voo'], { include: [], exclude: ['Voo'] })).toBe(false);
    expect(passesFilter(['Médio'], { include: [], exclude: ['Voo'] })).toBe(true);
  });
});

describe('applyFilters', () => {
  it('busca textual', () => {
    const out = applyFilters(items, { query: 'elf' });
    expect(out.map((i) => i.id)).toEqual(['elf']);
  });

  it('includes only flying races', () => {
    const out = applyFilters(items, { filterState: { trait: { fly: 'include' } } });
    expect(out.map((i) => i.id)).toEqual(['aarakocra']);
  });

  it('excludes flying races (DM banned flight)', () => {
    const out = applyFilters(items, { filterState: { trait: { fly: 'exclude' } } });
    expect(out.map((i) => i.id)).toEqual(['elf', 'goliath']);
  });

  it('combines filters with AND', () => {
    const out = applyFilters(items, {
      filterState: { size: { M: 'include' }, trait: { fly: 'exclude' } },
    });
    expect(out.map((i) => i.id)).toEqual(['elf']);
  });

  it('no active filters returns everything', () => {
    expect(applyFilters(items, {})).toHaveLength(3);
  });
});

describe('deriveOptions', () => {
  it('collects distinct values, sorted', () => {
    expect(deriveOptions(items, 'size')).toEqual(['L', 'M']);
  });
});
