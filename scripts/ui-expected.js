// =============================================================================
// ui-expected: o que a tela do jogo DEVE mostrar de cada modelo (U2, docs/UI-TEST-PLAN.md)
// =============================================================================
// O QUE FAZ
//   Para cada personagem modelo do SRD (src/dev/playModels.json), monta o catálogo do
//   jogo pelo motor, sobre o MESMO pacote SRD que o app usa na primeira visita
//   (`srdBundle.json` pelo `prepareDb`), no estado descansado, e grava o esperado em
//   `test-results/ui-data/expected.json`: os ataques da ação Attack (acerto e dano), as
//   features da aba Features, os pools com o máximo e as magias preparadas. O
//   `testing/ui/u2.spec.js` confere a tela contra ele. Roda antes dos testes de
//   interface (o `globalSetup` do playwright.config).
//   Grava também `test-results/ui-data/archetypes.json`: para cada roteiro de arquétipo
//   (testing/archetypes/spec.js, as fichas de testing/feature-audit/check-archetypes.json), os
//   passos `rider` do estado descansado, com o que o motor oferece naquela rolagem, sobre a
//   cópia local do 5e.tools (`loadDb`), a mesma que o teste serve ao app.
//
// FUNÇÕES
//   expectedFor(character, db): o esperado de um personagem.
//   attackDetail(a, catalog, state): o acerto e o dano de um ataque, pelos números do motor.
//   wornState(catalog), wornView(character, db): o estado gasto e o que a tela mostra nele.
//   riderChecks(spec, character, db): os passos `rider` de um roteiro com o que o motor oferece.
//   lc(s): o texto em minúsculas.
//
// DECISÕES E ARMADILHAS
//   - O esperado vem do catálogo (`screenCatalog`, o mesmo do Play.jsx) e dos auxiliares do
//     motor (`fixedRollBonus`, `attackRollContext`), nunca da tela (o princípio do §3 do
//     plano): a U2 prova o caminho do motor até a tela.
//   - Estado descansado (`emptyPlayState`): é como a ficha abre num perfil novo.
//   - Do roteiro só entram os `rider` ANTES do primeiro `do` (o estado descansado: o que vem
//     depois pede usar algo na tela, que é a U4) e os de magia cujo dano sai no lançamento
//     (`damage.later` fica fora: o Hunter's Mark rola depois, pelo modificador).
//   - O arquivo é gerado a cada rodada e fica fora do git (`test-results/`), numa pasta que
//     o Playwright não limpa (`ui-data`; a `ui` é a saída dele, apagada a cada rodada).
// -----------------------------------------------------------------------------

import fs from 'node:fs';
import bundle from '../src/data/srdBundle.json' with { type: 'json' };
import models from '../src/dev/playModels.json' with { type: 'json' };
import { prepareDb } from '../src/engine/prepareDb.js';
import { derivePlayCatalog } from '../src/engine/playCatalog.js';
import { screenCatalog } from '../src/engine/playView.js';
import { emptyPlayState, remainingOf, createPlayDoc } from '../src/engine/playState.js';
import { actionContext } from '../src/engine/playBasicActions.js';
import { fixedRollBonus, attackRollContext, rollEffects, effectiveSpeed, effectiveSpeeds, conditionName, CONDITIONS } from '../src/engine/playEffects.js';
import { formatBonus } from '../src/engine/math.js';
import { vitals } from '../src/engine/playHealth.js';
import { hitDiceLeft } from '../src/engine/playRest.js';
import { slotPoolsFor, spellAttackOf } from '../src/engine/playCast.js';
import { spellLevelLabel } from '../src/engine/spells.js';
import { loadDb, snapshotVersion } from './lib/loadDb.js';
import { ARCHETYPES } from '../testing/archetypes/spec.js';
import archetypeSheets from '../testing/feature-audit/check-archetypes.json' with { type: 'json' };

const OUT = new URL('../test-results/ui-data/expected.json', import.meta.url);
const ARCH_OUT = new URL('../test-results/ui-data/archetypes.json', import.meta.url);
const lc = (s) => String(s ?? '').toLowerCase();

/** O acerto e o dano de um ataque, pelos números do motor. */
function attackDetail(a, catalog, state) {
  const hit = a.toHit ? formatBonus(a.toHit.total + fixedRollBonus(state, catalog, attackRollContext(a, 'attack', catalog))) : null;
  const bonus = a.damage ? (a.damage.bonus ?? 0) + fixedRollBonus(state, catalog, attackRollContext(a, 'damage', catalog)) : 0;
  const damage = !a.damage ? null : a.damage.dice ? `${a.damage.dice}${bonus ? formatBonus(bonus) : ''}` : String(Math.max(0, bonus));
  return { name: a.name, hit, damage };
}

const SPEED_LABEL = { walk: 'Walk', fly: 'Fly', swim: 'Swim', climb: 'Climb', burrow: 'Burrow' };
const WORN_CONDITIONS = { exhaustion: 2, poisoned: 1 };

/** O estado gasto: um de cada recurso, 3 de dano, exaustão 2 e Poisoned. */
function wornState(catalog) {
  const state = emptyPlayState();
  for (const r of catalog.resources ?? []) if (r.max > 0 && ['pool', 'slot', 'pact', 'hitDice'].includes(r.kind)) state.spent[r.key] = 1;
  return { ...state, damage: 3, conditions: { ...WORN_CONDITIONS } };
}

