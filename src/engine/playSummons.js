// =============================================================================
// playSummons: os summons do play mode (invocar, PV, condições, ações, dispensar)
// =============================================================================
// O QUE FAZ
//   A fase S2 do plano (docs/SUMMONS-TRANSFORMATIONS-PLAN.md, DDL-0192): quais
//   criaturas uma magia invoca, as operações que põem e tiram um summon do estado,
//   a vista de um grupo (a criatura resolvida pelo núcleo, engine/creature.js, e os
//   PV de cada membro) e o "ataque" de uma ação dele, no formato que o play mode já
//   rola (rollAttackEvent, rollDamageEvent).
//
// FUNÇÕES
//   lc(s): o texto em minúsculas.
//   summonCreaturesFor(bestiary, spell): os blocos que a magia invoca.
//   summonTurnOf(entries), turnText(turn): a regra de turno pela prosa e o texto dela.
//   featureSummons(bestiary, featureName, source), isSummonFeature(featureName): os
//     companheiros de classe (CLASS_SUMMONS), os do livro da feature quando há.
//   familiarForms(bestiary, special): as feras de ND 0 do Find Familiar e as formas especiais (uma
//     por nome, a do XMM).
//   familiarSpecialForms(options): as formas especiais que as opções escolhidas dão, lidas no texto
//     ("special forms: Imp, Pseudodragon, ...": o Pact of the Chain, DDL-0238).
//   isLightSummon(spell), lightRulesOf(entries), lightOps(opts): a instância leve
//     (S4, DDL-0194): a magia sem bloco que fica em campo (LIGHT_SUMMONS).
//   LIGHT_REPEATS, repeatDice(repeat, level): o "again" que rola outra coisa que o lançamento (Storm
//     Sphere, Wall of Light: um ataque de magia), com o dado do círculo gravado (DDL-0245).
//   lcText(entries): a prosa em minúsculas, sem as marcas do 5etools.
//   summonContext(catalog, origin, opts): o contexto do invocador, congelado.
//   durableTemp(catalog, spell, level): os temporários do Durable Summons (2 x nível de mago, magia
//     de Conjuration com espaço; DDL-0236), ou 0.
//   summonOps({ state, creature, spell, level, variant, count, origin, catalog }):
//     as operações de invocar (e as que tiram os summons da concentração anterior).
//   summonGroupView(group, block, features): a criatura resolvida e os PV de cada membro; as
//     features do invocador aplicam o que as invocações dão ao familiar (`notes`).
//   isFamiliar(group): o grupo é o familiar do Find Familiar (a magia, o Pact of the Chain ou do Legion)?
//   familiarBoons(group, features): o que as invocações mudam no familiar (TC-0166): a CD do
//     invocador (Investment of the Chain Master), o ataque dele (Call of the Void) e as notas.
//   withBoons(stats, boons): as ações do bloco com esse ataque e essa CD.
//   summonRiders(view, catalog, state, action): os extras do invocador no dano do summon (Master
//     Demonologist: o 1d6 do Hex num diabo que você comanda, ligado se você concentra no Hex; o
//     Magic Fang do Bond of Fang and Scale: 1d6 na mordida do drake, DDL-0239).
//   summonVitalsEvent(opts), dismissEvent(group): os eventos do card (PV pelos
//     painéis Heal e Hurt do jogador, dispensar).
//   summonAttack(group, action, stats): uma ação no formato de ataque do play mode.
//
// DECISÕES E ARMADILHAS
//   - As invocações do familiar (DDL-0238) são estado do PERSONAGEM, não do grupo: a vista as lê a cada
//     desenho, então trocar a invocação muda o familiar já invocado. O que não tem número (o voo de 40
//     pés, a Reação que dá Resistência, o tipo de dano trocável) vai como nota no cartão.
//   - O CONTEXTO do invocador (círculo, nível de classe, modificadores, PB, ataque,
//     CD e modificador de magia, variante) é gravado no grupo na hora de invocar: o
//     reducer não lê a ficha (DDL-0108), e a vista resolve a criatura só com o que o
//     grupo guarda e o bloco do bestiário.
//   - O membro guarda o DANO, não o PV (como o próprio jogador): o máximo vem do
//     bloco e do contexto, e trocar o círculo não deixa um PV impossível gravado.
//   - Um summon de magia de concentração fica ligado a ela (`concentration`); lançar
//     outra magia de concentração tira os ligados à anterior no mesmo evento (U5:
//     sozinho, com desfazer). Quando a concentração cai por outro caminho é a S3.
//   - S3 (DDL-0193): a concentração que cai por QUALQUER caminho tira os summons ligados
//     (endConcentrationOps); o summon sem concentração e com duração sai na rodada
//     certa (`expiresRound`, nextTurnEvent). A regra de turno vem da PROSA (medido: 24
//     de 40 magias "immediately after yours", 10 "shares your Initiative", 23 "no
//     action required by you"), gravada no grupo. Os companheiros de classe vêm de
//     CLASS_SUMMONS (feature que invoca -> bloco do bestiário); o Find Familiar oferece
//     as feras de ND 0 (o bestiário não marca as formas com `summonedBySpell`).
//   - PV do membro (DDL-0201): os painéis Heal e Hurt do jogador (HpPanels), com a
//     mesma regra: o temporário não soma (fica o maior, `replace` força) e absorve o
//     dano antes; o máximo sobe com o atual (`maxDelta`, como o Aid); o Hurt pode cortar
//     o máximo. O dano gravado nunca passa do que o membro tinha, para a cura não
//     precisar pagar o excesso. Sem máximo lido (prosa), só dano e cura simples.
//   - Grupos iguais (S3 do dono): `count` membros num grupo só, cada um com o seu PV.
//   - S4 (DDL-0194): a instância leve é um grupo com `light` e sem `ref`. LIGHT_SUMMONS
//     só diz QUAIS magias (prova na prosa de cada uma); o resto vem do texto
//     (lightRulesOf): Ação Bônus ou ação Magic para mover e repetir, a CA ("has AC 20")
//     e os PV ("equal to your Hit Points maximum", congelados ao conjurar), e a troca
//     ao lançar de novo (Mage Hand). Sem PV, o grupo não tem membro. As rolagens são as
//     da magia no círculo gravado, sem gastar espaço. O Witch Bolt (DDL-0243) guarda em
//     `light.repeat` o dano automático da Ação Bônus ("deal 1d12 Lightning damage to the target
//     automatically"): o "again" do grupo rola só esse dano, sem ataque.
//   - TC-0171 (DDL-0245): a instância leve também é a magia que se REPETE sem espaço nos turnos
//     seguintes, mesmo sem nada em campo (Heat Metal, Produce Flame, Sunbeam, Eye Beam, Enervation,
//     Holy Star of Mystra, Draconic Transformation, Songal's Elemental Suffusion). O custo vem dos verbos
//     da prosa (hurl, create, target, unleash, exhale, expend, command, launch); a que repete sem rolar
//     nada (Eyebite, Fizban's Platinum Shield) tem só o "Use", que grava o gasto do turno; a que se
//     move ou é controlada (`moves`: Spiritual Weapon, Mage Hand, Rain of Fire) também tem o "Use", para
//     mover sem rolar. A que só repete a rolagem (Heat Metal, Witch Bolt) não: a Ação Bônus É a rolagem. A que rola
//     outra coisa no "again" fica em LIGHT_REPEATS; a frase do Witch Bolt já cobre o Enervation.
// -----------------------------------------------------------------------------

