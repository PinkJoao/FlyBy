// =============================================================================
// roster: a busca, ordenação e agrupamento do roster
// =============================================================================
// O QUE FAZ
//   Extraído da Home para ser testável sem DOM: recebe os personagens e as opções
//   da barra, e devolve grupos { key, items } (um grupo `key: null` sem
//   agrupamento).
//
// FUNÇÕES
//   cap(s), nameOf(c): texto.
//   primaryClass(c): a classe principal (a original, ou a primeira com id).
//   orderRoster(characters, opts): os grupos.
// -----------------------------------------------------------------------------

import { totalLevel } from '../schema/character';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const nameOf = (c) => c?.meta?.name || '';

/** A classe principal de um personagem. */
export function primaryClass(c) {
  const classes = c?.classes ?? [];
  const cls = classes.find((x) => x.isOriginalClass && x.classId) ?? classes.find((x) => x.classId);
  return cls?.classId ? cap(cls.classId) : 'Unclassed';
}

const SORTERS = {
  name: (a, b) => nameOf(a).localeCompare(nameOf(b)),
  level: (a, b) => totalLevel(b) - totalLevel(a) || nameOf(a).localeCompare(nameOf(b)),
  created: (a, b) => (b?.meta?.createdAt ?? 0) - (a?.meta?.createdAt ?? 0),
  class: (a, b) => primaryClass(a).localeCompare(primaryClass(b)) || nameOf(a).localeCompare(nameOf(b)),
};

/**
 * Os personagens filtrados, ordenados e agrupados.
 * @param {object[]} characters
 * @param {{ query?: string, sortBy?: string, groupBy?: string }} opts
 * @returns {Array<{ key: string|null, items: object[] }>}
 */
export function orderRoster(characters, { query = '', sortBy = 'name', groupBy = 'none' } = {}) {
  const q = query.trim().toLowerCase();
  let list = characters ?? [];
  if (q) list = list.filter((c) => nameOf(c).toLowerCase().includes(q) || (nameOf(c) === '' && 'unnamed'.includes(q)));

  const sorted = [...list].sort(SORTERS[sortBy] ?? SORTERS.name);

  if (groupBy !== 'class') return [{ key: null, items: sorted }];

  const map = new Map();
  for (const c of sorted) {
    const k = primaryClass(c);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(c);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, items]) => ({ key, items }));
}