/** O que a tela mostra no estado gasto, pelo motor. */
function wornView(character, db) {
  const base = derivePlayCatalog(character, db);
  const state = wornState(screenCatalog(base, emptyPlayState()));
  const catalog = screenCatalog(base, state);
  const hp = vitals(state, catalog);
  const dice = hitDiceLeft(catalog, state);
  const left = dice.reduce((s, d) => s + d.left, 0);
  const max = dice.reduce((s, d) => s + d.max, 0);
  const speeds = effectiveSpeeds(catalog, state);
  const claimed = new Set((catalog.featureList ?? []).map((f) => f.name));
  const origin = (catalog.spells ?? []).find((o) => o.spells.length);
  const levels = origin ? [...new Set(origin.spells.filter((s) => s.prepared !== false || s.ritualOnly).map((s) => s.level))].sort((a, b) => a - b) : [];
  return {
    doc: { ...createPlayDoc(character.id), baseline: state },
    hp: { current: hp.current, max: hp.max },
    hitDice: max ? `${left}/${max}` : null,
    speed: effectiveSpeed(catalog, state),
    speeds: Object.keys(SPEED_LABEL).filter((m) => speeds[m]).map((m) => ({ label: SPEED_LABEL[m], feet: speeds[m].feet })),
    conditions: Object.entries(state.conditions).map(([id, level]) => `${conditionName(id)}${CONDITIONS[id]?.levels ? ` ${level}` : ''}`),
    pools: (catalog.resources ?? []).filter((r) => r.kind === 'pool').map((r) => ({ row: claimed.has(r.item) ? r.item : r.name, label: `${remainingOf(state, r.key, r.max)} of ${r.max} left` })),
    slots: origin?.kind === 'item' ? [] : levels.map((lv) => ({
      level: spellLevelLabel(lv),
      titles: slotPoolsFor(catalog, state, lv).map((p) => `${p.label}: ${p.left} of ${p.max} left. Tap to change by hand`),
    })),
  };
}

/** O esperado de um personagem. */
function expectedFor(character, db) {
  const state = emptyPlayState();
  const catalog = screenCatalog(derivePlayCatalog(character, db), state);
  const ctx = actionContext(catalog, state);
  return {
    id: character.id,
    attacks: ctx.attacks.map((a) => attackDetail(a, catalog, state)),
    features: [...new Set((catalog.featureList ?? []).map((f) => f.name))],
    pools: (catalog.resources ?? []).filter((r) => r.kind === 'pool' && r.item).map((r) => ({ feature: r.item, max: r.max })),
    spells: [...new Set((catalog.spells ?? []).flatMap((o) => o.spells.filter((s) => s.prepared !== false).map((s) => s.name)))],
    worn: wornView(character, db),
  };
}

/** Os passos `rider` do estado descansado de um roteiro, com o que o motor oferece. */
function riderChecks(spec, character, db) {
  const catalog = screenCatalog(derivePlayCatalog(character, db), emptyPlayState());
  const state = emptyPlayState();
  const firstDo = spec.steps.findIndex((s) => s.do);
  const out = [];
  for (const step of spec.steps.slice(0, firstDo < 0 ? undefined : firstDo)) {
    if (step.check !== 'rider') continue;
    let roll;
    let target;
    if (typeof step.on === 'string') {
      const attack = (catalog.attacks ?? []).find((a) => lc(a.name) === lc(step.on)) ?? (catalog.attacks ?? []).find((a) => lc(a.name).startsWith(lc(step.on)));
      if (!attack) continue;
      roll = attackRollContext(attack, step.roll, catalog);
      target = { attack: attack.name };
    } else {
      const origin = (catalog.spells ?? []).find((o) => o.spells.some((x) => lc(x.name) === lc(step.on.spell)));
      const spell = origin?.spells.find((x) => lc(x.name) === lc(step.on.spell));
      if (!spell || spell.mechanics?.damage?.later) continue;
      const level = step.on.level ?? spell.level;
      roll = attackRollContext(spellAttackOf(origin, spell, level), step.roll);
      target = { spell: spell.name, level };
    }
    const effects = rollEffects(state, catalog, roll);
    const hit = effects.find((x) => lc(x.label).includes(lc(step.label)) || lc(x.source).includes(lc(step.label)));
    out.push({ ...target, roll: step.roll, label: step.label, absent: !!step.absent, engine: hit ? 'offered' : 'absent', offered: effects.map((e) => e.label) });
  }
  return out;
}

const db = prepareDb(bundle);
const all = models.map((c) => expectedFor(c, db));
fs.mkdirSync(new URL('.', OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(all, null, 1));
console.log(`[U2] esperado de ${all.length} modelos em test-results/ui-data/expected.json`);

const full = await loadDb();
const sheets = new Map(archetypeSheets.map((c) => [c.id, c]));
const arch = ARCHETYPES.filter((spec) => sheets.has(spec.id))
  .map((spec) => ({ id: spec.id, character: sheets.get(spec.id), checks: riderChecks(spec, sheets.get(spec.id), full) }))
  .filter((a) => a.checks.length);
fs.writeFileSync(ARCH_OUT, JSON.stringify({ version: snapshotVersion(), archetypes: arch }, null, 1));
console.log(`[U2] ${arch.reduce((n, a) => n + a.checks.length, 0)} passos de extra em ${arch.length} arquétipos (5etools ${snapshotVersion()}) em test-results/ui-data/archetypes.json`);
