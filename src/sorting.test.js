// =============================================================================
// sorting.test: a ordenação do botão de ordenar
// =============================================================================
// O QUE FAZ
//   nextSort (outra opção começa na direção natural, a mesma inverte), dirLabel,
//   e sortList: por chave nos dois sentidos, vazio sempre no fim, empate pelo
//   nome, e a opção sem chave (ordem natural) que só inverte.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { NAME_SORT, nextSort, dirLabel, sortList } from './sorting';

const WEIGHT = { value: 'weight', label: 'Weight', defaultDir: 'desc', keyOf: (r) => r.weight };

describe('nextSort', () => {
  it('outra opção começa na direção natural dela', () => {
    expect(nextSort({ value: 'name', dir: 'desc' }, WEIGHT)).toEqual({ value: 'weight', dir: 'desc' });
    expect(nextSort({ value: 'weight', dir: 'desc' }, NAME_SORT)).toEqual({ value: 'name', dir: 'asc' });
  });

  it('a mesma opção de novo inverte', () => {
    expect(nextSort({ value: 'weight', dir: 'desc' }, WEIGHT)).toEqual({ value: 'weight', dir: 'asc' });
  });
});

describe('dirLabel', () => {
  it('usa os rótulos da opção, ou os numéricos', () => {
    expect(dirLabel(NAME_SORT, 'desc')).toBe('Z to A');
    expect(dirLabel(WEIGHT, 'asc')).toBe('Low to high');
  });
});

describe('sortList', () => {
  const list = [
    { name: 'Rope', weight: 10 },
    { name: 'Ration' },
    { name: 'Anvil', weight: 50 },
    { name: 'Bell', weight: 10 },
  ];

  it('ordena pela chave nos dois sentidos, com o vazio sempre no fim', () => {
    expect(sortList(list, { option: WEIGHT, dir: 'desc' }).map((x) => x.name)).toEqual(['Anvil', 'Bell', 'Rope', 'Ration']);
    expect(sortList(list, { option: WEIGHT, dir: 'asc' }).map((x) => x.name)).toEqual(['Bell', 'Rope', 'Anvil', 'Ration']);
  });

  it('pelo nome, de A a Z e de Z a A', () => {
    expect(sortList(list, { option: NAME_SORT, dir: 'asc' }).map((x) => x.name)).toEqual(['Anvil', 'Bell', 'Ration', 'Rope']);
    expect(sortList(list, { option: NAME_SORT, dir: 'desc' }).map((x) => x.name)).toEqual(['Rope', 'Ration', 'Bell', 'Anvil']);
  });

  it('a opção sem chave mantém a ordem natural e só inverte', () => {
    const natural = { value: 'natural', label: 'Rules first', defaultDir: 'asc' };
    expect(sortList(list, { option: natural, dir: 'asc' })).toBe(list);
    expect(sortList(list, { option: natural, dir: 'desc' }).map((x) => x.name)).toEqual(['Bell', 'Anvil', 'Ration', 'Rope']);
  });

  it('lê o raw de um item embrulhado', () => {
    const wrapped = list.map((raw) => ({ raw }));
    expect(sortList(wrapped, { option: WEIGHT, dir: 'desc', rawOf: (x) => x.raw }).map((x) => x.raw.name)[0]).toBe('Anvil');
  });

  it('"+1 Arrow" ordena como "Arrow +1", ao lado da flecha comum, inclusive no desempate', () => {
    const shop = [{ name: '+1 Arrow', weight: 1 }, { name: 'Battleaxe', weight: 1 }, { name: 'Arrow', weight: 1 }, { name: '+2 Arrow', weight: 1 }];
    expect(sortList(shop, { option: NAME_SORT, dir: 'asc' }).map((x) => x.name)).toEqual(['Arrow', '+1 Arrow', '+2 Arrow', 'Battleaxe']);
    expect(sortList(shop, { option: WEIGHT, dir: 'asc' }).map((x) => x.name)).toEqual(['Arrow', '+1 Arrow', '+2 Arrow', 'Battleaxe']);
  });
});
