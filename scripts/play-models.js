// =============================================================================
// play-models: os personagens modelo da Fase P, montados e provados
// =============================================================================
// O QUE FAZ
//   Uso: npx vite-node scripts/play-models.js [--only=<id>] [--no-write]
//   Monta cada modelo de testing/play-models/spec.js nos níveis 3, 11 e 20 (e as cópias
//   leves no 5) pelo autoBuild, com as escolhas explícitas da especificação, e prova o
//   play mode de cada um no motor (docs/PLAY-MODE-CERT-PLAN.md §5.2):
//   - o builder: nenhuma pendência, e cada escolha da especificação ficou onde foi posta;
//   - o catálogo do jogo: nenhum problema;
//   - cada teste (atributo, salvaguarda, perícia, iniciativa), ataque e dano rola com
//     todos os extras ligados, e o total é um número;
//   - cada activity aplica o evento sem erro e gasta o que diz;
//   - cada "Use" do registro curado e da prosa rola e aplica;
//   - cada magia lança pelo primeiro espaço, e o dano e a cura rolam;
//   - cada recurso com recuperação volta no descanso que diz;
//   - cada feature recebe o veredito do levantamento (scripts/lib/playCoverage.js).
//   Grava testing/COVERAGE-PLAY.md (o livro, uma linha por feature) e
//   src/dev/playModels.json (os personagens para o botão "Load test characters") e
//   testing/play-models/legacy-characters.json (os da leva Legacy, privados, para o passe ao
//   vivo no app de dev, carregados pelo console).
//
// FUNÇÕES
//   originFeatOf(name): o talento de origem da especificação como { id, source }.
//   ABILITY_ORDER: os atributos de cada classe, do mais alto ao mais baixo (registro).
//   build(db, model, level): o personagem do modelo no nível, e os problemas do builder.
//   probe(db, character, unit): o catálogo e as sondas de um personagem; devolve os
//     problemas e o veredito de cada feature.
//   finite(n): o número é finito?
//   rollAll(catalog, state, roll): os extras de uma rolagem, todos ligados.
//   bookOf(rows, units): o texto do COVERAGE-PLAY.md.
//
// DECISÕES E ARMADILHAS
//   - O druida leva as formas conhecidas do Wild Shape (`withWildShapeForms`, as feras do SRD embutido,
//     sorteadas pela semente do modelo e do nível), como o jogador as escolhe na aba da classe (DDL-0348).
//   - Os modelos do SRD sorteiam talento, opção de classe e magia só entre o que tem a marca
//     srd52 ou srd (`spec.allow`); os da leva Legacy (DDL-0224) também no XPHB e no livro da
//     própria subclasse (sorteando em tudo, o monge nascia com talentos de cenário), e nunca vão
//     para src/dev/playModels.json, que vai no app e no espelho público (só o livro, privado).
//     `model.picks` entra direto no saco da classe (o Pact of the Blade do Hexblade).
//   - Cada modelo leva o kit inicial da classe (a opção A, como o guia de criação faz): sem
//     ele, a primeira rodada só tinha o ataque desarmado, e o passe ao vivo achou isso
//     (DDL-0219). Armadura e arma nascem equipadas (startingKitInventory).
//   - O id do personagem é estável (`model-<id>-<nível>`): carregar de novo pelo botão
//     substitui, não duplica.
//   - Um extra ligado que não se aplica (o Cunning Strike sem Sneak Attack) é legítimo: a
//     sonda liga TODOS para provar que cada fórmula resolve, não para conferir a regra.
//   - O veredito: `ok` para `use` sem problema; `log-ok` para `log` (o histórico registra o
//     uso e o gasto, P4); `ok` para a passiva sem pista pendente (nada a calcular: texto,
//     ou a ficha deriva); `gap` com pista sem motivo ou com problema de sonda.
//   - O livro dedupe por nome e seção da feature: a mesma feature em vários níveis e
//     modelos é uma linha, com a primeira unidade em que apareceu e o pior veredito.
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import process from 'node:process';
import { loadDb } from './lib/loadDb.js';
import { autoBuild } from './lib/autoBuild.js';
import { hashSeed, mulberry32 } from './lib/rng.js';
import { MODELS, LIGHT_COPIES, LEVELS, LIGHT_LEVEL } from '../testing/play-models/spec.js';
import { cuesOf, classify, unexplainedCues } from './lib/playCoverage.js';
import { derivePlayCatalog } from '../src/engine/playCatalog.js';
import { plainText } from '../src/engine/playFeatures.js';
import { emptyPlayState, applyEvent } from '../src/engine/playState.js';
import { rollTestEvent, rollAttackEvent, rollDamageEvent } from '../src/engine/playActions.js';
import { rollEffects, applyEffects } from '../src/engine/playEffects.js';
import { activityEvent, featureLogEvent } from '../src/engine/playUse.js';
import { featureUseOf } from '../src/engine/playFeatureRolls.js';
import { castWays, castEvent, spellAttackOf, spellHealEvent } from '../src/engine/playCast.js';
import { shortRestEvent, longRestEvent } from '../src/engine/playRest.js';
import { withStartingKit } from './lib/startingKit.js';
import { withWildShapeForms, srdBeasts } from './lib/wildShapeForms.js';

