// =============================================================================
// classProgression: as features de classe e de subclasse agrupadas por nível
// =============================================================================
// O QUE FAZ
//   A visão de progressão da aba Class, no estilo da página de classe do 5e.tools:
//   por nível, as features de CLASSE (refs resolvidas em classFeature) e, com
//   subclasse escolhida, as DELA (subclassFeatureList, que inlina as refs). Também
//   achata a tabela de progressão.
//
// FUNÇÕES
//   norm(s): normalização.
//   classFeatureItems(db, classId, classObj): as features de classe resolvidas,
//     com os refClassFeature do texto inlinados (as opções do Divine Order).
//   classFeatureLevels(db, classId, classObj, subclass): níveis 1 a 20; nível sem
//     feature não aparece.
//   isLongFeature(entries): é uma lista de opções (começa colapsada na UI)?
//   cellText(v): o texto de uma célula; 0 em coluna de slot vira "-".
//   classTable(classObj, subclass): { cols, rows } com Level, PB e as colunas;
//     subclasses com tabela própria (Eldritch Knight) entram no fim.
// -----------------------------------------------------------------------------

import { parseFeatureRef } from './classData';
import { subclassFeatureList } from './subclassPreview';
import { resolveOptionalRefs } from './optionalFeatures';

const norm = (s) => (s ?? '').toString().trim().toLowerCase();

/**
 * @typedef {Object} LevelFeatures
 * @property {number} level
 * @property {{key:string, name:string, entries:Array, from:'class'|'subclass'}[]} features
 */

/**
 * As features de classe resolvidas, com as refs do texto inlinadas.
 * @returns {{name:string, level:number, entries:Array}[]}
 */
function classFeatureItems(db, classId, classObj) {
  const pool = db?.[`class-${classId}`]?.classFeature ?? [];
  const byStrong = new Map();
  const byLoose = new Map();
  for (const f of pool) {
    byStrong.set(`${norm(f.name)}|${norm(f.classSource)}|${f.level}`, f);
    byLoose.set(`${norm(f.name)}|${f.level}`, f);
  }
  const findFeature = (name, source, level) =>
    byStrong.get(`${norm(name)}|${norm(source)}|${level}`) ?? byLoose.get(`${norm(name)}|${level}`);

  const seen = new Set();
  const inlineRefs = (entries) => {
    const walk = (e) => {
      if (Array.isArray(e)) return e.map(walk);
      if (!e || typeof e !== 'object') return e;
      if (e.type === 'refClassFeature') {
        const r = parseFeatureRef(e.classFeature);
        const f = findFeature(r.name, r.source, r.level);
        const key = f ? `${norm(f.name)}|${f.level}` : String(e.classFeature);
        if (f && !seen.has(key)) {
          seen.add(key);
          return { type: 'entries', name: f.name, entries: walk(f.entries ?? []) };
        }
        return { type: 'entries', name: r.name, entries: [] };
      }
      const clone = { ...e };
      if (e.entries) clone.entries = walk(e.entries);
      if (e.items) clone.items = walk(e.items);
      return clone;
    };
    return walk(entries ?? []);
  };

  const out = [];
  for (const ref of classObj?.classFeatures ?? []) {
    const r = parseFeatureRef(ref);
    const f = findFeature(r.name, r.source || classObj.source, r.level);
    if (f) {
      out.push({ name: f.name, level: f.level, entries: resolveOptionalRefs(inlineRefs(f.entries ?? []), db) });
    }
  }
  return out;
}

/**
 * A progressão (1 a 20) de uma classe, com subclasse opcional.
 * @param {object} db
 * @param {string} classId
 * @param {object} classObj
 * @param {object} [subclass]
 * @returns {LevelFeatures[]}
 */
export function classFeatureLevels(db, classId, classObj, subclass = null) {
  const byLevel = new Map();
  const push = (level, feature) => {
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level).push(feature);
  };

  for (const f of classFeatureItems(db, classId, classObj)) {
    push(f.level, { key: `c|${f.name}|${f.level}`, name: f.name, entries: f.entries, from: 'class' });
  }
  if (subclass) {
    for (const f of subclassFeatureList(db, classId, subclass)) {
      push(f.level, { key: `s|${f.name}|${f.level}`, name: f.name, entries: f.entries, from: 'subclass' });
    }
  }

  return [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, features]) => ({ level, features }));
}

/** A feature é uma lista longa de opções? */
export function isLongFeature(entries) {
  let refs = 0;
  let hasOptions = false;
  const walk = (e) => {
    if (Array.isArray(e)) return e.forEach(walk);
    if (!e || typeof e !== 'object') return;
    if (e.type === 'options') hasOptions = true;
    if (e.type === 'refOptionalfeature') refs += 1;
    if (e.entries) walk(e.entries);
    if (e.items) walk(e.items);
  };
  walk(entries);
  if (hasOptions || refs >= 6) return true;
  try {
    return JSON.stringify(entries ?? []).length > 3500;
  } catch {
    return false;
  }
}

/** O texto de uma célula da tabela. */
function cellText(v) {
  if (v == null) return '-';
  if (typeof v === 'object') {
    if (v.type === 'bonus') return `+${v.value}`;
    if (v.type === 'bonusSpeed') return `+${v.value} ft.`;
    if (v.type === 'dice') {
      return v.displayText ?? (v.toRoll ?? []).map((d) => `${d.number}d${d.faces}`).join('+');
    }
    return String(v.value ?? '');
  }
  if (v === 0) return '-';
  return String(v);
}

/**
 * A tabela de progressão achatada.
 * @param {object} classObj
 * @param {object} [subclass]
 * @returns {{cols: string[], rows: string[][]}|null}
 */
export function classTable(classObj, subclass = null) {
  const groups = [
    ...(classObj?.classTableGroups ?? []),
    ...(subclass?.subclassTableGroups ?? []),
  ];
  if (groups.length === 0) return null;
  const cols = ['Level', 'PB', ...groups.flatMap((g) => g.colLabels ?? [])];
  const rows = [];
  for (let i = 0; i < 20; i++) {
    const row = [String(i + 1), `+${Math.ceil((i + 1) / 4) + 1}`];
    for (const g of groups) {
      const src = g.rows ?? g.rowsSpellProgression ?? [];
      for (const v of src[i] ?? Array((g.colLabels ?? []).length).fill(null)) row.push(cellText(v));
    }
    rows.push(row);
  }
  return { cols, rows };
}
