// =============================================================================
// subclassPreview - monta os `entries` de uma subclasse para o preview
// =============================================================================
// No 5etools a subclasse é só uma lista de referências (`subclassFeatures`) que
// apontam para entradas em `db['class-X'].subclassFeature`. O texto de cada
// feature ainda pode conter `refSubclassFeature` (inclui outra feature inline -
// é assim que o Battle Master, por ex., traz "Combat Superiority"/"Maneuvers")
// e `refOptionalfeature` (aponta p/ manobras etc.). Resolvemos as referências e
// devolvemos uma árvore de entries pronta p/ o EntryContent, para o jogador ver
// TODAS as features da subclasse antes de escolher (como o Plutonium importa).
// -----------------------------------------------------------------------------

import { resolveOptionalRefs } from './optionalFeatures';
import { resolveCopies } from '../selector/copy';

const norm = (s) => (s ?? '').toString().trim().toLowerCase();

// Id de unicidade de uma subclassFeature (p/ resolver `_copy`): algumas features
// são STUBS `_copy` de corpo vazio que herdam o texto de outra (ex: as domains de
// clérigo XPHB copiam o corpo das versões PHB). Sem resolver, o preview/progressão
// vêm vazios.
const featureCopyId = (f) =>
  [f.name, f.source, f.classSource, f.subclassShortName, f.subclassSource, f.level]
    .map((x) => norm(x))
    .join('|');

/** Chave forte (com fonte) e chave frouxa (sem fonte) de uma feature. */
function strongKey(name, shortName, source, level) {
  return `${norm(name)}|${norm(shortName)}|${norm(source)}|${level}`;
}
function looseKey(name, shortName, level) {
  return `${norm(name)}|${norm(shortName)}|${level}`;
}

/** "name|className|classSource|subShortName|subSource|level" → objeto. */
function parseRef(ref) {
  const [name, , , shortName, source, level] = String(ref).split('|');
  return { name, shortName, source, level: Number(level) };
}

/**
 * Lista de features da subclasse com refs resolvidas/inlinadas.
 * @param {object} db
 * @param {string} classId       ex: 'fighter'
 * @param {object} subclass      objeto de subclasse (com subclassFeatures[])
 * @returns {{name:string, level:number, entries:Array}[]}
 */
export function subclassFeatureList(db, classId, subclass) {
  if (!Array.isArray(subclass?.subclassFeatures)) return [];
  // Resolve `_copy` no pool de features (stubs que herdam o corpo de outra).
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

  // Expande refs dentro do corpo de uma feature (recursivo, à prova de ciclo).
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
  // Emite uma feature, SEPARANDO os refSubclassFeature DIRETOS (top-level) em
  // features próprias no mesmo nível - em vez de empacotar tudo da subclasse num
  // bloco só (ex: College of Swords/Battle Master no nível 3). Assim as features
  // ficam separadas como nos níveis maiores; refs ANINHADOS (dentro de `options`)
  // continuam inlinados. Recursivo à prova de ciclo (via `seen`).
  const emitFeature = (f) => {
    if (!f || seen.has(keyOf(f))) return;
    seen.add(keyOf(f));
    const directRefs = [];
    const body = [];
    for (const e of f.entries ?? []) {
      if (e && typeof e === 'object' && e.type === 'refSubclassFeature') directRefs.push(e);
      else body.push(e);
    }
    // A "umbrella" só entra como card se sobrar corpo próprio (prosa de intro etc.).
    if (body.length > 0) {
      out.push({ name: f.name, level: f.level, entries: resolveOptionalRefs(expand(body), db) });
    }
    for (const r of directRefs) emitFeature(find(parseRef(r.subclassFeature)));
  };
  for (const ref of subclass.subclassFeatures) emitFeature(find(parseRef(ref)));
  return out;
}

/**
 * Entries prontos p/ o EntryContent (preview do seletor de subclasse).
 * @returns {Array}
 */
export function resolveSubclassEntries(db, classId, subclass) {
  return subclassFeatureList(db, classId, subclass).map((f) => ({
    type: 'entries',
    name: `Level ${f.level}: ${f.name}`,
    entries: f.entries,
  }));
}
