// =============================================================================
// sweep-t3: o Tier 0 da T3, talentos, magias e itens (TESTING-PLAN §5b)
// =============================================================================
// O QUE FAZ
//   Para cada unidade da T3 (featMatrix, spellMatrix, itemMatrix), monta um
//   HOSPEDEIRO pelo autoBuild com a unidade no lugar REAL (o talento no espaço da
//   categoria dele, a magia no grimório de uma classe que a tem na lista, o item no
//   inventário, equipado e sintonizado), e cobra: o personagem fecha sem pendência,
//   a unidade está na derivação, o pré-requisito do talento passa, o ator exportado
//   tem o item da unidade e é estruturalmente válido, e o round-trip pelo nosso
//   import devolve as mesmas decisões. Grava `testing/report-t3.json` e
//   `testing/COVERAGE-T3.md` (UI, Export e Notes à mão sobrevivem).
//   `npm run sweep:t3` (ou `-- --feats`, `--spells`, `--items`, `--only=<texto>`).
//   `--emit-actors` grava a ficha de cada unidade em `testing/actors/t3_*.json` e a
//   lista `_t3.json`, para o lote ao vivo no Foundry (TESTING-PLAN §5.3).
//
// FUNÇÕES
//   classRowFor(db, classId): a primeira linha de classe (com subclasse) da matriz.
//   withAbility(c, ability, min): troca os valores do standard array para o
//     atributo chegar ao mínimo de um pré-requisito.
//   speciesFor(db, races): a linha de espécie (e linhagem) da primeira raça do
//     pré-requisito que existe na matriz ("gnome / deep" é a espécie Deep Gnome).
//   featHost(db, row, feat, species): classe, nível, espaço, espécie e o talento
//     exigido de um talento.
//   spellHost(db, row): a classe e o nível que preparam a magia.
//   exportChecks(db, character, hasUnit): shape, presença da unidade e round-trip.
//   flagged(actor, page, name, source): o ator tem o item com a marca de procedência?
//   runFeat(db, row, species), runSpell(db, row, species), runItem(db, row,
//     species): uma unidade.
//   verdict(r): o resumo de uma linha.
//   splitCells(line), escapePipes(s), unescapePipes(s), parseManual(text),
//     writeCoverage(results): o tracker COVERAGE-T3.md.
//   emitActor(actor, kind, row): grava a ficha da unidade para o lote ao vivo.
//   main(): a CLI.
//
// DECISÕES E ARMADILHAS
//   - O espaço do talento segue a categoria (o que o seletor oferece em cada
//     escolha da classe, medido): origem no talento de origem; G e sem categoria no
//     `feat@4` (ou no ASI do nível do pré-requisito); FS no `feat@1` do Fighter, FS:P
//     e FS:R no `feat@2` do Paladino e do Ranger; EB no `feat@19`. Pré-requisito de
//     conjuração (ou feature Spellcasting ou Pact Magic) leva o hospedeiro para o
//     Mago; classe no nível 1 vira a classe do hospedeiro; raça com sub-raça vira a
//     linhagem; talento exigido entra antes (origem, ou o `feat@4` com a unidade no
//     `feat@8`). Só a PRIMEIRA alternativa do pré-requisito (as outras são OU).
//     Status `null` (sem pré-requisito) passa; `unknown` (campanha, texto livre)
//     o motor não avalia e vira nota; só `bad` reprova. Dragonmark (D, EFA) entra
//     como talento de ORIGEM: é o que os antecedentes de herdeiro dão no lugar dele
//     (DDL-0172), e o Dragonmark que outro talento exige (Greater Mark, ou a
//     categoria do Potent Dragonmark, que leva o Mark of Healing) também vai na
//     origem. Dark Gift (DG, RHW) vai no espaço de talento geral.
//   - A magia entra pela classe da lista na ordem de PREFERRED_CASTERS (o Bruxo por
//     último: acima do 5º círculo ele lança pelo Mystic Arcanum); magia sem classe
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
import { classMatrix, defaultSpecies, speciesMatrix, featMatrix, spellMatrix, itemMatrix } from './lib/matrix';
import { autoBuild } from './lib/autoBuild';
import { checkActorShape, scanBadValues } from './lib/invariants';
import { decisionSummary, diffSummaries, classifyDiffs } from './lib/roundtrip';
import { ownedFromDb, resolveFeat } from '../src/engine/resolve';
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

