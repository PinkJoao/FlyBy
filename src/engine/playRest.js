// =============================================================================
// playRest: os descansos curto e longo do play mode
// =============================================================================
// O QUE FAZ
//   Monta o evento de cada descanso a partir do estado de agora e do catálogo
//   (os recursos com a regra de recuperação de cada um). Um descanso é UM evento:
//   desfazer devolve tudo como estava (docs/PLAY-MODE-PLAN.md 3.8).
//
// FUNÇÕES
//   recoveryFor(catalog, state, period, ctx): o que cada recurso recupera no
//     descanso (operações e linhas do resumo).
//   rollHitDie(args): rola um dado de vida com a CON (mínimo 1).
//   hitDiceLeft(catalog, state): os dados de vida que sobram, por face.
//   shortRestEvent(args): o descanso curto com os dados de vida gastos.
//   longRestEvent(args): o descanso longo.
//
// DECISÕES E ARMADILHAS
//   Regras medidas no XPHB (variantrules "Short Rest", "Long Rest" e o capítulo 1)
//   - Curto: cada dado de vida gasto é rolado com o modificador de CON e cura no
//     MÍNIMO 1; o jogador decide depois de cada rolagem se gasta outro (por isso
//     a tela rola dado a dado e só grava no fim). Recupera o que é de descanso
//     curto. Exige pelo menos 1 HP: a tela avisa, não bloqueia (§6.4).
//   - Longo: todo o HP, TODOS os dados de vida gastos (2024), o temporário some,
//     a exaustão baixa 1 nível, a contagem da morte zera, e a concentração
//     termina (dormir dá a condição Inconsciente) com o que dependia dela; os
//     efeitos de feature e de magia e os manuais com duração de descanso somem
//     (playEffects.restModifierOps). Recupera o que é de descanso
//     curto também (o dnd5e faz o mesmo com o período `sr`).
//   - Períodos: o curto recupera `sr`; o longo, `lr`, `sr`, `day`, `dawn` e
//     `dusk` (o "1 por dia" da magia concedida e do item volta no longo).
//     Recuperação `recoverAll` devolve tudo; `formula` devolve o valor da
//     fórmula (rolada aqui e gravada no evento) até o gasto.
// -----------------------------------------------------------------------------

import { rollFormula, cryptoRng } from './dice';
import { makeEvent, hpView } from './playState';
import { healOutcome } from './playHealth';
import { endConcentrationOps, restModifierOps } from './playEffects';

const PERIODS = { sr: ['sr'], lr: ['lr', 'sr', 'day', 'dawn', 'dusk'] };

/**
 * O que cada recurso gasto recupera num descanso.
 * @param {'sr'|'lr'} period
 * @returns {{ ops: object[], lines: { name: string, detail: string }[], groups: object[] }}
 */
export function recoveryFor(catalog, state, period, { rng = cryptoRng } = {}) {
  const periods = PERIODS[period];
  const ops = [];
  const lines = [];
  const groups = [];
  for (const r of catalog.resources ?? []) {
    const spent = Math.min(state.spent?.[r.key] ?? 0, r.max);
    if (!spent) continue;
    const list = r.recovery ?? [];
    if (list.some((x) => x.type === 'recoverAll' && periods.includes(x.period))) {
      ops.push({ op: 'restore', key: r.key });
      lines.push({ name: r.name, detail: `${spent} restored` });
      continue;
    }
    let amount = 0;
    for (const x of list) {
      if (x.type !== 'formula' || !x.formula || !periods.includes(x.period)) continue;
      const rolled = rollFormula(String(x.formula), { data: catalog.rollData, rng });
      amount += rolled.total;
      groups.push(...rolled.groups);
    }
    const back = Math.max(0, Math.min(amount, spent));
    if (back) {
      ops.push({ op: 'restore', key: r.key, amount: back });
      lines.push({ name: r.name, detail: `${back} restored` });
    }
  }
  return { ops, lines, groups };
}

