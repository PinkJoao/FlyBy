// =============================================================================
// sweep-t3: o Tier 0 da T3, talentos, magias, itens e backgrounds (TESTING-PLAN §5b)
// =============================================================================
// O QUE FAZ
//   Para cada unidade da T3 (featMatrix, spellMatrix, itemMatrix), monta um
//   HOSPEDEIRO pelo autoBuild com a unidade no lugar REAL (o talento no espaço da
//   categoria dele, a magia no grimório de uma classe que a tem na lista, o item no
//   inventário, equipado e sintonizado), e cobra: o personagem fecha sem pendência,
//   a unidade está na derivação, o pré-requisito do talento passa, o ator exportado
//   tem o item da unidade e é estruturalmente válido, e o round-trip pelo nosso
//   import devolve as mesmas decisões. Os backgrounds prontos (DDL-0328) entram num
//   guerreiro do nível 5 pelo `spec.background`. Grava `testing/report-t3.json` e
//   `testing/COVERAGE-T3.md` (UI, Export e Notes à mão sobrevivem).
//   `npm run sweep:t3` (ou `-- --feats`, `--spells`, `--items`, `--backgrounds`, `--only=<texto>`).
//   `--emit-actors` grava a ficha de cada unidade em `testing/actors/t3_*.json` e a
//   lista `_t3.json`, para o lote ao vivo no Foundry (TESTING-PLAN §5.3), também a dos
//   backgrounds (`t3_background_*.json`, DDL-0329). Os itens
//   vão 40 unidades por ficha (`t3_items_NNN.json`): uma ficha por item passaria
//   de 700 MB em disco.
//
// FUNÇÕES
//   spellHost(db, row): a classe e o nível que preparam a magia (o hospedeiro do talento vem de lib/featHost.js).
//   exportChecks(db, character, hasUnit): shape, presença da unidade e round-trip.
//   flagged(actor, page, name, source): o ator tem o item com a marca de procedência?
//   runFeat(db, row, species), runSpell(db, row, species), runItem(db, row,
//     species), runBackground(db, row, species): uma unidade.
//   backgroundMatrix(db): as linhas dos backgrounds prontos.
//   verdict(r): o resumo de uma linha.
//   splitCells(line), escapePipes(s), unescapePipes(s), parseManual(text),
//     writeCoverage(results): o tracker COVERAGE-T3.md.
//   emitActor(actor, kind, row): grava a ficha da unidade para o lote ao vivo.
//   setItemHost(actor), collectItemUnit(actor, row), flushItemBatch(): os itens vão em LOTES de 40
//     unidades numa ficha só (o hospedeiro mais os itens delas).
//   main(): a CLI.
//
// DECISÕES E ARMADILHAS
//   - O espaço do talento e o hospedeiro dele: ver lib/featHost.js. Status `null` do pré-requisito
//     (sem pré-requisito) passa; `unknown` (campanha, texto livre) o motor não avalia e vira nota;
//     só `bad` reprova.
//   - A magia entra pela classe da lista na ordem de PREFERRED_CASTERS (o Bruxo por
//     último: acima do 5º círculo ele lança pelo Mystic Arcanum); a magia que só uma
//     SUBCLASSE alarga (a dunamancia do EGW pela Chronurgy) entra por ela; magia sem classe
//     nenhuma (concedida só por talento ou subclasse) é registrada, não testada aqui.
//     Magia que só entra na classe pelo `classVariant` (a lista expandida por outro
//     livro: Chaos Bolt, Absorb Elements) usa essa classe, marcada no Host: a lista
//     do app (classSpellList) não lia o campo (DDL-0170); desde o DDL-0171 ele conta,
//     e o desvio fica só como rede (0 magias por ele).
//   - O Ability Score Improvement não vira item de talento: o export o grava como o
//     aumento de atributo do item da classe (o formato do Foundry); ele é conferido
//     pelo round-trip, não pela presença.
//   - O item entra equipado SÓ se a ficha deixa (EQUIPPABLE_GROUPS, o mesmo da
//     InventoryTab: arma, armadura, foco, ferramenta, instrumento) e, se pede,
//     sintonizado; a presença no ator exportado se
//     mede pela marca de procedência (o hash do 5etools), que a variante leva mesmo
//     saindo como item base mais encantamento.
//   - Round-trip estrito (`known: []`), como o `npm run sweep -- --strict`.
// -----------------------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { loadDb } from './lib/loadDb';
import { classMatrix, defaultSpecies, featMatrix, spellMatrix, itemMatrix } from './lib/matrix';
import { autoBuild } from './lib/autoBuild';
import { classRowFor, featHost, buildFeatHost } from './lib/featHost';
import { checkActorShape, scanBadValues } from './lib/invariants';
import { decisionSummary, diffSummaries, classifyDiffs } from './lib/roundtrip';
import { ownedFromDb, resolveFeat, resolveSubclassObj } from '../src/engine/resolve';
import { expandedSpellNames } from '../src/engine/spellListWidening';
import { prereqContext, prereqStatus } from '../src/engine/prereq';
import { classSpellList } from '../src/engine/spells';
import { spellSources } from '../src/engine/spellSources';
import spellEntity from '../src/selector/entities/spell';
import { resolveItemObj, itemTypeInfo } from '../src/engine/items';
import { assembleFoundryActor } from '../src/engine/foundryActor';
import { foundryToCharacter } from '../src/engine/foundryImport';
import { loadFoundryMechanics } from '../src/engine/foundryMechanicsData';
import { toolsHash } from '../src/engine/foundryInterop';
import { makeId } from '../src/schema/character';
import { readyBackgrounds } from '../src/engine/backgrounds';

