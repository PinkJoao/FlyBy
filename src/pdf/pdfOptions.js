// =============================================================================
// pdfOptions: o que o jogador escolhe pôr na ficha PDF
// =============================================================================
// O QUE FAZ
//   Puro. A forma das opções, os padrões, os atalhos (Compact, Standard, que é o
//   padrão, e Complete) e a
//   normalização de um valor gravado (DDL-0105):
//     theme       'white' | 'parchment'
//     pageSize    'A4' | 'LETTER'
//     sections    combat, features, spells, inventory, biography (liga e desliga)
//     fields      portrait, skills, attacks, resources, proficiencies, tableBoxes
//                 (página de combate)
//     detail      por grupo: classFeatures, subclassFeatures, speciesTraits, feats
//                 em 'off' | 'titles' | 'full'; spells em 'table' | 'cards';
//                 items em 'names' | 'magic' | 'all'
//     flavor      species, classes, subclasses, items (o fluff de cada um)
//
// FUNÇÕES
//   pick(value, allowed, fallback): o valor se for um dos permitidos.
//   flags(raw, defaults): um mapa de booleanos com as chaves do padrão.
//   normalizePdfOptions(raw): as opções completas e válidas.
//   applyPreset(opts, preset): as opções com um atalho aplicado (tema e papel
//     ficam).
//   presetOf(opts): o atalho que as opções reproduzem, ou 'custom'.
//
// DECISÕES E ARMADILHAS
//   - Gravado no aparelho pelo settingsStore, não no personagem: é preferência
//     de apresentação, não decisão de jogo (§6.3).
//   - Um valor gravado por uma versão antiga ou corrompido NUNCA quebra a
//     exportação: cada campo cai no padrão, um por um.
// -----------------------------------------------------------------------------

export const FEATURE_GROUPS = ['classFeatures', 'subclassFeatures', 'speciesTraits', 'feats'];
const FEATURE_DETAIL = ['off', 'titles', 'full'];
const SPELL_DETAIL = ['table', 'cards'];
const ITEM_DETAIL = ['names', 'magic', 'all'];

export const DEFAULT_PDF_OPTIONS = {
  theme: 'parchment',
  pageSize: 'A4',
  sections: { combat: true, features: true, spells: true, inventory: true, biography: true },
  fields: { portrait: true, skills: true, attacks: true, resources: true, proficiencies: true, tableBoxes: true },
  detail: {
    classFeatures: 'full',
    subclassFeatures: 'full',
    speciesTraits: 'full',
    feats: 'full',
    spells: 'cards',
    items: 'magic',
  },
  flavor: { species: true, classes: false, subclasses: true, items: false },
};

export const PDF_PRESETS = {
  standard: {
    sections: DEFAULT_PDF_OPTIONS.sections,
    fields: DEFAULT_PDF_OPTIONS.fields,
    detail: DEFAULT_PDF_OPTIONS.detail,
    flavor: DEFAULT_PDF_OPTIONS.flavor,
  },
  compact: {
    sections: { combat: true, features: true, spells: true, inventory: true, biography: true },
    fields: { portrait: true, skills: true, attacks: true, resources: true, proficiencies: true, tableBoxes: true },
    detail: {
      classFeatures: 'titles', subclassFeatures: 'titles', speciesTraits: 'titles', feats: 'titles',
      spells: 'table', items: 'names',
    },
    flavor: { species: false, classes: false, subclasses: false, items: false },
  },
  complete: {
    sections: { combat: true, features: true, spells: true, inventory: true, biography: true },
    fields: { portrait: true, skills: true, attacks: true, resources: true, proficiencies: true, tableBoxes: true },
    detail: {
      classFeatures: 'full', subclassFeatures: 'full', speciesTraits: 'full', feats: 'full',
      spells: 'cards', items: 'all',
    },
    flavor: { species: true, classes: true, subclasses: true, items: true },
  },
};

/** O valor se for um dos permitidos. */
const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

/** Um mapa de booleanos com as chaves do padrão. */
const flags = (raw, defaults) =>
  Object.fromEntries(Object.entries(defaults).map(([k, d]) => [k, typeof raw?.[k] === 'boolean' ? raw[k] : d]));

/**
 * As opções completas e válidas, a partir de um valor gravado qualquer.
 * @param {object} [raw]
 */
export function normalizePdfOptions(raw) {
  const d = DEFAULT_PDF_OPTIONS;
  const detail = raw?.detail ?? {};
  return {
    theme: pick(raw?.theme, ['white', 'parchment'], d.theme),
    pageSize: pick(raw?.pageSize, ['A4', 'LETTER'], d.pageSize),
    sections: flags(raw?.sections, d.sections),
    fields: flags(raw?.fields, d.fields),
    detail: {
      ...Object.fromEntries(FEATURE_GROUPS.map((g) => [g, pick(detail[g], FEATURE_DETAIL, d.detail[g])])),
      spells: pick(detail.spells, SPELL_DETAIL, d.detail.spells),
      items: pick(detail.items, ITEM_DETAIL, d.detail.items),
    },
    flavor: flags(raw?.flavor, d.flavor),
  };
}

/** As opções com um atalho aplicado; tema e papel continuam os do jogador. */
export function applyPreset(opts, preset) {
  const p = PDF_PRESETS[preset];
  if (!p) return normalizePdfOptions(opts);
  return normalizePdfOptions({ ...opts, ...structuredClone(p) });
}

/** O atalho que as opções reproduzem, ou 'custom'. */
export function presetOf(opts) {
  const o = normalizePdfOptions(opts);
  const strip = ({ sections, fields, detail, flavor }) => JSON.stringify({ sections, fields, detail, flavor });
  for (const [id, p] of Object.entries(PDF_PRESETS)) {
    if (strip(o) === strip(normalizePdfOptions(p))) return id;
  }
  return 'custom';
}