const ROOT = join(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'testing');
const ASI_LEVELS = [4, 8, 12, 16, 19];
const SLOT = {
  G: ['fighter', 4, 'feat@4'],
  FS: ['fighter', 1, 'feat@1'],
  'FS:P': ['paladin', 2, 'feat@2'],
  'FS:R': ['ranger', 2, 'feat@2'],
  EB: ['fighter', 19, 'feat@19'],
};
// ATENÇÃO: o mesmo conjunto do EQUIPPABLE_GROUPS de components/builder/InventoryTab.jsx (o que a ficha deixa equipar).
const EQUIPPABLE_GROUPS = new Set(['weapon', 'armor', 'spellcastingFocus', 'tool', 'instrument']);
const PREFERRED_CASTERS = ['wizard', 'cleric', 'druid', 'bard', 'sorcerer', 'paladin', 'ranger', 'artificer', 'warlock'];

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);

function classRowFor(db, classId) {
  return classMatrix(db).find((r) => r.classId === classId) ?? { classId, classSource: 'XPHB' };
}

function withAbility(c, ability, min) {
  if ((c.scores[ability] ?? 0) >= min) return;
  const [best] = Object.entries(c.scores).sort((a, b) => b[1] - a[1]);
  const keep = c.scores[ability];
  c.scores[ability] = best[1];
  c.scores[best[0]] = keep;
}

function speciesFor(db, races) {
  const all = speciesMatrix(db);
  const lc = (x) => String(x ?? '').toLowerCase();
  for (const race of races ?? []) {
    const name = lc(race?.name);
    const sub = lc(race?.subrace);
    const rows = all.filter((s) => s.speciesId === name);
    const hit = (sub ? rows.find((s) => lc(s.lineage).includes(sub)) : null)
      ?? (sub ? all.find((s) => s.speciesId === `${sub} ${name}`) : null)
      ?? rows[0]
      ?? all.find((s) => lc(s.lineage) === name);
    if (hit) return { speciesId: hit.speciesId, speciesSource: hit.speciesSource, lineage: hit.lineage ?? null };
  }
  return null;
}

function featHost(db, row, feat, species) {
  const alt = (feat.prerequisite ?? [])[0] ?? {};
  const caster = alt.spellcasting || alt.spellcasting2020 || alt.spellcastingFeature || alt.spellcastingPrepared
    || (alt.feature ?? []).some((x) => /spellcasting|pact magic/i.test(String(x)));
  const minLevel = typeof alt.level === 'number' ? alt.level : (alt.level?.level ?? 0);
  let [classId, level, slot] = row.category === 'O' || row.category === 'D' ? ['fighter', 1, 'origin'] : (SLOT[row.category] ?? SLOT.G);
  const levelClass = alt.level?.class?.name ? String(alt.level.class.name).toLowerCase() : null;
  if (levelClass && !row.category.startsWith('FS')) classId = levelClass;
  else if (caster && classId === 'fighter') classId = 'wizard';
  if (slot !== 'origin' && minLevel > level && !row.category.startsWith('FS')) {
    level = ASI_LEVELS.find((l) => l >= minLevel) ?? 19;
    slot = `feat@${level}`;
  }
  let required = null;
  const reqRef = (alt.feat ?? [])[0];
  if (reqRef) {
    const [rn, rs] = String(reqRef).split('|');
    const lc = (x) => String(x ?? '').toLowerCase();
    const rf = (db.feats?.feat ?? []).find((x) => lc(x.name) === lc(rn) && (!rs || lc(x.source) === lc(rs)));
    if (rf) {
      required = { id: `${rf.name}|${rf.source}`, origin: rf.category === 'O' || rf.category === 'D' };
      if (!required.origin && slot === 'feat@4') {
        level = Math.max(level, 8);
        slot = 'feat@8';
        required.slot = 'feat@4';
      } else if (!required.origin) {
        required.slot = 'feat@4';
        level = Math.max(level, 8);
      }
    }
  }
  if (!required && (alt.featCategory ?? []).includes('D')) required = { id: 'Mark of Healing|EFA', origin: true };
  const host = alt.race?.length ? (speciesFor(db, alt.race) ?? species) : species;
  const abilities = (alt.ability ?? []).flatMap((o) => Object.entries(o));
  return { classId, level, slot, species: host, abilities, required };
}