const ROOT = join(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'testing');
// ATENÇÃO: o mesmo conjunto do EQUIPPABLE_GROUPS de components/builder/InventoryTab.jsx (o que a ficha deixa equipar).
const EQUIPPABLE_GROUPS = new Set(['weapon', 'armor', 'spellcastingFocus', 'tool', 'instrument']);
const PREFERRED_CASTERS = ['wizard', 'cleric', 'druid', 'bard', 'sorcerer', 'paladin', 'ranger', 'artificer', 'warlock'];

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);

function spellHost(db, row) {
  const name = row.name.toLowerCase();
  const classId = PREFERRED_CASTERS.find((cid) => classSpellList(db, cid).has(name));
  if (classId) return { classId, level: 20, via: 'class' };
  const raw = spellEntity.list(db).find((x) => x.name === row.name && x.source === row.source);
  const variants = new Set(spellSources(db, raw).classesVariant.map((c) => String(c.name).toLowerCase()));
  const viaVariant = PREFERRED_CASTERS.find((cid) => variants.has(cid));
  if (viaVariant) return { classId: viaVariant, level: 20, via: 'classVariant' };
  for (const r of classMatrix(db).filter((x) => x.subclassId)) {
    const sub = resolveSubclassObj(db, r.classId, r.subclassId, r.subclassSource);
    if (sub && expandedSpellNames(sub, { db, classLevel: 20, maxSlotLevel: 9 }).has(name)) {
      return { classId: r.classId, level: 20, via: 'subclass', subclassId: r.subclassId, subclassSource: r.subclassSource, classSource: r.classSource };
    }
  }
  return { skip: 'sem lista de classe nem subclasse que a alargue (só por concessão)' };
}

function exportChecks(db, character, hasUnit) {
  try {
    const actor = assembleFoundryActor(character, db);
    const shape = [...checkActorShape(actor), ...scanBadValues(actor)];
    const present = hasUnit(actor);
    let roundtrip;
    try {
      const back = foundryToCharacter(actor, db);
      const diffs = diffSummaries(decisionSummary(character), decisionSummary(back));
      const { real } = classifyDiffs(diffs, { known: [] });
      roundtrip = { ok: real.length === 0, diffs: real.slice(0, 6) };
    } catch (e) {
      roundtrip = { ok: false, crash: e.message };
    }
    return { ok: shape.length === 0 && present && roundtrip.ok, shape, present, roundtrip, actor };
  } catch (e) {
    return { ok: false, crash: `${e.message}\n${e.stack?.split('\n')[1] ?? ''}` };
  }
}

const flagged = (actor, page, name, source) =>
  (actor.items ?? []).some((i) => i.flags?.plutonium?.page === page && i.flags.plutonium.hash === toolsHash(name, source));