/** Rola um dado de vida com a CON; cura no mínimo 1 (XPHB). */
export function rollHitDie({ catalog, faces, rng = cryptoRng }) {
  const rolls = rollFormula(`1d${faces} + @abilities.con.mod`, { data: catalog.rollData, rng });
  return { faces, rolls, healed: Math.max(1, rolls.total) };
}

/** Os dados de vida que sobram, por face, da maior para a menor. */
export function hitDiceLeft(catalog, state) {
  return (catalog.resources ?? [])
    .filter((r) => r.kind === 'hitDice')
    .map((r) => ({ key: r.key, faces: r.faces, max: r.max, left: Math.max(0, r.max - (state.spent?.[r.key] ?? 0)) }));
}

/**
 * O descanso curto: os dados de vida já rolados, a cura e o que volta.
 * @param {{ state: object, catalog: object, spends: { faces: number, rolls: object, healed: number }[], rng?: Function, now?: Date }} args
 */
export function shortRestEvent({ state, catalog, spends = [], rng, now = new Date() }) {
  const ops = [];
  const lines = [];
  const byFace = {};
  for (const s of spends) byFace[s.faces] = (byFace[s.faces] ?? 0) + 1;
  for (const [faces, n] of Object.entries(byFace)) ops.push({ op: 'spend', key: `hd:d${faces}`, amount: n });
  const healTotal = spends.reduce((sum, s) => sum + s.healed, 0);
  const heal = healOutcome(state, catalog, healTotal);
  ops.push(...heal.ops);
  if (spends.length) {
    lines.push({
      name: 'Hit Point Dice',
      detail: `${Object.entries(byFace).map(([f, n]) => `${n}d${f}`).join(' + ')} spent, ${heal.summary.healed} HP regained`,
    });
  }
  const rec = recoveryFor(catalog, state, 'sr', { rng });
  ops.push(...rec.ops);
  lines.push(...rec.lines);
  const ended = restModifierOps(state, 'sr');
  ops.push(...ended);
  if (ended.length) lines.push({ name: 'Effects', detail: `${ended.length} ended` });
  return makeEvent('shortRest', {
    label: 'Short rest',
    ops,
    payload: { lines, from: heal.summary.from, to: heal.summary.to },
    rolls: {
      total: heal.summary.healed,
      parts: spends.map((s) => ({ label: `d${s.faces} + Con`, formula: s.rolls.formula, total: s.healed, groups: s.rolls.groups })),
    },
  }, now);
}

/** O descanso longo: HP, dados de vida, recursos, exaustão, morte e concentração. */
export function longRestEvent({ state, catalog, rng, now = new Date() }) {
  const hp = hpView(state, catalog.stats?.hpMax ?? 0);
  const ops = [];
  const lines = [];
  if (state.damage) {
    ops.push({ op: 'hp', damage: -state.damage });
    lines.push({ name: 'Hit points', detail: `${hp.current} to ${hp.max}` });
  }
  if (state.tempHp) ops.push({ op: 'hp', temp: -state.tempHp });
  const d = state.death ?? {};
  if (d.success || d.failure || d.stable || d.dead) ops.push({ op: 'death', reset: true });
  const rec = recoveryFor(catalog, state, 'lr', { rng });
  ops.push(...rec.ops);
  lines.push(...rec.lines);
  const exhaustion = state.conditions?.exhaustion ?? 0;
  if (exhaustion > 0) {
    ops.push({ op: 'condition', id: 'exhaustion', level: exhaustion - 1 });
    lines.push({ name: 'Exhaustion', detail: `level ${exhaustion} to ${exhaustion - 1}` });
  }
  const ended = restModifierOps(state, 'lr').filter((o) => !(state.modifiers ?? []).find((m) => m.id === o.remove)?.concentration);
  ops.push(...ended);
  if (ended.length) lines.push({ name: 'Effects', detail: `${ended.length} ended` });
  if (state.concentration) {
    ops.push(...endConcentrationOps(state));
    lines.push({ name: 'Concentration', detail: `${state.concentration.name ?? 'spell'} ended` });
  }
  return makeEvent('longRest', { label: 'Long rest', ops, payload: { lines } }, now);
}
