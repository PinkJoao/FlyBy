// =============================================================================
// playState: o estado de jogo como LOG de eventos, com desfazer, refazer e janela
// =============================================================================
// O QUE FAZ
//   O play mode não guarda o estado atual: guarda o log de eventos e o deriva
//   (docs/PLAY-MODE-PLAN.md 3.1). O documento de jogo de um personagem é
//   `{ characterId, version, baseline, events, cursor }`: o estado é o `baseline`
//   com os eventos de 0 a `cursor` aplicados. Desfazer recua o cursor, refazer
//   avança, e um evento novo depois de desfazer descarta o ramo refazível.
//
//   Cada evento leva OPERAÇÕES concretas, já calculadas por quem o criou (a tela,
//   com o catálogo e a derivação na mão): "dano +7, temporário -5", "gasta 1 de
//   slot:3". O redutor só as aplica, sem ler ficha nem compêndio, então o replay é
//   determinístico mesmo que a ficha mude depois (subir de nível não reescreve o
//   passado). As rolagens vão no evento (`rolls`, o resultado do dice.js).
//
//   O estado guarda o GASTO, não o valor atual (3.2): `damage` é o dano sofrido
//   (o HP atual é o máximo menos o dano), `spent` conta o consumido por chave estável
//   (`slot:3`, `pact`, `hd:d10`, `pool:<origem>|<nome>`, `granted:<origem>|<magia>`).
//
// FUNÇÕES
//   clamp(n, lo, hi), num(n): prender num intervalo; número ou 0.
//   Estado
//     emptyPlayState(): o estado descansado.
//     applyOp(state, op), applyEvent(state, event): o redutor puro.
//     hpView(state, maxHp), remainingOf(state, key, max): os valores atuais.
//   Documento e log
//     createPlayDoc(characterId), normalizePlayDoc(raw, characterId): o
//       documento novo e a coerção defensiva de um salvo.
//     currentPlayState(doc): o estado no cursor.
//     makeEvent(kind, fields, now): um evento com id e data.
//     recordEvent(doc, event): grava, descartando o ramo refazível.
//     undoEvent(doc), redoEvent(doc), canUndo(doc), canRedo(doc): o cursor.
//     normalizeLimits(limits), compactPlayDoc(doc, limits, now): a janela.
//   Personagem (inventário e moedas)
//     characterOps(event): as operações do evento que tocam o personagem.
//     deepEqual(a, b): igualdade estrutural, para o conflito.
//     applyCharacterOps(character, ops, direction): aplica ou desfaz no
//       personagem, com a lista do que conflitou.
//
// DECISÕES E ARMADILHAS
//   Operações (`op`)
//   - `hp` { damage, temp }: somas, cada uma com piso em 0. `spend` { key,
//     amount }: soma ao gasto (negativo devolve), piso 0, a chave some no 0.
//     `restore` { key, amount? }: devolve `amount` ou tudo. `death` { success,
//     failure, set, reset }: `set` troca campos ({ success, failure, stable, dead })
//     e então soma, preso entre 0 e 3; `reset` zera tudo. `condition` { id, level }: 0
//     tira. `inspiration` { value }, `concentration` { value }, `combat` { value }:
//     definem. `modifier` { add } ou { remove: id }.
//   - Operação desconhecida é IGNORADA e o evento fica no log: um evento gravado
//     por uma versão mais nova não derruba a mais velha (carga, §6.3).
//   - `inventory` { uid, before, after, index? } e `currency` { delta } tocam o
//     PERSONAGEM (pergunta 3 do plano), não o estado: o redutor as pula, e quem
//     move o cursor chama applyCharacterOps. Ir para a frente exige o item igual
//     a `before`; voltar, igual a `after`. Se o jogador mexeu no item pelo builder
//     depois, a operação CONFLITA: não aplica e volta na lista, para a tela
//     avisar, em vez de adivinhar. Moeda conflita se alguma ficaria negativa.
//   Janela (pergunta 4 do plano)
//   - Ficam as últimas `maxEvents` aplicadas OU as de até `maxAgeDays` dias, o
//     que for MENOR; as mais velhas são DOBRADAS no `baseline`: o estado continua
//     exato, só a entrada sai do histórico. O ramo refazível (depois do cursor)
//     nunca é dobrado nem descartado aqui. A operação de personagem dobrada não
//     precisa de nada: ela já está na ficha.
//   - HISTORY_LIMITS (500 ações, 30 dias) é o padrão do plano; a tela passa o que
//     o jogador ajustou.
// -----------------------------------------------------------------------------

import { makeId } from '../schema/character';

export const PLAY_DOC_VERSION = 1;

export const HISTORY_LIMITS = { maxEvents: 500, maxAgeDays: 30 };

