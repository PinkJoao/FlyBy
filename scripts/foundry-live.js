// =============================================================================
// foundry-live: o lote do sweep e os premades num mundo Foundry REAL (T2d)
// =============================================================================
// O QUE FAZ
//   O lado do PC do teste ao vivo. Cinco comandos (`npx vite-node
//   scripts/foundry-live.js <comando>`):
//     feats      um ator por talento com mecânica (o Fighter Champion nível 20 do
//                sweep mais o item do talento, com o acabamento do export), em
//                `testing/actors/feat_*.json`, e a lista `_feats.json`.
//     premades   reexporta os 48 premades oficiais pelo nosso import e export,
//                como `testing/actors/premade_*.json`, e grava os pares.
//     serve      servidor local com CORS na porta 8787: o lote, os premades
//                oficiais, o harness da página e a volta (POST /save).
//     roundtrip  a ficha que o Foundry guardou, lida pelo NOSSO import, contra a
//                original: as decisões do jogador têm de bater.
//     report     resume o `_results.json` e o `_premades.json` da volta.
//     numbers    o oráculo diferencial (DDL-0274): o ator que o Foundry guardou, lido pelo nosso import e
//                derivado pelo nosso motor, contra os números que o Foundry calculou para ele (CA, PV,
//                proficiência, iniciativa, CD de magia, salvaguardas, perícias, espaços, acerto das armas).
//   No mundo, carregue o harness pelo console:
//     eval(await (await fetch('http://127.0.0.1:8787/s/foundryLivePage.js',
//       { targetAddressSpace: 'loopback' })).text())
//   e rode `FLYBY_LIVE.run()` e `FLYBY_LIVE.runPremades()`.
//
// FUNÇÕES
//   emitPremades(): reexporta os premades e grava `_pairs.json`.
//   emitFeats(): um ator por talento com mecânica e a lista `_feats.json`.
//   serve(): o servidor local.
//   roundtrip(): a volta pelo nosso import.
//   report(): o resumo dos achados e do lado a lado.
//   diffInto(agg, a, b, path, row): acumula as diferenças de dois snapshots.
//   ourNumbers(character, db): os mesmos números do `snapshot` da página, pelo nosso motor e pelo catálogo do jogo.
//   numbers(): o oráculo diferencial, por família de diferença.
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
//   - `numbers` compara o MESMO ator dos dois lados (o que o Foundry guardou, pelo nosso import), então mede a
//     derivação, não o export. A CD do Foundry é a da habilidade de conjuração do ator: basta estar entre as CDs das
//     nossas origens. O acerto da arma vem do rótulo ("+7"). Os dois intérpretes são independentes: uma diferença é
//     defeito de um dos dois, e o relatório não decide qual.
// -----------------------------------------------------------------------------

import http from 'node:http';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, createReadStream, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { loadDb } from './lib/loadDb';
import { decisionSummary, diffSummaries } from './lib/roundtrip';
import { foundryToCharacter } from '../src/engine/foundryImport';
import { assembleFoundryActor } from '../src/engine/foundryActor';
import { buildFeatItem } from '../src/engine/foundryItems';
import { linkConsumptionTargets } from '../src/engine/foundryConsumption';
import { modernizeEffectKeys } from '../src/engine/foundryCompat';
import { loadFoundryMechanics } from '../src/engine/foundryMechanicsData';
import { deriveFromDb } from '../src/engine/resolve';
import { derivePlayCatalog } from '../src/engine/playCatalog';

const ROOT = join(import.meta.dirname, '..');
const ACTORS = join(ROOT, 'testing', 'actors');
const BACK = join(ROOT, 'testing', 'live-back');
const PREMADES = join(ROOT, 'DnD Source Material', 'Character Sheets in JSON', 'Standard Premade Characters');
const PAGE = join(ROOT, 'scripts', 'lib', 'foundryLivePage.js');
const PORT = 8787;
const FEAT_BASE = 'class_fighter_Champion.json';

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

