// =============================================================================
// featureOptions - escolhas de "uma das seguintes sub-features" (Fase 6)
// =============================================================================
// Duas formas no 5etools, ambas tratadas aqui:
//  1. ESTRUTURADA: bloco `type:'options'` com `refClassFeature` (Divine Order,
//     Primal Order, Elemental Fury) - escolha explícita, count vem do bloco.
//  2. EM PROSA: a feature diz "you gain one of the following … of your choice"
//     e lista as opções como sub-entries nomeadas (Bear/Eagle/Wolf) ou refs, SEM
//     o wrapper `options`. Como a prosa é frágil, usamos um CONJUNTO CURADO
//     (CHOOSE_ONE_FEATURES) que marca QUAIS features são "escolha 1"; as opções
//     são EXTRAÍDAS das próprias sub-entries da feature.
//
// NÃO confundir com `options`+`refOptionalfeature` (Maneuver/Metamagic/Invocation
// Options): esses são a lista do optionalfeatureProgression, com seletor próprio.
// -----------------------------------------------------------------------------

import { resolveCopies } from '../selector/copy';
import { parseFeatureRef } from './classData';

const norm = (s) => (s ?? '').toString().trim().toLowerCase();

const featureCopyId = (f) =>
  [f.name, f.source, f.classSource, f.subclassShortName, f.subclassSource, f.level].map(norm).join('|');

// Features "escolha 1" cujas opções vivem em prosa (sem bloco `options`).
//   true          → extrair as opções das sub-entries nomeadas / refs da feature.
//   string[]      → lista explícita de opções (ex.: tipos de dano, que não são
//                   sub-features nomeadas e por isso não dá p/ extrair).
// Chave = nome da feature (minúsculo); nomes são únicos entre nossas classes.
const DAMAGE_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];
const CHOOSE_ONE_FEATURES = {
  // sub-features nomeadas → extrair
  'blessed strikes': true, // Cleric (Divine Strike / Potent Spellcasting)
  "hunter's prey": true, // Ranger/Hunter
  'defensive tactics': true, // Ranger/Hunter
  "superior hunter's defense": true, // Ranger/Hunter
  'rage of the wilds': true, // Barbarian/Wild Heart
  'aspect of the wilds': true,
  'power of the wilds': true,
  // Barbarian/Storm Herald: o bloco `options`+refSubclassFeature do Storm Aura É
  // uma escolha real ("Choose desert, sea, or tundra" - TC-0019), ao contrário
  // dos casos grant-all (Genie/Psi Warrior/Soulknife, DDL-0002). Storm Soul@6 e
  // Raging Storm@14 SEGUEM esta escolha - não são escolhas próprias.
  'storm aura': true,
  'armor model': true, // Artificer/Armorer (Guardian / Infiltrator)
  'the third eye': true, // Wizard/Diviner (re-escolhível)
  // listas simples → opções explícitas
  'fiendish resilience': ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'],
  'elemental epitome': DAMAGE_TYPES,
};

/** Índice frouxo (nome|nível) do pool de features (classe ou subclasse). */
function poolIndex(pool) {
  const byLoose = new Map();
  for (const f of pool) byLoose.set(`${norm(f.name)}|${f.level}`, f);
  return byLoose;
}

/** Blocos `type:'options'` de refClassFeature no corpo (forma estruturada). */
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

/** É uma "opção" (sub-feature nomeada ou ref de feature)? */
function isOptionLike(e) {
  return (
    e &&
    typeof e === 'object' &&
    ((e.type === 'entries' && e.name) || e.type === 'refClassFeature' || e.type === 'refSubclassFeature')
  );
}

/** Acha o PRIMEIRO grupo (BFS) de ≥2 opções irmãs - o grupo de escolha. */
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

/** Converte uma opção (entrada nomeada ou ref) em card {value,label,entries}. */
function optionToCard(e, resolveRef) {
  if (e.type === 'refClassFeature' || e.type === 'refSubclassFeature') {
    const r = resolveRef(e);
    return r ? { value: `${r.name}|${r.source}`, label: r.name, entries: r.entries ?? [] } : null;
  }
  return { value: e.name, label: e.name, entries: e.entries ?? [] }; // sub-entry nomeada
}

/** Opções de uma feature curada: lista explícita OU extraídas das sub-entries. */
function curatedOptions(feature, resolveRef) {
  const spec = CHOOSE_ONE_FEATURES[norm(feature.name)];
  if (!spec) return null;
  if (Array.isArray(spec)) return spec.map((v) => ({ value: v, label: v, entries: [] }));
  const group = findChooseGroup(feature.entries);
  return group ? group.map((e) => optionToCard(e, resolveRef)).filter(Boolean) : [];
}

/**
 * Escolhas de sub-feature das features de CLASSE até o nível: bloco `options`
 * estruturado (Divine/Primal Order…) + as curadas em prosa (Blessed Strikes).
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

    // 1) blocos `options` estruturados (refClassFeature)
    for (const block of findOptionBlocks(feature.entries)) {
      const options = block.refs.map((cf) => optionToCard({ type: 'refClassFeature', classFeature: cf }, resolveRef)).filter(Boolean);
      if (options.length) {
        out.push({ id: `featopt@${feature.name}@${feature.level}`, kind: 'featureoption', count: block.count, level: feature.level, label: feature.name, feature: { name: feature.name, level: feature.level }, pool: { type: 'featureoption', options } });
      }
    }
    // 2) curada em prosa
    const curated = curatedOptions(feature, resolveRef);
    if (curated?.length) {
      out.push({ id: `featopt@${feature.name}@${feature.level}`, kind: 'featureoption', count: 1, level: feature.level, label: feature.name, feature: { name: feature.name, level: feature.level }, pool: { type: 'featureoption', options: curated } });
    }
  }
  return out;
}

/**
 * Escolhas de sub-feature das features de SUBCLASSE (curadas em prosa: Hunter's
 * Prey, Wild Heart, Armor Model, Elemental Epitome…). Ids começam com `sub:`
 * para serem podados na troca de subclasse.
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
