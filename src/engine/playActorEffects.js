// =============================================================================
// playActorEffects: a ponte dos Active Effects do ator para as rolagens do jogo
// =============================================================================
// O QUE FAZ
//   A camada G1 da Fase P (docs/PLAY-MODE-CERT-PLAN.md, DDL-0211). O ator que o export
//   monta já carrega a mecânica de muitas features em Active Effects legíveis: o Danger
//   Sense é `system.abilities.dex.save.roll.mode` +1, o Luck do Halfling é
//   `flags.dnd5e.halflingLucky`, a Aura of Protection é `system.bonuses.abilities.save`.
//   Este módulo lê os efeitos LIGADOS e transferidos dos itens de feature (`feat`) e os
//   traduz, por uma lista FECHADA de chaves, em extras do diálogo da rolagem: vantagem
//   ou desvantagem, uma parte somada, o reroll do 1 no d20 e os 3d20 da Elven Accuracy.
//
// FUNÇÕES
//   targetOf(key): o alvo de uma chave da lista fechada, ou null.
//   formulaOf(value): o valor do efeito como fórmula (sem o "+" da frente).
//   actorRollEffects(actor): os efeitos do ator que valem no jogo, um por chave útil.
//   fitsRoll(effect, roll): o efeito vale para esta rolagem?
//   bridgedEffects(state, catalog, roll, conditionIds): os extras, no formato de rollEffects.
//   norm(s), slug(s): o nome comparável e o pedaço do id do extra.
//
// DECISÕES E ARMADILHAS
//   - LISTA FECHADA (`RULES`) contra contar duas vezes (§6.3): só entram chaves que a ficha
//     NÃO transforma em número. CA, deslocamento, sentidos, resistências e proficiências a
//     derivação já soma; o PB do Alert, `initiativeBonus` (engine/playCatalog); o crítico e
//     o Reliable Talent, os PASSIVES de engine/playEffects.
//   - O efeito DESLIGADO (Rage, Umbral Form, a forma Dragon do Starry Form) é interruptor
//     de quem usa a feature: segue no FEATURE_EFFECTS e no registro curado, nunca aqui.
//   - Feature com entrada no FEATURE_ROLLS (Dread Ambusher, Radiant Strikes) fica com o
//     registro: o efeito do ator dela é ignorado. Menos a entrada `use` (uma cura, um gasto), que não cobre
//     rolagem de d20: o efeito do ator vale, salvo no tipo de rolagem que a entrada toca (`on`). O Hungering
//     Might tem `use` para a cura e o "+SAB na salvaguarda de CON" sumia do jogo (oráculo `numbers`, DDL-0277).
//   - `CONDITIONAL` nomeia, pelo texto, o que o efeito do ator traz ligado mas o livro
//     condiciona: Frost Rune (só com a runa invocada), Transmuter's Stone (só o benefício
//     escolhido para a pedra), Skulker (vantagem em Stealth só ao se esconder), Dueling (uma
//     arma corpo a corpo numa mão; nunca no Unarmed Strike, que não é arma: DDL-0246). Esses aparecem DESLIGADOS, com a condição na nota
//     (liberdade com aviso, §6.4). `when: 'form'` liga só na forma do Wild Shape (Improved
//     Circle Forms); `unless` desliga com a condição presente (Danger Sense e Incapacitated). O efeito de
//     uma entrada com `when` é lido mesmo DESLIGADO: o export o desliga no Foundry (INVOKED_EFFECTS em
//     engine/foundryItems, DDL-0277) e o jogo o liga só na condição.
//   - O valor vem como o Foundry escreve ("+2", "@abilities.cha.mod", "(max(1,@abilities.wis.mod))")
//     e é resolvido pelo rollData do catálogo na hora da rolagem; o "+" da frente sai, e
//     `@attributes.prof` (Hare-Trigger) vira o `@prof` do rollData.
//   - `system.bonuses.abilities.save` vale também no teste de morte e na concentração (os
//     dois são salvaguardas); `...check` vale na iniciativa (um teste de DES).
// -----------------------------------------------------------------------------

import { featureRollOf } from './playFeatureRolls';

const D20 = ['attack', 'check', 'save', 'initiative', 'deathSave', 'concentration'];
const ATTACK_KEYS = { mwak: { weapon: true, melee: true }, rwak: { weapon: true, melee: false }, msak: { spell: true, melee: true }, rsak: { spell: true, melee: false } };

const RULES = [
  [/^system\.abilities\.(str|dex|con|int|wis|cha)\.save\.roll\.mode$/, (m) => ({ kinds: m[1] === 'con' ? ['save', 'concentration'] : ['save'], ability: m[1], mode: true })],
  [/^system\.abilities\.(str|dex|con|int|wis|cha)\.check\.roll\.mode$/, (m) => ({ kinds: m[1] === 'dex' ? ['check', 'initiative'] : ['check'], ability: m[1], mode: true })],
  [/^system\.skills\.(\w{3})\.roll\.mode$/, (m) => ({ kinds: ['check'], skill: m[1], mode: true })],
  [/^system\.attributes\.init\.roll\.mode$|^flags\.dnd5e\.initiativeAdv$/, () => ({ kinds: ['initiative'], mode: true })],
  [/^system\.attributes\.death\.roll\.mode$/, () => ({ kinds: ['deathSave'], mode: true })],
  [/^system\.attributes\.concentration\.roll\.mode$/, () => ({ kinds: ['concentration'], mode: true })],
  [/^system\.bonuses\.abilities\.save$/, () => ({ kinds: ['save', 'deathSave', 'concentration'] })],
  [/^system\.bonuses\.abilities\.check$/, () => ({ kinds: ['check', 'initiative'] })],
  [/^system\.abilities\.(str|dex|con|int|wis|cha)\.bonuses\.save$/, (m) => ({ kinds: m[1] === 'con' ? ['save', 'concentration'] : ['save'], ability: m[1] })],
  [/^system\.abilities\.(str|dex|con|int|wis|cha)\.bonuses\.check$/, (m) => ({ kinds: m[1] === 'dex' ? ['check', 'initiative'] : ['check'], ability: m[1] })],
  [/^system\.skills\.(\w{3})\.bonuses\.check$/, (m) => ({ kinds: ['check'], skill: m[1] })],
  [/^system\.attributes\.init\.(?:bonus|total)$/, () => ({ kinds: ['initiative'] })],
  [/^system\.bonuses\.(mwak|rwak|msak|rsak)\.(attack|damage)$/, (m) => ({ kinds: [m[2]], ...ATTACK_KEYS[m[1]] })],
  [/^flags\.dnd5e\.halflingLucky$/, () => ({ kinds: D20, rerollOnes: true })],
  [/^flags\.dnd5e\.elvenAccuracy$/, () => ({ kinds: ['attack'], elven: true })],
];