const SRD_BEASTS = srdBeasts();

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

const finite = (n) => typeof n === 'number' && Number.isFinite(n);

/** O talento de origem da especificação como { id, source }. */
function originFeatOf(name) {
  const [id, source] = String(name ?? 'Alert').split('|');
  return { id, source: source || 'XPHB' };
}

/** Os atributos de cada classe, do mais alto ao mais baixo (o standard array nessa ordem). */
const ABILITY_ORDER = {
  barbarian: ['str', 'con', 'dex'],
  bard: ['cha', 'dex', 'con'],
  cleric: ['wis', 'con', 'str'],
  druid: ['wis', 'con', 'dex'],
  fighter: ['str', 'con', 'dex'],
  monk: ['dex', 'wis', 'con'],
  paladin: ['str', 'cha', 'con'],
  ranger: ['dex', 'wis', 'con'],
  rogue: ['dex', 'int', 'con'],
  sorcerer: ['cha', 'con', 'dex'],
  warlock: ['cha', 'con', 'dex'],
  wizard: ['int', 'con', 'dex'],
};

/** O personagem do modelo no nível, e os problemas do builder. */
function build(db, model, level) {
  const feats = Object.entries(model.feats ?? {}).filter(([lvl]) => level >= Number(lvl));
  const built = autoBuild(db, {
    id: `${model.id}@${level}`,
    name: `${model.name} ${level}`,
    classId: model.classId,
    classSource: 'XPHB',
    subclassId: model.subclassId,
    subclassSource: model.subclassSource,
    speciesId: model.speciesId,
    speciesSource: model.speciesSource,
    lineage: model.lineage ?? null,
    level,
    seed: hashSeed(model.id, level),
    originFeat: originFeatOf(model.originFeat),
    abilityOrder: ABILITY_ORDER[model.classId],
    allow: (raw) => !!(raw?.srd52 || raw?.srd) || (model.batch === 'Legacy' && [model.subclassSource, 'XPHB'].includes(raw?.source)),
    preset: (c) => {
      for (const [lvl, id] of feats) c.classes[0].choices[`feat@${lvl}`] = { kind: 'feat', picks: [id], sub: {} };
      for (const [id, picks] of Object.entries(model.picks ?? {})) c.classes[0].choices[id] = { kind: id.startsWith('optfeat@') ? 'optionalfeature' : 'feat', picks: [...picks], sub: {} };
    },
  });
  const c = built.character;
  c.id = `model-${model.id}-${level}`;
  const problems = [];
  withStartingKit(db, c, mulberry32(hashSeed(model.id, 9)), problems);
  withWildShapeForms(db, c, SRD_BEASTS, mulberry32(hashSeed(`${model.id}:forms`, level)));
  if (!built.ok) problems.push({ where: 'builder', message: `${built.pendencies.total} pendencies left` });
  for (const p of built.problems) problems.push({ where: 'builder', message: p.message ?? String(p) });
  for (const [lvl, id] of feats) {
    if (c.classes[0].choices[`feat@${lvl}`]?.picks?.[0] !== id) problems.push({ where: 'builder', message: `feat@${lvl} lost ${id}` });
  }
  if (model.subclassId && level >= 3 && c.classes[0].subclassId !== model.subclassId) problems.push({ where: 'builder', message: `subclass ${model.subclassId} lost` });
  return { character: c, problems };
}

