// =============================================================================
// playCombat: o modo combate leve do play mode
// =============================================================================
// O QUE FAZ
//   O combate do ponto de vista do personagem (docs/PLAY-MODE-PLAN.md, pergunta 5):
//   começar rola a iniciativa e abre a rodada 1; "Next turn" avança a rodada,
//   devolve a ação, a ação bônus e a reação, e tira o que expirou por rodada (os
//   efeitos com duração e a concentração da magia que acabou); terminar fecha o
//   combate. A economia do turno (ação, bônus, reação) é marcada sozinha quando um
//   ataque, uma feature ou uma magia a gasta, e pode ser mexida à mão.
//
// FUNÇÕES
//   roundsOf(duration): uma duração do 5etools em rodadas (1 minuto são 10).
//   costOfActivation(type): o custo do turno de uma ativação ('action', 'bonus',
//     'reaction') ou null.
//   startCombatEvent(args): rola a iniciativa e abre a rodada 1.
//   nextTurnEvent(args): a rodada seguinte, com a economia de volta e o que expirou.
//   endCombatEvent(args): fecha o combate.
//   economyOp(state, cost, used): marca ou desmarca um custo do turno.
//   economyEvent(args): marcar ou desmarcar um custo à mão, como evento.
//   withRounds(modifier, state, rounds): o efeito com a duração em rodadas, se em combate.
//   movementLeft(state, speed): os pés que sobram neste turno (o Dash soma um
//     deslocamento inteiro).
//   moveEvent(args), dashEvent(args), resetMoveEvent(args): andar, o Dash (que
//     pode já andar `feet` pés no mesmo evento) e zerar o movimento do turno.
//
// DECISÕES E ARMADILHAS
//   - O combate é do PERSONAGEM, não da mesa: a rodada avança quando o jogador diz
//     que o turno dele começa ("Next turn"); a ordem dos outros é do mestre.
//   - Expira no começo do turno em que a rodada passa do fim: um efeito de 1
//     minuto (10 rodadas) lançado na rodada 2 some no começo da rodada 12. A
//     concentração da magia que expirou termina junto, com os efeitos dela.
//   - A reação volta no começo do SEU turno (regra), junto com a ação e o bônus.
//   - ECONOMY são os três custos que a barra mostra.
//   - O MOVIMENTO do turno mora na economia (`used.move` em pés, `used.dash` em
//     vezes): o "Next turn" o zera junto com a ação. O Dash marca a ação (quem usa
//     o Cunning Action desmarca à mão e marca o bônus). Andar mais do que sobra
//     é permitido e aparece negativo (liberdade com aviso).
//   - Fora de combate, nada disso pesa: durações por rodada só nascem em combate,
//     e a economia não é marcada.
// -----------------------------------------------------------------------------

import { d20Test } from './dice';
import { makeEvent } from './playState';
import { bonusParts, rngFor, d20Options, testParts } from './playActions';
import { endConcentrationOps } from './playEffects';

export const ECONOMY = ['action', 'bonus', 'reaction'];

const UNIT_ROUNDS = { round: 1, minute: 10, hour: 600 };

/** Uma duração do 5etools em rodadas, ou null (instantânea, permanente, especial). */
export function roundsOf(duration) {
  const d = Array.isArray(duration) ? duration[0] : duration;
  if (d?.type !== 'timed') return null;
  const per = UNIT_ROUNDS[d.duration?.type];
  return per ? per * (Number(d.duration?.amount) || 1) : null;
}

/** O custo do turno de uma ativação. */
export function costOfActivation(type) {
  return ECONOMY.includes(type) ? type : null;
}

/** Rola a iniciativa (com os efeitos) e abre a rodada 1. */
export function startCombatEvent({ catalog, options = {}, rng, now = new Date() }) {
  const rolls = d20Test({
    parts: [...testParts(catalog, { type: 'initiative' }), ...(options.applied?.parts ?? []), ...bonusParts(options)],
    ...d20Options(options),
    data: catalog.rollData,
    rng: rngFor(options, rng),
  });
  return makeEvent('combat', {
    label: 'Combat started',
    ops: [{ op: 'combat', value: { round: 1, initiative: rolls.total, used: {} } }],
    payload: { started: true, effects: options.applied?.labels ?? [] },
    rolls,
  }, now);
}

