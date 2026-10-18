// =============================================================================
// feat: a entity de talento, por categoria e ciente do personagem
// =============================================================================
// O QUE FAZ
//   Uma entity por conjunto de categorias do 5etools: O (origem), G (general),
//   FS/FS:P/FS:R (fighting styles) e EB (epic boons). Pré-requisitos aparecem no
//   card e no preview, coloridos pelo status contra o personagem (ok, bad,
//   unknown) quando recebe o `ctx` (prereqContext). Filtros: Source, Ability
//   Bonus, Prerequisites e, opcional, Category.
//
// FUNÇÕES
//   inCategories(feat, categories), filterCategories(feat): as categorias.
//   hasFreeLegacyBonus(feat): legacy sem bônus próprio (ganha +1 livre)?
//   boostableAbilities(feat), boostText(feat): o bônus de atributo.
//   makeFeatEntity(categories, title, ctx, only, opts): a fábrica.
//   Exporta FEAT_CATEGORY_TITLE (títulos por categoria) e originFeatEntity.
//
// DECISÕES E ARMADILHAS
//   - Adaptação DMG 2024 (como o Plutonium): talento LEGACY (sem categoria) conta
//     como General; legacy sem `ability` ganha um +1 livre (o ChoiceList o renderiza).
//   - O filtro de Categoria (TC-0029) existe para os slots de ASI e Epic Boon, que
//     aceitam mais de uma: a padrão vem pré-marcada pelo chamador, e as de fora
//     ganham badge.
//   - `only` restringe a nomes (o College of Swords só tem Dueling e Two-Weapon).
//   - Sem pré-requisito conta como atendido.
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';
import { evalPrereq } from '../../engine/prereq';

const ALL_ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_LABEL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const ABILITY_ABBR = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };

function inCategories(feat, categories) {
  const c = feat.category;
  if (c == null) return categories.includes('G');
  if (Array.isArray(c)) return c.some((x) => categories.includes(x));
  return categories.includes(c);
}

/** Legacy sem bônus próprio (tratado como +1 livre)? */
export function hasFreeLegacyBonus(feat) {
  return feat?.category == null && !feat?.ability;
}

/** Os atributos que o talento pode aumentar. */
function boostableAbilities(feat) {
  if (hasFreeLegacyBonus(feat)) return ALL_ABILITIES;
  const out = new Set();
  for (const entry of feat.ability ?? []) {
    if (entry?.choose) for (const a of entry.choose.from ?? []) out.add(a);
    else if (entry && typeof entry === 'object') {
      for (const k of Object.keys(entry)) if (ALL_ABILITIES.includes(k)) out.add(k);
    }
  }
  return [...out];
}

/** O texto curto do bônus ("+1 Str or Dex"). */
function boostText(feat) {
  if (hasFreeLegacyBonus(feat)) return '+1 any (legacy)';
  const parts = [];
  for (const entry of feat.ability ?? []) {
    if (entry?.choose) {
      const c = entry.choose;
      const amount = c.amount ?? 1;
      const from = c.from ?? [];
      const names = from.length === ALL_ABILITIES.length ? 'any' : from.map((a) => ABILITY_ABBR[a] ?? a).join(' or ');
      parts.push(`+${amount} ${names}${(c.count ?? 1) > 1 ? ` (×${c.count})` : ''}`);
    } else if (entry && typeof entry === 'object') {
      for (const [k, v] of Object.entries(entry)) {
        if (ALL_ABILITIES.includes(k)) parts.push(`+${v} ${ABILITY_ABBR[k]}`);
      }
    }
  }
  return parts.join(' or ') || null;
}

const CATEGORY_FILTER_OPTIONS = [
  { value: 'O', label: 'Origin' },
  { value: 'G', label: 'General' },
  { value: 'EB', label: 'Epic Boon' },
];

/** As categorias normalizadas de um talento (null vira G). */
function filterCategories(feat) {
  const c = feat.category;
  if (c == null) return ['G'];
  return Array.isArray(c) ? c : [c];
}

/**
 * A entity de talento para um conjunto de categorias.
 * @param {string[]} categories
 * @param {string} title
 * @param {object} [ctx]
 * @param {Set<string>} [only]
 * @param {object} [opts]
 */
export function makeFeatEntity(categories, title = 'Feat', ctx = null, only = null, opts = {}) {
  const prereqOf = (f) => evalPrereq(f, ctx ?? { scores: {}, level: 0, raceId: null, classLevels: {}, grantedFeatures: [] });

  return {
    type: 'feat',
    title,

    list: (db) => {
      const base = latestOnly(db?.feats?.feat ?? []).filter((f) => inCategories(f, categories));
      return only ? base.filter((f) => only.has(f.name)) : base;
    },

    idOf: (f) => `${f.name}|${f.source}`,

    precompute: (f) => {
      const pre = prereqOf(f);
      return {
        searchText: `${f.name} ${f.source}`.toLowerCase(),
        filterValues: {
          source: [f.source].filter(Boolean),
          boost: boostableAbilities(f),
          prereq: [pre?.status ?? 'ok'],
          ...(opts.categoryFilter ? { category: filterCategories(f) } : {}),
        },
      };
    },

    filters: [
      ...(opts.categoryFilter
        ? [{ id: 'category', header: 'Category', options: CATEGORY_FILTER_OPTIONS }]
        : []),
      { id: 'source', header: 'Source', derive: true },
      {
        id: 'boost',
        header: 'Ability Bonus',
        options: ALL_ABILITIES.map((a) => ({ value: a, label: ABILITY_LABEL[a] })),
      },
      {
        id: 'prereq',
        header: 'Prerequisites',
        options: [
          { value: 'ok', label: 'Met' },
          { value: 'bad', label: 'Not Met' },
          { value: 'unknown', label: 'Unverifiable' },
        ],
      },
    ],

    /** Pré-requisitos coloridos e bônus de atributo. */
    meta: (f) => {
      const out = [];
      const pre = prereqOf(f);
      if (pre) {
        for (const e of pre.entries) {
          out.push({ label: 'Prerequisite', value: e.text, status: ctx ? e.status : undefined });
        }
      }
      const boost = boostText(f);
      if (boost) out.push({ label: 'Ability Bonus', value: boost });
      return out;
    },

    card: (f) => {
      const pre = prereqOf(f);
      const catBadges = opts.categoryFilter
        ? filterCategories(f)
            .map((c) => (c === 'O' ? 'Origin' : c === 'EB' ? 'Epic Boon' : null))
            .filter(Boolean)
        : [];
      return {
        title: f.name,
        subtitle: f.source,
        badges: f.category == null ? ['Legacy'] : catBadges,
        prereqs: pre
          ? pre.entries.map((e) => ({ text: e.text, status: ctx ? e.status : 'unknown' }))
          : [],
      };
    },
  };
}

export const FEAT_CATEGORY_TITLE = {
  O: 'Origin Feat',
  G: 'Feat',
  FS: 'Fighting Style',
  EB: 'Epic Boon',
};

const originFeatEntity = makeFeatEntity(['O'], 'Origin Feat');
export default originFeatEntity;
