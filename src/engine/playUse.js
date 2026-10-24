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
//   adjustResourceEvent(args): gastar ou devolver à mão.
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
//   - A cura vai para o próprio personagem quando a activity mira ele mesmo
//     (`selfTarget`) ou quando o jogador marca; senão só rola e mostra.
//   - SPECIAL_RECOVERY (XPHB): Arcane Recovery devolve slots que somem até a
//     metade do nível de Mago, arredondada para cima, nenhum de círculo 6 ou mais;
//     o Natural Recovery do Círculo da Terra, o mesmo com o nível de Druida. Font
//     of Magic: criar um slot custa 2, 3, 5, 6 ou 7 pontos (círculos 1 a 5);
//     converter um slot dá tantos pontos quanto o círculo. O modelo guarda o GASTO,
//     então "criar" só reabastece um slot gasto: sem slot gasto daquele círculo, a
//     tela avisa.
// -----------------------------------------------------------------------------

import { rollFormula, rollParts, d20Test, cryptoRng } from './dice';
import { makeEvent, remainingOf } from './playState';
import { healOutcome } from './playHealth';
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
  const costs = resolveCosts(catalog, state, activity, options);
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
  if (activity.attack) {
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
  if (activity.heal) parts.push({ label: 'Healing', formula: activity.heal.formula });
  for (const p of activity.damage ?? []) parts.push({ label: (p.types ?? []).join('/') || 'Damage', formula: p.formula });
  const rolls = parts.length
    ? rollParts([...parts, ...(attack ? [] : bonusParts(options))], { data, rng: r, critical: !!(options.critical || attack?.isCritical) })
    : null;

  const effect = featureModifier(action, catalog);
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

/** Gasta (positivo) ou devolve (negativo) à mão um recurso do catálogo. */
export function adjustResourceEvent({ catalog, key, delta, now = new Date() }) {
  const n = Math.trunc(Number(delta) || 0);
  return makeEvent('resource', {
    label: nameOf(catalog, key),
    ops: n >= 0 ? [{ op: 'spend', key, amount: n }] : [{ op: 'restore', key, amount: -n }],
    payload: { key, delta: n },
  }, now);
}
