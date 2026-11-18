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
//   slotPoolsFor(catalog, state, level): os espaços que o cabeçalho de um círculo
//     mostra (o do círculo e o pacto, se ele cabe), com o que sobra.
//   projectileCount(spell, level, characterLevel), timesFormula(formula, k): quantos projéteis a magia
//     dispara (`PROJECTILES`: o Eldritch Blast pelo nível do personagem, "two beams at level 5, three
//     beams at level 11, and four beams at level 17"; o Magic Missile, "three glowing darts" e "one more
//     dart for each spell slot level above 1"; o Scorching Ray, três raios e um por círculo acima do 2º;
//     o Jim's Magic Missile, três mísseis com ataque) e a fórmula de k iguais; o lançamento rola um ataque
//     por projétil, ou o dano por alvo (TC-0175, DDL-0249).
//   isZoneSpell(spell, catalog): a magia de área cujo dano vem depois sem outro caminho para rolar (o
//     `damage.later` sem efeito curado nem instância leve: Hunger of Hadar, Web, Cordon of Arrows).
//   activeZone(state, spell), endZoneEvent(args): ela está ativa (a concentração nela, ou o marcador `zone`
//     da que não pede concentração, que o castEvent põe), e o evento de encerrar (DDL-0249).
//   zoneUsedOps(state, spell, ids): guarda na magia de área ativa (a concentração ou o marcador) os extras de
//     "one damage roll of that spell" já usados, para o "Damage again" vir com eles desligados (DDL-0251).
//   castEvent(args): o evento de conjurar.
//   spellAttackOf(origin, spell, level): a magia como "ataque" do playActions
//     (acerto da origem, dano com o upcast), para rolar acerto e dano.
//   diceWithUpcast(baseDice, spell, level): o dado base mais o upcast do círculo.
//   healParts(origin, spell, level, catalog): as partes da cura, com o upcast, o modificador e
//     o que as features somam (`SPELL_HEAL_BONUS`: Disciple of Life, 2 + o círculo; o XPHB
//     pede o espaço gasto, e o lançamento grátis de um círculo 1 ou mais também ganha, um
//     limite aceito; o passe ao vivo achou a cura sem ele, DDL-0219).
//   spellHealEvent(args): rola a cura e, se for em si mesmo, aplica.
//   castTriggers(event, catalog): o que uma feature dá DEPOIS de lançar, pelo card da magia
//     (Blessed Healer, Abjuration Adept), com o valor pelo círculo do espaço gasto.
//   slotRegainEvent(args): o Expert Divination devolve o maior espaço gasto abaixo do círculo
//     lançado, até o 5 (TC-0162).
//   spellRecallEvent(args): o Free Casting da Boon of Spell Recall (1d4 igual ao círculo
//     devolve o espaço, DDL-0218).
//
// DECISÕES E ARMADILHAS
//   - Gift of the Ever-Living Ones (TC-0166, DDL-0238): com um efeito `healMax` ligado (healDiceMaxed em engine/playEffects), os dados da cura que o personagem recebe vão ao máximo, como o Supreme Healing em spellHealEvent; a parte diz qual dos dois.
//   - A magia `ritualOnly` (o ritual do grimório pelo Ritual Adept) só tem o caminho do ritual
//     (TC-0158).
//   - Boon of Spell Recall (DDL-0218): "Whenever you cast a spell with a level 1-4 spell
//     slot, roll 1d4. If the number you roll is the same as the slot's level, the slot isn't
//     expended". O evento da magia guarda `slotKey`; o botão do card rola e devolve o espaço.
//   - Supreme Healing (DDL-0217): na cura de magia, cada dado vale o máximo ("don't roll
//     those dice for the healing; instead use the highest number possible for each die"),
//     por `withDiceMax` em spellHealEvent; a parte diz "(Supreme Healing)".
//   - CAST_TRIGGERS (DDL-0215): o que a feature dá "immediately after you cast a spell with a
//     spell slot". Blessed Healer: a magia de cura gasta espaço, e você recupera 2 + o
//     círculo ("a creature other than yourself": o jogador sabe em quem curou, por isso é um
//     botão no card e não automático). Abjuration Adept: magia de Abjuração com espaço dá
//     PV temporários iguais ao dobro do círculo. O evento guarda `school` e `slotted` (o
//     espaço comum ou o do pacto, não o uso concedido nem o ritual).
//   - Cantrip, magia à vontade (`will`) e magia inata sem contador saem de graça.
//     O "inato sem frequência" é CARGA (playCatalog): sem contador, não se gasta.
//   - Magia concedida com usos (1 por dia, PB por descanso) gasta o próprio uso; ela
//     TAMBÉM pode sair de um slot (2024), menos o Mystic Arcanum, que é só o uso.
//   - Slot: qualquer círculo igual ou maior que o da magia, comum ou de pacto (o
//     multiclasse usa o pacto para qualquer magia de classe). O círculo lançado
//     manda no upcast: o pacto lança no círculo do pacto.
//   - Ritual: sem slot (os 10 minutos a mais são da mesa).
//   - slotPoolsFor é o RESUMO do cabeçalho (docs/PLAY-MODE-V2-PLAN.md §6): o espaço
//     do próprio círculo e o do pacto quando o pacto é igual ou maior (o bruxo 5 vê o
//     pacto nos grupos 1, 2 e 3). Os círculos MAIORES, que também servem, só aparecem
//     no painel de lançar (castWays): no cabeçalho de cada grupo repetiriam tudo. O
//     Mystic Arcanum não é espaço: o uso aparece na linha da magia.
//   - Magia com efeito curado (playEffects.spellModifier: Bless, Hunter's Mark)
//     liga o modificador no MESMO evento: sempre, se a magia é só em si mesmo;
//     com `onSelf`, se o jogador disse que ela o inclui.
//   - Em combate, a duração da magia vira rodadas (playCombat): a concentração
//     ganha `expiresRound` e o efeito, `rounds`; o "Next turn" os tira quando passa.
//   - Lançar uma magia de CONCENTRAÇÃO troca a anterior no mesmo evento (o
//     payload diz qual terminou).
//   - Upcast: o dado do `{@scaledamage}`/`{@scaledice}` por círculo acima do base,
//     somado como uma parte a mais ("Upcast"); a cura soma o modificador da origem
//     quando a prosa manda (`heal.addMod`); o dano soma o modificador com `damage.addMod` (DDL-0245).
// -----------------------------------------------------------------------------

