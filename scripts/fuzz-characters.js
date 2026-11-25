// =============================================================================
// fuzz-characters: personagens aleatórios e válidos, conferidos por invariantes
// =============================================================================
// O QUE FAZ
//   Uso: npx vite-node scripts/fuzz-characters.js [--count=<n>] [--seed=<n>] [--list]
//   A estratégia 2 do recap de 2026-11-19 (DDL-0273): a régua prova cada linha e cada par; o fuzz prova a
//   MISTURA que nenhuma linha imagina. Sorteia `--count` personagens (uma a três classes com as subclasses, uma
//   espécie com a linhagem, níveis até 20 no total) pelo autoBuild, e confere em cada um:
//   - o builder termina sem pendência;
//   - a regra de multiclasse do XPHB (scripts/lib/multiclassOracle.js), quando há mais de uma classe;
//   - o catálogo do jogo deriva; toda fórmula de ataque, de dano e de recurso rola sem erro e sem NaN;
//   - todo recurso tem máximo inteiro e não negativo;
//   - uma sessão no motor: gastar um de cada pool, levar dano e curar, e o descanso longo devolve o que o texto diz
//     (todo recurso com recuperação no longo volta cheio, o PV volta ao máximo);
//   - a ficha volta igual pelo Foundry (export, import e o decisionSummary).
//   Imprime as famílias de problema e, com `--list`, cada um.
//
// FUNÇÕES
//   pick(rng, list): um item ao acaso.
//   randomSpec(rng, rows, species): as classes, a espécie e os níveis de um personagem sorteado.
//   checkFormula(formula, data, where, out): rola uma fórmula e anota o erro ou o NaN.
//   sessionProblems(catalog, rng): a sessão no motor e o que o descanso longo não devolveu.
//   fuzzOne(spec, id): os problemas de um personagem.
//
// DECISÕES E ARMADILHAS
//   - Semente fixa por padrão (o mesmo `--seed` acha o mesmo problema de novo).
//   - O recurso com recuperação que não é do longo (o "1d4 long rests" da Lethargy Resilience, o pool só do curto)
//     não entra na conta do descanso longo: só o que declara `lr` ou `recoverAll`.
//   - Nada de texto de livro na saída: só nomes e o problema.
// -----------------------------------------------------------------------------
import process from 'node:process';
import { loadDb } from './lib/loadDb.js';
import { classMatrix, speciesMatrix } from './lib/matrix.js';
import { autoBuild } from './lib/autoBuild.js';
import { hashSeed, mulberry32 } from './lib/rng.js';
import { multiclassProblems } from './lib/multiclassOracle.js';
import { decisionSummary, diffSummaries, classifyDiffs } from './lib/roundtrip.js';
import { derivePlayCatalog } from '../src/engine/playCatalog.js';
import { deriveFromDb } from '../src/engine/resolve.js';
import { deriveGrantedProficiencies } from '../src/engine/autoProficiencies.js';
import { buildClassChoices } from '../src/components/builder/classChoices.js';
import { attacksPerAction } from '../src/engine/playBasicActions.js';
import { assembleFoundryActor } from '../src/engine/foundryActor.js';
import { foundryToCharacter } from '../src/engine/foundryImport.js';
import { loadFoundryMechanics } from '../src/engine/foundryMechanicsData.js';
import { rollFormula } from '../src/engine/dice.js';
import { emptyPlayState, applyOp, hpView } from '../src/engine/playState.js';
import { longRestEvent } from '../src/engine/playRest.js';
import { damageOutcome, healOutcome } from '../src/engine/playHealth.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const COUNT = Number(args.count ?? 300);
const SEED = Number(args.seed ?? 20261119);

const db = loadDb();
await loadFoundryMechanics();

/** Um item ao acaso. */
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

/** As classes, a espécie e os níveis de um personagem sorteado. */
function randomSpec(rng, rows, species) {
  const byClass = new Map();
  for (const r of rows) {
    const k = `${r.classId}|${r.classSource}`;
    if (!byClass.has(k)) byClass.set(k, []);
    byClass.get(k).push(r);
  }
  const keys = [...byClass.keys()];
  const n = rng() < 0.5 ? 1 : rng() < 0.75 ? 2 : 3;
  const chosen = [];
  while (chosen.length < n) {
    const k = pick(rng, keys);
    if (!chosen.includes(k)) chosen.push(k);
  }
  let left = 1 + Math.floor(rng() * 20);
  const classes = chosen.map((k, i) => {
    const level = i === chosen.length - 1 ? Math.max(1, left) : Math.max(1, Math.min(left - (chosen.length - 1 - i), 1 + Math.floor(rng() * left)));
    left -= level;
    const r = pick(rng, byClass.get(k));
    return { classId: r.classId, classSource: r.classSource, subclassId: r.subclassId, subclassSource: r.subclassSource, level };
  }).filter((c) => c.level > 0);
  const s = pick(rng, species);
  return { classes, species: { speciesId: s.speciesId, speciesSource: s.speciesSource, lineage: s.lineage }, label: `${classes.map((c) => `${c.classId}${c.subclassId ? `(${c.subclassId})` : ''} ${c.level}`).join(' / ')} + ${s.id}` };
}

