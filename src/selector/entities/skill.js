// =============================================================================
// Entity config: Skill
// =============================================================================
// Seletor de perícia (SelectorPanel) - mostra a descrição de cada perícia via
// DetailView (raw.entries) e a habilidade associada no meta. Usado nas escolhas
// de perícia (Background, mistas, etc.).
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';

const ABILITY_NAME = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

function abilityOf(s) {
  const a = Array.isArray(s.ability) ? s.ability[0] : s.ability;
  return a ? (ABILITY_NAME[a] ?? a) : null;
}

const skillEntity = {
  type: 'skill',
  title: 'Skill',

  list: (db) => latestOnly(db?.skills?.skill ?? []),

  idOf: (s) => s.name,

  precompute: (s) => ({
    searchText: `${s.name} ${s.source}`.toLowerCase(),
    filterValues: {
      source: [s.source].filter(Boolean),
      ability: [abilityOf(s)].filter(Boolean),
    },
  }),

  filters: [
    { id: 'ability', header: 'Ability', derive: true },
    { id: 'source', header: 'Source', derive: true },
  ],

  meta: (s) => (abilityOf(s) ? [{ label: 'Ability', value: abilityOf(s) }] : []),

  card: (s) => ({ title: s.name, subtitle: s.source, meta: abilityOf(s) ?? undefined, badges: [] }),
};

export default skillEntity;