const DAY_MS = 24 * 60 * 60 * 1000;

const NO_DEATH = { success: 0, failure: 0, stable: false, dead: false };

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);

/** O estado descansado: nada gasto, nenhuma condição. */
export function emptyPlayState() {
  return {
    damage: 0,
    tempHp: 0,
    death: { ...NO_DEATH },
    spent: {},
    conditions: {},
    inspiration: false,
    concentration: null,
    modifiers: [],
    combat: null,
  };
}

/** Aplica uma operação ao estado, sem mutá-lo. */
export function applyOp(state, op) {
  switch (op?.op) {
    case 'hp':
      return {
        ...state,
        damage: Math.max(0, state.damage + num(op.damage)),
        tempHp: Math.max(0, state.tempHp + num(op.temp)),
      };
    case 'spend':
    case 'restore': {
      if (!op.key) return state;
      const before = state.spent[op.key] ?? 0;
      const after = op.op === 'spend'
        ? Math.max(0, before + num(op.amount))
        : op.amount == null ? 0 : Math.max(0, before - num(op.amount));
      const spent = { ...state.spent };
      if (after > 0) spent[op.key] = after;
      else delete spent[op.key];
      return { ...state, spent };
    }
    case 'death': {
      if (op.reset) return { ...state, death: { ...NO_DEATH } };
      const base = { ...NO_DEATH, ...state.death, ...(op.set ?? {}) };
      return {
        ...state,
        death: {
          ...base,
          success: clamp(num(base.success) + num(op.success), 0, 3),
          failure: clamp(num(base.failure) + num(op.failure), 0, 3),
          stable: base.stable === true,
          dead: base.dead === true,
        },
      };
    }
    case 'condition': {
      if (!op.id) return state;
      const conditions = { ...state.conditions };
      const level = Math.max(0, num(op.level));
      if (level > 0) conditions[op.id] = level;
      else delete conditions[op.id];
      return { ...state, conditions };
    }
    case 'inspiration':
      return { ...state, inspiration: op.value === true };
    case 'concentration':
      return { ...state, concentration: op.value ?? null };
    case 'combat':
      return { ...state, combat: op.value ?? null };
    case 'modifier':
      if (op.add) return { ...state, modifiers: [...state.modifiers.filter((m) => m.id !== op.add.id), op.add] };
      if (op.remove) return { ...state, modifiers: state.modifiers.filter((m) => m.id !== op.remove) };
      return state;
    default:
      return state;
  }
}

/** Aplica todas as operações de um evento. */
export function applyEvent(state, event) {
  return (event?.ops ?? []).reduce(applyOp, state);
}

/** HP máximo, atual (o máximo menos o dano, preso no intervalo) e temporário. */
export function hpView(state, maxHp) {
  const max = Math.max(0, num(maxHp));
  return { max, current: clamp(max - state.damage, 0, max), temp: state.tempHp };
}

/** Quanto resta de um recurso de máximo `max`. */
export function remainingOf(state, key, max) {
  return Math.max(0, num(max) - (state.spent[key] ?? 0));
}

/**
 * Um documento de jogo novo, descansado.
 * @param {string} characterId
 */
export function createPlayDoc(characterId) {
  return { characterId, version: PLAY_DOC_VERSION, baseline: emptyPlayState(), events: [], cursor: 0 };
}

/** Coerção defensiva de um documento salvo (ou ausente) para a forma atual. */
export function normalizePlayDoc(raw, characterId) {
  if (!raw || typeof raw !== 'object') return createPlayDoc(characterId);
  const base = emptyPlayState();
  const b = raw.baseline && typeof raw.baseline === 'object' ? raw.baseline : {};
  const baseline = {
    ...base,
    ...b,
    damage: Math.max(0, num(b.damage)),
    tempHp: Math.max(0, num(b.tempHp)),
    death: { ...NO_DEATH, ...(b.death ?? {}) },
    spent: b.spent && typeof b.spent === 'object' ? { ...b.spent } : {},
    conditions: b.conditions && typeof b.conditions === 'object' ? { ...b.conditions } : {},
    modifiers: Array.isArray(b.modifiers) ? b.modifiers : [],
  };
  const events = Array.isArray(raw.events) ? raw.events.filter((e) => e && typeof e === 'object') : [];
  const cursor = clamp(Number.isInteger(raw.cursor) ? raw.cursor : events.length, 0, events.length);
  return { characterId: raw.characterId ?? characterId, version: PLAY_DOC_VERSION, baseline, events, cursor };
}

/** O estado no cursor. */
export function currentPlayState(doc) {
  return doc.events.slice(0, doc.cursor).reduce(applyEvent, doc.baseline);
}

/**
 * Um evento com id e data.
 * @param {string} kind
 * @param {{ ops?: object[], payload?: object, rolls?: object|null, label?: string }} [fields]
 * @param {Date} [now]
 */