import { rollParts, cryptoRng } from './dice';
import { makeEvent, remainingOf } from './playState';
import { healOutcome } from './playHealth';
import { bonusParts, rngFor, withDiceMax } from './playActions';
import { endConcentrationOps, spellModifier, healDiceMaxed, makeModifier } from './playEffects';
import { isLightSummon } from './playSummons';
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
  if (spell.ritualOnly) return [{ id: 'ritual', label: 'As a ritual from your spellbook (Ritual Adept)', level: spell.level, key: null, left: null }];
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
 * Os espaços que o cabeçalho de um círculo mostra: o do círculo e o pacto, se cabe.
 * @returns {{ key: string, kind: 'slot'|'pact', label: string, level: number, left: number, max: number }[]}
 */
export function slotPoolsFor(catalog, state, level) {
  if (!(level > 0)) return [];
  const out = [];
  for (const r of catalog?.resources ?? []) {
    if (r.kind === 'slot' && r.level === level) out.push({ key: r.key, kind: 'slot', label: `Level ${level} slots`, level, left: remainingOf(state, r.key, r.max), max: r.max });
    if (r.kind === 'pact' && r.level >= level) out.push({ key: r.key, kind: 'pact', label: `Pact slots (level ${r.level})`, level: r.level, left: remainingOf(state, r.key, r.max), max: r.max });
  }
  return out;
}

