// =============================================================================
// playUse: usar uma feature no play mode, com o consumo automático
// =============================================================================
// O QUE FAZ
//   Transforma o uso de uma activity do catálogo (engine/playCatalog) num evento
//   com tudo o que ela gasta e rola (docs/PLAY-MODE-PLAN.md, requisito 6): o pool
//   da feature (ou de outra, como o Channel Divinity), um slot, um dado de vida, o
//   que um atributo devolve (Magical Cunning), e as rolagens de cura, dano e
//   ataque. Também as RECUPERAÇÕES ESPECIAIS, que pedem uma escolha que a
//   activity não carrega (quais slots o Arcane Recovery devolve, que slot o Font
//   of Magic cria), e o ajuste manual de um contador.
//
// FUNÇÕES
//   left(catalog, state, key): quanto resta de um recurso.
//   slotKey(catalog, level): a chave do slot de um círculo (`slot:N`), ou null.
//   nameOf(catalog, key): o nome de um recurso para o resumo.
//   resolveCosts(catalog, state, activity, options): os gastos concretos da
//     activity, com a escala e o slot escolhidos.
//   activityEvent(args): o evento de usar uma activity.
//   specialRecovery(action): a regra curada de uma recuperação especial, ou null.
//   slotRecoveryEvent(args): o Arcane Recovery e o Natural Recovery.
//   fontOfMagicEvent(args): criar um slot com pontos, ou converter um slot em pontos.
//   adjustResourceEvent(args): gastar ou devolver à mão (com `state`, preso ao que há).
//   setResourceEvent(args): o ResourcePanel: o que resta e o máximo que o jogador pôs.
//   withResourceMax(catalog, state): o catálogo com o ajuste do máximo de cada recurso.
//   featureLogEvent(args): o "Log to history" de uma feature (nome e custo, sem rolar).
//
// DECISÕES E ARMADILHAS
//   - activityEvent NÃO se chama "use...": o lint do React trata todo nome que
//     começa com "use" como hook e recusa chamá-lo dentro de um handler.
//   - Liberdade com aviso (§6.4): sem recurso suficiente, o evento sai mesmo assim
//     com `short` no payload, e a tela pergunta antes. O gasto acima do máximo não
//     quebra nada (o restante fica preso em 0).
//   - `@scaling` (quanto gastar, escolhido na hora): a activity `scalable` gasta a
//     escala escolhida do pool (Lay on Hands, Recover Vitality) e a fórmula rola com
//     ela.
//   - Consumo de SLOT: o alvo do Foundry é o círculo mínimo (`"1"`) ou vazio; o
//     jogador escolhe o círculo. Valor negativo DEVOLVE o slot.
//   - Consumo de ATRIBUTO: só `spells.pact.value` e `spells.spellN.value`, os que
//     as activities citam; a fórmula (negativa devolve) roda com o rollData.
//   - Consumo de DADO DE VIDA: `largest`/`smallest` (Durable) olham os que SOBRAM.
//   - Feature com efeito curado (playEffects.featureModifier: Rage) liga o
//     modificador no mesmo evento do uso.
//   - `options.only` ('attack' ou 'effect') rola só o d20 do ataque ou só o dano e a
//     cura (DDL-0156: a tela pergunta qual); `options.free` é a segunda rolagem, do
//     cartão do histórico: não gasta de novo nem liga o efeito outra vez. Os dois vão
//     no payload, para o cartão saber o que falta rolar.
//   - A cura vai para o próprio personagem quando a activity mira ele mesmo
//     (`selfTarget`) ou quando o jogador marca; senão só rola e mostra.
//   - SPECIAL_RECOVERY (XPHB): Arcane Recovery devolve slots que somem até a
//     metade do nível de Mago, arredondada para cima, nenhum de círculo 6 ou mais;
//     o Natural Recovery do Círculo da Terra, o mesmo com o nível de Druida. Font
//     of Magic: criar um slot custa 2, 3, 5, 6 ou 7 pontos (círculos 1 a 5);
//     converter um slot dá tantos pontos quanto o círculo. O modelo guarda o GASTO,
//     então "criar" só reabastece um slot gasto: sem slot gasto daquele círculo, a
//     tela avisa.
//   - O máximo de um recurso é da ficha, e o mestre pode mudá-lo na mesa (o ResourcePanel
//     em Max): o estado guarda só o AJUSTE (`resourceMax`, como o `maxHpDelta`), e a
//     tela passa o catálogo por withResourceMax uma vez, então toda conta que lê
//     `resource.max` (as abas, os eventos, o descanso) já vê o máximo ajustado; o da
//     ficha fica em `sheetMax`. setResourceEvent recebe o FIM (resta e máximo) e
//     calcula as operações; subir o máximo sem mexer no gasto sobe o que resta junto.
//     O payload diz `was` e `now`, nunca `from`/`to`: a notificação da tela
//     (toastNumber) lê `payload.to` de qualquer evento como número.
//   - featureLogEvent é a primeira camada do DDL-0203: TODA feature pode ir ao
//     histórico com o custo do turno, mesmo sem activity (as 181 da matriz que só a
//     prosa diz que gastam uma ação, bônus ou reação). Não rola nem liga efeito; com
//     `spend` gasta um do pool (o "Use" da feature que só tem pool). O gasto do turno
//     entra pelo `record` da tela, como nas activities. A camada 2 (DDL-0205) passa o
//     modificador (Reckless Attack, com a duração em rodadas) e a salvaguarda
//     (Stunning Strike) do registro curado; desde o DDL-0206 também a rolagem (`roll`:
//     o dado de superioridade do Commander's Strike, os PV do Inspiring Smite), e desde
//     o DDL-0207 `apply` (cura ou PV temporários com o total, healOutcome e tempHpOutcome)
//     e `restore` (devolve todo o gasto de um pool, o Focus do Uncanny Metabolism).
// -----------------------------------------------------------------------------