async function emitFeats() {
  const db = loadDb();
  await loadFoundryMechanics();
  for (const f of readdirSync(ACTORS)) if (f.startsWith('feat_')) rmSync(join(ACTORS, f));
  const base = JSON.parse(readFileSync(join(ACTORS, FEAT_BASE), 'utf8'));
  const list = [];
  for (const raw of db.feats?.feat ?? []) {
    const item = buildFeatItem(raw, { db, level: 4 });
    if (!item) continue;
    if (!Object.keys(item.system.activities ?? {}).length && !item.effects.length && !item.system.uses?.max) continue;
    const actor = structuredClone(base);
    actor.items = [...actor.items.filter((i) => i.name !== item.name), item];
    linkConsumptionTargets(actor.items);
    modernizeEffectKeys(actor.items);
    const file = `feat_${raw.name.replace(/[^a-z0-9]+/gi, '_')}_${raw.source}.json`;
    writeFileSync(join(ACTORS, file), JSON.stringify(actor));
    list.push({ file, name: raw.name, source: raw.source });
  }
  writeFileSync(join(ACTORS, '_feats.json'), JSON.stringify(list));
  console.log(`feats: ${list.length} talentos com mecânica, um ator cada (base ${FEAT_BASE})`);
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

/** Os números do `snapshot` da página, pelo nosso motor e pelo catálogo do jogo. */
function ourNumbers(character, db) {
  const d = deriveFromDb(character, db);
  const cat = derivePlayCatalog(character, db);
  const slots = {};
  for (const [k, n] of Object.entries(d.spellcasting?.slots ?? {})) if (n) slots[`spell${k}`] = n;
  if (d.spellcasting?.pactSlots?.slots) slots.pact = d.spellcasting.pactSlots.slots;
  return {
    ac: d.armorClass?.total, hpMax: d.maxHp, prof: d.proficiencyBonus, init: cat.checks?.initiative?.bonus,
    spellDcs: (d.spellcasting?.origins ?? []).filter((o) => o.kind === 'class').map((o) => o.saveDc),
    saves: d.saves, skills: Object.fromEntries(Object.entries(d.skills ?? {}).map(([k, v]) => [k, v.bonus])), slots,
    weapons: Object.fromEntries((cat.attacks ?? []).map((a) => [a.name, a.toHit?.total])),
  };
}

/** O oráculo diferencial: o mesmo ator pelo Foundry e pelo nosso motor, por família de diferença. */
async function numbers() {
  const db = loadDb();
  await loadFoundryMechanics();
  const results = JSON.parse(readFileSync(join(BACK, '_results.json'), 'utf8'));
  const fam = {};
  let checked = 0;
  const add = (k, ex) => { (fam[k] ??= []).push(ex); };
  for (const r of results) {
    if (!r.snapshot || !existsSync(join(BACK, r.file))) continue;
    let ours;
    try {
      ours = ourNumbers(foundryToCharacter(JSON.parse(readFileSync(join(BACK, r.file), 'utf8')), db), db);
    } catch (e) {
      add('erro no nosso lado', `${r.file}: ${String(e?.message ?? e).slice(0, 80)}`);
      continue;
    }
    checked++;
    const f = r.snapshot;
    const id = r.file.replace(/[.]json$/, '');
    for (const k of ['ac', 'hpMax', 'prof', 'init']) if (f[k] != null && ours[k] != null && f[k] !== ours[k]) add(k, `${id}: Foundry ${f[k]}, nós ${ours[k]}`);
    if (f.spellDc && ours.spellDcs.length && !ours.spellDcs.includes(f.spellDc)) add('spellDc', `${id}: Foundry ${f.spellDc}, nós ${ours.spellDcs.join('/')}`);
    for (const [k, v] of Object.entries(f.saves ?? {})) if (ours.saves?.[k] != null && v !== ours.saves[k]) add(`save`, `${id} ${k}: Foundry ${v}, nós ${ours.saves[k]}`);
    for (const [k, v] of Object.entries(f.skills ?? {})) if (ours.skills?.[k] != null && v !== ours.skills[k]) add(`skill`, `${id} ${k}: Foundry ${v}, nós ${ours.skills[k]}`);
    for (const [k, v] of Object.entries(f.slots ?? {})) if ((ours.slots[k] ?? 0) !== v) add('slots', `${id} ${k}: Foundry ${v}, nós ${ours.slots[k] ?? 0}`);
    for (const [k, v] of Object.entries(ours.slots)) if (f.slots?.[k] == null) add('slots', `${id} ${k}: Foundry 0, nós ${v}`);
    for (const [name, w] of Object.entries(f.weapons ?? {})) {
      const hit = Number(String(w?.toHit ?? '').replace(/[^0-9-]/g, ''));
      if (w?.toHit && ours.weapons[name] != null && hit !== ours.weapons[name]) add('weapon toHit', `${id} ${name}: Foundry ${w.toHit}, nós ${ours.weapons[name]}`);
    }
  }
  console.log(`numbers: ${checked} atores comparados (Foundry x nosso motor)`);
  for (const [k, list] of Object.entries(fam).sort((x, y) => y[1].length - x[1].length)) {
    console.log(`  ${String(list.length).padStart(5)}  ${k}   ex.: ${list.slice(0, 3).join(' ; ').slice(0, 260)}`);
  }
  if (process.argv.includes('--list')) for (const [k, list] of Object.entries(fam)) for (const x of list) console.log(`${k}: ${x}`);
}

const cmd = process.argv[2];
if (cmd === 'premades') await emitPremades();
else if (cmd === 'feats') await emitFeats();
else if (cmd === 'serve') serve();
else if (cmd === 'roundtrip') roundtrip();
else if (cmd === 'report') report();
else if (cmd === 'numbers') await numbers();
else console.log('uso: npx vite-node scripts/foundry-live.js premades|feats|serve|roundtrip|report|numbers');