const CAST_TRIGGERS = {
  'blessed healer': { when: (p) => p.heal && p.slotted && p.level >= 1, apply: 'heal', formula: (p) => `${2 + p.level}`, label: (p) => `Blessed Healer: regain ${2 + p.level} HP` },
  'boon of spell recall': { when: (p) => p.slotted && p.level >= 1 && p.level <= 4, recall: true, label: () => 'Spell Recall: roll 1d4' },
  'expert divination': { when: (p) => p.school === 'D' && /^slot:/.test(p.slotKey ?? '') && p.level >= 2, regain: true, label: (p) => `Expert Divination: regain a slot below level ${Math.min(p.level, 6)}` },
  'abjuration adept': { when: (p) => p.school === 'A' && p.slotted && p.level >= 1, apply: 'temp', formula: (p) => `${2 * p.level}`, label: (p) => `Protective Ward: ${2 * p.level} temp HP` },
};

/** O que uma feature dá depois de lançar, pelo card da magia: [{ name, label, apply, formula }]. */
export function castTriggers(event, catalog) {
  if (event?.kind !== 'cast') return [];
  const p = event.payload ?? {};
  const features = new Set(catalog?.features ?? []);
  return Object.entries(CAST_TRIGGERS)
    .filter(([name, t]) => features.has(name) && t.when(p))
    .map(([name, t]) => (t.recall ? { name, label: t.label(p), recall: true, level: p.level, slotKey: p.slotKey }
      : t.regain ? { name, label: t.label(p), regain: true, level: p.level }
        : { name, label: t.label(p), apply: t.apply, formula: t.formula(p) }));
}

/** O Expert Divination: devolve o maior espaço gasto abaixo do círculo lançado, até o 5. */
export function slotRegainEvent({ catalog, state, trigger, now = new Date() }) {
  const top = Math.min(trigger.level - 1, 5);
  const slot = (catalog.resources ?? [])
    .filter((r) => r.kind === 'slot' && r.level <= top && (state.spent?.[r.key] ?? 0) > 0)
    .sort((a, b) => b.level - a.level)[0];
  return makeEvent('use', {
    label: 'Expert Divination',
    ops: slot ? [{ op: 'restore', key: slot.key, amount: 1 }] : [],
    payload: { logged: true, costs: [], short: [], lines: [slot ? `A level ${slot.level} slot is regained` : `No expended slot of level ${top} or lower`] },
  }, now);
}

/** O Free Casting da Boon of Spell Recall: 1d4, e igual ao círculo, o espaço volta. */
export function spellRecallEvent({ trigger, rng = cryptoRng, now = new Date() }) {
  const rolls = rollParts([{ label: 'Free Casting', formula: '1d4' }], { rng });
  const back = rolls.total === trigger.level && trigger.slotKey;
  return makeEvent('use', {
    label: 'Boon of Spell Recall',
    ops: back ? [{ op: 'restore', key: trigger.slotKey, amount: 1 }] : [],
    payload: { logged: true, rolled: true, costs: [], short: [], lines: [back ? `Rolled ${rolls.total}: the level ${trigger.level} slot is not expended` : `Rolled ${rolls.total}: the slot stays spent (needs ${trigger.level})`] },
    rolls,
  }, now);
}

/** As magias de vários projéteis, pelo texto ("three glowing darts", "one more dart for each spell slot level above 1"). */
export const PROJECTILES = {
  'eldritch blast': { noun: 'beam', byCharacter: [[17, 4], [11, 3], [5, 2], [1, 1]] },
  'magic missile': { noun: 'dart', base: 3, from: 1, per: 1 },
  'scorching ray': { noun: 'ray', base: 3, from: 2, per: 1 },
  "jim's magic missile": { noun: 'missile', base: 3, from: 1, per: 1 },
};