import { rollFormula, rollParts, d20Test, cryptoRng } from './dice';
import { makeEvent, remainingOf } from './playState';
import { healOutcome, tempHpOutcome } from './playHealth';
import { bonusParts, rngFor, d20Options } from './playActions';
import { featureModifier } from './playEffects';
import { withRounds } from './playCombat';

const SPECIAL_RECOVERY = {
  'action:arcane-recovery': { kind: 'slots', classId: 'wizard', maxLevel: 5 },
  'action:natural-recovery': { kind: 'slots', classId: 'druid', maxLevel: 5, activity: 'Recover Spell Slots' },
  'action:font-of-magic': { kind: 'fontOfMagic', pool: 'pool:font-of-magic', cost: { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 } },
};

/** Quanto resta de um recurso do catálogo. */
export function left(catalog, state, key) {
  const r = (catalog.resources ?? []).find((x) => x.key === key);
  return r ? remainingOf(state, key, r.max) : 0;
}

/** A chave do slot de um círculo, ou null se o personagem não tem esse círculo. */
export function slotKey(catalog, level) {
  return (catalog.resources ?? []).some((r) => r.key === `slot:${level}`) ? `slot:${level}` : null;
}

/** O nome de um recurso para o resumo. */
const nameOf = (catalog, key) => (catalog.resources ?? []).find((r) => r.key === key)?.name ?? key;

/**
 * Os gastos concretos de uma activity: [{ key, amount }] (amount negativo devolve).
 * @param {{ scaling?: number, slotLevel?: number }} options
 */
export function resolveCosts(catalog, state, activity, { scaling = 1, slotLevel = null } = {}) {
  const out = [];
  const n = Math.max(1, Math.floor(Number(scaling) || 1));
  for (const c of activity.consumes ?? []) {
    if (c.key) {
      out.push({ key: c.key, amount: activity.scalable ? n * c.amount : c.amount });
    } else if (c.spellSlot != null) {
      const v = Number.parseInt(c.formula, 10) || 1;
      const level = slotLevel ?? (Number.parseInt(c.spellSlot, 10) || 1);
      const key = slotKey(catalog, level) ?? ((catalog.rollData?.spells?.pact?.level === level) ? 'pact' : null);
      if (key) out.push({ key, amount: v });
    } else if (c.attribute) {
      const m = c.attribute.match(/^spells\.(pact|spell(\d))\.value$/);
      if (!m) continue;
      const key = m[1] === 'pact' ? 'pact' : `slot:${m[2]}`;
      const v = rollFormula(c.formula, { data: catalog.rollData }).total;
      out.push({ key, amount: v });
    } else if (c.hitDice != null) {
      const dice = (catalog.resources ?? []).filter((r) => r.kind === 'hitDice' && remainingOf(state, r.key, r.max) > 0);
      const pick = c.hitDice === 'smallest' ? dice[dice.length - 1] : dice[0];
      if (pick) out.push({ key: pick.key, amount: Number.parseInt(c.formula, 10) || 1 });
    }
  }
  return out;
}

