// =============================================================================
// survey-builder-choices: o que a prosa manda escolher e o builder não guarda
// =============================================================================
// O QUE FAZ
//   Uso: npx vite-node scripts/survey-builder-choices.js [--text] [--kind=class|subclass|species|feat]
//   A metade "builder" da Fase P (docs/PLAY-MODE-CERT-PLAN.md §3a, DDL-0211). Monta a
//   matriz (classes no 20, espécies no 5, talentos num hospedeiro) pelo autoBuild, que
//   preenche TODA escolha que o builder oferece, e lista as features cuja prosa pede uma
//   escolha DURADOURA sem nenhuma escolha guardada que corresponda a ela:
//   - escolha nomeada ("choose one of the following", "choose a ... option"): alguma
//     chave do saco de escolhas tem de citar o nome da feature;
//   - escolha de um tipo (perícia, ferramenta, idioma, resistência, magia, atributo):
//     a unidade tem de ter alguma escolha daquele tipo.
//   É um gabarito para conferir à mão, como o survey-feature-uses: cada candidata vira
//   escolha nova no builder, ou um motivo escrito em `NOT_A_CHOICE`.
//
// FUNÇÕES
//   visit(character, unit, only): soma as candidatas de um personagem.
//   featBuild(row): o hospedeiro de um talento (o mesmo do survey-play-coverage).
//
// DECISÕES E ARMADILHAS
//   - As pistas, o saco de escolhas e o `NOT_A_CHOICE` moram em scripts/lib/builderCues.js,
//     divididos com o gerador do registro de features (scripts/feature-audit.js, DDL-0228).
// -----------------------------------------------------------------------------
import process from 'node:process';
import { loadDb } from './lib/loadDb.js';
import { classMatrix, speciesMatrix, defaultSpecies, featMatrix } from './lib/matrix.js';
import { autoBuild } from './lib/autoBuild.js';
import { hashSeed } from './lib/rng.js';
import { derivePlayCatalog } from '../src/engine/playCatalog.js';
import { plainText } from '../src/engine/playFeatures.js';
import { bagEntries, pendingChoice } from './lib/builderCues.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

const db = loadDb();
const species = defaultSpecies(db);
const seen = new Map();

/** Soma as candidatas de um personagem. */
function visit(character, unit, only = null) {
  const catalog = derivePlayCatalog(character, db);
  const entries = bagEntries(character);
  for (const f of catalog.featureList ?? []) {
    if (only && !(f.kind === 'feat' && f.name === only)) continue;
    const key = `${f.name}|${f.source}|${f.section}`;
    if (seen.has(key)) continue;
    const text = plainText(f.entries);
    const kind = pendingChoice(f, character, entries, text);
    if (kind) seen.set(key, { name: f.name, source: f.source, kind: f.kind, section: f.section, unit, cue: kind, text });
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

if (!args.kind || args.kind === 'class' || args.kind === 'subclass') {
  for (const row of classMatrix(db)) {
    visit(autoBuild(db, { classId: row.classId, classSource: row.classSource, subclassId: row.subclassId, subclassSource: row.subclassSource, level: 20, ...species, seed: hashSeed(row.id, 1) }).character, row.id);
  }
}
if (!args.kind || args.kind === 'species') {
  for (const row of speciesMatrix(db)) {
    visit(autoBuild(db, { classId: 'fighter', classSource: 'XPHB', level: 5, speciesId: row.speciesId, speciesSource: row.speciesSource, lineage: row.lineage, seed: hashSeed(row.id, 1) }).character, row.id);
  }
}
if (!args.kind || args.kind === 'feat') {
  for (const row of featMatrix(db)) {
    try { visit(featBuild(row).character, row.id, row.name); } catch { /* o sweep da T3 prova o talento */ }
  }
}

const list = [...seen.values()].filter((f) => !args.kind || f.kind === args.kind)
  .sort((a, b) => a.kind.localeCompare(b.kind) || a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
const byKind = {};
for (const f of list) {
  const row = (byKind[f.kind] ??= {});
  row[f.cue] = (row[f.cue] ?? 0) + 1;
}
console.table(byKind);
for (const f of list) {
  console.log(`${f.kind.padEnd(8)} ${f.cue.padEnd(8)} ${f.name} [${f.source}] (${f.section})`);
  if (args.text) console.log(`    ${f.text.slice(0, 600)}\n`);
}
console.log(`\ncandidatas: ${list.length}`);
