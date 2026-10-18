// =============================================================================
// lineage: a entity de linhagem, por raça base
// =============================================================================
// O QUE FAZ
//   As linhagens (as `_versions` e as sub-raças fundidas, juntas em raceLineages)
//   num SelectorPanel como qualquer outro, em vez de cards próprios.
//
// FUNÇÕES
//   lineageShort(v): o rótulo curto ("Drow Lineage", "Black").
//   lineageResist(v, baseRace): as resistências que a base não tem.
//   cap(s): texto.
//   lineageEntries(v, baseRace): os traços que diferem da base, para o detalhe.
//   makeLineageEntity(baseRace, db): a fábrica.
//
// DECISÕES E ARMADILHAS
//   - O título usa o nome que a ESPÉCIE dá à escolha ("Variable Trait", "Kobold
//     Legacy", "Giant Ancestry"; DDL-0062).
//   - O meta destaca o traço definidor: o modo de movimento que a base não tem (o
//     voo do Winged) e o tipo de dano da ancestralidade de dragão.
// -----------------------------------------------------------------------------

import { raceLineages, lineageLabel, lineageSelectorLabel } from '../../engine/speciesData';

/** O rótulo curto da versão. */
const lineageShort = (v) => lineageLabel(v?.name ?? '');

/** As resistências específicas da variante. */
function lineageResist(v, baseRace) {
  const base = new Set((baseRace?.resist ?? []).map((r) => (typeof r === 'string' ? r : r?.resist)).filter(Boolean));
  return (v?.resist ?? [])
    .map((r) => (typeof r === 'string' ? r : r?.resist))
    .filter((r) => r && !base.has(r));
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Os traços específicos da linhagem. */
function lineageEntries(v, baseRace) {
  const baseNames = new Set((baseRace?.entries ?? []).filter((e) => e?.name).map((e) => e.name));
  const specific = (v?.entries ?? []).filter((e) => e?.name && !baseNames.has(e.name));
  return specific.length ? specific : (v?.entries ?? []);
}

/**
 * A entity de linhagem de uma raça base.
 * @param {object} baseRace
 * @param {object|null} [db]
 * @returns {object}
 */
export function makeLineageEntity(baseRace, db = null) {
  return {
    type: 'lineage',
    title: lineageSelectorLabel(baseRace),

    list: (dbArg) => raceLineages(dbArg ?? db, baseRace),

    idOf: (v) => v.name,

    precompute: (v) => ({
      searchText: `${lineageShort(v)} ${v.source ?? ''}`.toLowerCase(),
      filterValues: { source: [v.source].filter(Boolean) },
    }),

    filters: [{ id: 'source', header: 'Source', derive: true }],

    meta: (v) => {
      const out = [];
      if (v.darkvision && v.darkvision !== (baseRace?.darkvision ?? 0)) out.push({ label: 'Darkvision', value: `${v.darkvision} ft`, highlight: true });
      const walk = typeof v.speed === 'number' ? v.speed : v.speed?.walk;
      if (walk && walk !== (typeof baseRace?.speed === 'number' ? baseRace.speed : baseRace?.speed?.walk)) {
        out.push({ label: 'Speed', value: `${walk} ft`, highlight: true });
      }
      for (const mode of ['fly', 'swim', 'climb']) {
        const value = typeof v.speed === 'object' ? v.speed?.[mode] : null;
        const base = typeof baseRace?.speed === 'object' ? baseRace.speed?.[mode] : null;
        if (value && value !== base) out.push({ label: cap(mode), value: `${value} ft`, highlight: true });
      }
      const resist = lineageResist(v, baseRace);
      if (resist.length) out.push({ label: 'Resistance', value: resist.map(cap).join(', '), highlight: true });
      return out;
    },

    card: (v) => ({ title: lineageShort(v), subtitle: v.source, badges: [] }),

    entries: (v) => lineageEntries(v, baseRace),
  };
}
