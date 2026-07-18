// =============================================================================
// Entity config: Subclass (fábrica - depende da classe escolhida)
// =============================================================================
// As subclasses ficam no arquivo da classe (db['class-X'].subclass). A lista é
// específica de cada classe, então a entity é gerada por uma função. latestOnly
// remove reprints (mostra só as versões atuais).
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';
import { resolveCopies } from '../copy';
import { resolveSubclassEntries } from '../../engine/subclassPreview';

// Id de unicidade p/ subclasse: shortName|source|classSource - a cópia "compat"
// de uma subclasse antiga anexada à classe nova (ex: Armorer TCE → classe EFA)
// colide com a original em name|source.
const subclassIdOf = (s) => `${s.shortName ?? s.name}|${s.source}|${s.classSource ?? ''}`;

// Subclasses não usam reprintedAs de forma consistente (e há duplicatas na mesma
// fonte). Dedup por shortName, preferindo a versão 2024 (XPHB).
function dedupeByShortName(list) {
  const map = new Map();
  for (const s of list) {
    const cur = map.get(s.shortName);
    if (!cur || s.source === 'XPHB') map.set(s.shortName, s);
  }
  return [...map.values()];
}

/**
 * @param {string} classId  ex: 'fighter'
 * @param {string} [title]  título do painel (ex: "Fighter Subclass")
 */
export function makeSubclassEntity(classId, title = 'Subclass') {
  return {
    type: 'subclass',
    title,

    // resolveCopies primeiro: cópias "compat" (_copy com _preserve.reprintedAs)
    // herdam o reprintedAs da original → latestOnly descarta TCE quando há EFA.
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

    // Todas as features da subclasse (resolvidas), p/ o jogador ver antes de escolher.
    entries: (s, db) => resolveSubclassEntries(db, classId, s),

    // Arte da subclasse (fluff-class-*.json → subclassFluff), casada por shortName.
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
