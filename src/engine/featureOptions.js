// =============================================================================
// featureOptions: as escolhas de "uma das seguintes sub-features"
// =============================================================================
// O QUE FAZ
//   Duas formas no 5etools, ambas tratadas aqui:
//     1. ESTRUTURADA: bloco `type:'options'` com `refClassFeature` (Divine Order,
//        Primal Order, Elemental Fury); o count vem do bloco.
//     2. EM PROSA: "you gain one of the following ... of your choice", com as
//        opções como sub-entries nomeadas ou refs, sem o bloco. A prosa é frágil,
//        então um conjunto CURADO (CHOOSE_ONE_FEATURES) marca QUAIS features são
//        "escolha 1", e as opções são EXTRAÍDAS das sub-entries.
//   Não confundir com `options` + `refOptionalfeature` (Maneuvers, Metamagic,
//   Invocations): esses são o optionalfeatureProgression, com seletor próprio.
//
// FUNÇÕES
//   norm(s), featureCopyId(f): normalização e id de cópia.
//   poolIndex(pool): índice nome|nível do pool de features.
//   findOptionBlocks(entries, out): os blocos `options` estruturados.
//   isOptionLike(e): é uma sub-feature nomeada ou uma ref?
//   findChooseGroup(entries): o primeiro grupo (BFS) de 2+ opções irmãs.
//   optionToCard(e, resolveRef): uma opção como card { value, label, entries }.
//   curatedOptions(feature, resolveRef): as opções de uma feature curada.
//   featureOptionChoices(db, classId, classObj, level): as escolhas das features
//     de CLASSE até o nível.
//   subclassFeatureOptionChoices(db, classId, subclass, level): as de SUBCLASSE.
//
// DECISÕES E ARMADILHAS
//   - CHOOSE_ONE_FEATURES: `true` extrai as opções da feature; uma lista explícita
//     serve quando as opções não são sub-features (tipos de dano). A chave é o nome
//     da feature em minúsculas, único entre as classes.
//   - O Storm Aura do Storm Herald É escolha real ("Choose desert, sea, or
//     tundra", TC-0019), ao contrário dos grant-all (Genie, Psi Warrior,
//     Soulknife; DDL-0002). Storm Soul e Raging Storm SEGUEM essa escolha.
//   - Os ids de subclasse começam com `sub:`, para serem podados quando a
//     subclasse troca.
// -----------------------------------------------------------------------------

import { resolveCopies } from '../selector/copy';
import { parseFeatureRef } from './classData';

const norm = (s) => (s ?? '').toString().trim().toLowerCase();

const featureCopyId = (f) =>
  [f.name, f.source, f.classSource, f.subclassShortName, f.subclassSource, f.level].map(norm).join('|');

const DAMAGE_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];
const CHOOSE_ONE_FEATURES = {
  'blessed strikes': true,
  "hunter's prey": true,
  'defensive tactics': true,
  "superior hunter's defense": true,
  'rage of the wilds': true,
  'aspect of the wilds': true,
  'power of the wilds': true,
  'storm aura': true,
  'armor model': true,
  'the third eye': true,
  'fiendish resilience': ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'],
  'elemental epitome': DAMAGE_TYPES,
};

/** Índice frouxo (nome|nível) do pool de features. */
function poolIndex(pool) {
  const byLoose = new Map();
  for (const f of pool) byLoose.set(`${norm(f.name)}|${f.level}`, f);
  return byLoose;
}

/** Os blocos `options` de refClassFeature (forma estruturada). */
function findOptionBlocks(entries, out = []) {
  const walk = (e) => {
    if (Array.isArray(e)) return e.forEach(walk);
    if (!e || typeof e !== 'object') return;
    if (e.type === 'options') {
      const refs = (e.entries ?? []).filter((x) => x?.type === 'refClassFeature');
      if (refs.length) out.push({ count: e.count ?? 1, refs: refs.map((r) => r.classFeature) });
    }
    if (e.entries) walk(e.entries);
    if (e.items) walk(e.items);
  };
  walk(entries);
  return out;
}

/** É uma sub-feature nomeada ou uma ref de feature? */
function isOptionLike(e) {
  return (
    e &&
    typeof e === 'object' &&
    ((e.type === 'entries' && e.name) || e.type === 'refClassFeature' || e.type === 'refSubclassFeature')
  );
}