/** Os extras de uma rolagem, todos ligados. */
function rollAll(catalog, state, roll) {
  const effects = rollEffects(state, catalog, roll);
  return applyEffects(effects, effects.map((e) => e.id));
}

/** O catálogo e as sondas de um personagem: os problemas e o veredito de cada feature. */
function probe(db, character, unit) {
  const problems = [];
  const fail = (where, message) => problems.push({ where, message });
  const guard = (where, fn) => {
    try {
      fn();
    } catch (e) {
      fail(where, `crash: ${e.message}`);
    }
  };
  let catalog;
  try {
    catalog = derivePlayCatalog(character, db);
  } catch (e) {
    fail('catalog', `crash: ${e.message}`);
    return { problems, features: [] };
  }
  for (const p of catalog.problems) fail(p.where, p.message);
  const rng = mulberry32(hashSeed(unit, 3));
  const state = emptyPlayState();

  for (const a of catalog.checks.abilities ?? []) {
    for (const test of [{ type: 'ability', id: a.ability }, { type: 'save', id: a.ability }]) {
      guard(`${test.type} ${a.ability}`, () => {
        const roll = test.type === 'save' ? { kind: 'save', ability: a.ability } : { kind: 'check', ability: a.ability };
        const ev = rollTestEvent({ catalog, test, name: test.id, options: { applied: rollAll(catalog, state, roll) }, rng });
        if (!finite(ev.rolls?.total)) fail(`${test.type} ${a.ability}`, 'total is not a number');
      });
    }
  }
  for (const s of catalog.checks.skills ?? []) {
    guard(`skill ${s.skill}`, () => {
      const ev = rollTestEvent({ catalog, test: { type: 'skill', id: s.skill }, name: s.skill, options: { applied: rollAll(catalog, state, { kind: 'check', ability: s.ability, skill: s.skill }) }, rng });
      if (!finite(ev.rolls?.total)) fail(`skill ${s.skill}`, 'total is not a number');
    });
  }
  guard('initiative', () => {
    const ev = rollTestEvent({ catalog, test: { type: 'initiative' }, name: 'Initiative', options: { applied: rollAll(catalog, state, { kind: 'initiative', ability: 'dex' }) }, rng });
    if (!finite(ev.rolls?.total)) fail('initiative', 'total is not a number');
  });

  for (const attack of catalog.attacks ?? []) {
    const base = { weapon: attack.kind === 'weapon' || attack.kind === 'unarmed', melee: attack.range === 'melee', unarmed: attack.kind === 'unarmed', spell: attack.kind === 'spell' || attack.kind === 'cantrip', attackAbility: attack.ability };
    guard(`attack ${attack.name}`, () => {
      if (attack.toHit || attack.attack) {
        const ev = rollAttackEvent({ catalog, attack, options: { applied: rollAll(catalog, state, { kind: 'attack', ...base }) }, rng });
        if (!finite(ev.rolls?.total)) fail(`attack ${attack.name}`, 'hit total is not a number');
      }
      if (attack.damage) {
        const ev = rollDamageEvent({ catalog, attack, options: { applied: rollAll(catalog, state, { kind: 'damage', ...base }) }, rng });
        if (!finite(ev.rolls?.total)) fail(`attack ${attack.name}`, 'damage total is not a number');
      }
    });
  }

  for (const action of catalog.actions ?? []) {
    for (const activity of action.activities ?? []) {
      guard(`use ${action.name}: ${activity.name}`, () => {
        const ev = activityEvent({ catalog, state, action, activity, rng });
        const after = applyEvent(state, ev);
        if (!finite(after.damage) || !finite(after.tempHp)) fail(`use ${action.name}`, 'state is not a number after the use');
        for (const c of activity.consumes ?? []) {
          if (c.key && c.amount > 0 && !(ev.ops ?? []).some((o) => o.op === 'spend' && o.key === c.key)) fail(`use ${action.name}: ${activity.name}`, `does not spend ${c.key}`);
        }
      });
    }
  }

  for (const f of catalog.featureList ?? []) {
    const use = featureUseOf(f, catalog);
    if (!use?.roll && !use?.modifier) continue;
    guard(`feature ${f.name}`, () => {
      const ev = featureLogEvent({ catalog, state, feature: f, roll: use.roll, apply: use.apply, modifier: use.modifier, rng });
      if (use.roll && !finite(ev.rolls?.total)) fail(`feature ${f.name}`, 'roll total is not a number');
      applyEvent(state, ev);
    });
  }

  for (const origin of catalog.spells ?? []) {
    for (const spell of origin.spells ?? []) {
      const ways = castWays(catalog, state, spell);
      if (!ways.length) continue;
      const way = ways[0];
      guard(`spell ${spell.name}`, () => {
        applyEvent(state, castEvent({ state, origin, spell, way }));
        if (spell.mechanics?.damage?.dice) {
          const ev = rollDamageEvent({ catalog, attack: spellAttackOf(origin, spell, way.level), options: {}, rng });
          if (!finite(ev.rolls?.total)) fail(`spell ${spell.name}`, 'damage total is not a number');
        }
        if (spell.mechanics?.heal?.dice) {
          const ev = spellHealEvent({ catalog, state, origin, spell, level: way.level, rng });
          if (!finite(ev.rolls?.total)) fail(`spell ${spell.name}`, 'healing total is not a number');
        }
      });
    }
  }

  for (const r of catalog.resources ?? []) {
    if (!r.max || !(r.recovery ?? []).length) continue;
    guard(`rest ${r.name}`, () => {
      const spent = { ...emptyPlayState(), spent: { [r.key]: r.max } };
      const short = r.recovery.every((x) => x.period === 'sr');
      const ev = short ? shortRestEvent({ state: spent, catalog, spends: [], rng }) : longRestEvent({ state: spent, catalog, rng });
      const after = applyEvent(spent, ev);
      if ((after.spent?.[r.key] ?? 0) >= r.max) fail(`rest ${r.name}`, `nothing back after a ${short ? 'short' : 'long'} rest`);
    });
  }

  const actions = new Map((catalog.actions ?? []).map((a) => [a.key, a]));
  const pools = (catalog.resources ?? []).filter((r) => r.kind === 'pool');
  const bridged = new Set([...(catalog.actorEffects ?? []), ...(catalog.proseEffects ?? [])].map((e) => e.name));
  const failedNames = new Set(problems.map((p) => String(p.where).replace(/^(use|feature) /, '').split(':')[0]));
  const features = (catalog.featureList ?? []).map((f) => {
    const cat = classify(f, actions.get(f.actionKey), pools.filter((p) => p.item === f.name), bridged.has(f.name));
    const pending = unexplainedCues(f, cat, cuesOf(plainText(f.entries)));
    const broken = failedNames.has(f.name);
    const verdict = broken || pending.length ? 'gap' : cat === 'log' ? 'log-ok' : 'ok';
    return { name: f.name, source: f.source, kind: f.kind, section: f.section, cat, pending, verdict };
  });
  return { problems, features };
}

