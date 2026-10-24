// =============================================================================
// playHealth: dano, cura, temporário, morte e concentração no play mode
// =============================================================================
// O QUE FAZ
//   As regras de vida do 2024 (XPHB, capítulo 1 e o glossário) como funções
//   puras que olham o estado de jogo e o catálogo AGORA e devolvem as
//   operações concretas do evento (DDL-0108: o redutor não lê a ficha). Quem
//   grava é a tela; quem rola é o engine/dice.
//
// FUNÇÕES
//   vitals(state, catalog): HP máximo, atual, temporário e o estado da morte.
//   traitFor(catalog, type): a defesa do personagem contra um tipo de dano.
//   adjustDamage(amount, trait): o dano depois de resistência, imunidade ou
//     vulnerabilidade.
//   concentrationDc(damage): a CD do save de concentração.
//   damageOutcome(state, catalog, opts): o que um dano faz (ops e resumo).
//   healOutcome(state, catalog, amount): o que uma cura faz.
//   tempHpOutcome(state, amount, opts): o temporário novo, sem somar.
//   deathSaveOutcome(state, catalog, roll): o que um teste contra a morte faz.
//   damageEvent(args), healEvent(args), tempHpEvent(args): os eventos.
//   deathSaveEvent(args): rola o teste contra a morte e monta o evento.
//   concentrationEvent(args): começa ou termina a concentração.
//   concentrationCheckEvent(args): o save de CON para manter a concentração.
//
// DECISÕES E ARMADILHAS
//   Regras medidas no texto do XPHB (data/book/book-xphb.json, 2026-10-24)
//   - Temporário é gasto PRIMEIRO; não soma com outro temporário (o jogador
//     escolhe: o padrão é ficar com o MAIOR, `replace` força o novo); cura não o
//     restaura; some no descanso longo.
//   - Dano com 0 HP: uma falha, duas num crítico; dano maior ou igual ao HP
//     máximo mata. Ao cair a 0, o que SOBRA do dano maior ou igual ao máximo
//     mata na hora (dano maciço). Dano tira a estabilidade.
//   - Teste contra a morte: 10 ou mais é sucesso; 1 natural, duas falhas; 20
//     natural, recupera 1 HP. Três sucessos deixam ESTÁVEL e zeram a contagem;
//     três falhas, morto. Recuperar qualquer HP zera tudo.
//   - Defesa: imunidade zera; resistência divide por dois (para baixo); a
//     vulnerabilidade dobra depois (as duas juntas voltam quase ao dano cheio).
//   - Concentração: CD 10 ou metade do dano sofrido (para baixo), o MAIOR, com
//     teto 30 (regra 2024). Falhar no save termina a concentração no MESMO
//     evento: o resultado está gravado, então o replay é o mesmo. Terminar a
//     concentração tira junto os modificadores ligados a ela (Bless, Hex,
//     playEffects.endConcentrationOps).
//   - A defesa contra o dano olha também os efeitos (a resistência da Rage, o
//     Petrified), por effectiveDefenses.
//   Forma
//   - O dano guardado é o que saiu do HP, nunca mais do que o atual: o HP não
//     fica negativo e uma cura parte do zero. A cura mira o HP ATUAL contra o
//     máximo de agora, então funciona mesmo com o dano guardado acima do máximo
//     (a ficha desceu de nível).
//   - A morte é ESTADO (`death.dead`), não a remoção da ficha: o mestre pode
//     trazer de volta, e uma cura limpa a marca.
// -----------------------------------------------------------------------------

import { hpView, makeEvent } from './playState';
import { d20Test } from './dice';
import { bonusParts, rngFor, d20Options } from './playActions';
import { effectiveDefenses, endConcentrationOps } from './playEffects';

const NO_DEATH = { success: 0, failure: 0, stable: false, dead: false };

/** HP máximo, atual e temporário, mais o estado da morte. */
export function vitals(state, catalog) {
  const hp = hpView(state, catalog.stats?.hpMax ?? 0);
  const death = { ...NO_DEATH, ...(state.death ?? {}) };
  return { ...hp, death, dying: hp.current === 0 && hp.max > 0 && !death.stable && !death.dead };
}

