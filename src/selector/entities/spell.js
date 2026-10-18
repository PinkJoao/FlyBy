// =============================================================================
// spell: a entity de magia (Spellbook, Fases B2.3 e B2.4)
// =============================================================================
// O QUE FAZ
//   Fluff (arte, lore), chips de meta (nível, escola, tempo, alcance, componentes,
//   duração) e o corpo do texto para o DetailView, mais lista, filtros e card para
//   o seletor do fluxo de preparar. O mapa magia para classe vive no db e o
//   precompute não o recebe, então a entity do seletor é uma FÁBRICA.
//
// FUNÇÕES
//   durationLabel(spell): "Instantaneous", "Concentration, up to 1 minute".
//   levelValue(spell), precomputeSpell(r, classIndex): o precompute.
//   makeSpellEntity(db, opts): a entity do seletor (memoize sobre o db).
//   Exporta spellEntity (sem filtro de classe).
//
// DECISÕES E ARMADILHAS
//   - O filtro de CLASSE é comum, com TODAS as classes; o SpellbookTab só pré-marca
//     a da origem. Dá para preparar uma magia de Warlock no Bardo se o mestre
//     deixar. Ele vem logo depois de Level, com "Already Prepared" abaixo (TC-0031;
//     pré-marcado como exclude, então precisa estar à vista).
//   - TC-0043: as magias que uma feature ACRESCENTA à lista carregam a classe da
//     origem no filtro ("count as Bard spells for you") e ganham badge da fonte.
//   - O fluff é fatiado por livro: procura o da magia, senão varre os outros.
//   - As listas a que a magia pertence (DDL-0089) ficam numa seção RETRÁTIL,
//     fechada, entre as chips e o texto (de 9 a 40 entradas).
// -----------------------------------------------------------------------------

import { SPELL_FLUFF_SOURCES } from '../../data/config';
import {
  allSpells,
  spellClassIndex,
  schoolName,
  spellLevelLabel,
  castingTimeLabel,
  rangeLabel,
  componentsText,
  materialText,
  isRitual,
  isConcentration,
  saveOrAttack,
} from '../../engine/spells';
import { spellSourceEntries } from '../../engine/spellSources';

/** O rótulo da duração. */
export function durationLabel(spell) {
  const d = spell?.duration?.[0];
  if (!d) return '';
  const base = (() => {
    if (d.type === 'instant') return 'Instantaneous';
    if (d.type === 'permanent') return `Until dispelled${d.ends?.includes('trigger') ? ' or triggered' : ''}`;
    if (d.type === 'special') return 'Special';
    if (d.type === 'timed' && d.duration) {
      const n = d.duration.amount ?? 1;
      const unit = d.duration.type ?? '';
      return `${n} ${unit}${n > 1 ? 's' : ''}`;
    }
    return d.type ?? '';
  })();
  return d.concentration ? `Concentration, up to ${base}` : base;
}

const LEVEL_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  value: i === 0 ? 'Cantrip' : `${i}`,
  label: i === 0 ? 'Cantrip' : spellLevelLabel(i),
}));

const levelValue = (spell) => (spell.level === 0 ? 'Cantrip' : String(spell.level));

/** Pré-computa uma magia; sem `classIndex` o filtro de classe fica vazio. */
function precomputeSpell(r, classIndex) {
  const sa = saveOrAttack(r);
  const tags = [];
  if (isRitual(r)) tags.push('Ritual');
  if (isConcentration(r)) tags.push('Concentration');
  const classes = classIndex?.get(r.name.toLowerCase()) ?? [];
  return {
    searchText: `${r.name} ${r.source} ${schoolName(r.school)}`.toLowerCase(),
    filterValues: {
      level: [levelValue(r)],
      class: classes,
      school: [schoolName(r.school)],
      time: [castingTimeLabel(r) || 'Other'],
      roll: [sa.kind === 'attack' ? 'Attack' : sa.kind === 'save' ? 'Save' : 'No Roll'],
      tags,
      source: [r.source],
    },
  };
}

