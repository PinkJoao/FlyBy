// =============================================================================
// survey-prose-grants: o que a prosa concede de forma fixa e a ficha não tem
// =============================================================================
// O QUE FAZ
//   Uso: npx vite-node scripts/survey-prose-grants.js [--kind=class|subclass|species|feat] [--text]
//   Oráculo das concessões FIXAS (DDL-0228): monta a matriz (classes e subclasses no 20,
//   espécies no 5, talentos num hospedeiro) pelo autoBuild e, para cada feature, lê na prosa
//   o que ela dá sem escolha: perícia ("proficiency in the Performance skill"), ferramenta
//   ("proficiency with Brewer's Supplies"), idioma ("speak, read, and write Draconic"),
//   armadura ("Heavy armor training") e resistência ("Resistance to Cold damage"). A ficha
//   derivada tem de ter cada uma; o que falta é candidata, que vira concessão no registro
//   certo (§7 do manual) ou um motivo em `EXPLAINED`.
//
// FUNÇÕES
//   visit(character, unit, only): soma as candidatas de um personagem.
//   featBuild(row): o hospedeiro de um talento (o mesmo do survey-builder-choices).
//   built(spec), fill(b): o personagem do autoBuild, com a derivação.
//
// DECISÕES E ARMADILHAS
//   - As regras e o `EXPLAINED` moram em scripts/lib/proseGrants.js, divididos com o gerador
//     do registro de features (scripts/feature-audit.js, DDL-0228).
//   - Gabarito para conferir à mão, como o survey-builder-choices.
// -----------------------------------------------------------------------------
import process from 'node:process';
import { loadDb } from './lib/loadDb.js';
import { classMatrix, speciesMatrix, defaultSpecies, featMatrix } from './lib/matrix.js';
import { autoBuild } from './lib/autoBuild.js';
import { hashSeed } from './lib/rng.js';
import { derivePlayCatalog } from '../src/engine/playCatalog.js';
import { plainText } from '../src/engine/playFeatures.js';
import { deriveFromDb } from '../src/engine/resolve.js';
import { EXPLAINED, grantsOf, missingOf } from './lib/proseGrants.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

const db = loadDb();
const species = defaultSpecies(db);
const seen = new Map();

/** Soma as candidatas de um personagem. */
function visit(built, unit, only = null) {
  const catalog = derivePlayCatalog(built.character, db, { derived: built.derived });
  const d = built.derived;
  for (const f of catalog.featureList ?? []) {
    if (only && !(f.kind === 'feat' && f.name === only)) continue;
    if (f.level != null && f.level > (d.level ?? 20)) continue;
    const key = `${f.name}|${f.source}|${f.section}`;
    if (seen.has(key) || EXPLAINED[f.name.toLowerCase()]) continue;
    const text = plainText(f.entries ?? []);
    const missing = missingOf(grantsOf(text), d);
    if (!missing.length) continue;
    seen.set(key, { name: f.name, source: f.source, kind: f.kind, section: f.section, unit, missing, text });
  }
}

/** O hospedeiro de um talento. */
function featBuild(row) {
  const feat = (db.feats?.feat ?? []).find((x) => x.name === row.name && x.source === row.source);
  const origin = row.category === 'O' || row.category === 'D';
  const caster = /spell/i.test(JSON.stringify(feat?.prerequisite ?? ''));
  const slot = { G: ['feat@4', 4], FS: ['feat@1', 1], 'FS:P': ['feat@2', 2], 'FS:R': ['feat@2', 2], EB: ['feat@19', 19] }[row.category] ?? ['feat@4', 4];
  const classId = row.category === 'FS:P' ? 'paladin' : row.category === 'FS:R' ? 'ranger' : caster ? 'wizard' : 'fighter';
  return autoBuild(db, {
    classId, classSource: 'XPHB', level: origin ? 1 : slot[1], ...species, seed: 7,
    ...(origin ? { originFeat: { id: row.name, source: row.source } } : {}),
    preset: (c) => { if (!origin) c.classes[0].choices[slot[0]] = { kind: 'feat', picks: [`${row.name}|${row.source}`], sub: {} }; },
  });
}

/** O personagem e a derivação dele. */
function built(spec) {
  const b = autoBuild(db, spec);
  return { character: b.character, derived: b.derived ?? null };
}

if (!args.kind || args.kind === 'class' || args.kind === 'subclass') {
  for (const row of classMatrix(db)) visit(fill(built({ ...row, level: 20, ...species, seed: hashSeed(row.id, 1) })), row.id);
}
if (!args.kind || args.kind === 'species') {
  for (const row of speciesMatrix(db)) visit(fill(built({ classId: 'fighter', classSource: 'XPHB', level: 5, speciesId: row.speciesId, speciesSource: row.speciesSource, lineage: row.lineage, seed: hashSeed(row.id, 1) })), row.id);
}
if (!args.kind || args.kind === 'feat') {
  for (const row of featMatrix(db)) {
    try { visit(fill(featBuild(row)), row.id, row.name); } catch { /* o sweep da T3 prova o talento */ }
  }
}

/** Garante a derivação no objeto. */
function fill(b) {
  return b.derived ? b : { ...b, derived: deriveFromDb(b.character, db) };
}

const list = [...seen.values()].filter((f) => !args.kind || f.kind === args.kind)
  .sort((a, b) => a.kind.localeCompare(b.kind) || a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
const byKind = {};
for (const f of list) for (const m of f.missing) {
  const row = (byKind[f.kind] ??= {});
  row[m.kind] = (row[m.kind] ?? 0) + 1;
}
console.table(byKind);
for (const f of list) {
  console.log(`${f.kind.padEnd(8)} ${f.name} [${f.source}] (${f.section}): ${f.missing.map((m) => m.label).join(', ')}`);
  if (args.text) console.log(`    ${f.text.slice(0, 500)}\n`);
}
console.log(`\ncandidatas: ${list.length}`);