const CONDITIONAL = {
  'frost rune': { note: 'only while the rune is invoked (10 minutes)' },
  "transmuter's stone": { note: 'only with the benefit you chose for the stone' },
  skulker: { note: 'Stealth checks made as part of the Hide action' },
  dueling: { note: 'a Melee weapon in one hand and no other weapon', oneHanded: true, defaultOn: true },
  'improved circle forms': { when: 'form' },
  'danger sense': { unless: 'incapacitated', note: 'not while Incapacitated', defaultOn: true },
};

const norm = (s) => String(s ?? '').trim().toLowerCase();
const slug = (s) => norm(s).replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** O alvo de uma chave da lista fechada, ou null. */
export function targetOf(key) {
  for (const [re, fn] of RULES) {
    const m = String(key ?? '').match(re);
    if (m) return fn(m);
  }
  return null;
}

/** O valor do efeito como fórmula, sem o "+" da frente. */
export function formulaOf(value) {
  return String(value ?? '').trim().replace(/^\+\s*/, '').replace(/@attributes\.prof/g, '@prof');
}

/** Os efeitos do ator que valem no jogo: ligados, transferidos, de feature, pela lista fechada. */
export function actorRollEffects(actor) {
  const out = [];
  const seen = new Set();
  for (const item of actor?.items ?? []) {
    if (item.type !== 'feat') continue;
    const rule = featureRollOf(item.name);
    const covered = new Set([...(rule?.on ?? []), ...(rule?.also ?? []).flatMap((a) => a.on ?? [])]);
    if (rule && rule.kind !== 'use') continue;
    for (const effect of item.effects ?? []) {
      if ((effect.disabled && !CONDITIONAL[norm(item.name)]?.when) || effect.transfer === false || effect.type === 'enchantment') continue;
      for (const change of effect.changes ?? []) {
        const target = targetOf(change.key);
        if (!target || target.kinds.some((k) => covered.has(k))) continue;
        const sig = `${norm(item.name)}|${change.key}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        const entry = { name: item.name, key: change.key, ...target };
        if (target.mode) {
          const v = change.value === true || change.value === 'true' ? 1 : Number(change.value);
          if (!v) continue;
          entry.mode = v > 0 ? 'adv' : 'dis';
        } else if (!target.rerollOnes && !target.elven) {
          entry.formula = formulaOf(change.value);
          if (!entry.formula) continue;
        }
        out.push(entry);
      }
    }
  }
  return out;
}

/** O efeito vale para esta rolagem? */
export function fitsRoll(e, roll) {
  if (!e.kinds.includes(roll.kind)) return false;
  if (e.ability && roll.kind !== 'concentration' && !(roll.kind === 'initiative' && e.ability === 'dex') && roll.ability !== e.ability) return false;
  if (e.skill && roll.skill !== e.skill) return false;
  if (e.elven && !['dex', 'int', 'wis', 'cha'].includes(roll.attackAbility)) return false;
  if (e.weapon && (!roll.weapon || roll.spell)) return false;
  if (e.spell && !roll.spell) return false;
  if (e.melee != null && (roll.melee !== false) !== e.melee) return false;
  return true;
}

/** Os extras da ponte que valem para uma rolagem, no formato de rollEffects. */
export function bridgedEffects(state, catalog, roll, conditionIds = []) {
  const out = [];
  for (const e of catalog.actorEffects ?? []) {
    if (!fitsRoll(e, roll)) continue;
    const c = CONDITIONAL[norm(e.name)] ?? {};
    if (c.oneHanded && (roll.twoHanded || roll.unarmed)) continue;
    const grip = c.oneHanded && (roll.hands === 'versatile' || roll.hands === 'mounted') ? 'one' : null;
    let on = c.defaultOn ?? !c.note;
    if (c.when === 'form') on = !!state.form;
    if (c.unless && conditionIds.includes(c.unless)) on = false;
    const label = e.mode === 'dis' ? `${e.name} (disadvantage)` : e.rerollOnes ? `${e.name} (reroll a 1)` : e.elven ? `${e.name} (3d20 with Advantage)` : e.name;
    const entry = { id: `actor:${slug(e.name)}:${slug(e.key)}`, label, source: e.name, defaultOn: on, ...(c.note ? { note: c.note } : {}), ...(grip ? { grip } : {}) };
    if (e.mode === 'adv') entry.adv = 1;
    else if (e.mode === 'dis') entry.dis = 1;
    else if (e.rerollOnes) entry.rerollOnes = true;
    else if (e.elven) entry.elven = true;
    else entry.part = { label: e.name, formula: e.formula };
    out.push(entry);
  }
  return out;
}
