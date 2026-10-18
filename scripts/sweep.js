// =============================================================================
// sweep: o Tier 0 da campanha de testes: npm run sweep
// =============================================================================
// O QUE FAZ
//   Varre a matriz inteira (classe x subclasse x níveis 1 a 20; espécie x
//   linhagem): auto-constrói cada linha (autoBuild), afere invariantes de
//   derivação, valida a estrutura do export Foundry e roda o oráculo de round-trip
//   (TESTING-PLAN.md §3).
//   Saídas: testing/report.json (completo, com seeds) e testing/COVERAGE.md (o
//   tracker, regenerado preservando UI/Export/Notes).
//   Flags: --class=<id> --subclass=<shortName> --species=<name> --seed=<n>
//   --strict --emit-actors (grava testing/actors/*.json para importar no Foundry)
//   --srd (varre o pacote SRD embutido, src/data/srdBundle.json, em vez do
//   snapshot; saída em testing/report-srd.json, sem tocar no COVERAGE).
//
// FUNÇÕES
//   runClassRow(db, row, species): uma linha de CLASSE: auto-build no nível 20 (com
//     as escolhas de todos os níveis), derivação em cada nível 1..20 num clone
//     podado por cleanupClassEntry, os níveis de decisão do Tier 1 (escolha nova ou
//     limite de magia crescendo) e o export.
//   runSpeciesRow(db, row): uma linha de ESPÉCIE: Fighter 1 com a espécie da linha.
//   runExport(db, character, rowId): forma estrutural do export e o oráculo de
//     round-trip (com waivers; --strict ignora o baseline de KNOWN_ISSUES).
//   verdict(r): o veredito compacto (a célula "Auto" do COVERAGE).
//   splitCells(line), unescapePipes(s), escapePipes(s): as células de uma linha.
//   parseExistingCoverage(text): as colunas manuais do COVERAGE atual.
//   writeCoverage(results): regrava o COVERAGE preservando as colunas manuais.
//   main(): a CLI, a varredura e as saídas.
//
// DECISÕES E ARMADILHAS
//   - O id de uma linha de ESPÉCIE contém um pipe (`species:Elf|XPHB/...`), que é o
//     separador de células do markdown. É ESCAPADO ao escrever e a leitura corta só
//     nos pipes não-escapados; sem isso as células deslizam e as colunas manuais de
//     toda linha de espécie se perdem a cada varredura.
//   - O COVERAGE completo só é regravado numa varredura SEM filtros: uma fatia não
//     pode apagar as linhas das outras unidades. O --srd também não o regrava: o
//     tracker é do compêndio completo, e o pacote SRD tem 12 das 135 linhas.
//   - Os personagens do --srd escolhem só do pacote: é o teste de que o modo SRD
//     funciona sozinho (DDL-0091), não uma recertificação do T1.
// -----------------------------------------------------------------------------

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { loadDb } from './lib/loadDb';
import { classMatrix, speciesMatrix, defaultSpecies } from './lib/matrix';
import { autoBuild } from './lib/autoBuild';
import { scanBadValues, checkDerivedSanity, checkActorShape } from './lib/invariants';
import { decisionSummary, diffSummaries, classifyDiffs } from './lib/roundtrip';
import { hashSeed } from './lib/rng';
import { deriveFromDb, resolveClassObj, resolveSubclassObj } from '../src/engine/resolve';
import { cleanupClassEntry } from '../src/engine/classFeatureChoices';
import { buildClassChoices } from '../src/components/builder/classChoices';
import { assembleFoundryActor } from '../src/engine/foundryActor';
import { foundryToCharacter } from '../src/engine/foundryImport';

const ROOT = join(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'testing');
const SRD_BUNDLE = join(ROOT, 'src', 'data', 'srdBundle.json');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const BASE_SEED = Number(args.seed ?? 1);

