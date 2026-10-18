// =============================================================================
// compare-premades: o Tier 0 do EXPORT (Fase T2): npm run t2
// =============================================================================
// O QUE FAZ
//   Roda o ciclo completo sobre cada ficha premade OFICIAL do material de
//   referência (DDL-0037): P --foundryToCharacter--> C --assembleFoundryActor--> A,
//   e diffa A x P. O premade é a verdade de esquema, então toda divergência é
//   (a) lacuna do export, (b) lacuna do import ou (c) diferença deliberada, que mora
//   no DELIBERATE do premadeDiff.
//   Saídas: testing/premade-report.json (achados por ficha e agregado por classe) e
//   o console (o agregado por classe, por onde se tria).
//   Flags: --actor=merric (fichas cujo arquivo casa o texto), --level=05 (01, 05,
//   11 ou 17), --cat=currency (uma classe de achado), --players (inclui as fichas
//   Plutonium do usuário: homebrew, NÃO são verdade de esquema), --verbose.
//
// FUNÇÕES
//   sheetFiles(): os arquivos de ficha a comparar, em ordem estável.
//   label(actorName, file): o rótulo curto de uma ficha ("Merric L05").
//   main(): o ciclo, o agregado e o report.
//
// DECISÕES E ARMADILHAS
//   - As ESPERADAS (premadeDiff.EXPECTED) ficam fora da contagem, mas aparecem
//     nomeadas no resumo e inteiras no report: contadas, nunca escondidas.
// -----------------------------------------------------------------------------

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { loadDb } from './lib/loadDb';
import { comparePremade, aggregate, DELIBERATE, EXPECTED } from './lib/premadeDiff';
import { foundryToCharacter } from '../src/engine/foundryImport';
import { assembleFoundryActor } from '../src/engine/foundryActor';

const ROOT = join(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'testing');
const SHEETS = join(ROOT, 'DnD Source Material', 'Character Sheets in JSON');
const PREMADE_DIR = join(SHEETS, 'Standard Premade Characters');
const PLAYER_DIR = join(SHEETS, 'Plutonium Made Player Characters');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);

/** Os arquivos de ficha a comparar, em ordem estável. */
function sheetFiles() {
  const list = [];
  const add = (dir, official) => {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      list.push({ file: join(dir, f), name: f.replace(/\.json$/, ''), official });
    }
  };
  add(PREMADE_DIR, true);
  if (args.players) add(PLAYER_DIR, false);
  return list
    .filter((s) => !args.actor || s.name.toLowerCase().includes(String(args.actor).toLowerCase()))
    .filter((s) => !args.level || new RegExp(`Lv0*${args.level}`, 'i').test(s.name));
}

/** O rótulo curto de uma ficha ("Merric L05"). */
function label(actorName, file) {
  const lv = file.match(/Lv(\d\d)/)?.[1];
  return lv ? `${actorName} L${lv}` : actorName;
}

function main() {
  console.log('Loading local compendium…');
  const db = loadDb();
  const sheets = sheetFiles();
  if (!sheets.length) throw new Error(`Nenhuma ficha encontrada em ${PREMADE_DIR}`);
  mkdirSync(OUT_DIR, { recursive: true });

  const perActor = [];
  for (const s of sheets) {
    const P = JSON.parse(readFileSync(s.file, 'utf8'));
    const id = label(P.name ?? s.name, s.name);
    let findings;
    try {
      const C = foundryToCharacter(P, db);
      const A = assembleFoundryActor(C, db);
      findings = comparePremade(P, A);
    } catch (e) {
      findings = [{ cat: 'CRASH', key: id, before: null, after: `${e.message}` }];
    }
    if (args.cat) findings = findings.filter((f) => f.cat.startsWith(String(args.cat)));
    perActor.push({ actor: id, file: s.name, official: s.official, findings });
    const real = findings.filter((f) => !f.expected).length;
    const exp = findings.length - real;
    console.log(`  ${real === 0 ? '✓' : '✗'} ${id.padEnd(14)} ${real} findings${exp ? ` (+${exp} expected)` : ''}`);
    if (args.verbose) {
      for (const f of findings) {
        console.log(`      ${f.cat} · ${f.key}: premade=${JSON.stringify(f.before)} ours=${JSON.stringify(f.after)}`);
      }
    }
  }

  const agg = aggregate(perActor);
  writeFileSync(
    join(OUT_DIR, 'premade-report.json'),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), deliberate: DELIBERATE, expected: EXPECTED.map((e) => ({ id: e.id, why: e.why })), aggregate: agg, perActor },
      null,
      2,
    ),
  );

  const total = perActor.reduce((n, a) => n + a.findings.filter((f) => !f.expected).length, 0);
  const expected = perActor.reduce((n, a) => n + a.findings.filter((f) => f.expected).length, 0);
  console.log(
    `\n=== ${total} findings across ${perActor.length} sheets, in ${agg.length} classes`
    + `${expected ? ` (+${expected} expected: ${EXPECTED.map((e) => e.id).join(', ')})` : ''} ===`,
  );
  for (const g of agg) {
    const ex = g.examples[0];
    const shown = `${ex.key}: premade=${JSON.stringify(ex.before)} ours=${JSON.stringify(ex.after)}`;
    console.log(
      `  ${String(g.count).padStart(4)}× ${g.cat.padEnd(24)} (${g.actors.length} sheets)  e.g. ${shown.slice(0, 110)}`,
    );
  }
  console.log('\nreport: testing/premade-report.json');
  if (total) process.exitCode = 1;
}

main();
