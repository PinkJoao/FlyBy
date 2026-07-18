// =============================================================================
// Entity config: Spell (Spellbook, Fases B2.3 e B2.4)
// =============================================================================
// Fluff (arte/lore), chips de meta (nível, escola, tempo, alcance, componentes,
// duração) e o corpo do texto (entries + "Using a Higher-Level Spell Slot") para
// o DetailView; e list/filters/card para o SelectorPanel do fluxo de preparar.
//
// O filtro de CLASSE é um filtro normal do painel, com TODAS as classes: o
// SpellbookTab só o pré-marca na classe da origem (via `initialFilterState`).
// Assim dá para, deliberadamente, buscar uma magia de Warlock enquanto se
// prepara o Bardo - se o mestre autorizou. Como o mapa magia→classe vive no
// `db` (spells/sources.json) e `precompute` não recebe `db`, a entity é uma
// FÁBRICA (`makeSpellEntity(db)`), como feat/lineage/optionalfeature.
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

/** Rótulo da duração: "Instantaneous", "Concentration, up to 1 minute"… */
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

/** Opções fixas do filtro de nível (0–9), na ordem natural. */
const LEVEL_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  value: i === 0 ? 'Cantrip' : `${i}`,
  label: i === 0 ? 'Cantrip' : spellLevelLabel(i),
}));

const levelValue = (spell) => (spell.level === 0 ? 'Cantrip' : String(spell.level));

/** Pré-computa uma magia. `classIndex` (nome→classes) é opcional: sem ele o
 * filtro de classe simplesmente não tem valores. */
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
    // O fluff é fatiado por livro; procura o do livro da magia e, se não houver,
    // varre os demais (reprints trocam de fonte, ex: PHB → XPHB).
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

  // Texto mecânico + o bloco de conjuração em círculo superior.
  entries: (spell) => [...(spell.entries ?? []), ...(spell.entriesHigherLevel ?? [])],
};

/**
 * Entity de magia PARA O SELETOR, com o filtro de **Class** populado a partir do
 * mapa reverso do compêndio. Todas as classes aparecem como opções - a origem
 * aberta só decide qual vem pré-marcada (`initialFilterState` do SelectorPanel).
 * Memoize o resultado (`useMemo` sobre `db`): o índice varre o mapa inteiro.
 * @param {object} db
 */
export function makeSpellEntity(db) {
  const classIndex = spellClassIndex(db);
  return {
    ...spellEntity,
    precompute: (r) => precomputeSpell(r, classIndex),
    // Class logo após Level: é o recorte mais usado ao preparar magias.
    filters: [
      spellEntity.filters[0],
      { id: 'class', header: 'Class', derive: true },
      ...spellEntity.filters.slice(1),
    ],
  };
}

export default spellEntity;
