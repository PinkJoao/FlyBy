// =============================================================================
// archetypes: os roteiros de arquétipo rodados no motor, com o número do texto
// =============================================================================
// O QUE FAZ
//   Monta a ficha de cada roteiro de `testing/archetypes/spec.js` (autoBuild, com as escolhas que mudam o
//   número fixas), joga os passos sobre o catálogo da TELA (`screenCatalog`, o mesmo do Play.jsx) e
//   confere cada número contra a fórmula do texto. Escreve o livro `testing/ARCHETYPES.md` (o resultado e o
//   roteiro para jogar na tela) e as fichas `testing/feature-audit/check-archetypes.json`, para carregar
//   no navegador (DDL-0246).
//
//   npx vite-node scripts/archetypes.js [--only=<id>] [--no-write]
//
// FUNÇÕES
//   lc(s): o texto em minúsculas.
//   splitTop(text), termsOf(text, vars): os termos de uma fórmula (dados e números), no nível de cima.
//   normalize(text, vars): a fórmula como { dice, bonus } comparável ("1d8 + 1d8 + 3" = "2d8 + 3").
//   same(a, b), show(n): a comparação e o texto de um valor normalizado.
//   build(db, spec): a ficha do roteiro.
//   findAttack(catalog, name), findSpell(catalog, name): o ataque e a magia pelo nome.
//   damageOf(state, catalog, attack): o dano como a tela mostra (dados, extras e os fixos ligados).
//   runStep(ctx, step): um passo; devolve { ok, want, got } ou muda o estado.
//   run(db, spec): o roteiro inteiro.
//   book(results): o livro em Markdown.
//
// DECISÕES E ARMADILHAS
//   - O número da tela é o do catálogo da tela mais os efeitos LIGADOS de número fixo (`fixedRollBonus`),
//     como o rótulo "Damage (1d8 + 3)"; um efeito desligado (Brutal Strike) é um `rider`, com a fórmula
//     resolvida (`resolveRefs`).
//   - O estado só muda pelos mesmos eventos da tela (activityEvent, featureLogEvent, castEvent, o
//     modificador do estado de arma); o roteiro nunca escreve o estado à mão.
//   - O `use` lê o "Use" do registro curado e, sem ele, a activity da feature (o Psionic Strike, o Hand of
//     Healing); a iniciativa é a do tile, com os fixos ligados (o Dread Ambusher soma SAB, DDL-0249).
//   - Um `rider` com `absent` prova que o extra NÃO aparece (o Psychic Blades num bardo que não é de Whispers).
//   - Um passo que não acha o que procura (o ataque, a magia, o recurso) falha com o motivo: o roteiro é
//     a lista do que o jogador procura na tela.
// -----------------------------------------------------------------------------

import fs from 'node:fs';
import process from 'node:process';
import { loadDb } from './lib/loadDb.js';
import { autoBuild } from './lib/autoBuild.js';
import { hashSeed } from './lib/rng.js';
import { ARCHETYPES } from '../testing/archetypes/spec.js';
import { derivePlayCatalog } from '../src/engine/playCatalog.js';
import { screenCatalog } from '../src/engine/playView.js';
import { emptyPlayState, applyEvent } from '../src/engine/playState.js';
import { rollEffects, fixedRollBonus, attackRollContext, effectiveAc, effectiveSpeed, makeModifier } from '../src/engine/playEffects.js';
import { withRounds } from '../src/engine/playCombat.js';
import { activityEvent, featureLogEvent } from '../src/engine/playUse.js';
import { featureUseOf } from '../src/engine/playFeatureRolls.js';
import { castWays, castEvent, spellAttackOf, healParts } from '../src/engine/playCast.js';
import { attacksPerAction } from '../src/engine/playBasicActions.js';
import { weaponRuleOf, eligibleWeapons, weaponModifier } from '../src/engine/playWeapons.js';
import { resolveRefs } from '../src/engine/dice.js';

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--only='))?.slice(7) ?? null;
const write = !args.includes('--no-write');
const lc = (s) => String(s ?? '').toLowerCase();

