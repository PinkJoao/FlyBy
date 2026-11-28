// =============================================================================
// ui-check-play: confere no motor o que o robô da U4 fez na tela (docs/UI-TEST-PLAN.md)
// =============================================================================
// O QUE FAZ
//   Lê o rastro que `testing/ui/u4.spec.js` grava (`test-results/ui-data/u4/<id>.json`: para
//   cada ação usada na tela, o documento de jogo e o personagem antes, depois e depois do
//   desfazer) e confere cada passo pelo motor: houve evento; nenhum número quebrado; nenhum
//   recurso abaixo de 0 nem acima do máximo (salvo o "usar mesmo assim", `short`); o gasto foi
//   o que a REGRA diz para aquela ação (a magia gasta o espaço da forma escolhida e o custo do
//   lançamento, a concentração liga; a feature gasta o que a activity consome; o ataque não
//   gasta nada além da munição; o item gasta uma carga ou uma unidade); e o desfazer volta o
//   estado e o personagem exatos. Imprime a lista de problemas em JSON (vazia: tudo certo).
//
// FUNÇÕES
//   main(file): confere o rastro e imprime os problemas.
//   checkStep(step, ctx): os problemas de um passo.
//   spentDelta(before, after): o que mudou no gasto, por chave.
//   brokenNumbers(value, path): os caminhos com NaN, infinito ou "NaN"/"undefined" num texto.
//   inventoryOps(events): as operações de inventário dos eventos.
//   expectedSpend(step, events, before, catalog): o gasto esperado pela regra, ou null (sem regra).
//   sameDecisions(a, b): o inventário e as moedas iguais.
//
// DECISÕES E ARMADILHAS
//   - O esperado sai do motor e da regra, nunca da tela (o §3 do plano): a forma de lançar vem de
//     `castWays` pelo rótulo que o evento gravou, o custo da feature de `resolveCosts`. O rastro diz
//     só o que o robô APERTOU; o resto vem do documento gravado pelo app.
//   - Cada passo parte do estado descansado (o robô desfaz depois de cada ação), então o catálogo
//     de antes é o da ficha gravada, e o de depois é o mesmo catálogo sobre o estado novo.
//   - Os ids das activities mudam a cada derivação (o export os gera): a activity do evento se acha
//     pelo id, senão pela única do action, pelo nome da opção ou pelo rótulo do evento.
//   - O Log de uma feature gasta o que o registro curado diz (`featureUseOf`: o Stunning Strike gasta
//     1 Focus); a chave do `restore` aceita qualquer devolução. Um custo negativo (a recuperação) vale
//     até o que estava gasto.
//   - O gasto acima do máximo é aceito quando o fluxo passou por um "... anyway" (o app avisa e deixa,
//     §6.4) ou o evento marca `short` (no `use`, a lista do que faltou).
//   - A magia com mais de um gasto (Quickened Spell, Spell Breaker: o CostPanel) espera o gasto
//     escolhido: o de recurso que caiu, senão o sem recurso. Um `pick` que não é forma de lançar é um
//     gasto (a linha do CostPanel: o rótulo e a feature), e o recurso dele tem de cair, menos quando a
//     tela perguntou e o padrão foi "Free" (a Arcane Apotheosis: uma metamagia por turno de graça).
//   - O Transform do Wild Shape (o evento `form`) gasta um uso do pool "Wild Shape", a forma é uma das
//     conhecidas da ficha e o estado fica nela (DDL-0348).
//   - A activity que escala (`scalable`) aceita qualquer múltiplo do custo base: o padrão do
//     painel é 1, mas o máximo muda com o recurso.
//   - Um passo sem regra (Summon, Transform, Bond, Choose) só passa pelas conferências gerais.
//   - Roda pelo vite-node (o motor importa JSON e módulos do app), uma vez por personagem.
// -----------------------------------------------------------------------------

import fs from 'node:fs';
import process from 'node:process';
import bundle from '../src/data/srdBundle.json' with { type: 'json' };
import { prepareDb } from '../src/engine/prepareDb.js';
import { derivePlayCatalog } from '../src/engine/playCatalog.js';
import { screenCatalog } from '../src/engine/playView.js';
import { currentPlayState, deepEqual, normalizePlayDoc } from '../src/engine/playState.js';
import { castWays } from '../src/engine/playCast.js';
import { spellCosts } from '../src/engine/playBasicActions.js';
import { resolveCosts, activityLabel } from '../src/engine/playUse.js';
import { featureUseOf } from '../src/engine/playFeatureRolls.js';
import { loadDb } from './lib/loadDb.js';

/** O que mudou no gasto, por chave. */
function spentDelta(before, after) {
  const out = {};
  for (const k of new Set([...Object.keys(before.spent ?? {}), ...Object.keys(after.spent ?? {})])) {
    const d = (after.spent?.[k] ?? 0) - (before.spent?.[k] ?? 0);
    if (d) out[k] = d;
  }
  return out;
}

