// =============================================================================
// Entity config: Feat (fábrica por categoria, ciente do personagem)
// =============================================================================
// Uma entity de talento por conjunto de categorias 5etools: O (origem), G
// (general), FS/FS:P/FS:R (fighting styles) e EB (epic boons).
//
// REGRAS DE ADAPTAÇÃO (DMG 2024 / Plutonium):
//  - Feats LEGACY (sem categoria) contam como GENERAL - entram no pool G.
//  - Feats G/EB sempre dão bônus de atributo; legacy sem campo `ability` é
//    tratado como bônus LIVRE (+1 em qualquer) - ver ChoiceList.
//
// PRÉ-REQUISITOS: exibidos no card E no preview, coloridos pelo status contra o
// personagem (ok/bad/unknown) quando a entity recebe `ctx` (prereqContext).
// Filtros: Source, Ability Bonus (qual atributo o feat PODE aumentar; legacy
// livre casa com todos) e Prerequisites (Met / Not Met / Unverifiable).
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';
import { evalPrereq } from '../../engine/prereq';

const ALL_ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_LABEL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const ABILITY_ABBR = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };

function inCategories(feat, categories) {
  const c = feat.category;
  // Legacy (sem categoria) conta como General (adaptação DMG 2024).
  if (c == null) return categories.includes('G');
  if (Array.isArray(c)) return c.some((x) => categories.includes(x));
  return categories.includes(c);
}

/** É legacy sem bônus próprio → tratamos como bônus livre (+1 qualquer). */
export function hasFreeLegacyBonus(feat) {
  return feat?.category == null && !feat?.ability;
}

/** Quais atributos o feat PODE aumentar (p/ filtro e meta). */
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

/** Texto curto do bônus (ex: "+1 Str or Dex", "+2 to one or +1 to two"). */
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

// Rótulos do filtro de Categoria (TC-0029). Legacy (sem categoria) conta como
// General - mesma adaptação DMG 2024 de `inCategories`.
const CATEGORY_FILTER_OPTIONS = [
  { value: 'O', label: 'Origin' },
  { value: 'G', label: 'General' },
  { value: 'EB', label: 'Epic Boon' },
];

/** Categorias NORMALIZADAS de um feat (p/ o filtro): null → G, array achatado. */
function filterCategories(feat) {
  const c = feat.category;
  if (c == null) return ['G'];
  return Array.isArray(c) ? c : [c];
}

/**
 * @param {string[]} categories  categorias 5etools (ex: ['G'], ['FS','FS:P'])
 * @param {string} title         título do painel (ex: 'Feat', 'Fighting Style')
 * @param {object} [ctx]         prereqContext(character) - colore os pré-requisitos
 * @param {Set<string>} [only]   restringe a estes NOMES de feat (ex: College of
 *                               Swords → só Dueling / Two-Weapon Fighting)
 * @param {object} [opts]        { categoryFilter: true } adiciona o filtro de
 *                               Categoria (TC-0029: ASI/Epic Boon listam mais de
 *                               uma categoria, com a padrão pré-marcada pelo
 *                               chamador via initialFilterState)
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
          prereq: [pre?.status ?? 'ok'], // sem pré-requisito conta como atendido
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

    /** Pré-requisitos (coloridos por status) + bônus de atributo. */
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
      // Com o filtro de categoria ativo, Origin/Epic Boon ganham badge - o
      // jogador vê que está pegando fora da categoria padrão do slot.
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

/** Títulos padrão por categoria (p/ o ChoiceList montar a entity certa). */
export const FEAT_CATEGORY_TITLE = {
  O: 'Origin Feat',
  G: 'Feat',
  FS: 'Fighting Style',
  EB: 'Epic Boon',
};

const originFeatEntity = makeFeatEntity(['O'], 'Origin Feat');
export default originFeatEntity;