/** Rola uma fórmula e anota o erro ou o NaN. */
function checkFormula(formula, data, where, out) {
  if (formula == null || formula === '') return;
  try {
    const r = rollFormula(String(formula), { data, rng: () => 0.5 });
    if (!Number.isFinite(r.total)) out.push(`${where}: fórmula "${formula}" dá ${r.total}`);
  } catch (e) {
    out.push(`${where}: fórmula "${formula}" não rola (${String(e?.message ?? e).slice(0, 60)})`);
  }
}

/** A sessão no motor: gasto, dano, cura e o descanso longo. */
function sessionProblems(catalog) {
  const out = [];
  let state = emptyPlayState();
  const pools = (catalog.resources ?? []).filter((r) => (r.kind === 'pool' || r.kind === 'slot' || r.kind === 'pact') && r.max > 0);
  for (const p of pools) state = applyOp(state, { op: 'spend', key: p.key, amount: 1 });
  const max = catalog.stats?.hpMax ?? 0;
  for (const op of damageOutcome(state, catalog, { amount: Math.min(5, Math.max(0, max - 1)) }).ops) state = applyOp(state, op);
  for (const op of healOutcome(state, catalog, 2).ops) state = applyOp(state, op);
  for (const op of longRestEvent({ state, catalog, rng: () => 0.5 }).ops) state = applyOp(state, op);
  if (hpView(state, max).current !== max) out.push(`descanso longo: PV ${hpView(state, max).current} de ${max}`);
  for (const p of pools) {
    const longRest = (p.recovery ?? []).some((r) => ['lr', 'day', 'dawn'].includes(r.period) && (r.type === 'recoverAll' || r.type == null));
    if (longRest && (state.spent?.[p.key] ?? 0) > 0) out.push(`descanso longo: ${p.name} não voltou cheio`);
  }
  return out;
}

/** Os problemas de um personagem. */
function fuzzOne(spec, id) {
  const out = [];
  let built;
  try {
    built = autoBuild(db, { id, ...spec.species, seed: hashSeed(id, 1), classes: spec.classes });
  } catch (e) {
    return [`autoBuild: ${String(e?.message ?? e).slice(0, 120)}`];
  }
  if (!built.ok) out.push(`builder com pendência (${built.pendencies.total})`);
  let catalog;
  try {
    catalog = derivePlayCatalog(built.character, db);
  } catch (e) {
    return [...out, `catálogo: ${String(e?.message ?? e).slice(0, 120)}`];
  }
  if (spec.classes.length > 1) out.push(...multiclassProblems(db, built, { deriveGranted: deriveGrantedProficiencies, buildClassChoices, catalog, attacksPerAction, derive: deriveFromDb }));
  const data = catalog.rollData ?? {};
  for (const a of catalog.attacks ?? []) {
    checkFormula(a.damage?.dice, data, `ataque ${a.name}`, out);
    if (a.toHit && !Number.isFinite(a.toHit.total)) out.push(`ataque ${a.name}: acerto ${a.toHit.total}`);
  }
  for (const r of catalog.resources ?? []) {
    if (!Number.isInteger(r.max) || r.max < 0) out.push(`recurso ${r.name}: máximo ${r.max}`);
  }
  for (const act of catalog.actions ?? []) for (const x of act.activities ?? []) for (const part of x.damage?.parts ?? []) checkFormula(part.formula ?? part, data, `activity ${act.name}`, out);
  out.push(...sessionProblems(catalog));
  try {
    const back = foundryToCharacter(assembleFoundryActor(built.character, db), db);
    const { real } = classifyDiffs(diffSummaries(decisionSummary(built.character), decisionSummary(back)), { known: [] });
    for (const x of real.slice(0, 3)) out.push(`volta pelo Foundry: ${x.path ?? JSON.stringify(x).slice(0, 100)}`);
  } catch (e) {
    out.push(`export ou import: ${String(e?.message ?? e).slice(0, 100)}`);
  }
  return out;
}

const rng = mulberry32(SEED);
const rows = classMatrix(db);
const species = speciesMatrix(db);
const fails = [];
for (let i = 0; i < COUNT; i++) {
  const spec = randomSpec(rng, rows, species);
  for (const p of fuzzOne(spec, `${SEED}:${i}`)) fails.push(`${spec.label}: ${p}`);
}
const bad = new Set(fails.map((f) => f.split(': ')[0])).size;
console.log(`${COUNT} personagens (semente ${SEED}): ${COUNT - bad} sem problema, ${bad} com problema.`);
const fam = new Map();
for (const f of fails) {
  const k = f.split(': ').slice(1).join(': ').replace(/"[^"]*"/g, '"X"').replace(/[0-9]+/g, 'N').slice(0, 110);
  fam.set(k, (fam.get(k) ?? 0) + 1);
}
for (const [k, n] of [...fam].sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(5), k);
if (args.list) for (const f of fails) console.log(f);
