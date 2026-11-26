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
//   subclassTeaser(db, classId, s): o resumo do carrossel: a introdução da
//     subclasse e as features por nível.
//
// DECISÕES E ARMADILHAS
//   - Sem arte no fluff (só o SRD embutido), a imagem vem dos retratos do Wesnoth que o dono
//     cruzou com o SRD (`withSrdArt`, `selector/srdArt.js`, DDL-0335).
//   - As subclasses da reedição cosmética da classe (`classSource` "WoW", cópias das
//     do XPHB, DDL-0190) saem da lista: seriam duplicatas com o mesmo nome.
//   - O id inclui classSource: a cópia "compat" (Armorer TCE na classe EFA) colide
//     com a original em name|source.
//   - Carrossel (DDL-0286): o resumo é a introdução que a própria feature-guarda-chuva
//     da subclasse traz (o texto que a apresenta) e os nomes das features por nível;
//     sem arte, o ícone da classe.
//   - Subclasses não usam reprintedAs de forma consistente (e há duplicatas na
//     mesma fonte): dedup por shortName.
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';
import { resolveCopies } from '../copy';
import { resolveSubclassEntries, subclassFeatureList } from '../../engine/subclassPreview';
import { firstParagraph, levelLines } from '../teaser';
import { classIcon } from './class';
import { reskinSources } from '../../engine/resolve';
import { withSrdArt, subclassArtKey } from '../srdArt';

const subclassIdOf = (s) => `${s.shortName ?? s.name}|${s.source}|${s.classSource ?? ''}`;

function dedupeByShortName(list) {
  const map = new Map();
  for (const s of list) {
    const cur = map.get(s.shortName);
    if (!cur || s.source === 'XPHB') map.set(s.shortName, s);
  }
  return [...map.values()];
}

/** O resumo do carrossel: a introdução da subclasse e as features por nível. */
function subclassTeaser(db, classId, s) {
  const names = new Set([s.name, s.shortName].filter(Boolean).map((n) => n.toLowerCase()));
  const list = subclassFeatureList(db, classId, s);
  const intro = list.find((f) => names.has(String(f.name).toLowerCase()));
  const byLevel = new Map();
  for (const f of list) {
    if (f === intro) continue;
    if (!byLevel.has(f.level)) byLevel.set(f.level, []);
    byLevel.get(f.level).push(f.name);
  }
  return [firstParagraph(intro?.entries), ...levelLines(byLevel)].filter(Boolean);
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
          .filter((s) => !reskinSources(db, classId).has(s.classSource))
      ),

    idOf: (s) => `${s.shortName}|${s.source}`,

    precompute: (s) => ({
      searchText: `${s.name} ${s.source}`.toLowerCase(),
      filterValues: { source: [s.source].filter(Boolean) },
    }),

    filters: [{ id: 'source', header: 'Source', derive: true }],

    cardShape: { subtitle: true },
    card: (s) => ({ title: s.name, subtitle: s.source, badges: [] }),

    carousel: true,

    icon: () => classIcon(classId),

    teaser: (s, db) => subclassTeaser(db, classId, s),

    entries: (s, db) => resolveSubclassEntries(db, classId, s),

    fluff: (s, db) => {
      const list = db?.[`fluff-class-${classId}`]?.subclassFluff ?? [];
      const match =
        list.find((f) => f.shortName === s.shortName && f.source === s.source) ??
        list.find((f) => f.shortName === s.shortName) ??
        null;
      return withSrdArt(subclassArtKey(s), match?.images?.length ? { images: match.images } : null);
    },
  };
}