/**
 * O evento de usar uma activity: gasta, rola e, quando é em si mesmo, cura.
 * @param {{ catalog: object, state: object, action: object, activity: object, options?: object, rng?: Function, now?: Date }} args
 */
export function activityEvent({ catalog, state, action, activity, options = {}, rng = cryptoRng, now = new Date() }) {
  const free = !!options.free;
  const only = options.only === 'attack' || options.only === 'effect' ? options.only : null;
  const costs = free ? [] : resolveCosts(catalog, state, activity, options);
  const ops = costs.map((c) => (c.amount >= 0
    ? { op: 'spend', key: c.key, amount: c.amount }
    : { op: 'restore', key: c.key, amount: -c.amount }));
  const short = costs.filter((c) => c.amount > 0 && left(catalog, state, c.key) < c.amount).map((c) => nameOf(catalog, c.key));

  const scaling = Math.max(1, Math.floor(Number(options.scaling) || 1));
  const mods = catalog.rollData?.abilities ?? {};
  const ability = activity.attack?.ability ?? null;
  const data = { ...catalog.rollData, scaling, ...(ability ? { mod: mods[ability]?.mod ?? 0 } : {}) };
  const r = rngFor(options, rng);
  const parts = [];
  let attack = null;
  if (activity.attack && only !== 'effect') {
    attack = d20Test({
      parts: [
        { label: 'Modifier', formula: ability ? mods[ability]?.mod ?? 0 : 0 },
        { label: 'Proficiency', formula: catalog.rollData?.prof ?? 0 },
        ...(options.applied?.parts ?? []),
        ...bonusParts(options),
      ],
      ...d20Options(options),
      data,
      rng: r,
    });
  }
  if (activity.heal && only !== 'attack') parts.push({ label: 'Healing', formula: activity.heal.formula });
  for (const p of only === 'attack' ? [] : activity.damage ?? []) parts.push({ label: (p.types ?? []).join('/') || 'Damage', formula: p.formula });
  const rolls = parts.length
    ? rollParts([...parts, ...(attack ? [] : bonusParts(options))], { data, rng: r, critical: !!(options.critical || attack?.isCritical) })
    : null;

  const effect = free ? null : featureModifier(action, catalog);
  if (effect) ops.push({ op: 'modifier', add: withRounds(effect, state, effect.maxRounds) });

  const healSelf = activity.heal && (options.applyHeal ?? activity.selfTarget);
  let healed = null;
  if (healSelf && rolls) {
    const amount = rolls.parts.find((p) => p.label === 'Healing')?.total ?? 0;
    const heal = healOutcome(state, catalog, amount);
    ops.push(...heal.ops);
    healed = heal.summary;
  }

  return makeEvent('use', {
    label: activity.name && activity.name !== action.name ? `${action.name}: ${activity.name}` : action.name,
    ops,
    payload: {
      actionKey: action.key,
      activityId: activity.id,
      costs: costs.map((c) => ({ name: nameOf(catalog, c.key), amount: c.amount })),
      short,
      save: activity.save ? { abilities: activity.save.abilities, dc: activity.save.dc } : null,
      types: (activity.damage ?? []).flatMap((p) => p.types ?? []),
      healed,
      attack: attack ? { total: attack.total, natural: attack.natural, critical: attack.isCritical } : null,
      effect: effect?.label ?? null,
      only,
      free,
    },
    rolls: attack ? { ...attack, parts: [...attack.parts, ...(rolls?.parts ?? [])], total: attack.total, damage: rolls?.total ?? null } : rolls,
  }, now);
}