function runClassRow(db, row, species) {
  const seed = hashSeed(row.id, BASE_SEED);
  const spec = {
    id: row.id,
    classId: row.classId,
    classSource: row.classSource,
    subclassId: row.subclassId,
    subclassSource: row.subclassSource,
    level: 20,
    ...species,
    seed,
  };
  const t0 = Date.now();
  const result = { id: row.id, kind: 'class', seed, build: {}, levels: {}, export: {} };

  let built;
  try {
    built = autoBuild(db, spec);
    result.build = {
      ok: built.ok,
      iterations: built.iterations,
      pendencies: built.pendencies,
      problems: built.problems,
    };
  } catch (e) {
    result.build = { ok: false, crash: `${e.message}\n${e.stack?.split('\n')[1] ?? ''}` };
    result.ms = Date.now() - t0;
    return result;
  }

  const levelIssues = [];
  const decisionLevels = new Set([1]);
  let prevSpell = null;
  for (let k = 1; k <= 20; k++) {
    try {
      const cc = structuredClone(built.character);
      const e = { ...cc.classes[0], level: k };
      const classObj = resolveClassObj(db, e.classId, e.source);
      const subclassObj = e.subclassId ? resolveSubclassObj(db, e.classId, e.subclassId, e.subclassSource) : null;
      cc.classes[0] = cleanupClassEntry(e, { classObj, subclassObj, subclassLevel: cc.rulesConfig.subclassLevel });
      const d = deriveFromDb(cc, db);
      const sanity = checkDerivedSanity(d, { level: k });
      const bad = scanBadValues(d);
      if (sanity.length || bad.length) levelIssues.push({ level: k, issues: [...sanity, ...bad] });

      if (buildClassChoices(db, cc.classes[0], cc).some((ch) => ch.level === k)) decisionLevels.add(k);
      if (k === cc.rulesConfig.subclassLevel) decisionLevels.add(k);
      const o = d.spellcasting?.origins?.find((o) => o.kind === 'class');
      const cur = o
        ? [o.cantripLimit ?? 0, o.prepareLimit ?? 0, o.maxPrepareLevel ?? 0, o.arcanumLevels?.length ?? 0].join(',')
        : null;
      if (cur !== null && prevSpell !== null && cur !== prevSpell) decisionLevels.add(k);
      prevSpell = cur;
    } catch (e) {
      levelIssues.push({ level: k, issues: [`derive crash: ${e.message}`] });
    }
  }
  result.levels = { issues: levelIssues, decisionLevels: [...decisionLevels].sort((a, b) => a - b) };

  result.export = runExport(db, built.character, row.id);
  result.ms = Date.now() - t0;
  return result;
}

function runSpeciesRow(db, row) {
  const seed = hashSeed(row.id, BASE_SEED);
  const spec = {
    id: row.id,
    classId: 'fighter',
    classSource: 'XPHB',
    level: 1,
    speciesId: row.speciesId,
    speciesSource: row.speciesSource,
    lineage: row.lineage,
    seed,
  };
  const t0 = Date.now();
  const result = { id: row.id, kind: 'species', seed, build: {}, export: {} };
  let built;
  try {
    built = autoBuild(db, spec);
    result.build = {
      ok: built.ok,
      iterations: built.iterations,
      pendencies: built.pendencies,
      problems: built.problems,
    };
    const sanity = checkDerivedSanity(built.derived, { level: 1 });
    const bad = scanBadValues(built.derived);
    if (sanity.length || bad.length) result.build.derivedIssues = [...sanity, ...bad];
  } catch (e) {
    result.build = { ok: false, crash: `${e.message}\n${e.stack?.split('\n')[1] ?? ''}` };
    result.ms = Date.now() - t0;
    return result;
  }
  result.export = runExport(db, built.character, row.id);
  result.ms = Date.now() - t0;
  return result;
}

/** Export Foundry: forma estrutural e oráculo de round-trip. */
function runExport(db, character, rowId) {
  try {
    const actor = assembleFoundryActor(character, db);
    const shape = [...checkActorShape(actor), ...scanBadValues(actor)];
    if (args['emit-actors']) {
      const dir = join(OUT_DIR, 'actors');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${rowId.replace(/[^a-z0-9]+/gi, '_')}.json`), JSON.stringify(actor, null, 2));
    }
    let roundtrip;
    try {
      const back = foundryToCharacter(actor, db);
      const diffs = diffSummaries(decisionSummary(character), decisionSummary(back));
      const { real, known, waived } = classifyDiffs(diffs, args.strict ? { known: [] } : {});
      roundtrip = { ok: real.length === 0, diffs: real, known, waived: waived.length };
    } catch (e) {
      roundtrip = { ok: false, crash: `${e.message}` };
    }
    return { ok: shape.length === 0 && roundtrip.ok, shape, roundtrip };
  } catch (e) {
    return { ok: false, crash: `${e.message}\n${e.stack?.split('\n')[1] ?? ''}` };
  }
}

function verdict(r) {
  const parts = [];
  if (r.build?.crash) parts.push('build CRASH');
  else if (!r.build?.ok) parts.push('build FAIL');
  if (r.build?.problems?.length) parts.push(`${r.build.problems.length} problems`);
  if (r.build?.derivedIssues?.length) parts.push('derived issues');
  if (r.levels?.issues?.length) parts.push(`levels FAIL(${r.levels.issues.length})`);
  if (r.export?.crash) parts.push('export CRASH');
  else if (r.export && !r.export.ok) {
    if (r.export.shape?.length) parts.push(`shape(${r.export.shape.length})`);
    if (r.export.roundtrip && !r.export.roundtrip.ok) {
      parts.push(r.export.roundtrip.crash ? 'rt CRASH' : `rt diff(${r.export.roundtrip.diffs.length})`);
    }
  }
  const kn = r.export?.roundtrip?.known?.length;
  const base = parts.length ? `FAIL: ${parts.join(', ')}` : 'ok';
  return kn ? `${base} · known(${kn})` : base;
}

// ATENÇÃO: o id de linha de ESPÉCIE contém pipe; escapado ao escrever, lido só nos não-escapados.
const splitCells = (line) => line.split(/(?<!\\)\|/).map((s) => s.trim());
const unescapePipes = (s) => s.replace(/\\\|/g, '|');
const escapePipes = (s) => s.replace(/\|/g, '\\|');

function parseExistingCoverage(text) {
  const manual = new Map();
  for (const line of (text ?? '').split('\n')) {
    const cells = splitCells(line);
    if (cells.length >= 8 && cells[1] && !cells[1].startsWith('-') && cells[1] !== 'Unit') {
      manual.set(unescapePipes(cells[1]).replace(/`/g, ''), { ui: cells[4], export: cells[5], notes: cells[6] });
    }
  }
  return manual;
}