const spellEntity = {
  key: 'spell',
  title: 'Spell',

  list: (db) => allSpells(db),

  idOf: (r) => `${r.name}|${r.source}`,

  precompute: (r) => precomputeSpell(r, null),

  filters: [
    { id: 'level', header: 'Level', options: LEVEL_OPTIONS },
    { id: 'school', header: 'School', derive: true },
    { id: 'time', header: 'Casting Time', derive: true },
    { id: 'roll', header: 'Save / Attack', options: ['Attack', 'Save', 'No Roll'] },
    { id: 'tags', header: 'Tags', options: ['Ritual', 'Concentration'] },
    { id: 'source', header: 'Source', derive: true },
  ],

  card: (r) => ({
    title: r.name,
    meta: [schoolName(r.school), castingTimeLabel(r), rangeLabel(r)].filter(Boolean).join(' · '),
    badges: [r.level === 0 ? 'Cantrip' : spellLevelLabel(r.level)],
  }),

  fluff: (spell, db) => {
    if (!spell) return null;
    const src = spell.source?.toLowerCase();
    const files = src && SPELL_FLUFF_SOURCES.includes(src) ? [src, ...SPELL_FLUFF_SOURCES] : SPELL_FLUFF_SOURCES;
    for (const file of files) {
      const list = db?.[`fluff-spells-${file}`]?.spellFluff ?? [];
      const hit =
        list.find((f) => f.name === spell.name && f.source === spell.source) ??
        list.find((f) => f.name === spell.name);
      if (hit) return hit;
    }
    return null;
  },

  meta: (spell) => {
    const out = [
      { label: 'Level', value: spell.level === 0 ? 'Cantrip' : spellLevelLabel(spell.level) },
      { label: 'School', value: schoolName(spell.school) },
      { label: 'Casting Time', value: castingTimeLabel(spell) },
      { label: 'Range', value: rangeLabel(spell) },
    ];
    const comp = componentsText(spell);
    if (comp) out.push({ label: 'Components', value: comp });
    const mat = materialText(spell);
    if (mat) out.push({ label: 'Materials', value: mat });
    out.push({ label: 'Duration', value: durationLabel(spell) });

    const sa = saveOrAttack(spell);
    if (sa.kind === 'attack') out.push({ label: 'Attack', value: `${sa.detail} spell attack`, highlight: true });
    else if (sa.kind === 'save') out.push({ label: 'Save', value: `${sa.detail} saving throw`, highlight: true });

    if (isRitual(spell)) out.push({ label: 'Ritual', value: 'Yes' });
    if (isConcentration(spell)) out.push({ label: 'Concentration', value: 'Yes' });
    return out;
  },

  entries: (spell) => [...(spell.entries ?? []), ...(spell.entriesHigherLevel ?? [])],

  sections: (spell, db) => [
    { id: 'spell-lists', label: 'Spell Lists', entries: spellSourceEntries(db, spell) },
  ],
};

/**
 * A entity de magia para o seletor, com o filtro de Class do compêndio.
 * @param {object} db
 * @param {object} [opts]
 */
export function makeSpellEntity(db, opts = {}) {
  const classIndex = spellClassIndex(db);
  const elsewhere = opts.preparedElsewhere ?? null;
  const hasElsewhere = (elsewhere?.size ?? 0) > 0;
  const added = opts.addedToList ?? null;
  const addedClass = opts.addedListClass ?? null;
  const hasAdded = (added?.size ?? 0) > 0 && !!addedClass;
  return {
    ...spellEntity,
    precompute: (r) => {
      const pre = precomputeSpell(r, classIndex);
      if (hasElsewhere) {
        pre.filterValues.owned = elsewhere.has(r.name.toLowerCase()) ? ['yes'] : [];
      }
      if (hasAdded && added.has(r.name.toLowerCase()) && !pre.filterValues.class.includes(addedClass)) {
        pre.filterValues.class = [...pre.filterValues.class, addedClass];
      }
      return pre;
    },
    ...(hasElsewhere || hasAdded
      ? {
          card: (r) => {
            const c = spellEntity.card(r);
            const badges = [...c.badges];
            const from = hasAdded ? added.get(r.name.toLowerCase()) : null;
            if (from) badges.push(from);
            if (hasElsewhere && elsewhere.get(r.name.toLowerCase())) badges.push('Already Prepared');
            return badges.length === c.badges.length ? c : { ...c, badges };
          },
        }
      : {}),
    filters: [
      spellEntity.filters[0],
      { id: 'class', header: 'Class', derive: true },
      ...(hasElsewhere
        ? [{ id: 'owned', header: 'Already Prepared', options: [{ value: 'yes', label: 'Prepared in another origin' }] }]
        : []),
      ...spellEntity.filters.slice(1),
    ],
  };
}

export default spellEntity;
