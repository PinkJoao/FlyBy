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
//   feet(v): o número de um deslocamento.
//   signed(n), SKILL_NAME(k): o "+2" e o nome da perícia com maiúsculas.
//   traitList(list, key), statBlockEntries(m): o bloco de estatísticas inteiro como entradas do 5etools (atributos,
//     salvaguardas, perícias, defesas, sentidos, idiomas, traços e ações), lido pelo DetailView (DDL-0281).
//   pickCreature(list, name, source): a criatura de uma menção `{@creature Nome|Fonte}`, ou null.
//   creatureCard(m, opts): o cartão (fonte abaixo do nome, linha de CA, PV e passo,
//     etiquetas de ND, tamanho, tipo e deslocamentos extras); `beastFormEntity` é a
//     mesma entity sem o tipo, para as formas que são sempre feras (DDL-0197).
//
// DECISÕES E ARMADILHAS
//   - O 5etools escreve tipo, ND, CA e PV de mais de um jeito (texto ou objeto,
//     `{ special }` nos summons, "11 + the spell's level"): as funções aceitam todos
//     e mostram o `special` como texto, sem inventar número.
//   - A lista resolve o `_copy` (o Hound of Ill Omen é cópia do Dire Wolf) e sai pelo latestOnly (a criatura de 2024 esconde a de 2014 do mesmo
//     nome) e é calculada uma vez por db (LIST_CACHE), como as outras entities.
//   - O bloco (DDL-0281, pedido do dono: ver o Vestige Companion da feature, o Riding Horse do Phantom Steed) é o da
//     criatura como o livro o dá, sem o contexto de quem invoca: "13 + your Charisma modifier" fica em texto; os
//     números do invocador são da aba Summons e do PDF (creatureModel). As versões (`_versions`) não são abertas.
//   - O cartão segue o contrato dos outros seletores (DDL-0197): a fonte vai no
//     `subtitle` com o nome por extenso no hover, o resto em `meta` e `badges`;
//     nada é escrito à mão no título.
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';
import { resolveCopies } from '../copy';
import { sourceName } from '../../engine/sourceNames';

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
  return typeof t === 'object' && t ? (t.choose ?? []).map(cap).join(' or ') : cap(t);
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

const EXTRA_SPEEDS = ['fly', 'swim', 'climb', 'burrow'];

/** O número de um deslocamento (número ou { number }). */
const feet = (v) => (typeof v === 'object' && v ? v.number : v);

/**
 * O cartão no formato dos outros seletores: fonte abaixo do nome, CA, PV e passo na
 * linha de baixo, e as etiquetas do ND, do tamanho, do tipo e dos deslocamentos extras.
 */
export function creatureCard(m, { showType = true } = {}) {
  const sp = m?.speed ?? {};
  const walk = feet(sp.walk);
  const a = (m?.ac ?? [])[0];
  const ac = typeof a === 'number' ? a : a?.ac ?? null;
  return {
    title: m.name,
    subtitle: m.source,
    subtitleFull: sourceName(m.source),
    meta: [ac != null && `AC ${ac}`, m?.hp?.average != null && `${m.hp.average} HP`, walk && `${walk} ft.`].filter(Boolean).join(' · '),
    badges: [
      m.cr != null ? `CR ${crText(m.cr)}` : null,
      sizeOf(m).join('/'),
      showType ? typeOf(m) : null,
      ...EXTRA_SPEEDS.filter((k) => sp[k]).map((k) => (feet(sp[k]) && feet(sp[k]) !== true ? `${cap(k)} ${feet(sp[k])} ft.` : cap(k))),
    ].filter(Boolean),
  };
}

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const signed = (n) => (n >= 0 ? `+${n}` : String(n));
const SKILL_NAME = (k) => k.replace(/(^|\s)\w/g, (c) => c.toUpperCase());

/** Uma lista de defesas do 5etools (texto ou `{ resist: [...], note }`) em uma linha. */
export function traitList(list, key) {
  return (list ?? []).map((x) => {
    if (typeof x === 'string') return cap(x);
    if (x?.special) return x.special;
    const inner = traitList(x?.[key] ?? [], key);
    return [x?.preNote, inner, x?.note].filter(Boolean).join(' ');
  }).filter(Boolean).join('; ');
}

/** O bloco de estatísticas como entradas do 5etools, para a prévia da criatura. */
export function statBlockEntries(m) {
  if (!m) return [];
  const scores = ABILITIES.map((a) => {
    const v = typeof m[a] === 'number' ? m[a] : null;
    return v == null ? '-' : `${v} (${signed(Math.floor((v - 10) / 2))})`;
  });
  const lines = [
    [`${sizeOf(m).join(' or ')} ${typeOf(m)}`.trim(), ''],
    ['Saving Throws', Object.entries(m.save ?? {}).map(([k, v]) => `${cap(k)} ${v}`).join(', ')],
    ['Skills', Object.entries(m.skill ?? {}).filter(([, v]) => typeof v === 'string').map(([k, v]) => `${SKILL_NAME(k)} ${v}`).join(', ')],
    ['Vulnerabilities', traitList(m.vulnerable, 'vulnerable')],
    ['Resistances', traitList(m.resist, 'resist')],
    ['Immunities', [traitList(m.immune, 'immune'), traitList(m.conditionImmune, 'conditionImmune')].filter(Boolean).join('; ')],
    ['Senses', [...(m.senses ?? []).map(cap), m.passive != null ? `Passive Perception ${m.passive}` : null].filter(Boolean).join(', ')],
    ['Languages', (m.languages ?? []).join(', ')],
    ['Challenge', m.cr != null ? `${crText(m.cr)}${m.pbNote ? ` (Proficiency Bonus ${m.pbNote})` : ''}` : ''],
  ].filter(([, v], i) => i === 0 || v);
  const out = [
    { type: 'table', colLabels: ABILITIES.map((a) => a.toUpperCase()), rows: [scores] },
    ...lines.map(([k, v]) => (v ? `{@b ${k}} ${v}` : `{@i ${k}}`)),
  ];
  const section = (name, list) => (list?.length ? [`{@b ${name}}`, ...list.map((e) => ({ type: 'entries', name: e.name ?? '', entries: e.entries ?? [] }))] : []);
  return [
    ...out,
    ...section('Traits', m.trait),
    ...section('Actions', m.action),
    ...section('Bonus Actions', m.bonus),
    ...section('Reactions', m.reaction),
    ...section('Legendary Actions', m.legendary),
  ];
}

/** A criatura de uma menção (nome e fonte; sem a fonte, a mais nova de mesmo nome), ou null. */
export function pickCreature(list, name, source) {
  const n = String(name ?? '').trim().toLowerCase();
  const same = (list ?? []).filter((m) => String(m.name ?? '').toLowerCase() === n);
  if (!same.length) return null;
  const src = String(source ?? '').toLowerCase();
  return same.find((m) => String(m.source ?? '').toLowerCase() === src) ?? latestOnly(same)[0] ?? same[0];
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
  entries: (m) => statBlockEntries(m),
  cardShape: { subtitle: true, meta: 1, tags: 2 },
  card: (m) => creatureCard(m),
};

/** A entity das formas de fera (Wild Shape, Polymorph): o mesmo seletor, sem o tipo, que é sempre Beast. */
export const beastFormEntity = {
  ...creatureEntity,
  card: (m) => creatureCard(m, { showType: false }),
  filters: creatureEntity.filters.filter((x) => x.id !== 'type'),
};

export default creatureEntity;