/** A defesa contra um tipo de dano: 'immune', 'resist', 'vulnerable', 'resist+vulnerable' ou null. */
export function traitFor(catalog, type) {
  const t = String(type ?? '').toLowerCase();
  if (!t) return null;
  const d = catalog.defenses ?? {};
  if ((d.immune ?? []).includes(t)) return 'immune';
  const resist = (d.resist ?? []).includes(t);
  const vulnerable = (d.vulnerable ?? []).includes(t);
  if (resist && vulnerable) return 'resist+vulnerable';
  return resist ? 'resist' : vulnerable ? 'vulnerable' : null;
}

/** O dano depois da defesa: imunidade zera, resistência divide, vulnerabilidade dobra. */
export function adjustDamage(amount, trait) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  if (trait === 'immune') return 0;
  let v = n;
  if (trait === 'resist' || trait === 'resist+vulnerable') v = Math.floor(v / 2);
  if (trait === 'vulnerable' || trait === 'resist+vulnerable') v *= 2;
  return v;
}

/** A CD do save de concentração: 10 ou metade do dano, o maior, até 30. */
export function concentrationDc(damage) {
  return Math.min(30, Math.max(10, Math.floor(damage / 2)));
}

/**
 * O que um dano faz agora: as operações e o resumo para o cartão.
 * @param {{ amount: number, type?: string, critical?: boolean }} opts
 */
export function damageOutcome(state, catalog, { amount, type = '', critical = false }) {
  const v = vitals(state, catalog);
  const trait = traitFor({ ...catalog, defenses: effectiveDefenses(catalog, state) }, type);
  const taken = adjustDamage(amount, trait);
  const toTemp = Math.min(v.temp, taken);
  const rest = taken - toTemp;
  const ops = [];
  const notes = [];
  let toHp = 0;

  if (v.current === 0 && rest > 0) {
    const failures = critical ? 2 : 1;
    const dead = rest >= v.max || v.death.failure + failures >= 3;
    ops.push({ op: 'death', set: { stable: false, ...(dead ? { dead: true } : {}) }, failure: failures });
    notes.push(dead ? 'Dies' : `Death save failure${failures > 1 ? 's' : ''} +${failures}`);
  } else if (rest > 0) {
    toHp = Math.min(rest, v.current);
    const overflow = rest - toHp;
    if (toHp === v.current) {
      if (overflow >= v.max) {
        ops.push({ op: 'death', set: { dead: true } });
        notes.push('Dies from massive damage');
      } else {
        notes.push('Drops to 0 hit points');
      }
    }
  }
  if (toHp || toTemp) ops.unshift({ op: 'hp', damage: toHp, temp: -toTemp });

  const dc = state.concentration && taken > 0 ? concentrationDc(taken) : null;
  return {
    ops,
    summary: { amount: Math.max(0, Math.floor(Number(amount) || 0)), taken, trait, type: type || null, toTemp, toHp, notes, concentrationDc: dc },
  };
}

/** O que uma cura faz: sobe o HP atual até o máximo e, saindo do zero, limpa a morte. */
export function healOutcome(state, catalog, amount) {
  const v = vitals(state, catalog);
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  const target = Math.min(v.max, v.current + n);
  const delta = (v.max - target) - state.damage;
  const ops = [];
  if (delta !== 0) ops.push({ op: 'hp', damage: delta });
  const deathMarked = v.death.success || v.death.failure || v.death.stable || v.death.dead;
  if (n > 0 && deathMarked) ops.push({ op: 'death', reset: true });
  return { ops, summary: { amount: n, healed: target - v.current, from: v.current, to: target } };
}

/** O temporário novo: sem somar; fica o maior, ou o novo com `replace`. */
export function tempHpOutcome(state, amount, { replace = false } = {}) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  const next = replace ? n : Math.max(state.tempHp, n);
  return {
    ops: next !== state.tempHp ? [{ op: 'hp', temp: next - state.tempHp }] : [],
    summary: { amount: n, from: state.tempHp, to: next, kept: next === state.tempHp && n !== next },
  };
}

