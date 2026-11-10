// =============================================================================
// creature: a entity das criaturas do bestiário (summons, formas, encontros)
// =============================================================================
// O QUE FAZ
//   Lista as criaturas do `db.bestiary` (o pacote do SRD, ou o bestiário baixado
//   sob demanda por data/bestiary.js) para o painel seletor: a forma de um
//   familiar, as formas conhecidas do Wild Shape, os monstros do FlyBy do mestre
//   (DDL-0173, DDL-0188). Filtros por tipo, nível de desafio, tamanho, ambiente e
//   fonte; ordem natural pelo nível de desafio. A prévia é CA, PV e deslocamento.
//
// FUNÇÕES
//   crValue(cr): o nível de desafio como número (1/4 vira 0.25), ou null.
//   crText(cr): o nível de desafio como texto ("1/4").
//   typeOf(m): o tipo da criatura com a primeira maiúscula ("Beast").
//   sizeOf(m): os tamanhos por extenso ("Medium").
//   acText(m), hpText(m), speedText(m): os números da prévia.
//   cap(s): a primeira letra maiúscula.
//
// DECISÕES E ARMADILHAS
//   - O 5etools escreve tipo, ND, CA e PV de mais de um jeito (texto ou objeto,
//     `{ special }` nos summons, "11 + the spell's level"): as funções aceitam todos
//     e mostram o `special` como texto, sem inventar número.
//   - A lista resolve o `_copy` (o Hound of Ill Omen é cópia do Dire Wolf) e sai pelo latestOnly (a criatura de 2024 esconde a de 2014 do mesmo
//     nome) e é calculada uma vez por db (LIST_CACHE), como as outras entities.
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';
import { resolveCopies } from '../copy';

const SIZE = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };
const SIZE_RANK = { Tiny: 0, Small: 1, Medium: 2, Large: 3, Huge: 4, Gargantuan: 5 };
const LIST_CACHE = new WeakMap();
const cap = (s) => String(s ?? '').replace(/^./, (c) => c.toUpperCase());

/** O nível de desafio como número (1/4 vira 0.25), ou null. */
export function crValue(cr) {
  const s = String(typeof cr === 'object' && cr ? cr.cr : cr ?? '').trim();
  if (!s) return null;
  if (s.includes('/')) {
    const [a, b] = s.split('/').map(Number);
    return b ? a / b : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** O nível de desafio como texto ("1/4"). */
export function crText(cr) {
  return String(typeof cr === 'object' && cr ? cr.cr : cr ?? '');
}

/** O tipo com a primeira maiúscula ("Beast"). */
export function typeOf(m) {
  const t = typeof m?.type === 'object' && m.type ? m.type.type : m?.type;
  return cap(typeof t === 'object' && t ? (t.choose ?? []).join(' or ') : t);
}

/** Os tamanhos por extenso ("Medium"). */
export function sizeOf(m) {
  return (m?.size ?? []).map((s) => SIZE[s] ?? s);
}

/** A CA como texto (o `special` dos summons vai como está). */
export function acText(m) {
  const a = (m?.ac ?? [])[0];
  if (a == null) return '';
  if (typeof a === 'number') return String(a);
  return a.special ?? (a.ac != null ? `${a.ac}${a.from ? ` (${a.from.join(', ').replace(/[{]@[a-z]+ ([^|}]+)[^}]*[}]/gi, '$1')})` : ''}` : '');
}

/** Os PV como texto ("22 (4d8 + 4)", ou o `special`). */
export function hpText(m) {
  const h = m?.hp;
  if (!h) return '';
  if (h.special) return h.special;
  return h.formula ? `${h.average} (${h.formula})` : String(h.average ?? '');
}

/** O deslocamento como texto ("30 ft., climb 30 ft."). */
export function speedText(m) {
  const sp = m?.speed ?? {};
  return Object.entries(sp)
    .filter(([k]) => k !== 'canHover' && k !== 'choose')
    .map(([k, v]) => {
      const n = typeof v === 'object' ? v.number : v;
      return k === 'walk' ? `${n} ft.` : `${k} ${n} ft.`;
    })
    .join(', ');
}

const creatureEntity = {
  type: 'creature',
  title: 'Creature',
  list: (db) => {
    if (!db) return [];
    if (!LIST_CACHE.has(db)) LIST_CACHE.set(db, latestOnly(resolveCopies(db.bestiary?.monster ?? [])));
    return LIST_CACHE.get(db);
  },
  naturalSort: {
    value: 'cr',
    label: 'Challenge',
    defaultDir: 'asc',
    dirLabels: ['Lowest first', 'Highest first'],
    keyOf: (m) => crValue(m.cr) ?? -1,
  },
  sorts: [
    { value: 'size', label: 'Size', defaultDir: 'asc', keyOf: (m) => SIZE_RANK[sizeOf(m)[0]] ?? -1 },
  ],
  idOf: (m) => `${m.name}|${m.source}`,
  precompute: (m) => ({
    searchText: `${m.name} ${typeOf(m)} ${m.source}`.toLowerCase(),
    filterValues: {
      type: [typeOf(m)].filter(Boolean),
      cr: [crText(m.cr)].filter(Boolean),
      size: sizeOf(m),
      environment: (m.environment ?? []).map(cap),
      source: [m.source].filter(Boolean),
    },
  }),
  filters: [
    { id: 'type', header: 'Type', derive: true },
    { id: 'cr', header: 'Challenge', derive: true },
    { id: 'size', header: 'Size', options: Object.values(SIZE).map((s) => ({ value: s, label: s })) },
    { id: 'environment', header: 'Environment', derive: true },
    { id: 'source', header: 'Source', derive: true },
  ],
  meta: (m) => [
    { label: 'Armor Class', value: acText(m) },
    { label: 'Hit Points', value: hpText(m) },
    { label: 'Speed', value: speedText(m) },
  ].filter((x) => x.value),
  card: (m) => ({
    title: m.name,
    subtitle: `${m.cr != null ? `CR ${crText(m.cr)} · ` : ''}${sizeOf(m).join('/')} ${typeOf(m)} · ${m.source}`.trim(),
    badges: [],
  }),
};

export default creatureEntity;
