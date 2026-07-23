// =============================================================================
// Entity config: Lineage (sub-raça / `_versions`) - fábrica por raça base
// =============================================================================
// As linhagens (ex: Elf → Drow/High/Wood) são as variantes de `_versions` da raça
// base E as sub-raças fundidas de `db.races.subrace` (Genasi Air/Earth/Fire/
// Water, Stensia…) - `raceLineages` junta as duas fontes. A entity é gerada por
// `makeLineageEntity(baseRace, db)` e alimenta o mesmo SelectorPanel de tudo
// mais (busca + cards + detalhe), em vez de cards ad-hoc.
// -----------------------------------------------------------------------------

import { raceLineages, lineageLabel, lineageSelectorLabel } from '../../engine/speciesData';

/** Rótulo curto da versão (ex: "Drow Lineage", "Black", "Amethyst"). */
const lineageShort = (v) => lineageLabel(v?.name ?? '');

/** Resistências específicas da variante (as que a base não tem) - p/ o chip de meta. */
function lineageResist(v, baseRace) {
  const base = new Set((baseRace?.resist ?? []).map((r) => (typeof r === 'string' ? r : r?.resist)).filter(Boolean));
  return (v?.resist ?? [])
    .map((r) => (typeof r === 'string' ? r : r?.resist))
    .filter((r) => r && !base.has(r));
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Traços ESPECÍFICOS da linhagem (os que diferem da base) - p/ o DetailView. */
function lineageEntries(v, baseRace) {
  const baseNames = new Set((baseRace?.entries ?? []).filter((e) => e?.name).map((e) => e.name));
  const specific = (v?.entries ?? []).filter((e) => e?.name && !baseNames.has(e.name));
  return specific.length ? specific : (v?.entries ?? []);
}

/**
 * @param {object} baseRace  raça base (com `_versions` e/ou sub-raças no db)
 * @param {object|null} [db]  compêndio (p/ as sub-raças; a lista da entity
 *   também recebe o db em runtime - este parâmetro cobre chamadas diretas)
 * @returns {object} config de entity (para PickerField/SelectorPanel)
 */
export function makeLineageEntity(baseRace, db = null) {
  return {
    type: 'lineage',
    // Como a ESPÉCIE chama essa escolha, segundo o dado ("Variable Trait" no
    // Custom Lineage, "Kobold Legacy", "Giant Ancestry"…); genérico se não disser.
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
      // Modo de movimento que a base não tem (o voo do Tiefling Winged) - é o
      // traço definidor da linhagem e some se olharmos só o deslocamento a pé.
      for (const mode of ['fly', 'swim', 'climb']) {
        const value = typeof v.speed === 'object' ? v.speed?.[mode] : null;
        const base = typeof baseRace?.speed === 'object' ? baseRace.speed?.[mode] : null;
        if (value && value !== base) out.push({ label: cap(mode), value: `${value} ft`, highlight: true });
      }
      // Ancestralidade de dragão: o tipo de dano resistido é o traço definidor.
      const resist = lineageResist(v, baseRace);
      if (resist.length) out.push({ label: 'Resistance', value: resist.map(cap).join(', '), highlight: true });
      return out;
    },

    card: (v) => ({ title: lineageShort(v), subtitle: v.source, badges: [] }),

    entries: (v) => lineageEntries(v, baseRace),
  };
}