function runFeat(db, row, species) {
  const t0 = Date.now();
  const id = `${row.name}|${row.source}`;
  const feat = resolveFeat(db, id);
  const host = feat ? featHost(db, row, feat, species) : { skip: 'talento não resolve' };
  const r = { id: row.id, kind: 'feat', host: host.skip ? null : `${host.classId} ${host.level} ${host.slot}` };
  if (host.skip) return { ...r, skip: host.skip, ms: Date.now() - t0 };
  const built = buildFeatHost(db, row, host);
  r.build = { ok: built.ok, problems: built.problems.slice(0, 6), pendencies: built.pendencies?.total ?? 0 };
  r.taken = !!ownedFromDb(built.character, db).feats?.has(id);
  const granted = row.category.startsWith('FS') ? ['Fighting Style'] : [];
  r.prereq = prereqStatus(feat, prereqContext(built.character, { db, grantedFeatures: granted }));
  const asi = row.name === 'Ability Score Improvement';
  const ex = exportChecks(db, built.character, (actor) => asi || flagged(actor, 'feats.html', row.name, row.source));
  if (args['emit-actors'] && ex.actor) emitted.push(emitActor(ex.actor, 'feat', row));
  delete ex.actor;
  r.export = ex;
  r.ms = Date.now() - t0;
  return r;
}

function runSpell(db, row, species) {
  const t0 = Date.now();
  const host = spellHost(db, row);
  const r = { id: row.id, kind: 'spell', host: host.skip ? null : `${host.classId} ${host.level}${host.via === 'class' ? '' : ` (${host.via})`}` };
  if (host.skip) return { ...r, skip: host.skip, ms: Date.now() - t0 };
  const crow = host.subclassId ? host : classRowFor(db, host.classId);
  const built = autoBuild(db, {
    id: row.id, classId: host.classId, classSource: crow.classSource, subclassId: crow.subclassId,
    subclassSource: crow.subclassSource, level: host.level, ...species, seed: 7,
    preset: (c) => { c.classes[0].spells.push({ id: row.name, source: row.source }); },
  });
  r.build = { ok: built.ok, problems: built.problems.slice(0, 6), pendencies: built.pendencies?.total ?? 0 };
  const lists = (built.derived.spellcasting?.origins ?? []).flatMap((o) => [
    ...(o.cantrips ?? []), ...(o.prepared ?? []), ...(o.unprepared ?? []), ...(o.arcanumSpells ?? []), ...(o.alwaysPrepared ?? []),
  ]);
  r.taken = lists.some((e) => e.raw?.name === row.name);
  const ex = exportChecks(db, built.character, (actor) => flagged(actor, 'spells.html', row.name, row.source));
  const item = (ex.actor?.items ?? []).find((i) => i.type === 'spell' && i.name === row.name);
  r.activities = item ? Object.keys(item.system.activities ?? {}).length : null;
  if (args['emit-actors'] && ex.actor) emitted.push(emitActor(ex.actor, 'spell', row));
  delete ex.actor;
  r.export = ex;
  r.ms = Date.now() - t0;
  return r;
}

function runItem(db, row, species) {
  const t0 = Date.now();
  const raw = resolveItemObj(db, row.name, row.source);
  const r = { id: row.id, kind: row.kind, sample: row.kind === 'variant' ? `${row.name}|${row.source}` : undefined };
  if (!raw) return { ...r, skip: 'item não resolve', ms: Date.now() - t0 };
  const crow = classRowFor(db, 'fighter');
  const spec = {
    id: row.id, classId: 'fighter', classSource: crow.classSource, subclassId: crow.subclassId,
    subclassSource: crow.subclassSource, level: 5, ...species, seed: 7,
  };
  if (args['emit-actors'] && !hostNames) setItemHost(assembleFoundryActor(autoBuild(db, spec).character, db));
  const built = autoBuild(db, {
    ...spec,
    preset: (c) => {
      const equippable = EQUIPPABLE_GROUPS.has(itemTypeInfo(raw).group);
      c.inventory.push({ uid: makeId(), itemId: raw.name, source: raw.source, quantity: 1, equipped: equippable, attuned: !!raw.reqAttune });
    },
  });
  r.build = { ok: built.ok, problems: built.problems.slice(0, 6), pendencies: built.pendencies?.total ?? 0 };
  r.taken = (built.derived.inventory ?? []).some((e) => e.raw?.name === raw.name);
  const ex = exportChecks(db, built.character, (actor) => flagged(actor, 'items.html', raw.name, raw.source));
  if (args['emit-actors'] && ex.actor) collectItemUnit(ex.actor, row);
  delete ex.actor;
  r.export = ex;
  r.ms = Date.now() - t0;
  return r;
}

const INVENTORY_TYPES = new Set(['weapon', 'equipment', 'consumable', 'tool', 'loot', 'container']);
const ITEM_BATCH = 40;
let itemBatch = null;
let hostNames = null;

