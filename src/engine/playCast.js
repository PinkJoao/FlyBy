// =============================================================================
// playCast: conjurar no play mode (slot, pacto, uso concedido, ritual)
// =============================================================================
// O QUE FAZ
//   As formas de lançar uma magia do catálogo (engine/playCatalog) com o estado
//   de agora, o evento de conjurar (gasta o que a forma pede e liga a
//   concentração) e as rolagens da magia no círculo em que foi lançada (ataque,
//   dano e cura, com o upcast).
//
// FUNÇÕES
//   leftOf(catalog, state, key): o que sobra de um recurso, com o máximo.
//   castWays(catalog, state, spell): as formas de lançar, com o que sobra de cada.
//   castEvent(args): o evento de conjurar.
//   spellAttackOf(origin, spell, level): a magia como "ataque" do playActions
//     (acerto da origem, dano com o upcast), para rolar acerto e dano.
//   diceWithUpcast(baseDice, spell, level): o dado base mais o upcast do círculo.
//   healParts(origin, spell, level): as partes da cura, com o upcast e o modificador.
//   spellHealEvent(args): rola a cura e, se for em si mesmo, aplica.
//
// DECISÕES E ARMADILHAS
//   - Cantrip, magia à vontade (`will`) e magia inata sem contador saem de graça.
//     O "inato sem frequência" é CARGA (playCatalog): sem contador, não se gasta.
//   - Magia concedida com usos (1 por dia, PB por descanso) gasta o próprio uso; ela
//     TAMBÉM pode sair de um slot (2024), menos o Mystic Arcanum, que é só o uso.
//   - Slot: qualquer círculo igual ou maior que o da magia, comum ou de pacto (o
//     multiclasse usa o pacto para qualquer magia de classe). O círculo lançado
//     manda no upcast: o pacto lança no círculo do pacto.
//   - Ritual: sem slot (os 10 minutos a mais são da mesa).
//   - Magia com efeito curado (playEffects.spellModifier: Bless, Hunter's Mark)
//     liga o modificador no MESMO evento: sempre, se a magia é só em si mesmo;
//     com `onSelf`, se o jogador disse que ela o inclui.
//   - Em combate, a duração da magia vira rodadas (playCombat): a concentração
//     ganha `expiresRound` e o efeito, `rounds`; o "Next turn" os tira quando passa.
//   - Lançar uma magia de CONCENTRAÇÃO troca a anterior no mesmo evento (o
//     payload diz qual terminou).
//   - Upcast: o dado do `{@scaledamage}`/`{@scaledice}` por círculo acima do base,
//     somado como uma parte a mais ("Upcast"); a cura soma o modificador da origem
//     quando a prosa manda (`heal.addMod`).
// -----------------------------------------------------------------------------

import { rollParts, cryptoRng } from './dice';
import { makeEvent, remainingOf } from './playState';
import { healOutcome } from './playHealth';
import { bonusParts, rngFor } from './playActions';
import { endConcentrationOps, spellModifier } from './playEffects';
import { withRounds } from './playCombat';

/** O resto de um recurso do catálogo, com o máximo dele. */
const leftOf = (catalog, state, key) => {
  const r = (catalog.resources ?? []).find((x) => x.key === key);
  return r ? { left: remainingOf(state, key, r.max), max: r.max } : null;
};

/**
 * As formas de lançar uma magia agora.
 * @returns {{ id: string, label: string, level: number, key: string|null, left: number|null }[]}
 */
export function castWays(catalog, state, spell) {
  const ways = [];
  if (spell.level === 0 || spell.castType === 'will' || (spell.castType === 'innate' && !spell.uses)) {
    ways.push({ id: 'free', label: spell.level === 0 ? 'Cantrip' : spell.castType === 'will' ? 'At will' : 'Innate', level: spell.level, key: null, left: null });
    if (spell.level === 0) return ways;
  }
  if (spell.uses) {
    const l = leftOf(catalog, state, spell.uses);
    ways.push({ id: 'uses', label: spell.arcanum ? 'Mystic Arcanum' : 'Free use', level: spell.castLevel ?? spell.level, key: spell.uses, left: l?.left ?? 0, max: l?.max ?? 0 });
  }
  if (!spell.arcanum && spell.level > 0) {
    for (const r of catalog.resources ?? []) {
      if (r.kind === 'slot' && r.level >= spell.level) {
        ways.push({ id: r.key, label: `Level ${r.level} slot`, level: r.level, key: r.key, left: remainingOf(state, r.key, r.max), max: r.max });
      }
      if (r.kind === 'pact' && r.level >= spell.level) {
        ways.push({ id: 'pact', label: `Pact slot (level ${r.level})`, level: r.level, key: 'pact', left: remainingOf(state, 'pact', r.max), max: r.max });
      }
    }
  }
  if (spell.ritual) ways.push({ id: 'ritual', label: 'As a ritual (no slot, 10 minutes longer)', level: spell.level, key: null, left: null });
  return ways;
}