function spellHost(db, row) {
  const name = row.name.toLowerCase();
  const classId = PREFERRED_CASTERS.find((cid) => classSpellList(db, cid).has(name));
  if (classId) return { classId, level: 20, via: 'class' };
  const raw = spellEntity.list(db).find((x) => x.name === row.name && x.source === row.source);
  const variants = new Set(spellSources(db, raw).classesVariant.map((c) => String(c.name).toLowerCase()));
  const viaVariant = PREFERRED_CASTERS.find((cid) => variants.has(cid));
  return viaVariant ? { classId: viaVariant, level: 20, via: 'classVariant' } : { skip: 'sem lista de classe (concedida só por talento ou subclasse)' };
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
  const crow = classRowFor(db, host.classId);
  const built = autoBuild(db, {
    id: row.id,
    classId: host.classId,
    classSource: crow.classSource,
    subclassId: crow.subclassId,
    subclassSource: crow.subclassSource,
    level: host.level,
    ...host.species,
    seed: 7,
    ...(host.slot === 'origin' ? { originFeat: { id: row.name, source: row.source } } : {}),
    ...(host.required?.origin ? { originFeat: { id: host.required.id.split('|')[0], source: host.required.id.split('|')[1] } } : {}),
    preset: (c) => {
      for (const [ab, min] of host.abilities) withAbility(c, ab, Number(min) || 13);
      if (host.required?.slot) c.classes[0].choices[host.required.slot] = { kind: 'feat', picks: [host.required.id], sub: {} };
      if (host.slot !== 'origin') c.classes[0].choices[host.slot] = { kind: 'feat', picks: [id], sub: {} };
    },
  });
  r.build = { ok: built.ok, problems: built.problems.slice(0, 6), pendencies: built.pendencies?.total ?? 0 };
  r.taken = !!ownedFromDb(built.character, db).feats?.has(id);
  const granted = row.category.startsWith('FS') ? ['Fighting Style'] : [];
  r.prereq = prereqStatus(feat, prereqContext(built.character, { db, grantedFeatures: granted }));
  const asi = row.name === 'Ability Score Improvement';
  const ex = exportChecks(db, built.character, (actor) => asi || flagged(actor, 'feats.html', row.name, row.source));
  delete ex.actor;
  r.export = ex;
  r.ms = Date.now() - t0;
  return r;
}

function runSpell(db, row, species) {
  const t0 = Date.now();
  const host = spellHost(db, row);
  const r = { id: row.id, kind: 'spell', host: host.skip ? null : `${host.classId} ${host.level}${host.via === 'classVariant' ? ' (classVariant)' : ''}` };
  if (host.skip) return { ...r, skip: host.skip, ms: Date.now() - t0 };
  const crow = classRowFor(db, host.classId);
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
  const built = autoBuild(db, {
    id: row.id, classId: 'fighter', classSource: crow.classSource, subclassId: crow.subclassId,
    subclassSource: crow.subclassSource, level: 5, ...species, seed: 7,
    preset: (c) => {
      const equippable = EQUIPPABLE_GROUPS.has(itemTypeInfo(raw).group);
      c.inventory.push({ uid: makeId(), itemId: raw.name, source: raw.source, quantity: 1, equipped: equippable, attuned: !!raw.reqAttune });
    },
  });
  r.build = { ok: built.ok, problems: built.problems.slice(0, 6), pendencies: built.pendencies?.total ?? 0 };
  r.taken = (built.derived.inventory ?? []).some((e) => e.raw?.name === raw.name);
  const ex = exportChecks(db, built.character, (actor) => flagged(actor, 'items.html', raw.name, raw.source));
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
  const all = !args.feats && !args.spells && !args.items;
  const only = args.only ? String(args.only).toLowerCase() : null;
  const keep = (rows) => (only ? rows.filter((r) => r.id.toLowerCase().includes(only)) : rows);
  const jobs = [
    ...(all || args.feats ? keep(featMatrix(db)).map((row) => () => runFeat(db, row, species)) : []),
    ...(all || args.spells ? keep(spellMatrix(db)).map((row) => () => runSpell(db, row, species)) : []),
    ...(all || args.items ? keep(itemMatrix(db)).map((row) => () => runItem(db, row, species)) : []),
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
  if (emitted.length) writeFileSync(join(ACTORS_DIR, '_t3.json'), JSON.stringify(emitted));
  const skipped = results.filter((r) => r.skip).length;
  writeFileSync(join(OUT_DIR, 'report-t3.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  if (all && !only) writeCoverage(results);
  console.log(`\n${results.length - fails - skipped}/${results.length - skipped} ok (${skipped} skipped) - report: testing/report-t3.json`);
  if (fails) process.exitCode = 1;
}

await main();