/** Os caminhos com NaN, infinito ou "NaN"/"undefined" num texto. */
function brokenNumbers(value, path = '') {
  if (typeof value === 'number') return Number.isFinite(value) ? [] : [path];
  if (typeof value === 'string') return /\bNaN\b|\bundefined\b|\[object Object\]/.test(value) ? [`${path}: "${value}"`] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => brokenNumbers(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => brokenNumbers(v, path ? `${path}.${k}` : k));
  return [];
}

/** As operações de inventário dos eventos. */
const inventoryOps = (events) => events.flatMap((e) => e.ops ?? []).filter((o) => o.op === 'inventory');

/** O inventário e as moedas iguais. */
const sameDecisions = (a, b) => deepEqual(a?.inventory ?? [], b?.inventory ?? []) && deepEqual(a?.currency ?? null, b?.currency ?? null);

/** O gasto esperado pela regra, ou null quando a ação não tem regra de gasto. */
function expectedSpend(step, events, before, catalog) {
  const kind = step.action.kind;
  if (kind === 'attack') return {};
  if (kind === 'spell') {
    const ev = events.find((e) => e.kind === 'cast');
    if (!ev) return { problem: 'sem evento de lançar' };
    const origin = (catalog.spells ?? []).find((o) => o.key === ev.payload.originKey) ?? (catalog.spells ?? []).find((o) => o.spells.some((s) => s.key === ev.payload.spellKey));
    const spell = origin?.spells.find((s) => s.key === ev.payload.spellKey);
    if (!spell) return { problem: `magia ${ev.label} fora do catálogo` };
    const costs = spellCosts(spell, catalog);
    const delta = spentDelta(before, currentPlayState(step.after.doc));
    const ways = castWays(catalog, before, spell);
    const costPick = !!step.action.pick && !ways.some((w) => w.label === step.action.pick);
    const free = step.flow.log.some((l) => /: Free$/.test(l));
    const picked = costPick ? costs.find((c) => c.source && step.action.pick.startsWith(c.label) && step.action.pick.includes(c.source)) : null;
    const cost = picked ?? costs.find((c) => c.spend && delta[c.spend.key]) ?? costs.find((c) => !c.spend) ?? costs[0] ?? null;
    const way = cost?.noSlot ? null : ways.find((w) => w.label === ev.payload.way);
    if (!way && !cost?.noSlot) return { problem: `forma "${ev.payload.way}" que o motor não oferece a ${spell.name}` };
    const out = {};
    const add = (k, n) => (out[k] = (out[k] ?? 0) + n);
    if (way?.key) add(way.key, way.amount ?? 1);
    if (way?.also) add(way.also, 1);
    if (cost?.spend && !free) add(cost.spend.key, cost.spend.amount);
    const extra = [];
    if (costPick && !picked) extra.push(`pediu o gasto "${step.action.pick}", que o motor não oferece`);
    if (step.action.pick && !costPick && ev.payload.way !== step.action.pick) extra.push(`pediu "${step.action.pick}", gravou "${ev.payload.way}"`);
    if (way && ev.payload.level !== way.level) extra.push(`círculo ${ev.payload.level}, a forma é do ${way.level}`);
    return { spend: out, spell, extra };
  }
  if (kind === 'feature') {
    const shape = events.find((e) => e.kind === 'form');
    if (shape) {
      const known = (step.before.character?.wildShapeForms ?? []).map((f) => f.name);
      const pool = (catalog.resources ?? []).find((x) => String(x.name).toLowerCase() === 'wild shape');
      const extra = [];
      if (step.action.pick && shape.payload?.form !== step.action.pick) extra.push(`pediu a forma "${step.action.pick}", gravou "${shape.payload?.form}"`);
      if (!known.includes(shape.payload?.form)) extra.push(`a forma "${shape.payload?.form}" não é uma das conhecidas (${known.join(', ')})`);
      if (currentPlayState(step.after.doc).form?.ref?.name !== shape.payload?.form) extra.push(`o estado não ficou na forma "${shape.payload?.form}"`);
      return { spend: pool ? { [pool.key]: 1 } : {}, extra };
    }
    const ev = events.find((e) => e.kind === 'use' && e.payload?.activityId);
    if (/^Spend one /.test(step.action.title)) return { one: true };
    const log = /^Log (.*) to the history$/.exec(step.action.title);
    if (log) {
      const feature = (catalog.featureList ?? []).find((f) => f.name === log[1]);
      const ev2 = events.find((e) => e.kind === 'use');
      let use = feature ? featureUseOf(feature, catalog) : null;
      const at = use?.options && ev2?.payload?.option ? use.options.indexOf(ev2.payload.option) : -1;
      if (at > 0) use = featureUseOf(feature, catalog, null, at);
      return { spend: use?.spend ? { [use.spend]: use.spent ?? 1 } : {}, restore: use?.restore ?? null };
    }
    if (!ev) return null;
    const action = (catalog.actions ?? []).find((a) => a.key === ev.payload.actionKey);
    const list = action?.activities ?? [];
    const activity = list.find((x) => x.id === ev.payload.activityId)
      ?? (list.length === 1 ? list[0] : list.find((x) => x.name && x.name === ev.payload.option) ?? list.find((x) => activityLabel(action, x) === ev.label));
    if (!activity) return { problem: `activity ${ev.payload.activityId} de ${ev.payload.feature} fora do catálogo` };
    if (ev.payload.free || ev.payload.noCost) return { spend: {} };
    const out = {};
    for (const c of resolveCosts(catalog, before, activity, {})) out[c.key] = (out[c.key] ?? 0) + c.amount;
    return { spend: out, scalable: !!activity.scalable };
  }
  if (kind === 'item') return { one: true, item: true };
  return null;
}