/** Quantos projéteis a magia dispara no círculo lançado (e no nível do personagem, para o cantrip); null se não é dessas. */
export function projectileCount(spell, level, characterLevel = 1) {
  const p = PROJECTILES[String(spell?.name ?? '').toLowerCase()];
  if (!p) return null;
  const n = p.byCharacter ? p.byCharacter.find(([lv]) => characterLevel >= lv)?.[1] ?? 1 : p.base + Math.max(0, (level ?? p.from) - p.from) * p.per;
  return { count: n, noun: p.noun };
}

/** A fórmula de `k` projéteis iguais: cada dado e cada número vezes `k` ("1d4 + 1" com 3 dardos: "3d4 + 3"). */
export function timesFormula(formula, k) {
  return String(formula).split(/\s*\+\s*/).map((t) => {
    const d = t.match(/^(\d*)d(\d+)$/);
    if (d) return `${(Number(d[1] || 1)) * k}d${d[2]}`;
    return /^\d+$/.test(t) ? String(Number(t) * k) : `${k} * (${t})`;
  }).join(' + ');
}

/** A magia de área cujo dano vem depois e não tem outro caminho para rolar (Hunger of Hadar, Web, Cordon of Arrows): fica ativa e o Cast vira "Use". */
export function isZoneSpell(spell, catalog = null) {
  return !!spell?.mechanics?.damage?.later && !spellModifier(spell, catalog) && !isLightSummon(spell);
}

/** A magia de área ativa: pela concentração nela, ou pelo marcador da que não pede concentração. Null se não está ativa. */
export function activeZone(state, spell) {
  if (!spell?.key) return null;
  if (spell.concentration) return state?.concentration?.spellKey === spell.key ? { level: state.concentration.level ?? spell.level, concentration: true, castUsed: state.concentration.castUsed ?? [] } : null;
  const m = (state?.modifiers ?? []).find((x) => x.zone === spell.key);
  return m ? { level: m.level ?? spell.level, concentration: false, modifierId: m.id, castUsed: m.castUsed ?? [] } : null;
}

/** As ops que guardam na magia de área ativa os extras de "one damage roll of that spell" já usados no lançamento. */
export function zoneUsedOps(state, spell, ids = []) {
  const zone = activeZone(state, spell);
  const fresh = (ids ?? []).filter((id) => !(zone?.castUsed ?? []).includes(id));
  if (!zone || !fresh.length) return [];
  if (zone.concentration) return [{ op: 'concentration', value: { ...state.concentration, castUsed: [...zone.castUsed, ...fresh] } }];
  const m = state.modifiers.find((x) => x.id === zone.modifierId);
  return [{ op: 'modifier', add: { ...m, castUsed: [...zone.castUsed, ...fresh] } }];
}

/** O evento de encerrar a magia de área: a concentração (com o que depende dela) ou o marcador. */
export function endZoneEvent({ state, spell, now = new Date() }) {
  const zone = activeZone(state, spell);
  const ops = !zone ? [] : zone.concentration ? endConcentrationOps(state) : [{ op: 'modifier', remove: zone.modifierId }];
  return makeEvent('use', { label: spell.name, ops, payload: { logged: true, spellKey: spell.key, option: 'End', lines: [zone?.concentration ? 'Concentration ends' : 'The spell ends'] } }, now);
}

/**
 * O evento de conjurar: gasta o que a forma pede e liga a concentração.
 * @param {{ catalog?: object, state: object, origin: object, spell: object, way: object, now?: Date }} args
 */
