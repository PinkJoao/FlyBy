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
//   rollHitDie(args): rola um dado de vida com a CON (mínimo 1) e as regras das features.
//   hitDieRules(catalog, rest): as regras dos dados de vida que valem agora.
//   hitDiceLeft(catalog, state): os dados de vida que sobram, por face.
//   shortRestEvent(args): o descanso curto com os dados de vida gastos.
//   concentrationLapses(state): a concentração acaba no descanso curto (dura até uma hora).
//   hitDiceEvent(args): gastar dados de vida fora do descanso (cura) ou, com
//     um número negativo, devolver os gastos.
//   longRestEvent(args): o descanso longo.
//   restInspiration(catalog): a feature que dá a Heroic Inspiration no fim do descanso longo, ou null.
//   restProficiencies(catalog): as features que dão proficiência ou Expertise até o próximo descanso longo.
//   restProficiencyModifier(args): o efeito que guarda essas escolhas (o PB na perícia, a arma ou ferramenta).
//
// DECISÕES E ARMADILHAS
//   - Gift of the Ever-Living Ones (TC-0166, DDL-0238): com um efeito `healMax` ligado (healDiceMaxed em engine/playEffects), os dados da cura que o personagem recebe vão ao máximo: rollHitDie recebe `maxed` e o dado vai ao máximo, como a regra `max` das features.
//   Regras medidas no XPHB (variantrules "Short Rest", "Long Rest" e o capítulo 1)
//   - Curto: cada dado de vida gasto é rolado com o modificador de CON e cura no
//     MÍNIMO 1; o jogador decide depois de cada rolagem se gasta outro (por isso
//     a tela rola dado a dado e só grava no fim). Recupera o que é de descanso
//     curto. Exige pelo menos 1 HP: a tela avisa, não bloqueia (§6.4). O curto dura
//     uma hora, então a concentração de uma magia de até uma hora (a duração vai no
//     estado, `rounds`) acaba nele (`concentrationLapses`); a de 8 horas fica, e a
//     gravada sem a duração também (o passe ao vivo achou o Flaming Sphere de 1 minuto
//     vivo depois do descanso, DDL-0219).
//   - "You gain Heroic Inspiration whenever you finish a Long Rest" (Resourceful do Human, XPHB e WoW): lido
//     do texto da feature (restInspiration), não por nome; o descanso longo liga a inspiração. O registro de
//     espécies (DDL-0270) achou o do SRD sem conta (TC-0220).
//   - Longo: todo o HP, TODOS os dados de vida gastos (2024), o temporário some,
//     a exaustão baixa 1 nível, a contagem da morte zera, e a concentração
//     termina (dormir dá a condição Inconsciente) com o que dependia dela; os
//     efeitos de feature e de magia e os manuais com duração de descanso somem
//     (playEffects.restModifierOps). Recupera o que é de descanso
//     curto também (o dnd5e faz o mesmo com o período `sr`).
//   - O ajuste do HP máximo (`maxHpDelta`, do painel de cura ou do Hurt) volta a
//     zero no longo: Aid dura 8 horas e o dreno do vampiro acaba no descanso longo.
//   - Dados de vida pelo card de HP (`hitDiceEvent`): a maior face primeiro, ao
//     gastar e ao devolver; pedir mais do que sobra gasta o que houver.
//   - Features que mudam o dado de vida (DDL-0215), pelo nome no catálogo:
//     HIT_DIE_RULES dá o valor máximo (Boon of Bountiful Health, "use the highest number
//     possible", em qualquer gasto; Troll Healing, "the maximum roll of the dice", só no
//     descanso curto), +1 por dado (Inner Peace, no curto) e rolar de novo 1 e 2 (Black
//     Blood Healing, `ro2`, no curto; Quiet Contemplation do Earthen, "1 additional Hit Points per Hit Point Dice
//     you spend" no curto, TC-0222). REST_HIT_DICE_BONUS soma uma vez por descanso curto
//     com dado gasto (Iron Stomach do Vigor of the Hill Giant: CON + PB, "whenever you eat
//     food as part of a short rest"; comer fica com o jogador). Gastar UM dado fora do
//     descanso (Dwarven Fortitude, Healing Machine, Emergency Fail-Safe) é o Hit dice do
//     card de HP (`hitDiceEvent`), que vale a qualquer hora.
//   - Proficiência trocada a cada descanso longo (DDL-0275, TC-0223): lida do TEXTO, nunca pelo nome (o Trance do
//     XPHB não dá proficiência; o do MPMM dá duas de arma ou ferramenta). REST_PROFS cobre o Trance do MPMM, o Astral
//     Trance e o Astral Knowledge (uma perícia e uma arma ou ferramenta), o Severed from Dreams (uma perícia) e o
//     Versatile Merc do Zhentarim Tactics (Expertise numa perícia que já tem). Vira um modificador de duração
//     `longRest`: o descanso seguinte o tira, e o PB entra na rolagem da perícia; a arma ou ferramenta fica como extra
//     opcional, porque o jogo não sabe com qual arma a rolagem é.
//   - Recarga em vários descansos (DDL-0275): o recurso com `state.lockouts[key] = N` não volta no descanso longo
//     até o N-ésimo; cada longo desconta 1 e diz quantos faltam. O curto não mexe na trava.
//   - Recuperação sem `type` (o overlay do Refined Reanimation traz só `{ period: 'lr' }`) vale `recoverAll`, o
//     padrão do dnd5e (`initial: "recoverAll"` no uses-field); o fuzz de personagens achou o pool que nunca voltava
//     (DDL-0273).
//   - Períodos: o curto recupera `sr`; o longo, `lr`, `sr`, `day`, `dawn` e
//     `dusk` (o "1 por dia" da magia concedida e do item volta no longo).
//     Recuperação `resetTo` deixa o pool com aquele número (o Power Surge volta a 1); `ifEmpty` devolve só
//     se ele estava vazio (DDL-0253). Recuperação `recoverAll` devolve tudo; `formula` devolve o valor da
//     fórmula (rolada aqui e gravada no evento) até o gasto.
// -----------------------------------------------------------------------------