/** Os termos de cima de uma fórmula, com o sinal: "1d8 + max(1, cha) - 2" dá três. */
function splitTop(text) {
  const out = [];
  let depth = 0;
  let cur = '';
  let sign = 1;
  for (const ch of String(text).replace(/\s+/g, '')) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && (ch === '+' || ch === '-') && cur) {
      out.push({ sign, term: cur });
      cur = '';
      sign = ch === '-' ? -1 : 1;
      continue;
    }
    if (depth === 0 && (ch === '+' || ch === '-') && !cur) {
      sign = ch === '-' ? -1 : 1;
      continue;
    }
    cur += ch;
  }
  if (cur) out.push({ sign, term: cur });
  return out;
}

/** Os dados e o número de uma fórmula, com as variáveis da ficha. */
function termsOf(text, vars) {
  const dice = {};
  let bonus = 0;
  for (const { sign, term } of splitTop(text)) {
    if (/^\(.*\)$/.test(term) && splitTop(term.slice(1, -1)).length > 1) {
      const inner = termsOf(term.slice(1, -1), vars);
      for (const [f, n] of Object.entries(inner.dice)) dice[f] = (dice[f] ?? 0) + sign * n;
      bonus += sign * inner.bonus;
      continue;
    }
    const d = term.replace(/^\((.*)\)$/, '$1').match(/^(\d*)d(\d+)$/);
    if (d) {
      dice[d[2]] = (dice[d[2]] ?? 0) + sign * (Number(d[1]) || 1);
      continue;
    }
    const names = Object.keys(vars);
    const value = new Function(...names, 'max', 'min', 'floor', `return (${term});`)(...names.map((n) => vars[n]), Math.max, Math.min, Math.floor);
    bonus += sign * Number(value);
  }
  return { dice, bonus };
}

/** A fórmula comparável: os dados por face e o número. */
function normalize(text, vars) {
  const { dice, bonus } = termsOf(text, vars);
  const list = Object.entries(dice).filter(([, n]) => n).sort((a, b) => Number(a[0]) - Number(b[0])).map(([f, n]) => `${n}d${f}`);
  return { dice: list.join(' + '), bonus };
}

const same = (a, b) => a.dice === b.dice && a.bonus === b.bonus;
const show = (n) => [n.dice, n.dice && !n.bonus ? '' : String(n.bonus)].filter(Boolean).join(' + ');

/** A ficha do roteiro: autoBuild com as escolhas fixas, as magias, o inventário. */
function build(db, spec) {
  const built = autoBuild(db, {
    id: spec.id, name: spec.id, classId: spec.classId, classSource: 'XPHB', subclassId: spec.subclassId, subclassSource: spec.subclassSource,
    speciesId: spec.speciesId, speciesSource: 'XPHB', lineage: spec.lineage ?? null, level: spec.level, seed: hashSeed(spec.id, 1), abilityOrder: spec.abilityOrder,
    preset: (c) => {
      c.classes[0].spells = (spec.spells ?? []).map((s) => ({ id: s, source: 'XPHB' }));
      for (const [id, picks] of Object.entries(spec.picks ?? {})) {
        c.classes[0].choices[id] = { kind: id.startsWith('optfeat@') ? 'optionalfeature' : id.startsWith('feat@') ? 'feat' : id.includes('featopt') ? 'featureoption' : id.includes('resist') ? 'resist' : 'feat', picks: [...picks], sub: {} };
      }
    },
  });
  const c = built.character;
  c.id = spec.id;
  c.meta.name = spec.id.replace(/^arch-/, 'Arch ').replace(/-/g, ' ');
  c.inventory = (spec.inventory ?? []).map((name, i) => ({ uid: `${spec.id}-${i}`, itemId: name, source: 'XPHB', quantity: 1, equipped: true, attuned: false }));
  const lost = Object.entries(spec.picks ?? {}).filter(([id, picks]) => !picks.every((p) => c.classes[0].choices[id]?.picks?.includes(p))).map(([id]) => id);
  return { character: c, ok: built.ok, lost };
}

