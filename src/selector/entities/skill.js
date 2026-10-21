// =============================================================================
// skill: a entity de perícia
// =============================================================================
// O QUE FAZ
//   O seletor de perícia (Background, pools mistos): a descrição de cada uma no
//   DetailView e a habilidade associada no meta.
//
// FUNÇÕES
//   abilityOf(s): a habilidade da perícia.
//
// DECISÕES E ARMADILHAS
//   - `sorts`: Ability, pela habilidade da perícia.
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

  sorts: [
    { value: 'ability', label: 'Ability', defaultDir: 'asc', dirLabels: ['A to Z', 'Z to A'], keyOf: (s) => abilityOf(s) ?? null },
  ],

  filters: [
    { id: 'ability', header: 'Ability', derive: true },
    { id: 'source', header: 'Source', derive: true },
  ],

  meta: (s) => (abilityOf(s) ? [{ label: 'Ability', value: abilityOf(s) }] : []),

  card: (s) => ({ title: s.name, subtitle: s.source, meta: abilityOf(s) ?? undefined, badges: [] }),
};

export default skillEntity;