import { rollFormula, cryptoRng } from './dice';
import { makeEvent, hpView } from './playState';
import { healOutcome } from './playHealth';
import { endConcentrationOps, restModifierOps, healDiceMaxed } from './playEffects';
import { plainText } from './playFeatures';

/** Uma hora em rodadas: o descanso curto do XPHB. */
const SHORT_REST_ROUNDS = 600;

const PERIODS = { sr: ['sr'], lr: ['lr', 'sr', 'day', 'dawn', 'dusk'] };

const HIT_DIE_RULES = {
  'boon of bountiful health': { max: true, label: 'Superior Recuperation' },
  'troll healing': { max: true, rest: true, label: 'Troll Healing' },
  'inner peace': { plus: 1, rest: true, label: 'Inner Peace' },
  'quiet contemplation': { plus: 1, rest: true, label: 'Quiet Contemplation' },
  'black blood healing': { reroll: 2, rest: true, label: 'Black Blood Healing' },
};
const REST_HIT_DICE_BONUS = {
  'vigor of the hill giant': { formula: '@abilities.con.mod + @prof', label: 'Iron Stomach (eating food)' },
};

/** As regras dos dados de vida que valem agora (no descanso curto ou fora dele). */
export function hitDieRules(catalog, rest = false) {
  const features = new Set(catalog?.features ?? []);
  return Object.entries(HIT_DIE_RULES).filter(([name, r]) => features.has(name) && (!r.rest || rest)).map(([, r]) => r);
}

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
  if (period === 'lr') {
    for (const [key, n] of Object.entries(state.lockouts ?? {})) {
      ops.push({ op: 'lockout', key, tick: -1 });
      const name = (catalog.resources ?? []).find((r) => r.key === key)?.name ?? key;
      lines.push({ name, detail: n > 1 ? `recharges after ${n - 1} more long rest${n - 1 > 1 ? 's' : ''}` : 'can be used again' });
    }
  }
  for (const r of catalog.resources ?? []) {
    if (period === 'lr' && (state.lockouts?.[r.key] ?? 0) > 1) continue;
    const spent = Math.min(state.spent?.[r.key] ?? 0, r.max);
    const list = (r.recovery ?? []).map((x) => (x?.type ? x : { ...x, type: 'recoverAll' }));
    const reset = list.find((x) => x.type === 'resetTo' && periods.includes(x.period));
    if (reset) {
      const keep = Number(reset.formula) || 0;
      const want = Math.max(0, r.max - keep);
      if (want !== spent) {
        ops.push({ op: 'restore', key: r.key }, ...(want ? [{ op: 'spend', key: r.key, amount: want }] : []));
        lines.push({ name: r.name, detail: `reset to ${keep}` });
      }
      continue;
    }
    if (!spent) continue;
    if (list.some((x) => x.type === 'recoverAll' && periods.includes(x.period))) {
      ops.push({ op: 'restore', key: r.key });
      lines.push({ name: r.name, detail: `${spent} restored` });
      continue;
    }
    const empty = list.find((x) => x.type === 'ifEmpty' && periods.includes(x.period));
    if (empty && spent >= r.max) {
      ops.push({ op: 'restore', key: r.key, amount: Number(empty.formula) || 1 });
      lines.push({ name: r.name, detail: `${Number(empty.formula) || 1} restored (it was empty)` });
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

/** Rola um dado de vida com a CON (e as regras das features); cura no mínimo 1 (XPHB). */
export function rollHitDie({ catalog, faces, rng = cryptoRng, rest = false, maxed = false }) {
  const rules = [...hitDieRules(catalog, rest), ...(maxed ? [{ max: true, label: 'Gift of the Ever-Living Ones' }] : [])];
  const reroll = rules.find((r) => r.reroll)?.reroll;
  const die = rules.some((r) => r.max) ? `${faces}` : `1d${faces}${reroll ? `ro${reroll}` : ''}`;
  const plus = rules.reduce((s, r) => s + (r.plus ?? 0), 0);
  const rolls = rollFormula(`${die} + @abilities.con.mod${plus ? ` + ${plus}` : ''}`, { data: catalog.rollData, rng });
  return { faces, rolls, healed: Math.max(1, rolls.total), ...(rules.length ? { rules: rules.map((r) => r.label) } : {}) };
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
  const features = new Set(catalog.features ?? []);
  const extras = spends.length ? Object.entries(REST_HIT_DICE_BONUS).filter(([name]) => features.has(name)).map(([, b]) => ({ label: b.label, rolls: rollFormula(b.formula, { data: catalog.rollData, rng: rng ?? cryptoRng }) })) : [];
  const healTotal = spends.reduce((sum, s) => sum + s.healed, 0) + extras.reduce((sum, x) => sum + Math.max(0, x.rolls.total), 0);
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
  const lapsed = concentrationLapses(state);
  const gone = lapsed ? endConcentrationOps(state) : [];
  const ended = restModifierOps(state, 'sr').filter((o) => !gone.some((g) => g.op === 'modifier' && g.remove === o.remove));
  ops.push(...ended);
  if (ended.length) lines.push({ name: 'Effects', detail: `${ended.length} ended` });
  if (lapsed) {
    ops.push(...gone);
    lines.push({ name: 'Concentration', detail: `${state.concentration.name ?? 'spell'} ended (it lasts less than the rest)` });
  }
  return makeEvent('shortRest', {
    label: 'Short rest',
    ops,
    payload: { lines, from: heal.summary.from, to: heal.summary.to },
    rolls: {
      total: heal.summary.healed,
      parts: [
        ...spends.map((s) => ({ label: `d${s.faces} + Con${s.rules ? ` (${s.rules.join(', ')})` : ''}`, formula: s.rolls.formula, total: s.healed, groups: s.rolls.groups })),
        ...extras.map((x) => ({ label: x.label, formula: x.rolls.formula, total: Math.max(0, x.rolls.total), groups: x.rolls.groups })),
      ],
    },
  }, now);
}

/**
 * Gastar `count` dados de vida (rolados aqui, curando) ou, negativo, devolver os gastos.
 * @param {{ state: object, catalog: object, count: number, rng?: Function, now?: Date }} args
 */
export function hitDiceEvent({ state, catalog, count, rng = cryptoRng, now = new Date() }) {
  const n = Math.trunc(Number(count) || 0);
  const dice = hitDiceLeft(catalog, state).sort((a, b) => b.faces - a.faces);
  const ops = [];
  const byFace = {};
  if (n < 0) {
    let want = -n;
    for (const d of dice) {
      const back = Math.min(want, d.max - d.left);
      if (back > 0) {
        ops.push({ op: 'restore', key: d.key, amount: back });
        byFace[d.faces] = back;
        want -= back;
      }
    }
    const restored = Object.values(byFace).reduce((s, v) => s + v, 0);
    return makeEvent('hitDice', { label: 'Hit dice recovered', ops, payload: { restored, dice: byFace } }, now);
  }
  const spends = [];
  let want = n;
  for (const d of dice) {
    for (let i = 0; i < d.left && want > 0; i++, want--) spends.push(rollHitDie({ catalog, faces: d.faces, rng, maxed: healDiceMaxed(state) }));
  }
  for (const s of spends) byFace[s.faces] = (byFace[s.faces] ?? 0) + 1;
  for (const d of dice) if (byFace[d.faces]) ops.push({ op: 'spend', key: d.key, amount: byFace[d.faces] });
  const heal = healOutcome(state, catalog, spends.reduce((sum, s) => sum + s.healed, 0));
  ops.push(...heal.ops);
  return makeEvent('hitDice', {
    label: 'Hit dice',
    ops,
    payload: { spent: spends.length, asked: n, dice: byFace, healed: heal.summary.healed, from: heal.summary.from, to: heal.summary.to },
    rolls: {
      total: heal.summary.healed,
      parts: spends.map((s) => ({ label: `d${s.faces} + Con`, formula: s.rolls.formula, total: s.healed, groups: s.rolls.groups })),
    },
  }, now);
}

/** A concentração que não passa de uma hora acaba durante o descanso curto (que dura uma hora). */
export function concentrationLapses(state) {
  const rounds = state.concentration?.rounds;
  return rounds != null && rounds <= SHORT_REST_ROUNDS;
}

/** O descanso longo: HP, dados de vida, recursos, exaustão, morte e concentração. */
export function longRestEvent({ state, catalog, rng, now = new Date() }) {
  const hp = hpView(state, catalog.stats?.hpMax ?? 0);
  const ops = [];
  const lines = [];
  const baseMax = Math.max(0, catalog.stats?.hpMax ?? 0);
  if (state.maxHpDelta) {
    ops.push({ op: 'hp', max: -state.maxHpDelta });
    lines.push({ name: 'Hit point maximum', detail: `${hp.max} to ${baseMax}` });
  }
  if (state.damage) {
    ops.push({ op: 'hp', damage: -state.damage });
    lines.push({ name: 'Hit points', detail: `${hp.current} to ${baseMax}` });
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
  const insp = restInspiration(catalog);
  if (insp && !state.inspiration) {
    ops.push({ op: 'inspiration', value: true });
    lines.push({ name: 'Heroic Inspiration', detail: insp });
  }
  return makeEvent('longRest', { label: 'Long rest', ops, payload: { lines } }, now);
}

const REST_INSPIRATION = /\bgain heroic inspiration (?:whenever|when|each time) you finish a long rest\b/i;

/** A feature que dá a Heroic Inspiration no fim do descanso longo, ou null. */
export function restInspiration(catalog) {
  const f = (catalog?.featureList ?? []).find((x) => REST_INSPIRATION.test(plainText(x.entries ?? [])));
  return f?.name ?? null;
}

const REST_PROFS = [
  { re: /gain two proficiencies that you don't have, each one with a weapon or (?:a )?tool/i, rule: { skills: 0, tools: 2, expertise: 0 } },
  { re: /proficiency in one skill of your choice and (?:with )?one weapon or tool/i, rule: { skills: 1, tools: 1, expertise: 0 } },
  { re: /finish a long rest, you gain proficiency in one skill of your choice/i, rule: { skills: 1, tools: 0, expertise: 0 } },
  { re: /choose a skill in which you have proficiency\. you have expertise in that skill until you finish your next long rest/i, rule: { skills: 0, tools: 0, expertise: 1 } },
];

/** As features que dão proficiência (ou Expertise) até o próximo descanso longo: [{ feature, skills, tools, expertise }]. */
export function restProficiencies(catalog) {
  const out = [];
  for (const f of catalog?.featureList ?? []) {
    const text = plainText(f.entries ?? []);
    const hit = REST_PROFS.find((x) => x.re.test(text));
    if (hit) out.push({ feature: f.name, ...hit.rule });
  }
  return out;
}

/** O efeito que guarda as escolhas até o próximo descanso longo: o PB na perícia, a Expertise, a arma ou ferramenta. */
export function restProficiencyModifier({ feature, skills = [], expertise = [], tools = [], skillLabel = (s) => s }) {
  const named = [...skills, ...expertise].map(skillLabel);
  return {
    label: `${feature}: ${[...named, ...tools].join(', ') || 'no choice'}`,
    source: 'feature',
    duration: 'longRest',
    notes: [
      ...(skills.length ? [`Proficiency until your next long rest: ${skills.map(skillLabel).join(', ')}`] : []),
      ...(expertise.length ? [`Expertise until your next long rest: ${expertise.map(skillLabel).join(', ')}`] : []),
      ...(tools.length ? [`Proficiency with ${tools.join(', ')} until your next long rest`] : []),
    ],
    effects: [
      ...[...skills, ...expertise].map((s) => ({ targets: [`skill:${s}`], formula: '@prof', label: feature })),
      ...(tools.length ? [{ targets: ['attack', 'check'], formula: '@prof', optional: true, label: `${feature} (${tools.join(', ')} only)` }] : []),
    ],
  };
}