import { makeEvent } from './playState';
import { creatureStats } from './creature';

const lc = (s) => String(s ?? '').toLowerCase();

/** Os blocos que a magia invoca (`summonedBySpell` = "Nome|Fonte"). */
export function summonCreaturesFor(bestiary, spell) {
  if (!spell?.name) return [];
  const want = `${lc(spell.name)}|${lc(spell.source)}`;
  return (bestiary ?? []).filter((m) => lc(m.summonedBySpell) === want);
}

/** O contexto do invocador, congelado no grupo. */
export function summonContext(catalog, origin, { spellLevel = null, classLevel = null, variant = null } = {}) {
  const abilities = catalog?.rollData?.abilities ?? {};
  return {
    spellLevel,
    classLevel,
    variant,
    pb: catalog?.stats?.profBonus ?? 2,
    mods: Object.fromEntries(Object.entries(abilities).map(([k, v]) => [k, v?.mod ?? 0])),
    spellAttack: origin?.attackBonus ?? null,
    spellDc: origin?.saveDc ?? null,
    spellMod: origin?.abilityMod ?? null,
  };
}

/** O Durable Summons: temporários iguais a duas vezes o nível de mago na criatura de uma magia de Conjuration lançada com espaço, ou 0. */
function durableTemp(catalog, spell, level) {
  if (!(catalog?.features ?? []).includes('durable summons') || spell?.school !== 'C' || !(level > 0)) return 0;
  return 2 * (catalog.rollData?.classes?.wizard?.levels ?? 0);
}

