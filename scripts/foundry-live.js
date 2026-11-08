// =============================================================================
// foundry-live: o lote do sweep e os premades num mundo Foundry REAL (T2d)
// =============================================================================
// O QUE FAZ
//   O lado do PC do teste ao vivo. Quatro comandos (`npx vite-node
//   scripts/foundry-live.js <comando>`):
//     premades   reexporta os 48 premades oficiais pelo nosso import e export,
//                como `testing/actors/premade_*.json`, e grava os pares.
//     serve      servidor local com CORS na porta 8787: o lote, os premades
//                oficiais, o harness da página e a volta (POST /save).
//     roundtrip  a ficha que o Foundry guardou, lida pelo NOSSO import, contra a
//                original: as decisões do jogador têm de bater.
//     report     resume o `_results.json` e o `_premades.json` da volta.
//   No mundo, carregue o harness pelo console:
//     eval(await (await fetch('http://127.0.0.1:8787/s/foundryLivePage.js',
//       { targetAddressSpace: 'loopback' })).text())
//   e rode `FLYBY_LIVE.run()` e `FLYBY_LIVE.runPremades()`.
//
// FUNÇÕES
//   emitPremades(): reexporta os premades e grava `_pairs.json`.
//   serve(): o servidor local.
//   roundtrip(): a volta pelo nosso import.
//   report(): o resumo dos achados e do lado a lado.
//   diffInto(agg, a, b, path, row): acumula as diferenças de dois snapshots.
//
// DECISÕES E ARMADILHAS
//   - O lote é o do `npm run sweep -- --strict --emit-actors` (286 atores,
//     nível 20 por classe e nível 1 por espécie); este script só soma os
//     premades, que são os únicos com equipamento, magia de verdade e itens
//     mágicos.
//   - A volta vai para `testing/live-back/` (git-ignored, como o lote).
//   - O servidor só escuta em 127.0.0.1 e só escreve dentro da pasta da volta.
//   - Medido na primeira rodada (2026-11-08, Foundry 13.351, dnd5e 5.3.3): cerca
//     de 2 s por ator, 286 atores em 10 minutos.
// -----------------------------------------------------------------------------

import http from 'node:http';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, createReadStream } from 'node:fs';
import { join, basename } from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { loadDb } from './lib/loadDb';
import { decisionSummary, diffSummaries } from './lib/roundtrip';
import { foundryToCharacter } from '../src/engine/foundryImport';
import { assembleFoundryActor } from '../src/engine/foundryActor';
import { loadFoundryMechanics } from '../src/engine/foundryMechanicsData';

const ROOT = join(import.meta.dirname, '..');
const ACTORS = join(ROOT, 'testing', 'actors');
const BACK = join(ROOT, 'testing', 'live-back');
const PREMADES = join(ROOT, 'DnD Source Material', 'Character Sheets in JSON', 'Standard Premade Characters');
const PAGE = join(ROOT, 'scripts', 'lib', 'foundryLivePage.js');
const PORT = 8787;

async function emitPremades() {
  const db = loadDb();
  await loadFoundryMechanics();
  mkdirSync(ACTORS, { recursive: true });
  const pairs = [];
  for (const f of readdirSync(PREMADES).filter((x) => x.endsWith('.json')).sort()) {
    const P = JSON.parse(readFileSync(join(PREMADES, f), 'utf8'));
    const ours = `premade_${f.replace(/[^a-z0-9.]+/gi, '_')}`;
    writeFileSync(join(ACTORS, ours), JSON.stringify(assembleFoundryActor(foundryToCharacter(P, db), db)));
    pairs.push({ orig: f, ours });
  }
  writeFileSync(join(ACTORS, '_pairs.json'), JSON.stringify(pairs));
  console.log(`premades: ${pairs.length} reexportados em testing/actors`);
}

