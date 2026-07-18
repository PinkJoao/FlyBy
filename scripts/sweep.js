// =============================================================================
// sweep - Tier 0 da campanha de testes (TESTING-PLAN.md §3): `npm run sweep`
// =============================================================================
// Varre a matriz inteira (classe × subclasse × níveis 1–20; espécie × linhagem):
// auto-constrói cada linha (autoBuild), afere invariantes de derivação, valida a
// estrutura do export Foundry e roda o oráculo de round-trip. Saídas:
//   testing/report.json   - resultado completo, legível por máquina (com seeds)
//   testing/COVERAGE.md   - o tracker (regenerado preservando UI/Export/Notes)
// Flags: --class=<id> --subclass=<shortName> --species=<name> --seed=<n>
//        --emit-actors (grava testing/actors/*.json p/ importar no Foundry real)
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

// --- CLI --------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const BASE_SEED = Number(args.seed ?? 1);

// --- Uma linha de CLASSE: build no nível 20 + loop de níveis + export --------
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

  // 1) Auto-build no nível 20 (todas as escolhas de todos os níveis presentes).
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

  // 2) Derivação em TODOS os níveis 1..20 (clone podado por cleanupClassEntry)
  //    + níveis de decisão para o Tier 1.
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

      // Nível de decisão: alguma escolha nova aparece neste nível…
      if (buildClassChoices(db, cc.classes[0], cc).some((ch) => ch.level === k)) decisionLevels.add(k);
      if (k === cc.rulesConfig.subclassLevel) decisionLevels.add(k);
      // …ou os limites de magia crescem.
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

  // 3) Export estrutural + round-trip.
  result.export = runExport(db, built.character, row.id);
  result.ms = Date.now() - t0;
  return result;
}

// --- Uma linha de ESPÉCIE: build Fighter 1 + espécie da linha + export -------
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

/** Export Foundry: forma estrutural + oráculo de round-trip (com waivers). */
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
      // --strict: ignora o baseline de KNOWN_ISSUES (medição real p/ burn-down).
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

// --- Verdicto compacto de uma linha (célula "Auto" do COVERAGE) --------------
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

// --- COVERAGE.md: regenera preservando as colunas manuais --------------------
function parseExistingCoverage(text) {
  const manual = new Map();
  for (const line of (text ?? '').split('\n')) {
    const cells = line.split('|').map((s) => s.trim());
    // | Unit | Auto | Decision levels | UI | Export | Notes |
    if (cells.length >= 8 && cells[1] && !cells[1].startsWith('-') && cells[1] !== 'Unit') {
      manual.set(cells[1].replace(/`/g, ''), { ui: cells[4], export: cells[5], notes: cells[6] });
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
          `\`${r.id}\``,
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

// --- main ---------------------------------------------------------------------
function main() {
  console.log('Loading local compendium…');
  const db = loadDb();
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
    join(OUT_DIR, 'report.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), baseSeed: BASE_SEED, results }, null, 2),
  );
  // O COVERAGE completo só é regravado numa varredura SEM filtros (uma fatia
  // não deve apagar as linhas das outras unidades).
  if (!args.class && !args.subclass && !args.species) writeCoverage(results);

  console.log(`\n${results.length - fails}/${results.length} rows ok - report: testing/report.json`);
  if (fails) process.exitCode = 1;
}

main();