/** A regra curada de uma recuperação especial da ação, com o orçamento do nível, ou null. */
export function specialRecovery(action, catalog) {
  const rule = SPECIAL_RECOVERY[action?.key];
  if (!rule) return null;
  if (rule.kind === 'slots') {
    const level = catalog.rollData?.classes?.[rule.classId]?.levels ?? 0;
    return { ...rule, budget: Math.ceil(level / 2) };
  }
  return rule;
}

/**
 * Arcane Recovery e Natural Recovery: devolve os slots escolhidos ({ nível: quantos }) e gasta o uso.
 * @returns {object} o evento; `payload.over` marca orçamento estourado ou círculo alto demais
 */
export function slotRecoveryEvent({ catalog, state, action, picks, now = new Date() }) {
  const rule = specialRecovery(action, catalog);
  const activity = action.activities.find((a) => !rule.activity || a.name === rule.activity) ?? action.activities[0];
  const ops = resolveCosts(catalog, state, activity).map((c) => ({ op: 'spend', key: c.key, amount: c.amount }));
  const lines = [];
  let total = 0;
  for (const [level, n] of Object.entries(picks ?? {})) {
    const count = Math.max(0, Math.floor(Number(n) || 0));
    if (!count) continue;
    ops.push({ op: 'restore', key: `slot:${level}`, amount: count });
    lines.push(`${count} level ${level} slot${count > 1 ? 's' : ''}`);
    total += count * Number(level);
  }
  const over = total > rule.budget || Object.keys(picks ?? {}).some((l) => Number(l) > rule.maxLevel && picks[l] > 0);
  return makeEvent('use', { label: `${action.name}: recover slots`, ops, payload: { actionKey: action.key, lines, budget: rule.budget, total, over } }, now);
}

/**
 * Font of Magic: `create` gasta pontos e reabastece um slot; `convert` gasta um slot e devolve pontos.
 * @param {{ mode: 'create'|'convert', level: number }} args
 */
export function fontOfMagicEvent({ catalog, state, action, mode, level, now = new Date() }) {
  const rule = SPECIAL_RECOVERY['action:font-of-magic'];
  const key = slotKey(catalog, level);
  if (mode === 'create') {
    const cost = rule.cost[level];
    return makeEvent('use', {
      label: `${action.name}: create a level ${level} slot`,
      ops: [{ op: 'spend', key: rule.pool, amount: cost }, ...(key ? [{ op: 'restore', key, amount: 1 }] : [])],
      payload: {
        actionKey: action.key,
        lines: [`${cost} sorcery points spent`, `level ${level} slot regained`],
        short: left(catalog, state, rule.pool) < cost ? ['Sorcery Points'] : [],
        noSpentSlot: !key || (state.spent?.[key] ?? 0) === 0,
      },
    }, now);
  }
  return makeEvent('use', {
    label: `${action.name}: convert a level ${level} slot`,
    ops: [...(key ? [{ op: 'spend', key, amount: 1 }] : []), { op: 'restore', key: rule.pool, amount: level }],
    payload: { actionKey: action.key, lines: [`level ${level} slot spent`, `${level} sorcery points regained`], short: key && left(catalog, state, key) < 1 ? [`Level ${level} slots`] : [] },
  }, now);
}

/**
 * Gasta (positivo) ou devolve (negativo) à mão um recurso do catálogo. Com `state`, o
 * gasto para no que sobra e a devolução no que foi gasto; o pedido fica em `asked`.
 */
export function adjustResourceEvent({ catalog, key, delta, state = null, now = new Date() }) {
  const asked = Math.trunc(Number(delta) || 0);
  let n = asked;
  if (state) {
    const r = (catalog.resources ?? []).find((x) => x.key === key);
    const leftNow = r ? remainingOf(state, key, r.max) : 0;
    const spent = r ? Math.min(r.max, state.spent?.[key] ?? 0) : 0;
    n = asked >= 0 ? Math.min(asked, leftNow) : -Math.min(-asked, spent);
  }
  return makeEvent('resource', {
    label: nameOf(catalog, key),
    ops: n >= 0 ? [{ op: 'spend', key, amount: n }] : [{ op: 'restore', key, amount: -n }],
    payload: { key, delta: n, ...(n !== asked ? { asked } : {}) },
  }, now);
}