/** A rodada seguinte: a economia volta e o que expirou por rodada sai. */
export function nextTurnEvent({ state, now = new Date() }) {
  const c = state.combat;
  if (!c) return null;
  const round = c.round + 1;
  const ops = [{ op: 'combat', value: { ...c, round, used: {} } }];
  const ended = [];
  for (const m of state.modifiers ?? []) {
    if (m.rounds && m.startRound != null && round >= m.startRound + m.rounds && !m.concentration) {
      ops.push({ op: 'modifier', remove: m.id });
      ended.push(m.label);
    }
  }
  const conc = state.concentration;
  if (conc?.expiresRound != null && round >= conc.expiresRound) {
    ops.push(...endConcentrationOps(state));
    ended.push(conc.name);
  }
  return makeEvent('combat', { label: `Round ${round}`, ops, payload: { round, ended } }, now);
}

/** Fecha o combate. */
export function endCombatEvent({ state, now = new Date() }) {
  return makeEvent('combat', { label: 'Combat ended', ops: [{ op: 'combat', value: null }], payload: { rounds: state.combat?.round ?? 0 } }, now);
}

/** Marca (ou desmarca) um custo do turno; fora de combate, nada. */
export function economyOp(state, cost, used = true) {
  if (!state.combat || !ECONOMY.includes(cost)) return null;
  return { op: 'combat', value: { ...state.combat, used: { ...(state.combat.used ?? {}), [cost]: used } } };
}

/** Marcar ou desmarcar à mão um custo do turno (o ataque de oportunidade, o engano). */
export function economyEvent({ state, cost, used, now = new Date() }) {
  const op = economyOp(state, cost, used);
  const name = cost === 'bonus' ? 'Bonus action' : cost === 'reaction' ? 'Reaction' : 'Action';
  return makeEvent('combat', { label: `${name} ${used ? 'used' : 'back'}`, ops: op ? [op] : [], payload: { economy: cost, used } }, now);
}

/** O efeito com a duração em rodadas, contada desta rodada; fora de combate, igual. */
export function withRounds(modifier, state, rounds) {
  if (!state.combat || !rounds) return modifier;
  return { ...modifier, rounds, startRound: state.combat.round };
}

/** Os pés que sobram neste turno; fora de combate, o deslocamento inteiro. */
export function movementLeft(state, speed) {
  const used = state.combat?.used ?? {};
  return (speed ?? 0) * (1 + (used.dash ?? 0)) - (used.move ?? 0);
}

/** Andar `feet` pés neste turno. */
export function moveEvent({ state, feet, speed, now = new Date() }) {
  const used = state.combat?.used ?? {};
  const move = Math.max(0, (used.move ?? 0) + Math.trunc(Number(feet) || 0));
  const ops = state.combat ? [{ op: 'combat', value: { ...state.combat, used: { ...used, move } } }] : [];
  const left = (speed ?? 0) * (1 + (used.dash ?? 0)) - move;
  return makeEvent('combat', { label: `Walked ${feet} ft`, ops, payload: { moved: Number(feet), left } }, now);
}

/** O Dash: mais um deslocamento neste turno, gastando a ação; `feet` já anda junto. */
export function dashEvent({ state, speed, feet = 0, now = new Date() }) {
  const used = state.combat?.used ?? {};
  const dash = (used.dash ?? 0) + 1;
  const moved = Math.max(0, Math.trunc(Number(feet) || 0));
  const move = (used.move ?? 0) + moved;
  const ops = state.combat ? [{ op: 'combat', value: { ...state.combat, used: { ...used, dash, move, action: true } } }] : [];
  const left = (speed ?? 0) * (1 + dash) - move;
  return makeEvent('combat', { label: moved ? `Dash, ${moved} ft` : 'Dash', ops, payload: { dash: true, moved, left } }, now);
}

/** Zera o movimento do turno (e o Dash). */
export function resetMoveEvent({ state, speed, now = new Date() }) {
  const used = { ...(state.combat?.used ?? {}) };
  delete used.move;
  delete used.dash;
  const ops = state.combat ? [{ op: 'combat', value: { ...state.combat, used } }] : [];
  return makeEvent('combat', { label: 'Movement reset', ops, payload: { left: speed ?? 0 } }, now);
}