function serve() {
  mkdirSync(BACK, { recursive: true });
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Private-Network': 'true',
  };
  const send = (res, file, type) => {
    if (!existsSync(file)) { res.writeHead(404, cors); return res.end(); }
    res.writeHead(200, { ...cors, 'Content-Type': type, 'Cache-Control': 'no-store' });
    return createReadStream(file).pipe(res);
  };
  http.createServer((req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const url = decodeURIComponent(req.url ?? '');
    if (url === '/list') {
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(readdirSync(ACTORS).filter((f) => f.endsWith('.json'))));
    }
    if (url === '/s/foundryLivePage.js') return send(res, PAGE, 'text/javascript');
    if (url.startsWith('/a/')) return send(res, join(ACTORS, basename(url.slice(3))), 'application/json');
    if (url.startsWith('/p/')) return send(res, join(PREMADES, basename(url.slice(3))), 'application/json');
    if (url.startsWith('/save/') && req.method === 'POST') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => { writeFileSync(join(BACK, basename(url.slice(6))), Buffer.concat(chunks)); res.writeHead(200, cors); res.end('ok'); });
      return undefined;
    }
    res.writeHead(404, cors);
    return res.end();
  }).listen(PORT, '127.0.0.1', () => console.log(`foundry-live: http://127.0.0.1:${PORT}`));
}

function roundtrip() {
  const db = loadDb();
  let compared = 0;
  const dirty = [];
  for (const f of readdirSync(BACK).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
    if (!existsSync(join(ACTORS, f))) continue;
    const read = (dir) => decisionSummary(foundryToCharacter(JSON.parse(readFileSync(join(dir, f), 'utf8')), db));
    let diffs;
    try { diffs = diffSummaries(read(ACTORS), read(BACK)); } catch (e) { diffs = [{ crash: e.message }]; }
    compared += 1;
    if (diffs.length) dirty.push({ f, diffs: diffs.slice(0, 8) });
  }
  console.log(`roundtrip: ${compared - dirty.length}/${compared} sem diferença nas decisões`);
  for (const d of dirty.slice(0, 20)) console.log(`  ${d.f}: ${JSON.stringify(d.diffs).slice(0, 300)}`);
}

function diffInto(agg, a, b, path, row) {
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diffInto(agg, a[k], b[k], `${path}.${k}`, row);
    return;
  }
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  const key = path.replace(/weapons\.[^.]+/, 'weapons.*').replace(/\.\d+(\.|$)/, '.N$1');
  (agg[key] ??= []).push(`${row}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
}

function report() {
  const results = existsSync(join(BACK, '_results.json')) ? JSON.parse(readFileSync(join(BACK, '_results.json'), 'utf8')) : [];
  const kinds = {};
  for (const r of results) {
    for (const i of r.issues ?? []) {
      const k = `${i.kind} | ${String(i.detail).replace(/ x\S*$/, '').slice(0, 80)}`;
      kinds[k] = (kinds[k] ?? 0) + 1;
    }
    if (r.error) kinds[`import-error | ${r.error.slice(0, 80)}`] = (kinds[`import-error | ${r.error.slice(0, 80)}`] ?? 0) + 1;
  }
  console.log(`lote: ${results.length} atores, ${results.filter((r) => !(r.issues ?? []).length && !r.error).length} sem achado`);
  for (const [k, n] of Object.entries(kinds).sort((x, y) => y[1] - x[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);
  const pres = existsSync(join(BACK, '_premades.json')) ? JSON.parse(readFileSync(join(BACK, '_premades.json'), 'utf8')) : [];
  const agg = {};
  for (const p of pres) if (p.official && p.ours) diffInto(agg, p.official, p.ours, '', p.orig.replace(/^fvtt-Actor-|0*\.json$/g, ''));
  console.log(`premades: ${pres.length} pares (oficial vs nosso, no Foundry)`);
  for (const [k, list] of Object.entries(agg).sort((x, y) => y[1].length - x[1].length)) {
    console.log(`  ${String(list.length).padStart(4)}  ${k}   ex.: ${list.slice(0, 2).join(' ; ').slice(0, 220)}`);
  }
}

const cmd = process.argv[2];
if (cmd === 'premades') await emitPremades();
else if (cmd === 'serve') serve();
else if (cmd === 'roundtrip') roundtrip();
else if (cmd === 'report') report();
else console.log('uso: npx vite-node scripts/foundry-live.js premades|serve|roundtrip|report');