/** O ataque pelo nome (o nome exato primeiro, depois o que começa com ele). */
function findAttack(catalog, name) {
  const all = catalog.attacks ?? [];
  return all.find((a) => lc(a.name) === lc(name)) ?? all.find((a) => lc(a.name).startsWith(lc(name))) ?? null;
}

/** A magia e a origem dela pelo nome. */
function findSpell(catalog, name) {
  for (const origin of catalog.spells ?? []) {
    const spell = (origin.spells ?? []).find((s) => lc(s.name) === lc(name));
    if (spell) return { origin, spell };
  }
  return null;
}

/** O dano como a tela mostra: os dados, os extras e os fixos ligados. */
function damageOf(state, catalog, attack) {
  const d = attack.damage;
  const extra = (d.extra ?? []).map((e) => e.formula).join(' + ');
  const fixed = fixedRollBonus(state, catalog, attackRollContext(attack, 'damage', catalog));
  return [resolveRefs(String(d.dice), catalog.rollData), extra, String((d.bonus ?? 0) + fixed)].filter(Boolean).join(' + ');
}

/** Um passo do roteiro. */
function runStep(ctx, step) {
  const catalog = screenCatalog(ctx.base, ctx.state);
  const vars = { ...ctx.mods(catalog), pb: catalog.stats?.profBonus ?? 0, lvl: ctx.level };
  const cmp = (want, got) => {
    const w = normalize(want, vars);
    const g = normalize(got, vars);
    return { ok: same(w, g), want: `${want} = ${show(w)}`, got: show(g) };
  };
  const miss = (what) => ({ ok: false, want: '-', got: `not found: ${what}` });

  if (step.do === 'use') {
    const action = (catalog.actions ?? []).find((a) => lc(a.name) === lc(step.feature));
    const feature = (catalog.featureList ?? []).find((f) => lc(f.name) === lc(step.feature));
    const rule = weaponRuleOf(step.feature);
    let ev;
    if (action?.activities?.length) {
      const activity = action.activities.find((x) => !step.activity || lc(x.name) === lc(step.activity)) ?? action.activities[0];
      ev = activityEvent({ catalog, state: ctx.state, action, activity, options: {} });
    } else if (feature) {
      const use = featureUseOf(feature, catalog);
      ev = featureLogEvent({ catalog, state: ctx.state, feature, spend: use?.spend ?? null, amount: use?.spent ?? 1, modifier: use?.modifier ? makeModifier(use.modifier) : null, roll: use?.roll ?? null, apply: use?.apply ?? null });
    } else return miss(step.feature);
    if (rule) {
      const attack = eligibleWeapons(rule, catalog).find((a) => lc(a.name).startsWith(lc(step.weapon)));
      if (!attack) return miss(`${step.weapon} for ${step.feature}`);
      const mod = withRounds(makeModifier(weaponModifier({ rule, attack, catalog })), ctx.state, rule.rounds);
      ev = { ...ev, ops: [...ev.ops, { op: 'modifier', add: mod }] };
    }
    ctx.state = applyEvent(ctx.state, ev);
    return { ok: true, want: '-', got: 'done' };
  }
  if (step.do === 'cast') {
    const found = findSpell(catalog, step.spell);
    if (!found) return miss(step.spell);
    const way = castWays(catalog, ctx.state, found.spell).find((w) => w.level === step.level) ?? castWays(catalog, ctx.state, found.spell)[0];
    if (!way) return miss(`a way to cast ${step.spell}`);
    ctx.state = applyEvent(ctx.state, castEvent({ catalog, state: ctx.state, origin: found.origin, spell: found.spell, way }));
    return { ok: true, want: '-', got: 'done' };
  }

  if (step.check === 'stat') {
    const got = step.stat === 'ac' ? effectiveAc(catalog, ctx.state) : step.stat === 'speed' ? effectiveSpeed(catalog, ctx.state)
      : step.stat === 'initiative' ? (catalog.checks?.initiative?.bonus ?? 0) + fixedRollBonus(ctx.state, catalog, { kind: 'initiative', ability: 'dex' }) : catalog.stats?.[step.stat];
    return got == null ? miss(step.stat) : cmp(step.expect, String(got));
  }
  if (step.check === 'resource') {
    const r = (catalog.resources ?? []).find((x) => lc(x.name) === lc(step.name)) ?? (catalog.resources ?? []).find((x) => lc(x.name).startsWith(lc(step.name)));
    return r ? cmp(step.expect, String(r.max)) : miss(step.name);
  }
  if (step.check === 'attacks') return cmp(step.expect, String(attacksPerAction(catalog)));
  if (step.check === 'save') {
    const a = (catalog.checks?.abilities ?? []).find((x) => x.ability === step.ability);
    if (!a) return miss(step.ability);
    return cmp(step.expect, String(a.save + fixedRollBonus(ctx.state, catalog, { kind: 'save', ability: step.ability })));
  }
  if (step.check === 'attack') {
    const attack = findAttack(catalog, step.name);
    if (!attack) return miss(step.name);
    const parts = [];
    if (step.toHit) parts.push(cmp(step.toHit, String(attack.toHit.total + fixedRollBonus(ctx.state, catalog, attackRollContext(attack, 'attack', catalog)))));
    if (step.damage) parts.push(cmp(step.damage, damageOf(ctx.state, catalog, attack)));
    return { ok: parts.every((p) => p.ok), want: parts.map((p) => p.want).join(' / '), got: parts.map((p) => p.got).join(' / ') };
  }
  if (step.check === 'spell') {
    const found = findSpell(catalog, step.name);
    if (!found) return miss(step.name);
    const level = step.level ?? found.spell.level;
    const atk = spellAttackOf(found.origin, found.spell, level);
    const parts = [];
    if (step.dc) parts.push(cmp(step.dc, String(found.origin.saveDc)));
    if (step.attack) parts.push(cmp(step.attack, String(found.origin.attackBonus)));
    if (step.damage) parts.push(atk.damage ? cmp(step.damage, damageOf(ctx.state, catalog, atk)) : miss('damage'));
    if (step.heal) parts.push(cmp(step.heal, healParts(found.origin, found.spell, level, catalog).map((p) => p.formula).join(' + ') || '0'));
    return { ok: parts.every((p) => p.ok), want: parts.map((p) => p.want).join(' / '), got: parts.map((p) => p.got).join(' / ') };
  }
  if (step.check === 'rider') {
    let roll;
    if (typeof step.on === 'string') {
      const attack = findAttack(catalog, step.on);
      if (!attack) return miss(step.on);
      roll = attackRollContext(attack, step.roll, catalog);
    } else {
      const found = findSpell(catalog, step.on.spell);
      if (!found) return miss(step.on.spell);
      roll = attackRollContext(spellAttackOf(found.origin, found.spell, step.on.level ?? found.spell.level), step.roll);
    }
    const effects = rollEffects(ctx.state, catalog, roll);
    const e = effects.find((x) => lc(x.label).includes(lc(step.label)) || lc(x.source).includes(lc(step.label)));
    if (step.absent) return e ? { ok: false, want: 'not offered', got: `offered: ${e.label}` } : { ok: true, want: 'not offered', got: 'not offered' };
    if (!e) return { ok: false, want: step.expect, got: `not offered (${effects.map((x) => x.label).join(', ') || 'none'})` };
    if (!e.part) return { ok: false, want: step.expect, got: 'offered, no formula' };
    const r = cmp(step.expect, resolveRefs(String(e.part.formula), catalog.rollData));
    if (step.defaultOn != null && !!e.defaultOn !== step.defaultOn) return { ...r, ok: false, got: `${r.got} (${e.defaultOn ? 'on' : 'off'} by default)` };
    return r;
  }
  if (step.check === 'use') {
    const feature = (catalog.featureList ?? []).find((f) => lc(f.name) === lc(step.feature));
    if (!feature) return miss(step.feature);
    const use = featureUseOf(feature, catalog);
    const acts = (catalog.actions ?? []).find((a) => a.key === feature.actionKey)?.activities ?? [];
    const fromActivity = acts.map((a) => a.heal?.formula ?? a.damage?.[0]?.formula ?? a.roll?.formula).find(Boolean);
    const formula = use?.roll?.formula ?? fromActivity ?? null;
    return formula ? cmp(step.expect, resolveRefs(String(formula), catalog.rollData)) : miss(`a roll on ${step.feature}`);
  }
  return { ok: false, want: '-', got: 'unknown step' };
}