/** Os problemas de um passo. */
function checkStep(step, { db }) {
  const where = `${step.action.kind} ${step.action.title}${step.action.pick ? ` [${step.action.pick}]` : ''}`;
  const out = [];
  const say = (m) => out.push(`${where}: ${m}`);
  const id = step.before.character?.id;
  for (const k of ['before', 'after', 'undo']) step[k].doc = normalizePlayDoc(step[k].doc, id);
  const before = currentPlayState(step.before.doc);
  const after = currentPlayState(step.after.doc);
  const events = step.after.doc.events.slice(step.before.doc.cursor, step.after.doc.cursor);
  if (!events.length) {
    if (!step.flow.notice) say('nenhum evento gravado');
    return out;
  }
  for (const p of brokenNumbers(events)) say(`número quebrado no evento: ${p}`);
  const base = derivePlayCatalog(step.before.character, db);
  const catalog = screenCatalog(base, before);
  const catAfter = screenCatalog(base, after);
  const short = events.some((e) => (Array.isArray(e.payload?.short) ? e.payload.short.length > 0 : !!e.payload?.short)) || step.flow.log.some((l) => / anyway$/.test(l));
  for (const r of catAfter.resources ?? []) {
    const spent = after.spent?.[r.key] ?? 0;
    if (spent < 0) say(`${r.name} com gasto negativo (${spent})`);
    if (r.max > 0 && spent > r.max && !short) say(`${r.name} gastou ${spent} de ${r.max}`);
  }
  const delta = spentDelta(before, after);
  const inv = inventoryOps(events);
  const exp = expectedSpend(step, events, before, catalog);
  if (exp?.problem) say(exp.problem);
  else if (exp?.one) {
    const units = Object.values(delta).reduce((s, d) => s + d, 0) + inv.reduce((s, o) => s + Math.max(0, (o.before?.quantity ?? 1) - (o.after?.quantity ?? 0)), 0);
    if (units !== 1) say(`esperado gastar 1 (uma carga, um uso ou uma unidade), gastou ${units} (${JSON.stringify(delta)})`);
  } else if (exp?.spend) {
    for (const k of new Set([...Object.keys(exp.spend), ...Object.keys(delta)])) {
      const raw = exp.spend[k] ?? 0;
      const want = raw < 0 ? Math.max(raw, -(before.spent?.[k] ?? 0)) : raw;
      const got = delta[k] ?? 0;
      const ok = exp.scalable && want > 0 ? got >= want && got % want === 0 : got === want || (k === exp.restore && got <= 0);
      if (!ok) say(`gasto de ${k}: esperado ${want}, gravado ${got}`);
    }
    for (const m of exp.extra ?? []) say(m);
    if (exp.spell?.concentration && after.concentration?.spellKey !== exp.spell.key) say(`${exp.spell.name} é concentração e o estado não a ligou`);
  }
  if (step.action.kind === 'attack') {
    if (inv.length > 1) say(`${inv.length} operações de inventário num ataque`);
    for (const o of inv) if ((o.before?.quantity ?? 0) - (o.after?.quantity ?? 0) !== 1) say(`munição: ${o.before?.quantity} para ${o.after?.quantity}`);
  }
  if (inv.length && sameDecisions(step.before.character, step.after.character)) say('o evento mexe no inventário e o personagem não mudou');
  const undone = currentPlayState(step.undo.doc);
  if (step.undo.doc.cursor !== step.before.doc.cursor) say(`o desfazer parou no cursor ${step.undo.doc.cursor}, antes era ${step.before.doc.cursor}`);
  else if (!deepEqual(undone, before)) say('o desfazer não voltou o estado exato');
  if (!sameDecisions(step.undo.character, step.before.character)) say('o desfazer não voltou o inventário e as moedas');
  return out;
}

/** Confere o rastro e imprime os problemas. */
async function main(file) {
  const trace = JSON.parse(fs.readFileSync(file, 'utf8'));
  const db = trace.source === 'local' ? await loadDb() : prepareDb(bundle);
  const problems = trace.steps.flatMap((step) => checkStep(step, { db }));
  process.stdout.write(JSON.stringify(problems));
}

await main(process.argv[2]);
