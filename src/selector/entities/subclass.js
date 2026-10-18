// =============================================================================
// subclass: a entity de subclasse, por classe
// =============================================================================
// O QUE FAZ
//   As subclasses ficam no arquivo da classe (db['class-X'].subclass), então a
//   entity é gerada por classe. O preview traz TODAS as features resolvidas e a
//   arte (subclassFluff, casada pelo shortName).
//
// FUNÇÕES
//   subclassIdOf(s): shortName|source|classSource.
//   dedupeByShortName(list): dedup preferindo XPHB.
//   makeSubclassEntity(classId, title): a fábrica.
//
// DECISÕES E ARMADILHAS
//   - O id inclui classSource: a cópia "compat" (Armorer TCE na classe EFA) colide
//     com a original em name|source.
//   - Subclasses não usam reprintedAs de forma consistente (e há duplicatas na
//     mesma fonte): dedup por shortName.
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';
import { resolveCopies } from '../copy';
import { resolveSubclassEntries } from '../../engine/subclassPreview';

const subclassIdOf = (s) => `${s.shortName ?? s.name}|${s.source}|${s.classSource ?? ''}`;

function dedupeByShortName(list) {
  const map = new Map();
  for (const s of list) {
    const cur = map.get(s.shortName);
    if (!cur || s.source === 'XPHB') map.set(s.shortName, s);
  }
  return [...map.values()];
}

/**
 * A entity de subclasse de uma classe.
 * @param {string} classId
 * @param {string} [title]
 */
export function makeSubclassEntity(classId, title = 'Subclass') {
  return {
    type: 'subclass',
    title,

    // ATENÇÃO: resolveCopies ANTES do latestOnly; só assim a cópia compat herda o reprintedAs.
    list: (db) =>
      dedupeByShortName(
        latestOnly(resolveCopies(db?.[`class-${classId}`]?.subclass ?? [], subclassIdOf))
      ),

    idOf: (s) => `${s.shortName}|${s.source}`,

    precompute: (s) => ({
      searchText: `${s.name} ${s.source}`.toLowerCase(),
      filterValues: { source: [s.source].filter(Boolean) },
    }),

    filters: [{ id: 'source', header: 'Source', derive: true }],

    card: (s) => ({ title: s.name, subtitle: s.source, badges: [] }),

    entries: (s, db) => resolveSubclassEntries(db, classId, s),

    fluff: (s, db) => {
      const list = db?.[`fluff-class-${classId}`]?.subclassFluff ?? [];
      const match =
        list.find((f) => f.shortName === s.shortName && f.source === s.source) ??
        list.find((f) => f.shortName === s.shortName) ??
        null;
      return match?.images?.length ? { images: match.images } : null;
    },
  };
}