/** O roteiro inteiro sobre a ficha montada. */
function run(db, spec) {
  const { character, ok, lost } = build(db, spec);
  const base = derivePlayCatalog(character, db);
  const ctx = {
    base,
    level: spec.level,
    state: emptyPlayState(),
    mods: (catalog) => Object.fromEntries((catalog.checks?.abilities ?? []).map((a) => [a.ability, a.mod])),
  };
  const steps = spec.steps.map((step) => {
    try {
      return { step, ...runStep(ctx, step) };
    } catch (e) {
      return { step, ok: false, want: '-', got: `crash: ${e.message}` };
    }
  });
  return { spec, character, builderOk: ok, lost, steps };
}

/** O livro: o resultado de cada roteiro e o roteiro para jogar na tela. */
function book(results) {
  const total = results.reduce((s, r) => s + r.steps.filter((x) => x.step.check).length, 0);
  const failed = results.reduce((s, r) => s + r.steps.filter((x) => !x.ok).length, 0);
  const lines = [
    '# Roteiros de arquétipo',
    '',
    'Gerado por `npx vite-node scripts/archetypes.js` (DDL-0246) a partir de `testing/archetypes/spec.js`. Cada',
    'roteiro é a build de assinatura de uma classe: os passos rodam no motor sobre o catálogo da tela, e o',
    'esperado é a fórmula do texto sobre a ficha (`str + pb`). As fichas estão em',
    '`testing/feature-audit/check-archetypes.json`; para jogar na tela, carregue-as no navegador e siga os',
    'passos na ordem: o número da tela deve ser o da coluna "Esperado".',
    '',
    `${results.length} roteiros, ${total} conferências: ${total - failed} certas, ${failed} erradas.`,
    '',
  ];
  for (const r of results) {
    const bad = r.steps.filter((x) => !x.ok).length;
    lines.push(`## ${r.spec.classId} (${r.spec.subclassId}) ${r.spec.level}: ${r.spec.signature}`, '');
    lines.push(`Ficha \`${r.spec.id}\`${r.builderOk ? '' : ' (o builder deixou pendências)'}${r.lost.length ? `; escolhas perdidas: ${r.lost.join(', ')}` : ''}. ${bad ? `**${bad} errada(s).**` : 'Tudo certo no motor.'}`, '');
    lines.push('| # | Na tela | Esperado | App | Ok | Prova |', '|---|---|---|---|---|---|');
    r.steps.forEach((x, i) => {
      const what = x.step.do ? `**${x.step.say}**` : x.step.say;
      lines.push(`| ${i + 1} | ${what} | ${x.want} | ${x.got} | ${x.ok ? 'ok' : '**não**'} | ${x.step.proof ?? ''} |`);
    });
    lines.push('');
  }
  return lines.join('\n');
}

const db = await loadDb();
const results = ARCHETYPES.filter((s) => !only || s.id === only).map((s) => run(db, s));
for (const r of results) {
  const bad = r.steps.filter((x) => !x.ok);
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${r.spec.id}${r.lost.length ? ` (lost picks: ${r.lost.join(', ')})` : ''}`);
  for (const x of bad) console.log(`     ${x.step.say}: want ${x.want}, got ${x.got}`);
}
if (write && !only) {
  fs.writeFileSync('testing/ARCHETYPES.md', `${book(results)}\n`);
  fs.writeFileSync('testing/feature-audit/check-archetypes.json', JSON.stringify(results.map((r) => r.character)));
  console.log('wrote testing/ARCHETYPES.md and testing/feature-audit/check-archetypes.json');
}