/** As operações de invocar, e as que tiram os summons da concentração anterior. */

export function summonOps({ state, creature, spell, level, variant = null, count = 1, origin, catalog, classLevel = null, turn = null, feature = null }) {
  const ops = [];
  const expiresRound = state?.combat && spell?.durationRounds && !spell?.concentration ? state.combat.round + spell.durationRounds : null;
  const n = Math.max(1, Math.floor(Number(count) || 1));
  ops.push({
    op: 'summon',
    add: {
      id: `summon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      ref: { name: creature.name, source: creature.source },
      label: variant ? `${creature.name} (${variant})` : creature.name,
      spell: spell ? { name: spell.name, key: spell.key } : null,
      feature,
      concentration: !!spell?.concentration,
      turn,
      ...(expiresRound ? { expiresRound } : {}),
      ctx: summonContext(catalog, origin, { spellLevel: level ?? null, classLevel, variant }),
      members: Array.from({ length: n }, () => ({ damage: 0, conditions: [], ...(durableTemp(catalog, spell, level) ? { temp: durableTemp(catalog, spell, level) } : {}) })),
    },
  });
  return ops;
}

const lcText = (entries) => JSON.stringify(entries ?? []).replace(/[{]@[a-zA-Z]+ ([^|}]*)[^}]*[}]/g, '$1').toLowerCase();

/**
 * A regra de turno pela PROSA da magia ou da feature: quando age e como recebe ordem.
 * @returns {{ order: 'after'|'shared'|'own'|null, command: 'free'|'bonus'|'action'|null }}
 */
export function summonTurnOf(entries) {
  const t = lcText(entries);
  const order = /immediately after yours|right after yours|immediately after you/.test(t) ? 'after'
    : /shares your initiative/.test(t) ? 'shared'
      : /(?:rolls?|has) (?:its|their) own initiative|own initiative/.test(t) ? 'own' : null;
  const command = /no action required by you/.test(t) ? 'free'
    : /bonus action to command|(?:take a|as a) bonus action[^.]*(?:command|order|activate)/.test(t) ? 'bonus'
      : /take an action to command|magic action[^.]*command|use your action to command/.test(t) ? 'action' : null;
  return { order, command };
}

/** O texto da regra de turno ("Acts after you · commands are free"). */
export function turnText(turn) {
  if (!turn) return '';
  const order = { after: 'Acts right after you', shared: 'Shares your initiative', own: 'Rolls its own initiative' }[turn.order] ?? '';
  const command = { free: 'commands are free', bonus: 'Bonus Action to command', action: 'Magic action to command' }[turn.command] ?? '';
  const text = [order, command].filter(Boolean).join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ATENÇÃO: só com a feature que INVOCA o companheiro (a prosa da subclasse); o bloco vem do bestiário pelo nome.
const CLASS_SUMMONS = {
  'steel defender': ['Steel Defender'],
  'primal companion': ['Beast of the Land', 'Beast of the Sea', 'Beast of the Sky'],
  'summon wildfire spirit': ['Wildfire Spirit'],
  'drake companion': ['Drake Companion'],
  'hound of ill omen': ['Hound of Ill Omen'],
  'animating performance': ['Dancing Item'],
  'reanimated companion': ['Reanimated Companion'],
  'eldritch cannon': ['Eldritch Cannon', 'Eldritch Cannon, Flamethrower', 'Eldritch Cannon, Force Ballista', 'Eldritch Cannon, Protector'],
};

/** Os blocos que uma feature de classe invoca (CLASS_SUMMONS): os do livro da feature, ou a edição mais nova de cada. */
export function featureSummons(bestiary, featureName, source = null) {
  const names = CLASS_SUMMONS[lc(featureName)] ?? [];
  const same = (bestiary ?? []).filter((m) => names.includes(m.name) && m.summonedByClass && source && lc(String(m.summonedByClass).split('|').pop()) === lc(source));
  if (same.length) return names.flatMap((n) => same.filter((m) => m.name === n));
  const order = ['xphb', 'efa', 'xge', 'tce', 'ftd', 'rhw'];
  return names.flatMap((n) => (bestiary ?? [])
    .filter((m) => m.name === n && m.summonedByClass)
    .sort((a, b) => (order.indexOf(lc(a.source)) + 99) % 99 - (order.indexOf(lc(b.source)) + 99) % 99)
    .slice(0, 1));
}

/** Uma feature invoca companheiro? (para o botão "Summon" da aba Features) */
export function isSummonFeature(featureName) {
  return !!CLASS_SUMMONS[lc(featureName)];
}

/** As formas do Find Familiar: as feras de ND 0 (o XPHB permite qualquer uma) e as formas especiais, uma por nome (a do XMM). */
export function familiarForms(bestiary, special = []) {
  const want = new Set(special.map(lc));
  const beasts = (bestiary ?? []).filter((m) => !m.summonedBySpell && !m.summonedByClass && (m.type?.type ?? m.type) === 'beast' && String(m.cr?.cr ?? m.cr) === '0');
  const extra = new Map();
  for (const m of bestiary ?? []) {
    const k = lc(m.name);
    if (want.has(k) && !m.summonedBySpell && (!extra.has(k) || m.source === 'XMM')) extra.set(k, m);
  }
  return [...new Set([...beasts, ...extra.values()])].sort((a, b) => a.name.localeCompare(b.name));
}

/** As formas especiais de familiar que as opções escolhidas dão, pelo texto ("one of the following special forms: Imp, ..."). */
export function familiarSpecialForms(options = []) {
  const out = [];
  for (const o of options) {
    const m = lcText(o?.entries).match(/special forms: ([^.]+)\./);
    if (m) out.push(...m[1].split(/, (?:or )?| or /).map((n) => n.replace(/[(].*$/, '').trim()).filter(Boolean));
  }
  return out;
}

// ATENÇÃO: só magia cuja prosa a deixa em campo ou a repete sem espaço nos turnos seguintes; uma emanação que só dura não entra.
const LIGHT_SUMMONS = new Set([
  'mage hand', 'dancing lights', 'spiritual weapon', 'flaming sphere', 'cloud of daggers', 'moonbeam',
  'call lightning', 'arcane eye', "bigby's hand", 'witch bolt', "mordenkainen's sword", "mordenkainen's faithful hound",
  'grasping vine', 'conjure fey', 'conjure animals', 'conjure celestial', 'conjure elemental', 'healing spirit',
  'heat metal', 'produce flame', 'sunbeam', 'eyebite', "melf's minute meteors", 'storm sphere', 'wall of light',
  'enervation', 'transfix', 'eye beam', 'rain of fire', 'holy star of mystra', "songal's elemental suffusion",
  'draconic transformation', "fizban's platinum shield", 'conjure constructs',
]);

export const LIGHT_REPEATS = {
  'storm sphere': { dice: '4d6', type: 'lightning', attack: true, upcast: { from: 4, dice: '1d6' } },
  'wall of light': { dice: '4d8', type: 'radiant', attack: true, upcast: { from: 5, dice: '1d8' } },
};

/** O dado do "again" no círculo gravado: "4d6" mais "1d6" por círculo acima do 4 dá "5d6" no 5. */
export function repeatDice(repeat, level) {
  const up = repeat?.upcast;
  if (!up || !(level > up.from)) return repeat?.dice ?? null;
  const [n, d] = repeat.dice.split('d').map(Number);
  const [un, ud] = up.dice.split('d').map(Number);
  return ud === d ? `${n + un * (level - up.from)}d${d}` : `${repeat.dice} + ${un * (level - up.from)}d${ud}`;
}

/** A magia vira instância leve (LIGHT_SUMMONS)? */
export function isLightSummon(spell) {
  return LIGHT_SUMMONS.has(lc(spell?.name));
}

/**
 * O que a prosa da instância leve diz: como recebe ordem, a CA e os PV.
 * @returns {{ command: 'bonus'|'action'|'free'|null, ac: number|null, hp: 'casterMax'|null, replaces: boolean }}
 */
export function lightRulesOf(entries) {
  const t = lcText(entries);
  const command = /(?:as a|take a|use a) bonus action[^.]*(?:move|teleport|repeat|cause|deal|unleash|exhale|expend)/.test(t) ? 'bonus'
    : /(?:magic action|(?:use|take) an action)[^.]*(?:move|teleport|control|call|hurl|create|target|unleash|command|launch)/.test(t) ? 'action'
      : /when you move on your turn, you can also move/.test(t) ? 'free' : null;
  const ac = t.match(/\bhas ac ([0-9]+)/)?.[1];
  const repeat = t.match(/take a bonus action to deal ([0-9]+d[0-9]+) ([a-z]+) damage to the target automatically/);
  return {
    command,
    ac: ac ? Number(ac) : null,
    hp: /hit points equal to your hit points maximum/.test(t) ? 'casterMax' : null,
    replaces: /if you cast (?:this spell|it) again/.test(t),
    moves: /(?:bonus action|magic action|an action)[^.]*(?:move|teleport|control)/.test(t),
    ...(repeat ? { repeat: { dice: repeat[1], type: repeat[2] } } : {}),
  };
}

/** As operações de pôr uma instância leve (a magia sem bloco), e as de tirar a anterior quando a prosa manda. */
export function lightOps({ state, spell, level, origin, catalog, rules, casterHpMax = null }) {
  const old = rules.replaces ? (state?.summons ?? []).filter((g) => g.light && g.spell?.name === spell.name).map((g) => ({ op: 'summon', remove: g.id })) : [];
  const [add] = summonOps({ state, creature: { name: spell.name, source: spell.source }, spell, level, origin, catalog, turn: { order: null, command: rules.command } });
  add.add.ref = null;
  const curated = LIGHT_REPEATS[lc(spell.name)];
  const repeat = rules.repeat ?? (curated ? { dice: repeatDice(curated, level), type: curated.type, attack: !!curated.attack } : null);
  add.add.light = { ac: rules.ac, hp: rules.hp === 'casterMax' ? casterHpMax : null, ...(rules.moves ? { moves: true } : {}), ...(repeat ? { repeat } : {}) };
  if (add.add.light.hp == null) add.add.members = [];
  return [...old, add];
}

/** O grupo é o familiar do Find Familiar (pelo Pact of the Chain, do Legion ou a magia)? */
function isFamiliar(group) {
  return lc(group?.spell?.name) === 'find familiar' || /^pact of the (chain|legion)$/.test(lc(group?.feature));
}

/**
 * O que as invocações do bruxo mudam no familiar (TC-0166): o ataque e a CD do invocador, e as notas.
 * @returns {{ attack: number|null, dc: number|null, notes: string[] }}
 */
export function familiarBoons(group, features = []) {
  const has = (n) => features.includes(n);
  const out = { attack: null, dc: null, notes: [] };
  if (!isFamiliar(group)) return out;
  const ctx = group.ctx ?? {};
  if (has('investment of the chain master')) {
    out.dc = ctx.spellDc ?? null;
    out.notes.push('Investment of the Chain Master: Fly or Swim Speed 40 ft (your choice); a Bonus Action commands its Attack action; its Bludgeoning, Piercing or Slashing damage can be Necrotic or Radiant; your Reaction gives it Resistance to a damage it takes');
  }
  if (has('call of the void')) {
    out.attack = ctx.spellAttack ?? null;
    out.notes.push('Call of the Void: it uses your spell attack bonus; a Bonus Action commands its Attack action; your Reaction gives a Voidwalker Resistance to a damage it takes');
  }
  if (has('gift of the ever-living ones')) out.notes.push('Gift of the Ever-Living Ones: while it is within 100 feet, turn on the effect on your Features tab and your healing dice count as their maximum');
  if (has('elemental familiar')) out.notes.push('Elemental Familiar: choose Acid, Cold, Fire, Lightning or Thunder when you cast Find Familiar; its benefits follow that type until you cast it again');
  if (has('otherworldly familiar')) out.notes.push('Otherworldly Familiar: choose Necrotic, Poison, Psychic, Radiant or Thunder for its Resistance; the benefits last until you cast Find Familiar again');
  if (has('voice of the chain master')) out.notes.push('Voice of the Chain Master: telepathy and its senses on the same plane; you can speak through it');
  return out;
}

/** As ações do bloco com o ataque e a CD que as invocações dão ao familiar. */
function withBoons(stats, boons) {
  if (!stats || (boons.attack == null && boons.dc == null)) return stats;
  const fix = (a) => ({
    ...a,
    ...(a.attack && boons.attack != null ? { attack: { ...a.attack, bonus: boons.attack } } : {}),
    ...(a.save && boons.dc != null ? { save: { ...a.save, dc: boons.dc } } : {}),
  });
  return { ...stats, actions: stats.actions.map(fix), bonus: stats.bonus.map(fix), reactions: stats.reactions.map(fix) };
}

/** A criatura resolvida e os PV de cada membro; `features` são as do invocador (as invocações do familiar). */
export function summonGroupView(group, block, features = []) {
  const member = (base) => (m, index) => {
    const max = base == null ? null : Math.max(0, base + (m.maxDelta ?? 0));
    const out = { index, max, current: max == null ? null : Math.min(max, Math.max(0, max - (m.damage ?? 0))), conditions: m.conditions ?? [] };
    if (m.temp) out.temp = m.temp;
    return out;
  };
  if (group.light) {
    const base = group.light.hp ?? null;
    const members = base == null ? [] : (group.members ?? []).map(member(base));
    return { group, stats: null, members, light: group.light };
  }
  const boons = familiarBoons(group, features);
  const stats = withBoons(block ? creatureStats(block, group.ctx ?? {}) : null, boons);
  const members = (group.members ?? []).map(member(stats?.hp?.value ?? null));
  return { group, stats, members, ...(boons.notes.length ? { notes: boons.notes } : {}) };
}

/**
 * O evento dos painéis de PV num membro: `heal`, `temp`, `max` ou `hurt`.
 * @param {{ group: object, member: { index: number, max: number|null, current: number|null, temp?: number }, kind: string, amount: number, replace?: boolean, affectMax?: boolean }} opts
 */
export function summonVitalsEvent({ group, member, kind, amount, replace = false, affectMax = false }, now = new Date()) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  const raw = Math.max(0, Number(group.members?.[member.index]?.damage) || 0);
  const temp = member.temp ?? 0;
  const max = member.max;
  const cur = member.current ?? 0;
  const who = `${group.label}${(group.members?.length ?? 1) > 1 ? ` #${member.index + 1}` : ''}`;
  const op = { op: 'summon', id: group.id, member: member.index };
  let label;
  let payload = { summon: group.label, member: member.index, kind, amount: n };
  if (kind === 'temp') {
    const next = replace ? n : Math.max(temp, n);
    op.temp = next - temp;
    label = `${who}: ${next} temporary HP`;
    payload = { ...payload, tempFrom: temp, tempTo: next, kept: next === temp && n !== next };
  } else if (kind === 'max') {
    op.max = n;
    label = `${who}: hit point maximum +${n}`;
    payload = { ...payload, maxFrom: max, maxTo: max == null ? null : max + n };
  } else if (kind === 'heal') {
    const to = max == null ? cur : Math.min(max, cur + n);
    op.damage = max == null ? -Math.min(n, raw) : (max - to) - raw;
    label = `${who}: ${n} healed`;
    payload = { ...payload, from: max == null ? null : cur, to: max == null ? null : to };
  } else {
    const toTemp = Math.min(temp, n);
    const rest = n - toTemp;
    if (toTemp) op.temp = -toTemp;
    if (max == null) op.damage = rest;
    else {
      const cut = affectMax ? Math.min(max, rest) : 0;
      const newMax = max - cut;
      const to = Math.min(cur - Math.min(rest, cur), newMax);
      op.damage = (newMax - to) - raw;
      if (cut) op.max = -cut;
      payload = { ...payload, from: cur, to, toTemp, maxCut: cut || null, maxTo: cut ? newMax : null };
    }
    label = `${who}: ${n} damage`;
  }
  return makeEvent('summon', { label, ops: [op], payload }, now);
}

/** O evento de dispensar o grupo. */
export function dismissEvent(group, now = new Date()) {
  return makeEvent('summon', {
    label: `${group.label} dismissed`,
    ops: [{ op: 'summon', remove: group.id }],
    payload: { summon: group.label, dismissed: true },
  }, now);
}

/** Uma ação do summon no formato de ataque do play mode (rollAttackEvent, rollDamageEvent). */
export function summonAttack(group, action, stats) {
  const dice = action.damage.map((d) => d.formula).filter(Boolean);
  return {
    key: `summon:${group.id}:${action.name}`,
    kind: 'summon',
    name: `${stats?.name ?? group.label}: ${action.name}`,
    attack: action.attack ? { bonus: action.attack.bonus ?? 0 } : null,
    save: action.save ?? null,
    damage: dice.length ? { dice: dice.join(' + '), bonus: 0, types: [...new Set(action.damage.map((d) => d.type).filter(Boolean))] } : null,
    versatile: null,
  };
}

/** Os extras do invocador no dano de um summon (Master Demonologist: o Hex num diabo que você comanda). */
export function summonRiders(view, catalog, state, action = null) {
  const features = catalog?.features ?? [];
  const out = [];
  if (features.includes('master demonologist') && lc(view?.stats?.type) === 'fiend') {
    const hex = lc(state?.concentration?.name) === 'hex';
    out.push({ id: 'rider:master-demonologist', label: 'Master Demonologist (Hex)', source: 'Master Demonologist', part: { label: 'Hex', formula: '1d6' }, note: 'only against the target of your Hex; Necrotic', defaultOn: hex });
  }
  if (features.includes('bond of fang and scale') && lc(view?.group?.feature) === 'drake companion' && (!action || /bite/i.test(action.name))) {
    out.push({ id: 'rider:magic-fang', label: 'Magic Fang (Bond of Fang and Scale)', source: 'Bond of Fang and Scale', part: { label: 'Magic Fang', formula: '1d6' }, note: 'the Bite; the type of its Draconic Essence', defaultOn: true });
  }
  return out;
}
