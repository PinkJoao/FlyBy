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
//   familiarForms(bestiary): as feras de ND 0 do Find Familiar.
//   isLightSummon(spell), lightRulesOf(entries), lightOps(opts): a instância leve
//     (S4, DDL-0194): a magia sem bloco que fica em campo (LIGHT_SUMMONS).
//   lcText(entries): a prosa em minúsculas, sem as marcas do 5etools.
//   summonContext(catalog, origin, opts): o contexto do invocador, congelado.
//   summonOps({ state, creature, spell, level, variant, count, origin, catalog }):
//     as operações de invocar (e as que tiram os summons da concentração anterior).
//   summonGroupView(group, block): a criatura resolvida e os PV de cada membro.
//   summonHpEvent(group, member, delta), dismissEvent(group): os eventos do card.
//   summonAttack(group, action, stats): uma ação no formato de ataque do play mode.
//
// DECISÕES E ARMADILHAS
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
//   - Grupos iguais (S3 do dono): `count` membros num grupo só, cada um com o seu PV.
//   - S4 (DDL-0194): a instância leve é um grupo com `light` e sem `ref`. LIGHT_SUMMONS
//     só diz QUAIS magias (prova na prosa de cada uma); o resto vem do texto
//     (lightRulesOf): Ação Bônus ou ação Magic para mover e repetir, a CA ("has AC 20")
//     e os PV ("equal to your Hit Points maximum", congelados ao conjurar), e a troca
//     ao lançar de novo (Mage Hand). Sem PV, o grupo não tem membro. As rolagens são as
//     da magia no círculo gravado, sem gastar espaço.
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
      members: Array.from({ length: n }, () => ({ damage: 0, conditions: [] })),
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
  const command = { free: 'commands are free', bonus: 'Bonus Action to command', action: 'an action to command' }[turn.command] ?? '';
  return [order, command].filter(Boolean).join(' · ');
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

/** As formas do Find Familiar: as feras de ND 0 (o XPHB permite qualquer uma). */
export function familiarForms(bestiary) {
  return (bestiary ?? []).filter((m) => (m.type?.type ?? m.type) === 'beast' && String(m.cr?.cr ?? m.cr) === '0' && !m.summonedBySpell && !m.summonedByClass)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ATENÇÃO: só magia cuja prosa cria uma coisa que fica e que o jogador move ou repete; emanação em si mesmo não entra.
const LIGHT_SUMMONS = new Set([
  'mage hand', 'dancing lights', 'spiritual weapon', 'flaming sphere', 'cloud of daggers', 'moonbeam',
  'call lightning', 'arcane eye', "bigby's hand", "mordenkainen's sword", "mordenkainen's faithful hound",
  'grasping vine', 'conjure fey', 'conjure animals', 'conjure celestial', 'conjure elemental', 'healing spirit',
]);

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
  const command = /(?:as a|take a) bonus action[^.]*(?:move|teleport|repeat|cause)/.test(t) ? 'bonus'
    : /magic action[^.]*(?:move|teleport|control|call)/.test(t) ? 'action'
      : /when you move on your turn, you can also move/.test(t) ? 'free' : null;
  const ac = t.match(/\bhas ac ([0-9]+)/)?.[1];
  return {
    command,
    ac: ac ? Number(ac) : null,
    hp: /hit points equal to your hit points maximum/.test(t) ? 'casterMax' : null,
    replaces: /if you cast this spell again/.test(t),
  };
}

/** As operações de pôr uma instância leve (a magia sem bloco), e as de tirar a anterior quando a prosa manda. */
export function lightOps({ state, spell, level, origin, catalog, rules, casterHpMax = null }) {
  const old = rules.replaces ? (state?.summons ?? []).filter((g) => g.light && g.spell?.name === spell.name).map((g) => ({ op: 'summon', remove: g.id })) : [];
  const [add] = summonOps({ state, creature: { name: spell.name, source: spell.source }, spell, level, origin, catalog, turn: { order: null, command: rules.command } });
  add.add.ref = null;
  add.add.light = { ac: rules.ac, hp: rules.hp === 'casterMax' ? casterHpMax : null };
  if (add.add.light.hp == null) add.add.members = [];
  return [...old, add];
}

/** A criatura resolvida e os PV de cada membro. */
export function summonGroupView(group, block) {
  if (group.light) {
    const max = group.light.hp ?? null;
    const members = max == null ? [] : (group.members ?? []).map((m, index) => ({ index, max, current: Math.max(0, max - (m.damage ?? 0)), conditions: m.conditions ?? [] }));
    return { group, stats: null, members, light: group.light };
  }
  const stats = block ? creatureStats(block, group.ctx ?? {}) : null;
  const max = stats?.hp?.value ?? null;
  const members = (group.members ?? []).map((m, index) => ({
    index,
    max,
    current: max == null ? null : Math.max(0, max - (m.damage ?? 0)),
    conditions: m.conditions ?? [],
  }));
  return { group, stats, members };
}

/** O evento de dano (delta > 0) ou cura (delta < 0) num membro. */
export function summonHpEvent(group, member, delta, now = new Date()) {
  const n = Math.round(Number(delta) || 0);
  return makeEvent('summon', {
    label: `${group.label}${(group.members?.length ?? 1) > 1 ? ` #${member + 1}` : ''}: ${n >= 0 ? `${n} damage` : `${-n} healed`}`,
    ops: [{ op: 'summon', id: group.id, member, damage: n }],
    payload: { summon: group.label, member, delta: n },
  }, now);
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