/**
 * O ajuste do ResourcePanel: chega ao que resta `left` com o máximo `max`. Gasto e
 * máximo viram operações; o payload guarda o antes e o depois para o histórico.
 */
export function setResourceEvent({ catalog, key, left, max, state, now = new Date() }) {
  const r = (catalog.resources ?? []).find((x) => x.key === key);
  const maxNow = r ? r.max : 0;
  const leftNow = remainingOf(state, key, maxNow);
  const newMax = Math.max(0, Math.trunc(Number(max) || 0));
  const newLeft = Math.min(newMax, Math.max(0, Math.trunc(Number(left) || 0)));
  const spentNow = state.spent?.[key] ?? 0;
  const spendBy = (newMax - newLeft) - spentNow;
  const ops = [];
  if (newMax !== maxNow) ops.push({ op: 'resourceMax', key, amount: newMax - maxNow });
  if (spendBy > 0) ops.push({ op: 'spend', key, amount: spendBy });
  if (spendBy < 0) ops.push({ op: 'restore', key, amount: -spendBy });
  return makeEvent('resource', {
    label: nameOf(catalog, key),
    ops,
    payload: { key, delta: leftNow - newLeft, was: { left: leftNow, max: maxNow }, now: { left: newLeft, max: newMax } },
  }, now);
}

/** O catálogo com o ajuste do máximo de cada recurso (`resourceMax`); o da ficha em `sheetMax`. */
export function withResourceMax(catalog, state) {
  const adjust = state?.resourceMax ?? {};
  if (!catalog || Object.keys(adjust).length === 0) return catalog;
  return {
    ...catalog,
    resources: (catalog.resources ?? []).map((r) => (adjust[r.key] ? { ...r, sheetMax: r.max, max: Math.max(0, r.max + adjust[r.key]) } : r)),
  };
}

/**
 * O "Log to history" de uma feature: o nome e o custo do turno, sem rolar. `spend` é a
 * chave do que o uso gasta (um); `modifier`, `save` e `roll` vêm do registro (playFeatureRolls).
 */
export function featureLogEvent({ catalog, state = null, feature, cost = null, spend = null, modifier = null, save = null, roll = null, apply = null, restore = null, rng = cryptoRng, now = new Date() }) {
  const rolls = roll ? rollParts([{ label: roll.label, formula: roll.formula }], { data: catalog.rollData, rng }) : null;
  const ops = spend ? [{ op: 'spend', key: spend, amount: 1 }] : [];
  if (modifier) ops.push({ op: 'modifier', add: state ? withRounds(modifier, state, modifier.maxRounds) : modifier });
  let healed = null;
  let temp = null;
  if (apply && rolls && state) {
    const outcome = apply === 'heal' ? healOutcome(state, catalog, rolls.total) : tempHpOutcome(state, rolls.total);
    ops.push(...outcome.ops);
    if (apply === 'heal') healed = outcome.summary;
    else temp = outcome.summary;
  }
  const restoredBack = restore && state ? Math.min(state.spent?.[restore] ?? 0, (catalog.resources ?? []).find((r) => r.key === restore)?.max ?? 0) : 0;
  if (restoredBack > 0) ops.push({ op: 'restore', key: restore, amount: restoredBack });
  return makeEvent('use', {
    label: feature.name,
    ops,
    payload: {
      featureKey: feature.key ?? null,
      logged: true,
      cost,
      costs: spend ? [{ name: nameOf(catalog, spend), amount: 1 }] : [],
      short: spend && state && left(catalog, state, spend) < 1 ? [nameOf(catalog, spend)] : [],
      save,
      effect: modifier?.label ?? null,
      rolled: !!rolls,
      healed,
      temp,
      lines: restoredBack > 0 ? [`${nameOf(catalog, restore)}: ${restoredBack} regained`] : [],
    },
    rolls,
  }, now);
}