function writeCoverage(results) {
  const path = join(OUT_DIR, 'COVERAGE.md');
  const manual = existsSync(path) ? parseExistingCoverage(readFileSync(path, 'utf8')) : new Map();
  const cell = (id, key, dflt) => manual.get(id)?.[key] || dflt;
  const table = (rows) =>
    [
      '| Unit | Auto | Decision levels | UI | Export | Notes |',
      '|---|---|---|---|---|---|',
      ...rows.map((r) =>
        [
          '',
          `\`${escapePipes(r.id)}\``,
          verdict(r),
          r.levels?.decisionLevels?.join(' ') ?? '-',
          cell(r.id, 'ui', 'todo'),
          cell(r.id, 'export', 'todo'),
          cell(r.id, 'notes', ''),
          '',
        ].join(' | ').trim(),
      ),
    ].join('\n');

  const classes = results.filter((r) => r.kind === 'class');
  const species = results.filter((r) => r.kind === 'species');
  const md = `# Coverage tracker - Phase T (generated by \`npm run sweep\`)

> **Auto** and **Decision levels** are REGENERATED on every sweep - do not edit.
> **UI / Export / Notes** are hand-maintained by the curation sessions (values
> survive regeneration; row key = the Unit cell). Conventions: \`todo\`, \`ok\`,
> \`issues (TC-xxxx)\`, \`needs-user-eyes\`. See TESTING-PLAN.md.

Last sweep: ${new Date().toISOString()} · base seed ${BASE_SEED} · ${results.length} rows

## Classes × subclasses (${classes.length})

${table(classes)}

## Species × lineages (${species.length})

${table(species)}
`;
  writeFileSync(path, md);
}

function main() {
  console.log(args.srd ? 'Loading the embedded SRD bundle…' : 'Loading local compendium…');
  const db = args.srd ? JSON.parse(readFileSync(SRD_BUNDLE, 'utf8')) : loadDb();
  const reportName = args.srd ? 'report-srd.json' : 'report.json';
  mkdirSync(OUT_DIR, { recursive: true });

  let cRows = classMatrix(db);
  let sRows = speciesMatrix(db);
  if (args.class) cRows = cRows.filter((r) => r.classId === String(args.class).toLowerCase());
  if (args.subclass) cRows = cRows.filter((r) => (r.subclassId ?? '').toLowerCase() === String(args.subclass).toLowerCase());
  if (args.species) sRows = sRows.filter((r) => r.speciesId === String(args.species).toLowerCase());
  if (args.class || args.subclass) sRows = args.species ? sRows : [];
  if (args.species && !args.class) cRows = [];

  const species = defaultSpecies(db);
  console.log(`Sweeping ${cRows.length} class rows + ${sRows.length} species rows (base seed ${BASE_SEED})…`);

  const results = [];
  let fails = 0;
  for (const row of cRows) {
    const r = runClassRow(db, row, species);
    results.push(r);
    const v = verdict(r);
    const failed = v.startsWith('FAIL');
    if (failed) fails++;
    console.log(`  ${failed ? '✗' : '✓'} ${row.id} (${r.ms} ms)${v === 'ok' ? '' : `  ${v}`}`);
  }
  for (const row of sRows) {
    const r = runSpeciesRow(db, row);
    results.push(r);
    const v = verdict(r);
    const failed = v.startsWith('FAIL');
    if (failed) fails++;
    console.log(`  ${failed ? '✗' : '✓'} ${row.id} (${r.ms} ms)${v === 'ok' ? '' : `  ${v}`}`);
  }

  writeFileSync(
    join(OUT_DIR, reportName),
    JSON.stringify({ generatedAt: new Date().toISOString(), baseSeed: BASE_SEED, results }, null, 2),
  );
  if (!args.class && !args.subclass && !args.species && !args.srd) writeCoverage(results);

  console.log(`\n${results.length - fails}/${results.length} rows ok - report: testing/${reportName}`);
  if (fails) process.exitCode = 1;
}

main();