const RANK = { ok: 0, 'log-ok': 1, gap: 2 };

/** O texto do COVERAGE-PLAY.md. */
function bookOf(rows, units) {
  const totals = { ok: 0, 'log-ok': 0, gap: 0 };
  for (const r of rows.values()) totals[r.verdict] += 1;
  const lines = [
    '# COVERAGE-PLAY: o play mode nos personagens modelo',
    '',
    'Gerado por `npx vite-node scripts/play-models.js` (docs/PLAY-MODE-CERT-PLAN.md §5.2, DDL-0218).',
    'Não edite à mão.',
    '',
    `Unidades: ${units.length} personagens. Features distintas: ${rows.size}: ${totals.ok} ok, ${totals['log-ok']} log-ok, ${totals.gap} gap.`,
    '',
    '## Os personagens',
    '',
    '| Unidade | Leva | Problemas |',
    '|---|---|---|',
    ...units.map((u) => `| ${u.unit} | ${u.batch} | ${u.problems.length ? u.problems.map((p) => `${p.where}: ${p.message}`).join('; ') : '0'} |`),
    '',
    '## As features',
    '',
    '| Feature | Seção | Tipo | Categoria | Veredito | Pistas pendentes | Primeira unidade |',
    '|---|---|---|---|---|---|---|',
    ...[...rows.values()]
      .sort((a, b) => RANK[b.verdict] - RANK[a.verdict] || a.section.localeCompare(b.section) || a.name.localeCompare(b.name))
      .map((r) => `| ${r.name} | ${r.section} | ${r.kind} | ${r.cat} | ${r.verdict} | ${r.pending.join(', ')} | ${r.unit} |`),
    '',
  ];
  return lines.join('\n');
}

