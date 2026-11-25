// =============================================================================
// matrix: as unidades do sweep, enumeradas do dado (Fase T)
// =============================================================================
// O QUE FAZ
//   As linhas da matriz saem do MESMO recorte que a UI oferece (entities do
//   seletor, latestOnly), nunca de listas hardcoded: toda classe x subclasse e toda
//   espécie x linhagem que o jogador pode escolher vira uma linha testável.
//
// FUNÇÕES
//   classMatrix(db): uma linha por subclasse pickável; classe sem subclasse no db
//     vira uma linha só.
//   speciesMatrix(db): uma linha POR linhagem (inclui `_versions` e sub-raças
//     fundidas); a base ganha linha própria quando a linhagem NÃO é obrigatória
//     (sem linhagens, ou só as legadas curadas do DDL-0058, que são opcionais).
//   defaultSpecies(db): a espécie fixa das linhas de classe (Dwarf XPHB, para
//     isolar a unidade sob teste); com linhagens, a primeira.
//   featMatrix(db), spellMatrix(db), itemMatrix(db): as unidades da T3
//     (TESTING-PLAN §5b), do mesmo recorte dos seletores de talento, magia e loja.
//   variantCategory(v): a categoria de base de uma variante gerada.
// -----------------------------------------------------------------------------

import { CLASS_NAMES } from '../../src/data/config';
import { resolveClassObj } from '../../src/engine/resolve';
import { raceLineages, requiresLineage } from '../../src/engine/speciesData';
import { makeSubclassEntity } from '../../src/selector/entities/subclass';
import raceEntity from '../../src/selector/entities/race';
import { makeFeatEntity } from '../../src/selector/entities/feat';
import spellEntity from '../../src/selector/entities/spell';
import itemEntity from '../../src/selector/entities/item';

/**
 * As linhas de CLASSE x SUBCLASSE.
 * @returns {Array<{id, kind:'class', classId, classSource, className,
 *   subclassId:string|null, subclassSource:string|null}>}
 */
export function classMatrix(db) {
  const rows = [];
  for (const classId of CLASS_NAMES) {
    const classObj = resolveClassObj(db, classId);
    if (!classObj) continue;
    const subs = makeSubclassEntity(classId).list(db);
    if (subs.length === 0) {
      rows.push({
        id: `class:${classId}`,
        kind: 'class',
        classId,
        classSource: classObj.source,
        className: classObj.name,
        subclassId: null,
        subclassSource: null,
      });
      continue;
    }
    for (const s of subs) {
      rows.push({
        id: `class:${classId}/${s.shortName}`,
        kind: 'class',
        classId,
        classSource: classObj.source,
        className: classObj.name,
        subclassId: s.shortName,
        subclassSource: s.source,
      });
    }
  }
  return rows;
}

/**
 * As linhas de ESPÉCIE x LINHAGEM.
 * @returns {Array<{id, kind:'species', speciesId, speciesSource, speciesName,
 *   lineage:string|null}>}
 */
export function speciesMatrix(db) {
  const rows = [];
  for (const race of raceEntity.list(db)) {
    const versions = raceLineages(db, race);
    const base = {
      kind: 'species',
      speciesId: race.name.toLowerCase(),
      speciesSource: race.source,
      speciesName: race.name,
    };
    if (!requiresLineage(db, race)) {
      rows.push({ ...base, id: `species:${race.name}|${race.source}`, lineage: null });
    }
    for (const v of versions) {
      rows.push({ ...base, id: `species:${race.name}|${race.source}/${v.name}`, lineage: v.name });
    }
  }
  return rows;
}

/** A espécie default das linhas de classe. */
export function defaultSpecies(db) {
  const race =
    raceEntity.list(db).find((r) => r.name === 'Dwarf' && r.source === 'XPHB') ??
    raceEntity.list(db)[0];
  if (!race) return null;
  const versions = raceLineages(db, race);
  return {
    speciesId: race.name.toLowerCase(),
    speciesSource: race.source,
    lineage: versions.length ? versions[0].name : null,
  };
}

const FEAT_CATEGORIES = ['O', 'G', 'FS', 'FS:P', 'FS:R', 'EB', 'D', 'DG'];

/**
 * As linhas de TALENTO (T3): todo talento que o seletor oferece, com a categoria.
 * @returns {Array<{id, kind:'feat', name, source, category}>}
 */
export function featMatrix(db) {
  return makeFeatEntity(FEAT_CATEGORIES, 'Feat').list(db).map((f) => ({
    id: `feat:${f.name}|${f.source}`,
    kind: 'feat',
    name: f.name,
    source: f.source,
    category: f.category ?? 'G',
  }));
}

/**
 * As linhas de MAGIA (T3): toda magia do seletor, com o círculo.
 * @returns {Array<{id, kind:'spell', name, source, level}>}
 */
export function spellMatrix(db) {
  return spellEntity.list(db).map((s) => ({ id: `spell:${s.name}|${s.source}`, kind: 'spell', name: s.name, source: s.source, level: s.level ?? 0 }));
}

/** A categoria de base de uma variante gerada, para escolher uma base por modelo. */
function variantCategory(v) {
  if (v.weapon || v.weaponCategory) return v.type?.startsWith('R') ? 'weapon-ranged' : 'weapon-melee';
  if (v.type?.startsWith('S')) return 'shield';
  if (v.type?.startsWith('A')) return 'ammunition';
  if (v.armor || /^(LA|MA|HA)/.test(v.type ?? '')) return `armor-${String(v.type).slice(0, 2).toLowerCase()}`;
  return 'other';
}

/**
 * As linhas de ITEM (T3): base e itens um a um; as variantes geradas, uma por MODELO
 * e categoria de base (a variante é o modelo aplicado).
 * @returns {Array<{id, kind:'item'|'variant', name, source, template?, category?}>}
 */
export function itemMatrix(db) {
  const rows = [];
  const seen = new Set();
  for (const r of itemEntity.list(db)) {
    if (r._variantName) {
      const category = variantCategory(r);
      const key = `${r._variantName}/${category}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ id: `variant:${key}`, kind: 'variant', name: r.name, source: r.source, template: r._variantName, category });
      continue;
    }
    rows.push({ id: `item:${r.name}|${r.source}`, kind: 'item', name: r.name, source: r.source });
  }
  return rows;
}