/**
 * O evento de conjurar: gasta o que a forma pede e liga a concentração.
 * @param {{ catalog?: object, state: object, origin: object, spell: object, way: object, now?: Date }} args
 */
export function castEvent({ state, origin, spell, way, onSelf = false, now = new Date() }) {
  const ops = [];
  if (way.key) ops.push({ op: 'spend', key: way.key, amount: 1 });
  const ended = spell.concentration && state.concentration ? state.concentration.name : null;
  if (spell.concentration) ops.push(...endConcentrationOps(state).filter((o) => o.op === 'modifier'));
  const expiresRound = state.combat && spell.durationRounds ? state.combat.round + spell.durationRounds : null;
  if (spell.concentration) ops.push({ op: 'concentration', value: { name: spell.name, spellKey: spell.key, level: way.level, ...(expiresRound ? { expiresRound } : {}) } });
  const effect = spellModifier(spell);
  const applied = effect && (effect.self || onSelf);
  if (applied) ops.push({ op: 'modifier', add: withRounds(effect.modifier, state, spell.durationRounds) });
  return makeEvent('cast', {
    label: spell.name,
    ops,
    payload: {
      spellKey: spell.key,
      originKey: origin.key,
      origin: origin.label,
      level: way.level,
      way: way.label,
      short: way.key && (way.left ?? 0) < 1,
      concentration: !!spell.concentration,
      ended,
      attack: spell.mechanics?.attack ? origin.attackBonus : null,
      save: spell.mechanics?.save ? { ability: spell.mechanics.save, dc: origin.saveDc } : null,
      damage: !!spell.mechanics?.damage?.dice,
      heal: !!spell.mechanics?.heal?.dice,
      effect: applied ? effect.modifier.label : null,
    },
  }, now);
}

/** As partes de dado de uma magia no círculo lançado (o base e o upcast). */
function diceWithUpcast(baseDice, spell, level) {
  const extra = spell.mechanics?.upcast && spell.level > 0 ? Math.max(0, level - spell.level) : 0;
  if (!extra) return baseDice;
  const m = String(spell.mechanics.upcast).match(/^(\d*)d(\d+)$/);
  if (!m) return `${baseDice} + ${extra} * (${spell.mechanics.upcast})`;
  return `${baseDice} + ${(Number(m[1]) || 1) * extra}d${m[2]}`;
}

/** A magia como "ataque" do playActions: acerto da origem e dano no círculo lançado. */
export function spellAttackOf(origin, spell, level = spell.level) {
  const d = spell.mechanics?.damage;
  return {
    key: spell.key,
    kind: 'spell',
    name: spell.name,
    attack: spell.mechanics?.attack ? { bonus: origin.attackBonus ?? 0 } : null,
    save: spell.mechanics?.save ? { ability: spell.mechanics.save, dc: origin.saveDc } : null,
    damage: d?.dice ? { dice: diceWithUpcast(d.dice, spell, level), bonus: 0, types: d.types ?? [] } : null,
    versatile: null,
  };
}

/** As partes da cura no círculo lançado, com o modificador quando a prosa manda. */
export function healParts(origin, spell, level = spell.level) {
  const h = spell.mechanics?.heal;
  if (!h?.dice) return [];
  return [
    { label: spell.name, formula: diceWithUpcast(h.dice, spell, level) },
    ...(h.addMod && origin.abilityMod ? [{ label: 'Spellcasting modifier', formula: origin.abilityMod }] : []),
  ];
}

/** Rola a cura de uma magia e, se for no próprio personagem, aplica. */
export function spellHealEvent({ catalog, state, origin, spell, level, options = {}, rng = cryptoRng, now = new Date() }) {
  const rolls = rollParts([...healParts(origin, spell, level), ...bonusParts(options)], { data: catalog.rollData, rng: rngFor(options, rng) });
  const ops = [];
  let healed = null;
  if (options.applyHeal) {
    const heal = healOutcome(state, catalog, rolls.total);
    ops.push(...heal.ops);
    healed = heal.summary;
  }
  return makeEvent('healRoll', { label: spell.name, ops, payload: { spellKey: spell.key, level, healed }, rolls }, now);
}
