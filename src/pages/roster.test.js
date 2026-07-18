import { describe, it, expect } from 'vitest';
import { orderRoster, primaryClass } from './roster';

const mk = (name, opts = {}) => ({
  id: name,
  meta: { name, createdAt: opts.createdAt ?? 0 },
  classes: opts.classes ?? [],
});

const wizard5 = mk('Gandalf', { createdAt: 100, classes: [{ classId: 'wizard', level: 5, isOriginalClass: true }] });
const fighter3 = mk('Aragorn', { createdAt: 300, classes: [{ classId: 'fighter', level: 3, isOriginalClass: true }] });
const multiclass = mk('Bilbo', {
  createdAt: 200,
  classes: [
    { classId: 'rogue', level: 2, isOriginalClass: false },
    { classId: 'ranger', level: 4, isOriginalClass: true },
  ],
});
const blank = mk('', { createdAt: 50, classes: [{ classId: '', level: 1, isOriginalClass: true }] });

const all = [wizard5, fighter3, multiclass, blank];

describe('primaryClass', () => {
  it('usa a classe ORIGINAL, não a primeira do array', () => {
    expect(primaryClass(multiclass)).toBe('Ranger'); // original, mesmo vindo depois
  });
  it('capitaliza a classe', () => {
    expect(primaryClass(wizard5)).toBe('Wizard');
  });
  it('sem classe → "Unclassed"', () => {
    expect(primaryClass(blank)).toBe('Unclassed');
    expect(primaryClass({ classes: [] })).toBe('Unclassed');
  });
});

describe('orderRoster - ordenação', () => {
  it('por nome (padrão), alfabético', () => {
    const [g] = orderRoster(all, { sortBy: 'name' });
    expect(g.items.map((c) => c.meta.name)).toEqual(['', 'Aragorn', 'Bilbo', 'Gandalf']);
  });

  it('por nível, do maior p/ o menor', () => {
    const [g] = orderRoster(all, { sortBy: 'level' });
    // Gandalf 5, Bilbo 6 (2+4), Aragorn 3, blank 1
    expect(g.items.map((c) => c.meta.name)).toEqual(['Bilbo', 'Gandalf', 'Aragorn', '']);
  });

  it('por criação, mais recente primeiro', () => {
    const [g] = orderRoster(all, { sortBy: 'created' });
    expect(g.items.map((c) => c.meta.createdAt)).toEqual([300, 200, 100, 50]);
  });

  it('por classe, alfabético pela classe principal', () => {
    const [g] = orderRoster(all, { sortBy: 'class' });
    expect(g.items.map((c) => primaryClass(c))).toEqual(['Fighter', 'Ranger', 'Unclassed', 'Wizard']);
  });
});

describe('orderRoster - busca', () => {
  it('filtra por nome (case-insensitive, substring)', () => {
    const [g] = orderRoster(all, { query: 'ara' });
    expect(g.items.map((c) => c.meta.name)).toEqual(['Aragorn']);
  });
  it('sem correspondência → grupo vazio', () => {
    expect(orderRoster(all, { query: 'zzz' })[0].items).toEqual([]);
  });
});

describe('orderRoster - agrupamento', () => {
  it('none → um único grupo sem chave', () => {
    const groups = orderRoster(all, { groupBy: 'none' });
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBeNull();
  });

  it('class → um grupo por classe principal, ordenados', () => {
    const groups = orderRoster(all, { groupBy: 'class' });
    expect(groups.map((g) => g.key)).toEqual(['Fighter', 'Ranger', 'Unclassed', 'Wizard']);
    expect(groups.find((g) => g.key === 'Ranger').items.map((c) => c.meta.name)).toEqual(['Bilbo']);
  });

  it('a busca também vale ao agrupar', () => {
    const groups = orderRoster(all, { groupBy: 'class', query: 'gandalf' });
    expect(groups.map((g) => g.key)).toEqual(['Wizard']);
  });
});

describe('orderRoster - robustez', () => {
  it('lista vazia / indefinida não quebra', () => {
    expect(orderRoster([], {})).toEqual([{ key: null, items: [] }]);
    expect(orderRoster(undefined, {})).toEqual([{ key: null, items: [] }]);
  });
});