/** O primeiro grupo (BFS) de duas ou mais opções irmãs. */
function findChooseGroup(entries) {
  const queue = [entries];
  while (queue.length) {
    const arr = queue.shift();
    if (!Array.isArray(arr)) continue;
    const opts = arr.filter(isOptionLike);
    if (opts.length >= 2) return opts;
    for (const e of arr) {
      if (e && typeof e === 'object') {
        if (Array.isArray(e.entries)) queue.push(e.entries);
        if (Array.isArray(e.items)) queue.push(e.items);
      }
    }
  }
  return null;
}

/** Uma opção como card { value, label, entries }. */
function optionToCard(e, resolveRef) {
  if (e.type === 'refClassFeature' || e.type === 'refSubclassFeature') {
    const r = resolveRef(e);
    return r ? { value: `${r.name}|${r.source}`, label: r.name, entries: r.entries ?? [] } : null;
  }
  return { value: e.name, label: e.name, entries: e.entries ?? [] };
}

/** As opções de uma feature curada: explícitas ou extraídas. */
function curatedOptions(feature, resolveRef) {
  const spec = CHOOSE_ONE_FEATURES[norm(feature.name)];
  if (!spec) return null;
  if (Array.isArray(spec)) return spec.map((v) => ({ value: v, label: v, entries: [] }));
  const group = findChooseGroup(feature.entries);
  return group ? group.map((e) => optionToCard(e, resolveRef)).filter(Boolean) : [];
}

/**
 * Escolhas de sub-feature das features de classe até o nível.
 * @returns {import('./choices').Choice[]}
 */
export function featureOptionChoices(db, classId, classObj, level) {
  const pool = resolveCopies(db?.[`class-${classId}`]?.classFeature ?? [], featureCopyId);
  const idx = poolIndex(pool);
  const resolveRef = (e) => {
    const rr = parseFeatureRef(e.classFeature);
    const sub = idx.get(`${norm(rr.name)}|${rr.level}`);
    return sub ? { name: sub.name, source: sub.source, entries: sub.entries } : null;
  };
  const out = [];

  for (const ref of classObj?.classFeatures ?? []) {
    const r = parseFeatureRef(ref);
    if (r.level > level) continue;
    const feature = idx.get(`${norm(r.name)}|${r.level}`);
    if (!feature) continue;

    for (const block of findOptionBlocks(feature.entries)) {
      const options = block.refs.map((cf) => optionToCard({ type: 'refClassFeature', classFeature: cf }, resolveRef)).filter(Boolean);
      if (options.length) {
        out.push({ id: `featopt@${feature.name}@${feature.level}`, kind: 'featureoption', count: block.count, level: feature.level, label: feature.name, feature: { name: feature.name, level: feature.level }, pool: { type: 'featureoption', options } });
      }
    }
    const curated = curatedOptions(feature, resolveRef);
    if (curated?.length) {
      out.push({ id: `featopt@${feature.name}@${feature.level}`, kind: 'featureoption', count: 1, level: feature.level, label: feature.name, feature: { name: feature.name, level: feature.level }, pool: { type: 'featureoption', options: curated } });
    }
  }
  return out;
}

/**
 * Escolhas de sub-feature da subclasse (ids com `sub:`).
 * @returns {import('./choices').Choice[]}
 */
export function subclassFeatureOptionChoices(db, classId, subclass, level) {
  if (!subclass) return [];
  const short = norm(subclass.shortName);
  const pool = resolveCopies(db?.[`class-${classId}`]?.subclassFeature ?? [], featureCopyId);
  const idx = poolIndex(pool);
  const resolveRef = (e) => {
    const [name, , , , source, lvl] = String(e.subclassFeature).split('|');
    const sub = idx.get(`${norm(name)}|${Number(lvl)}`);
    return sub ? { name: sub.name, source: sub.source ?? source, entries: sub.entries } : null;
  };
  const out = [];
  const seen = new Set();
  for (const f of pool) {
    if (norm(f.subclassShortName) !== short) continue;
    if ((f.level ?? 0) > level) continue;
    const options = curatedOptions(f, resolveRef);
    if (!options?.length) continue;
    if (seen.has(`${norm(f.name)}|${f.level}`)) continue;
    seen.add(`${norm(f.name)}|${f.level}`);
    out.push({ id: `sub:featopt@${f.name}@${f.level}`, kind: 'featureoption', count: 1, level: f.level, label: f.name, feature: { name: f.name, level: f.level, subclass: subclass.shortName }, pool: { type: 'featureoption', options } });
  }
  return out;
}