/** O hospedeiro SEM item nenhum: a base de toda ficha de lote e o que não é da unidade. */
function setItemHost(actor) {
  hostNames = new Map();
  for (const i of (actor.items ?? []).filter((x) => INVENTORY_TYPES.has(x.type))) hostNames.set(i.name, (hostNames.get(i.name) ?? 0) + 1);
  itemBatch = { base: structuredClone(actor), units: [], items: [] };
}

/** Os itens da unidade (o que a ficha tem além do equipamento do hospedeiro), para o lote ao vivo. */
function collectItemUnit(actor, row) {
  const inv = (actor.items ?? []).filter((i) => INVENTORY_TYPES.has(i.type));
  const left = new Map(hostNames);
  const unit = inv.filter((i) => {
    const n = left.get(i.name) ?? 0;
    if (n > 0) { left.set(i.name, n - 1); return false; }
    return true;
  });
  itemBatch.units.push({ id: row.id, names: unit.map((i) => i.name) });
  itemBatch.items.push(...unit);
  if (itemBatch.units.length >= ITEM_BATCH) flushItemBatch();
}

/** Grava a ficha do lote de itens e começa outro. */
function flushItemBatch() {
  if (!itemBatch?.units.length) return;
  const n = emitted.filter((e) => e.kind === 'items').length;
  const actor = { ...structuredClone(itemBatch.base), name: `T3 items ${n + 1}` };
  actor.items = [...actor.items, ...itemBatch.items];
  const file = `t3_items_${String(n + 1).padStart(3, '0')}.json`;
  writeFileSync(join(ACTORS_DIR, file), JSON.stringify(actor));
  emitted.push({ file, kind: 'items', units: itemBatch.units });
  itemBatch = { base: itemBatch.base, units: [], items: [] };
}

/** As linhas dos backgrounds prontos. */
function backgroundMatrix(db) {
  return readyBackgrounds(db).map((b) => ({ id: `${b.name}|${b.source}`, name: b.name, source: b.source, kind: 'background' }));
}

function runBackground(db, row, species) {
  const t0 = Date.now();
  const crow = classRowFor(db, 'fighter');
  const r = { id: row.id, kind: 'background', host: 'fighter 5' };
  const built = autoBuild(db, {
    id: row.id, classId: 'fighter', classSource: crow.classSource, subclassId: crow.subclassId,
    subclassSource: crow.subclassSource, level: 5, ...species, seed: 7, background: { id: row.name, source: row.source },
  });
  r.build = { ok: built.ok, problems: built.problems.slice(0, 6), pendencies: built.pendencies?.total ?? 0 };
  r.taken = built.character.origin?.background?.id === row.name;
  const ex = exportChecks(db, built.character, (actor) =>
    (actor.items ?? []).some((i) => i.type === 'background' && i.name === row.name && i.flags?.builder5e?.background?.source === row.source));
  if (args['emit-actors'] && ex.actor) emitted.push(emitActor(ex.actor, 'background', row));
  delete ex.actor;
  r.export = ex;
  r.ms = Date.now() - t0;
  return r;
}

function verdict(r) {
  if (r.skip) return `skip: ${r.skip}`;
  const parts = [];
  if (!r.build?.ok) parts.push(`build FAIL (${r.build?.pendencies ?? '?'} pend.)`);
  if (r.build?.problems?.length) parts.push(`${r.build.problems.length} problems`);
  if (!r.taken) parts.push('not derived');
  if (r.kind === 'feat' && r.prereq === 'bad') parts.push('prereq bad');
  if (r.export?.crash) parts.push('export CRASH');
  else {
    if (r.export?.shape?.length) parts.push(`shape(${r.export.shape.length})`);
    if (r.export && !r.export.present) parts.push('not exported');
    if (r.export?.roundtrip && !r.export.roundtrip.ok) parts.push(r.export.roundtrip.crash ? 'rt CRASH' : `rt diff(${r.export.roundtrip.diffs?.length})`);
  }
  return parts.length ? `FAIL: ${parts.join(', ')}` : 'ok';
}

const splitCells = (line) => line.split(/(?<!\\)\|/).map((s) => s.trim());
const PIPE = String.fromCharCode(92) + '|';
const escapePipes = (s) => String(s).split('|').join(PIPE);
const unescapePipes = (s) => String(s).split(PIPE).join('|');

