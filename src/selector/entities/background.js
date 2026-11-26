// =============================================================================
// background: a entity de background (DDL-0328)
// =============================================================================
// O QUE FAZ
//   O Custom Background (a origem montada peça por peça) primeiro e fixo, depois os
//   backgrounds prontos de 2024 em diante (engine/backgrounds.js). Filtros: Ability
//   Scores, Feat, Skills, Tool e Source. O card mostra o talento e os três atributos; o
//   carrossel usa o parágrafo do fluff e a arte (uma faixa larga, DDL-0328).
//
// FUNÇÕES
//   isCustomBackground(raw): é a entrada do Custom Background?
//   backgroundIdOf(origin): o id da escolha da origem ('custom' sem background).
//   featLabel(db, raw): o talento que o background dá, em texto.
//   toolLabel(db, raw): a ferramenta (ou a categoria a escolher).
//   bgFluff(raw, db): a entrada de fluff.
//   Exporta CUSTOM_BACKGROUND e backgroundEntity.
//
// DECISÕES E ARMADILHAS
//   - O Custom é uma entrada sintética (`custom: true`), marcada por `pinned`: o seletor
//     e o carrossel a põem antes de tudo, fora dos filtros (resposta do dono: é a opção
//     padrão, os prontos são um atalho). O texto dela é da interface, não do livro.
//   - `list` é calculada uma vez por db (LIST_CACHE): o seletor chama `list` a cada
//     render, e cópias novas quebrariam o cache dos cards.
//   - O talento de escolha (os do Ravenloft) aparece como "Survivor or a Dark Gift".
// -----------------------------------------------------------------------------

import { readyBackgrounds, backgroundAbilities, backgroundSkills, backgroundFixedTool, backgroundToolCategory, backgroundFeat } from '../../engine/backgrounds';
import { firstParagraph } from '../teaser';

const ABILITY_LABEL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const ABILITY_ABBR = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };
const SKILL_LABEL = {
  acr: 'Acrobatics', ani: 'Animal Handling', arc: 'Arcana', ath: 'Athletics', dec: 'Deception', his: 'History',
  ins: 'Insight', itm: 'Intimidation', inv: 'Investigation', med: 'Medicine', nat: 'Nature', prc: 'Perception',
  prf: 'Performance', per: 'Persuasion', rel: 'Religion', slt: 'Sleight of Hand', ste: 'Stealth', sur: 'Survival',
};

export const CUSTOM_BACKGROUND = {
  name: 'Custom Background',
  source: '',
  custom: true,
  entries: [
    'Build the origin piece by piece: two ability boosts, an origin feat, two skills, a tool and two languages, each of your choice.',
  ],
};

const CATEGORY_NAME = { DG: 'Dark Gift', D: 'Dragonmark', O: 'Origin feat' };

const LIST_CACHE = new WeakMap();

/** É a entrada do Custom Background? */
export function isCustomBackground(raw) {
  return !!raw?.custom;
}

/** O id da escolha da origem ('custom' sem background). */
export function backgroundIdOf(origin) {
  const b = origin?.background;
  return b?.id ? `${b.id}|${b.source}` : 'custom';
}

/** O talento que o background dá, em texto. */
export function featLabel(db, raw) {
  if (isCustomBackground(raw)) return 'Any origin feat';
  const f = backgroundFeat(db, raw);
  const named = f.options.map((o) => (o.preset ? `${o.id} (${o.preset.charAt(0).toUpperCase()}${o.preset.slice(1)})` : o.id));
  const cats = f.categories.map((c) => `a ${CATEGORY_NAME[c] ?? c}`);
  return [...named, ...cats].join(' or ') || '-';
}

/** A ferramenta (ou a categoria a escolher). */
export function toolLabel(db, raw) {
  const fixed = backgroundFixedTool(db, raw);
  if (fixed) return fixed;
  const cat = backgroundToolCategory(raw);
  return cat ? `One ${cat.label}` : '-';
}

/** A entrada de fluff do background. */
function bgFluff(raw, db) {
  const list = db?.['fluff-backgrounds']?.backgroundFluff ?? [];
  return list.find((f) => f.name === raw.name && f.source === raw.source) ?? null;
}

const backgroundEntity = {
  type: 'background',
  title: 'Background',

  list: (db) => {
    const key = db ?? {};
    if (!LIST_CACHE.has(key)) LIST_CACHE.set(key, [CUSTOM_BACKGROUND, ...readyBackgrounds(db)]);
    return LIST_CACHE.get(key);
  },

  pinned: isCustomBackground,

  idOf: (b) => (isCustomBackground(b) ? 'custom' : `${b.name}|${b.source}`),

  precompute: (b, db) => {
    if (isCustomBackground(b)) return { searchText: 'custom background', filterValues: {} };
    const f = backgroundFeat(db, b);
    return {
      searchText: `${b.name} ${b.source}`.toLowerCase(),
      filterValues: {
        ability: backgroundAbilities(b),
        feat: [...f.options.map((o) => o.id), ...f.categories.map((c) => CATEGORY_NAME[c] ?? c)],
        skill: backgroundSkills(b).map((s) => SKILL_LABEL[s] ?? s),
        tool: [backgroundFixedTool(db, b) ?? backgroundToolCategory(b)?.label].filter(Boolean),
        source: [b.source],
      },
    };
  },

  filters: [
    { id: 'ability', header: 'Ability Scores', options: Object.entries(ABILITY_LABEL).map(([value, label]) => ({ value, label })) },
    { id: 'feat', header: 'Feat', derive: true },
    { id: 'skill', header: 'Skills', derive: true },
    { id: 'tool', header: 'Tool', derive: true },
    { id: 'source', header: 'Source', derive: true },
  ],

  meta: (b, db) => {
    if (isCustomBackground(b)) return [];
    return [
      { label: 'Abilities', value: backgroundAbilities(b).map((a) => ABILITY_ABBR[a]).join(', ') },
      { label: 'Feat', value: featLabel(db, b) },
      { label: 'Skills', value: backgroundSkills(b).map((s) => SKILL_LABEL[s] ?? s).join(', ') },
      { label: 'Tool', value: toolLabel(db, b) },
    ];
  },

  cardShape: { title: 1, subtitle: true, tags: 2 },
  card: (b, db) => {
    if (isCustomBackground(b)) return { title: b.name, subtitle: null, badges: [{ text: 'Your choice', tone: 'accent' }] };
    return {
      title: b.name,
      subtitle: b.source,
      badges: [
        { text: featLabel(db, b), tone: 'neutral' },
        { text: backgroundAbilities(b).map((a) => ABILITY_ABBR[a]).join(' '), tone: 'neutral' },
      ],
    };
  },

  carousel: true,

  cardExtra: (b) => (isCustomBackground(b) ? [] : [`Skills ${backgroundSkills(b).map((s) => SKILL_LABEL[s] ?? s).join(', ')}`]),

  icon: (b) => (isCustomBackground(b) ? 'stepStory' : 'itemScroll'),

  teaser: (b, db) => {
    if (isCustomBackground(b)) return null;
    const para = firstParagraph(bgFluff(b, db)?.entries);
    return para ? [para] : null;
  },

  entries: (b, db) => (isCustomBackground(b) ? b.entries : [...(bgFluff(b, db)?.entries ?? []), ...(b.entries ?? [])]),

  fluff: (b, db) => {
    if (isCustomBackground(b)) return null;
    const images = bgFluff(b, db)?.images;
    return images?.length ? { images } : null;
  },
};

export default backgroundEntity;