export function castEvent({ state, catalog = null, origin, spell, way, onSelf = false, now = new Date() }) {
  const ops = [];
  if (way.key) ops.push({ op: 'spend', key: way.key, amount: 1 });
  const ended = spell.concentration && state.concentration ? state.concentration.name : null;
  if (spell.concentration) ops.push(...endConcentrationOps(state).filter((o) => o.op === 'modifier' || o.op === 'summon' || o.op === 'form' || (o.op === 'hp' && o.temp < 0)));
  const expiresRound = state.combat && spell.durationRounds ? state.combat.round + spell.durationRounds : null;
  if (spell.concentration) ops.push({ op: 'concentration', value: { name: spell.name, spellKey: spell.key, level: way.level, ...(expiresRound ? { expiresRound } : {}), ...(spell.durationRounds ? { rounds: spell.durationRounds } : {}) } });
  const effect = spellModifier(spell, catalog);
  const applied = effect && (effect.self || onSelf);
  if (applied) ops.push({ op: 'modifier', add: withRounds(effect.modifier, state, spell.durationRounds) });
  if (!spell.concentration && isZoneSpell(spell, catalog)) {
    for (const m of (state.modifiers ?? []).filter((x) => x.zone === spell.key)) ops.push({ op: 'modifier', remove: m.id });
    ops.push({ op: 'modifier', add: withRounds(makeModifier({ label: spell.name, source: 'spell', zone: spell.key, level: way.level, duration: 'manual' }), state, spell.durationRounds) });
  }
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
      damage: !!spell.mechanics?.damage?.dice && !spell.mechanics.damage.later,
      heal: !!spell.mechanics?.heal?.dice,
      school: spell.school ?? null,
      slotted: /^(slot|pact)/.test(way.key ?? ''),
      slotKey: /^(slot|pact)/.test(way.key ?? '') ? way.key : null,
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
    level,
    cantrip: spell.level === 0,
    school: spell.school ?? null,
    spellClass: origin.classId ?? null,
    attack: spell.mechanics?.attack ? { bonus: origin.attackBonus ?? 0 } : null,
    save: spell.mechanics?.save ? { ability: spell.mechanics.save, dc: origin.saveDc } : null,
    damage: d?.dice ? { dice: diceWithUpcast(d.dice, spell, level), bonus: d.addMod ? origin.abilityMod ?? 0 : 0, types: d.types ?? [], ...(d.typeOptions ? { typeOptions: d.typeOptions } : {}) } : null,
    versatile: null,
  };
}

/** As partes da cura no círculo lançado, com o modificador quando a prosa manda. */
export function healParts(origin, spell, level = spell.level, catalog = null) {
  const h = spell.mechanics?.heal;
  if (!h?.dice) return [];
  const owned = catalog?.features ?? [];
  return [
    { label: spell.name, formula: diceWithUpcast(h.dice, spell, level) },
    ...(h.addMod && origin.abilityMod ? [{ label: 'Spellcasting modifier', formula: origin.abilityMod }] : []),
    ...(level >= 1 ? Object.entries(SPELL_HEAL_BONUS).filter(([name]) => owned.includes(name)).map(([, b]) => ({ label: b.label, formula: b.formula(level) })) : []),
  ];
}

/** O que uma feature soma na cura de uma magia de círculo 1 ou mais, pelo círculo do espaço. */
const SPELL_HEAL_BONUS = {
  'disciple of life': { label: 'Disciple of Life', formula: (level) => 2 + level },
};

/** Rola a cura de uma magia e, se for no próprio personagem, aplica. */
export function spellHealEvent({ catalog, state, origin, spell, level, options = {}, rng = cryptoRng, now = new Date() }) {
  const supreme = (catalog.features ?? []).includes('supreme healing');
  const maxBy = supreme ? 'Supreme Healing' : healDiceMaxed(state) ? 'Gift of the Ever-Living Ones' : null;
  const parts = healParts(origin, spell, level, catalog).map((p) => (maxBy && /d\d/.test(String(p.formula)) ? { label: `${p.label} (${maxBy})`, formula: withDiceMax(p.formula, catalog.rollData) } : p));
  const rolls = rollParts([...parts, ...bonusParts(options)], { data: catalog.rollData, rng: rngFor(options, rng) });
  const ops = [];
  let healed = null;
  if (options.applyHeal) {
    const heal = healOutcome(state, catalog, rolls.total);
    ops.push(...heal.ops);
    healed = heal.summary;
  }
  return makeEvent('healRoll', { label: spell.name, ops, payload: { spellKey: spell.key, level, healed }, rolls }, now);
}
