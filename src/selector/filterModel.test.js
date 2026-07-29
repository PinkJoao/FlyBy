import { describe, it, expect } from 'vitest';
import { applyFilters, passesFilter, cycleOption, deriveOptions, facetCounts } from './filterModel';

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

describe('facetCounts', () => {
  const ids = ['size', 'trait'];

  it('conta tudo quando nada está marcado', () => {
    const c = facetCounts(items, { filterIds: ids });
    expect(c.size).toEqual({ M: 2, L: 1 });
    expect(c.trait).toEqual({ darkvision: 1, fly: 1, 'powerful-build': 1 });
  });

  it('zera a opção que nenhum item restante alcança', () => {
    // Só o goliath é Large, e ele não voa -> "fly" fica sem base.
    const c = facetCounts(items, { filterIds: ids, filterState: { size: { L: 'include' } } });
    expect(c.trait).toEqual({ 'powerful-build': 1 });
    expect(c.trait.fly).toBeUndefined();
  });

  it('ignora o estado do PRÓPRIO filtro (marcar um tamanho não mata os outros)', () => {
    const c = facetCounts(items, { filterIds: ids, filterState: { size: { L: 'include' } } });
    expect(c.size).toEqual({ M: 2, L: 1 });
  });

  it('respeita a busca textual', () => {
    const c = facetCounts(items, { filterIds: ids, query: 'elf' });
    expect(c.size).toEqual({ M: 1 });
    expect(c.trait).toEqual({ darkvision: 1 });
  });

  it('um exclude também reduz a base dos outros filtros', () => {
    const c = facetCounts(items, { filterIds: ids, filterState: { trait: { fly: 'exclude' } } });
    expect(c.size).toEqual({ M: 1, L: 1 });
  });

  it('com dois filtros ativos, cada um conta contra o outro', () => {
    const state = { size: { M: 'include' }, trait: { fly: 'include' } };
    const c = facetCounts(items, { filterIds: ids, filterState: state });
    // size conta sob "trait=fly": só o aarakocra (M).
    expect(c.size).toEqual({ M: 1 });
    // trait conta sob "size=M": elf (darkvision) e aarakocra (fly).
    expect(c.trait).toEqual({ darkvision: 1, fly: 1 });
  });
});

describe('deriveOptions', () => {
  it('collects distinct values, sorted', () => {
    expect(deriveOptions(items, 'size')).toEqual(['L', 'M']);
  });
});