/** O que um teste contra a morte faz, pelo natural e pelo total. */
export function deathSaveOutcome(state, catalog, { natural, total }) {
  const v = vitals(state, catalog);
  if (natural === 20) {
    const heal = healOutcome(state, catalog, 1);
    return { ops: [...heal.ops.filter((o) => o.op === 'hp'), { op: 'death', reset: true }], result: 'Regains 1 hit point' };
  }
  const failures = natural === 1 ? 2 : total >= 10 ? 0 : 1;
  if (failures) {
    const dead = v.death.failure + failures >= 3;
    return {
      ops: [{ op: 'death', failure: failures, ...(dead ? { set: { dead: true } } : {}) }],
      result: dead ? 'Dies' : failures === 2 ? 'Two failures' : 'Failure',
    };
  }
  if (v.death.success + 1 >= 3) {
    return { ops: [{ op: 'death', set: { success: 0, failure: 0, stable: true } }], result: 'Stable' };
  }
  return { ops: [{ op: 'death', success: 1 }], result: 'Success' };
}

/** O evento de um dano sofrido. */
export function damageEvent({ state, catalog, amount, type, critical, label = 'Damage taken', now = new Date() }) {
  const { ops, summary } = damageOutcome(state, catalog, { amount, type, critical });
  return makeEvent('damage', { label, ops, payload: { ...summary, critical: !!critical } }, now);
}

/** O evento de uma cura. */
export function healEvent({ state, catalog, amount, label = 'Healing', now = new Date() }) {
  const { ops, summary } = healOutcome(state, catalog, amount);
  return makeEvent('heal', { label, ops, payload: summary }, now);
}

/** O evento de HP temporário. */
export function tempHpEvent({ state, amount, replace = false, label = 'Temporary hit points', now = new Date() }) {
  const { ops, summary } = tempHpOutcome(state, amount, { replace });
  return makeEvent('tempHp', { label, ops, payload: summary }, now);
}

/** Rola o teste contra a morte (d20 puro, mais o bônus do diálogo) e monta o evento. */
export function deathSaveEvent({ state, catalog, options = {}, rng, now = new Date() }) {
  const rolls = d20Test({ parts: [...(options.applied?.parts ?? []), ...bonusParts(options)], ...d20Options(options), data: catalog.rollData, rng: rngFor(options, rng) });
  const { ops, result } = deathSaveOutcome(state, catalog, { natural: rolls.natural, total: rolls.total });
  return makeEvent('deathSave', { label: 'Death saving throw', ops, payload: { result }, rolls }, now);
}

/** Começa (com o nome do que se concentra) ou termina a concentração, com o que dependia dela. */
export function concentrationEvent({ state = null, name = null, now = new Date() }) {
  const ends = state ? endConcentrationOps(state).filter((o) => o.op === 'modifier') : [];
  return makeEvent('concentration', {
    label: name ? `Concentrating on ${name}` : 'Concentration ended',
    ops: [...ends, { op: 'concentration', value: name ? { name } : null }],
    payload: { name },
  }, now);
}

/** O save de CON para manter a concentração; a falha a termina no mesmo evento. */
export function concentrationCheckEvent({ state, catalog, dc, options = {}, rng, now = new Date() }) {
  const rolls = d20Test({
    parts: [{ label: 'Constitution save', formula: catalog.checks?.concentration?.bonus ?? 0 }, ...(options.applied?.parts ?? []), ...bonusParts(options)],
    ...d20Options(options),
    data: catalog.rollData,
    rng: rngFor(options, rng),
  });
  const kept = rolls.total >= dc;
  const name = state.concentration?.name ?? null;
  return makeEvent('concentrationCheck', {
    label: name ? `Concentration: ${name}` : 'Concentration',
    ops: kept || !state.concentration ? [] : endConcentrationOps(state),
    payload: { dc, kept, name },
    rolls,
  }, now);
}