export function makeEvent(kind, { ops = [], payload = {}, rolls = null, label = '' } = {}, now = new Date()) {
  return { id: makeId(), at: now.toISOString(), kind, label, payload, rolls, ops };
}

/** Grava um evento no cursor; o ramo refazível é descartado e devolvido. */
export function recordEvent(doc, event) {
  const discarded = doc.events.slice(doc.cursor);
  const events = [...doc.events.slice(0, doc.cursor), event];
  return { doc: { ...doc, events, cursor: events.length }, discarded };
}

/** Desfaz o último evento aplicado; null se não há o que desfazer. */
export function undoEvent(doc) {
  if (!canUndo(doc)) return null;
  return { doc: { ...doc, cursor: doc.cursor - 1 }, event: doc.events[doc.cursor - 1] };
}

/** Refaz o próximo evento do ramo; null se não há o que refazer. */
export function redoEvent(doc) {
  if (!canRedo(doc)) return null;
  return { doc: { ...doc, cursor: doc.cursor + 1 }, event: doc.events[doc.cursor] };
}

/** Há evento aplicado para desfazer? */
export function canUndo(doc) {
  return doc.cursor > 0;
}

/** Há evento desfeito para refazer? */
export function canRedo(doc) {
  return doc.cursor < doc.events.length;
}

/** Os limites da janela, inteiros e no mínimo 1. */
export function normalizeLimits(limits = {}) {
  const pick = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 1 ? Math.floor(Number(v)) : d);
  return {
    maxEvents: pick(limits.maxEvents, HISTORY_LIMITS.maxEvents),
    maxAgeDays: pick(limits.maxAgeDays, HISTORY_LIMITS.maxAgeDays),
  };
}

/**
 * Dobra no baseline o que passou da janela (quantidade ou idade).
 * @returns {{ doc: object, folded: number }}
 */
export function compactPlayDoc(doc, limits = HISTORY_LIMITS, now = new Date()) {
  const { maxEvents, maxAgeDays } = normalizeLimits(limits);
  const applied = doc.events.slice(0, doc.cursor);
  const cutoff = now.getTime() - maxAgeDays * DAY_MS;
  let old = 0;
  while (old < applied.length && Date.parse(applied[old].at) < cutoff) old++;
  const folded = Math.max(old, applied.length - maxEvents);
  if (folded <= 0) return { doc, folded: 0 };
  const baseline = applied.slice(0, folded).reduce(applyEvent, doc.baseline);
  return {
    doc: { ...doc, baseline, events: doc.events.slice(folded), cursor: doc.cursor - folded },
    folded,
  };
}

/** As operações do evento que tocam o personagem (inventário e moedas). */
export function characterOps(event) {
  return (event?.ops ?? []).filter((op) => op?.op === 'inventory' || op?.op === 'currency');
}

/** Igualdade estrutural (a ordem das chaves não importa). */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).filter((k) => a[k] !== undefined);
  const kb = Object.keys(b).filter((k) => b[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}

/**
 * Aplica (`forward`) ou desfaz (`backward`) as operações de personagem.
 * @returns {{ character: object, conflicts: object[] }}
 */
export function applyCharacterOps(character, ops, direction = 'forward') {
  const list = direction === 'forward' ? ops : [...ops].reverse();
  let inventory = [...(character.inventory ?? [])];
  let currency = { ...(character.currency ?? {}) };
  const conflicts = [];

  for (const op of list) {
    if (op?.op === 'inventory') {
      const expected = direction === 'forward' ? op.before ?? null : op.after ?? null;
      const target = direction === 'forward' ? op.after ?? null : op.before ?? null;
      const at = inventory.findIndex((e) => e.uid === op.uid);
      const current = at >= 0 ? inventory[at] : null;
      if (!deepEqual(current, expected)) {
        conflicts.push(op);
        continue;
      }
      if (target && at >= 0) {
        inventory[at] = target;
      } else if (target) {
        const index = Number.isInteger(op.index) ? clamp(op.index, 0, inventory.length) : inventory.length;
        inventory = [...inventory.slice(0, index), target, ...inventory.slice(index)];
      } else if (at >= 0) {
        inventory = inventory.filter((e, i) => i !== at);
      }
    } else if (op?.op === 'currency') {
      const sign = direction === 'forward' ? 1 : -1;
      const next = { ...currency };
      for (const [coin, delta] of Object.entries(op.delta ?? {})) next[coin] = num(next[coin]) + sign * num(delta);
      if (Object.values(next).some((v) => v < 0)) {
        conflicts.push(op);
        continue;
      }
      currency = next;
    }
  }
  return { character: { ...character, inventory, currency }, conflicts };
}