const db = loadDb();
const units = [];
const rows = new Map();
const characters = [];
const legacy = [];
const plan = [
  ...MODELS.flatMap((m) => LEVELS.map((level) => ({ model: { ...m, name: `${m.batch === 'Legacy' ? 'Model legacy' : 'Model 2024'} ${m.classId[0].toUpperCase()}${m.classId.slice(1)}` }, level }))),
  ...LIGHT_COPIES.map((lc) => {
    const base = MODELS.find((m) => m.id === lc.of);
    return { model: { ...base, ...lc, feats: lc.feats ?? base.feats, batch: base.batch, name: `Model copy ${lc.id.replace(/^lc-/, '')}` }, level: LIGHT_LEVEL };
  }),
].filter(({ model }) => !args.only || model.id === args.only);

for (const { model, level } of plan) {
  const unit = `${model.id}@${level}`;
  const { character, problems } = build(db, model, level);
  const result = probe(db, character, unit);
  units.push({ unit, batch: model.batch, problems: [...problems, ...result.problems] });
  // ATENÇÃO: o arquivo do botão vai no app e no espelho público: só ficha do SRD (DDL-0224).
  (model.batch === 'Legacy' ? legacy : characters).push(character);
  for (const f of result.features) {
    const key = `${f.name}|${f.section}`;
    const prev = rows.get(key);
    if (!prev || RANK[f.verdict] > RANK[prev.verdict]) rows.set(key, { ...f, unit });
  }
  const bad = problems.length + result.problems.length;
  console.log(`${bad ? 'x' : 'ok'} ${unit}${bad ? `  ${[...problems, ...result.problems].map((p) => `${p.where}: ${p.message}`).join(' | ')}` : ''}`);
}

const gaps = [...rows.values()].filter((r) => r.verdict === 'gap');
const failing = units.filter((u) => u.problems.length);
console.log(`\n${units.length} personagens, ${failing.length} com problema; ${rows.size} features distintas, ${gaps.length} gap.`);
for (const g of gaps) console.log(`  gap: ${g.name} (${g.section}) ${g.pending.join(', ')} [${g.unit}]`);

if (!args['no-write'] && !args.only) {
  fs.writeFileSync('testing/COVERAGE-PLAY.md', bookOf(rows, units));
  fs.mkdirSync('src/dev', { recursive: true });
  fs.writeFileSync('src/dev/playModels.json', `${JSON.stringify(characters)}\n`);
  fs.writeFileSync('testing/play-models/legacy-characters.json', `${JSON.stringify(legacy)}\n`);
  console.log('wrote testing/COVERAGE-PLAY.md, src/dev/playModels.json and testing/play-models/legacy-characters.json');
}
process.exitCode = failing.length || gaps.length ? 1 : 0;
