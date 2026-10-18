// =============================================================================
// subclassPreview: os entries de uma subclasse para o preview
// =============================================================================
// O QUE FAZ
//   No 5etools a subclasse é só uma lista de refs (`subclassFeatures`) para
//   `db['class-X'].subclassFeature`. O texto ainda pode ter `refSubclassFeature`
//   (inclui outra feature inline, como o Combat Superiority do Battle Master) e
//   `refOptionalfeature` (manobras). As refs são resolvidas numa árvore pronta
//   para o EntryContent, para o jogador ver TODAS as features antes de escolher.
//
// FUNÇÕES
//   norm(s), featureCopyId(f): normalização e id de `_copy`.
//   strongKey(name, shortName, source, level), looseKey(name, shortName, level):
//     as chaves com e sem fonte.
//   parseRef(ref): uma ref de feature de subclasse como objeto.
//   subclassFeatureList(db, classId, subclass): as features com refs resolvidas.
//   resolveSubclassEntries(db, classId, subclass): os entries do preview.
//
// DECISÕES E ARMADILHAS
//   - Algumas features são STUBS `_copy` de corpo vazio (as domains de Clérigo
//     XPHB copiam o texto das PHB); sem resolver, preview e progressão vêm vazios.
//   - Os refSubclassFeature DIRETOS de uma feature viram features próprias no
//     mesmo nível (como nos níveis maiores); os aninhados em `options` seguem
//     inlinados. Recursivo e à prova de ciclo.
//   - `atLevel` (TC-0044, TC-0045): o stub de uma subclasse legada no chassi 2024
//     reaponta a umbrella para o nível novo, mas as refs dentro dela apontam o
//     nível ANTIGO. Elas vêm junto com a umbrella e herdam o nível dela (DDL-0053).
//   - A umbrella só vira card se sobrar corpo próprio (a intro).
// -----------------------------------------------------------------------------

import { resolveOptionalRefs } from './optionalFeatures';
import { resolveCopies } from '../selector/copy';

const norm = (s) => (s ?? '').toString().trim().toLowerCase();

const featureCopyId = (f) =>
  [f.name, f.source, f.classSource, f.subclassShortName, f.subclassSource, f.level]
    .map((x) => norm(x))
    .join('|');

/** A chave forte (com fonte) de uma feature. */
function strongKey(name, shortName, source, level) {
  return `${norm(name)}|${norm(shortName)}|${norm(source)}|${level}`;
}
function looseKey(name, shortName, level) {
  return `${norm(name)}|${norm(shortName)}|${level}`;
}

/** Uma ref "name|className|classSource|subShortName|subSource|level" como objeto. */
function parseRef(ref) {
  const [name, , , shortName, source, level] = String(ref).split('|');
  return { name, shortName, source, level: Number(level) };
}

/**
 * As features da subclasse com as refs resolvidas.
 * @param {object} db
 * @param {string} classId
 * @param {object} subclass
 * @returns {{name:string, level:number, entries:Array}[]}
 */
export function subclassFeatureList(db, classId, subclass) {
  if (!Array.isArray(subclass?.subclassFeatures)) return [];
  const features = resolveCopies(db?.[`class-${classId}`]?.subclassFeature ?? [], featureCopyId);

  const byStrong = new Map();
  const byLoose = new Map();
  for (const f of features) {
    byStrong.set(strongKey(f.name, f.subclassShortName, f.subclassSource, f.level), f);
    byLoose.set(looseKey(f.name, f.subclassShortName, f.level), f);
  }
  const find = (r) =>
    byStrong.get(strongKey(r.name, r.shortName, r.source, r.level)) ??
    byLoose.get(looseKey(r.name, r.shortName, r.level)) ??
    null;

  const seen = new Set();
  const keyOf = (f) => strongKey(f.name, f.subclassShortName, f.subclassSource, f.level);

  const expand = (entries) => {
    const out = [];
    for (const e of entries ?? []) {
      if (e && typeof e === 'object' && e.type === 'refSubclassFeature') {
        const f = find(parseRef(e.subclassFeature));
        if (f && !seen.has(keyOf(f))) {
          seen.add(keyOf(f));
          out.push({ type: 'entries', name: f.name, entries: expand(f.entries) });
        }
        continue;
      }
      if (e && typeof e === 'object' && (e.entries || e.items)) {
        const clone = { ...e };
        if (e.entries) clone.entries = expand(e.entries);
        if (e.items) clone.items = expand(e.items);
        out.push(clone);
        continue;
      }
      out.push(e);
    }
    return out;
  };

  const out = [];
  const emitFeature = (f, atLevel) => {
    if (!f || seen.has(keyOf(f))) return;
    seen.add(keyOf(f));
    const level = atLevel ?? f.level;
    const directRefs = [];
    const body = [];
    for (const e of f.entries ?? []) {
      if (e && typeof e === 'object' && e.type === 'refSubclassFeature') directRefs.push(e);
      else body.push(e);
    }
    if (body.length > 0) {
      out.push({ name: f.name, level, entries: resolveOptionalRefs(expand(body), db) });
    }
    for (const r of directRefs) emitFeature(find(parseRef(r.subclassFeature)), level);
  };
  for (const ref of subclass.subclassFeatures) emitFeature(find(parseRef(ref)));
  return out;
}

/**
 * Os entries prontos para o preview.
 * @returns {Array}
 */
export function resolveSubclassEntries(db, classId, subclass) {
  return subclassFeatureList(db, classId, subclass).map((f) => ({
    type: 'entries',
    name: `Level ${f.level}: ${f.name}`,
    entries: f.entries,
  }));
}
