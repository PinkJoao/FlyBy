// =============================================================================
// matrix - enumeração data-driven das unidades do sweep (Fase T)
// =============================================================================
// As linhas da matriz saem do MESMO recorte que a UI oferece (entities do
// seletor, latestOnly), nunca de listas hardcoded: toda classe × subclasse e
// toda espécie × linhagem que o jogador pode escolher vira uma linha testável.
// -----------------------------------------------------------------------------

import { CLASS_NAMES } from '../../src/data/config';
import { resolveClassObj } from '../../src/engine/resolve';
import { raceLineages, requiresLineage } from '../../src/engine/speciesData';
import { makeSubclassEntity } from '../../src/selector/entities/subclass';
import raceEntity from '../../src/selector/entities/race';

/**
 * Linhas de CLASSE × SUBCLASSE. Cada subclasse pickável (mesma lista do
 * seletor) vira uma linha; uma classe sem subclasses no db vira uma linha só.
 * @returns {Array<{id, kind:'class', classId, classSource, className,
 *                  subclassId:string|null, subclassSource:string|null}>}
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
 * Linhas de ESPÉCIE × LINHAGEM. Uma linha POR linhagem; a raça base ganha uma
 * linha própria quando a linhagem NÃO é obrigatória (sem linhagens, ou só com as
 * legadas curadas do DDL-0058, que são opcionais - ver requiresLineage).
 * @returns {Array<{id, kind:'species', speciesId, speciesSource, speciesName,
 *                  lineage:string|null}>}
 */
export function speciesMatrix(db) {
  const rows = [];
  for (const race of raceEntity.list(db)) {
    const versions = raceLineages(db, race); // `_versions` + sub-raças fundidas
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

/**
 * A espécie DEFAULT das linhas de classe - fixa (Dwarf XPHB) para isolar a
 * unidade sob teste; se a raça tiver linhagens, pega a primeira (obrigatória).
 */
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