function parseManual(text) {
  const manual = new Map();
  for (const line of (text ?? '').split('\n')) {
    const cells = splitCells(line);
    if (cells.length >= 7 && cells[1] && !cells[1].startsWith('-') && cells[1] !== 'Unit') {
      manual.set(unescapePipes(cells[1]).replace(/`/g, ''), { ui: cells[4], export: cells[5], notes: cells[6] });
    }
  }
  return manual;
}

function writeCoverage(results) {
  const path = join(OUT_DIR, 'COVERAGE-T3.md');
  const manual = existsSync(path) ? parseManual(readFileSync(path, 'utf8')) : new Map();
  const cell = (id, key, dflt) => manual.get(id)?.[key] || dflt;
  const table = (rows) => [
    '| Unit | Auto | Host | UI | Export | Notes |',
    '|---|---|---|---|---|---|',
    ...rows.map((r) => ['', `\`${escapePipes(r.id)}\``, verdict(r), escapePipes(r.host ?? r.sample ?? '-'), cell(r.id, 'ui', 'todo'), cell(r.id, 'export', 'todo'), cell(r.id, 'notes', ''), ''].join(' | ').trim()),
  ].join('\n');
  const of = (kind) => results.filter((r) => r.kind === kind);
  const md = `# Coverage tracker - Phase T3 (generated by \`npm run sweep:t3\`)

> **Auto** and **Host** are REGENERATED on every run - do not edit. **UI / Export /
> Notes** are hand-maintained (they survive regeneration; row key = the Unit cell).
> See TESTING-PLAN.md §5b.

Last run: ${new Date().toISOString()} · ${results.length} rows

## Feats (${of('feat').length})

${table(of('feat'))}

## Spells (${of('spell').length})

${table(of('spell'))}

## Items (${of('item').length})

${table(of('item'))}

## Variant templates (${of('variant').length})

${table(of('variant'))}

## Backgrounds (${of('background').length})

${table(of('background'))}
`;
  writeFileSync(path, md);
}

const ACTORS_DIR = join(ROOT, 'testing', 'actors');
const emitted = [];

/** Grava a ficha da unidade para o lote ao vivo e devolve a linha da lista. */
function emitActor(actor, kind, row) {
  const file = `t3_${kind}_${row.name.replace(/[^a-z0-9]+/gi, '_')}_${row.source}.json`;
  writeFileSync(join(ACTORS_DIR, file), JSON.stringify(actor));
  return { file, kind, name: row.name, source: row.source };
}

async function main() {
  const db = loadDb();
  await loadFoundryMechanics();
  mkdirSync(OUT_DIR, { recursive: true });
  const species = defaultSpecies(db);
  const all = !args.feats && !args.spells && !args.items && !args.backgrounds;
  const only = args.only ? String(args.only).toLowerCase() : null;
  const keep = (rows) => (only ? rows.filter((r) => r.id.toLowerCase().includes(only)) : rows);
  const jobs = [
    ...(all || args.feats ? keep(featMatrix(db)).map((row) => () => runFeat(db, row, species)) : []),
    ...(all || args.spells ? keep(spellMatrix(db)).map((row) => () => runSpell(db, row, species)) : []),
    ...(all || args.items ? keep(itemMatrix(db)).map((row) => () => runItem(db, row, species)) : []),
    ...(all || args.backgrounds ? keep(backgroundMatrix(db)).map((row) => () => runBackground(db, row, species)) : []),
  ];
  console.log(`T3 sweep: ${jobs.length} units…`);
  const results = [];
  let fails = 0;
  for (const job of jobs) {
    let r;
    try { r = job(); } catch (e) { r = { id: '?', kind: '?', build: { ok: false }, crash: e.message }; }
    results.push(r);
    const v = verdict(r);
    if (v.startsWith('FAIL')) {
      fails += 1;
      console.log(`  ✗ ${r.id}  ${v}`);
    }
  }
  flushItemBatch();
  if (emitted.length) writeFileSync(join(ACTORS_DIR, '_t3.json'), JSON.stringify(emitted));
  const skipped = results.filter((r) => r.skip).length;
  writeFileSync(join(OUT_DIR, 'report-t3.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  if (all && !only) writeCoverage(results);
  console.log(`\n${results.length - fails - skipped}/${results.length - skipped} ok (${skipped} skipped) - report: testing/report-t3.json`);
  if (fails) process.exitCode = 1;
}

await main();
