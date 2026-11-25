// =============================================================================
// playRerolls: rolar de novo um teste já gravado, pela regra de uma feature
// =============================================================================
// O QUE FAZ
//   A parte "reroll" do G3 (docs/PLAY-MODE-CERT-PLAN.md, DDL-0214). Muitas features deixam
//   rolar de novo DEPOIS de ver o resultado: Disciplined Survivor (a salvaguarda que falhou,
//   1 Focus), Seeking Spell (o ataque de magia que errou, 1 Sorcery Point), Fanatical Focus
//   (a salvaguarda, uma vez por Rage, com o bônus da Rage), Draconic Presence, Unerring
//   Accuracy, Chronal Shift, Boon of Fortune's Favor. O card do teste e do ataque no
//   histórico ganha "Reroll": o jogador escolhe a regra, o app rola o mesmo teste de novo
//   (o mesmo d20 e as mesmas partes) e grava um evento NOVO, com o gasto da feature.
//
// FUNÇÕES
//   rollKindOf(event, catalog): o tipo da rolagem de um evento ('save', 'check', 'attack',
//     'initiative') e o que o filtro precisa (perícia, magia, arma), ou null.
//   rerollOptions(event, catalog, state): as regras que deixam rolar de novo esse evento,
//     com o gasto e o bônus, e a regra genérica ("Another rule") no fim.
//   rerollEvent(args): o evento da nova rolagem.
//   inspirationSpendOps(state, catalog): gastar a Heroic Inspiration (e o dado de vida do Troll Amani).
//   inspirationEvent(args): ligar (o mestre dá) ou gastar a Heroic Inspiration pelo interruptor.
//   rerollableDice(event): os dados de um dano ou de uma cura que se podem rolar de novo.
//   rerollDiceOptions(event, catalog, state): as regras que deixam rolar de novo ALGUNS
//     dados (Piercer, Empowered Spell, Empowered Healing, Flames of Phlegethos).
//   rerollDiceEvent(args): o evento novo com os dados escolhidos rolados de novo.
//
// DECISÕES E ARMADILHAS
//   - Heroic Inspiration (DDL-0275): "expend it to reroll any die immediately after rolling it, and you must use the
//     new roll". Com `state.inspiration`, o "Reroll" do card oferece "Heroic Inspiration", que a gasta. Desligar o
//     interruptor à mão também é gastar (o jogador a usou na mesa). Gastar devolve um dado de vida quando uma feature
//     diz "whenever you spend Heroic Inspiration, you regain 1 expended Hit Point Die" (Troll Lineage, Amani; lido
//     do texto, TC-0223): o de face maior que estiver gasto. O evento diz isso nos dois caminhos: `lines` no do
//     interruptor e `regained` no reroll (DDL-0276; na tela o dado voltava e o histórico não dizia).
//   - DICE_REROLLS (DDL-0215): rolar de novo ALGUNS dados do dano ou da cura, no card do
//     histórico ("Reroll dice"). Piercer, "reroll one of the attack's damage dice" (1 dado,
//     dano perfurante); Empowered Spell, "reroll a number of the damage dice up to your
//     Charisma modifier (minimum of one)", 1 Sorcery Point; Empowered Healing, "reroll any
//     number of those dice once", 1 Sorcery Point; Flames of Phlegethos, "reroll any roll of
//     1 on the fire damage dice" (os 1 já vêm marcados). Só o grupo que soma todos os dados
//     (sem kh/kl) e só o evento sem operações: a cura já aplicada em você não se refaz.
//   - REROLLS é o registro curado, pelo nome da feature, com a frase como prova:
//     Disciplined Survivor "whenever you make a saving throw and fail, you can expend 1
//     Focus Point to reroll it"; Seeking Spell "If you make an attack roll for a spell and
//     miss, you can spend 1 Sorcery Point to reroll the d20"; Fanatical Focus "Once per
//     active Rage, if you fail a saving throw, you can reroll it with a bonus equal to your
//     Rage Damage bonus"; Draconic Presence (Draconic Disciple, FTD) "If you fail a Charisma
//     (Intimidation) or Charisma (Persuasion) check, you can use your reaction to reroll";
//     Unerring Accuracy "If you miss with an attack roll using a monk weapon on your turn,
//     you can reroll it"; Chronal Shift "after you ... makes an attack roll, an ability
//     check, or a saving throw, you can force the creature to reroll", um uso do pool;
//     Boon of Fortune's Favor "When you fail a saving throw, you can reroll it".
//   - `keep` (DDL-0215) soma DEPOIS sem rolar de novo: Arcane Deflection, "When ... you fail
//     a saving throw, you can use your reaction to gain ... a +4 bonus to that saving throw".
//     O evento novo leva os mesmos dados e a parte a mais; o card diz "Raised by X".
//   - Só o teste (`check`, que inclui salvaguarda e iniciativa) e o ataque: são eventos sem
//     operações, e rolar de novo não desfaz nada. O teste de morte e o de concentração mudam
//     o estado, e ficam de fora.
//   - O evento NOVO guarda `payload.reroll` ({ of, source }); o antigo fica como estava, e o
//     desfazer tira só o novo. "Another rule" (o mestre, um aliado com Bountiful Luck) rola
//     sem gastar nada.
//   - O que a regra condiciona (a salvaguarda que FALHOU, o ataque que ERROU, uma vez por
//     turno) fica na nota: o app não sabe a CD nem a CA do alvo. Sem o que gastar, a opção
//     aparece com "(none left)" e pode ser escolhida assim mesmo (liberdade com aviso, §6.4).
//   - A nova rolagem usa os dados do app (os dados físicos não entram aqui) e o crítico no 20.
// -----------------------------------------------------------------------------

import { rollParts, cryptoRng } from './dice';
import { makeEvent, remainingOf } from './playState';
import { spendKeyOf } from './playFeatureRolls';
import { plainText } from './playFeatures';

const DICE_REROLLS = {
  piercer: { on: ['damageRoll'], type: 'piercing', max: () => 1, note: 'once per turn, an attack that deals Piercing damage; you must use the new roll' },
  'empowered spell': { on: ['damageRoll'], spell: true, spend: { item: 'Font of Magic' }, max: (rd) => Math.max(1, rd.abilities?.cha?.mod ?? 0), note: 'up to your Charisma modifier of the damage dice; you must use the new rolls' },
  'empowered healing': { on: ['healRoll'], spend: { item: 'Font of Magic' }, max: () => Infinity, note: 'any number of the healing dice, once per turn' },
  'flames of phlegethos': { on: ['damageRoll'], spell: true, type: 'fire', ones: true, max: () => Infinity, note: 'any 1 on the fire damage dice; you must use the new roll' },
};

/** Os dados que se podem rolar de novo num evento: os mantidos de grupos que somam tudo. */
export function rerollableDice(event) {
  const out = [];
  (event?.rolls?.parts ?? []).forEach((part, p) => {
    (part.groups ?? []).forEach((group, g) => {
      const live = (group.results ?? []).filter((r) => !r.rerolled);
      if (!group.faces || live.some((r) => !r.kept)) return;
      (group.results ?? []).forEach((r, i) => {
        if (r.kept && !r.rerolled) out.push({ id: `${p}.${g}.${i}`, part: p, group: g, result: i, faces: group.faces, value: r.value });
      });
    });
  });
  return out;
}

/**
 * As regras que deixam rolar de novo alguns dados do dano ou da cura, e "Another rule".
 * @returns {{ id: string, label: string, note?: string, max: number, ones: boolean, spendKey: string|null, left: number|null }[]}
 */
export function rerollDiceOptions(event, catalog, state) {
  if (!event || !['damageRoll', 'healRoll'].includes(event.kind) || (event.ops ?? []).length || !rerollableDice(event).length) return [];
  const key = String(event.payload?.attackKey ?? '');
  const attack = (catalog.attacks ?? []).find((a) => a.key === key);
  const spell = key.startsWith('spell:') || attack?.kind === 'spell' || attack?.kind === 'cantrip' || event.kind === 'healRoll';
  const types = (event.payload?.types ?? []).map((t) => String(t).toLowerCase());
  const features = new Set(catalog.features ?? []);
  const rd = catalog.rollData ?? {};
  const out = [];
  for (const [name, r] of Object.entries(DICE_REROLLS)) {
    if (!features.has(name) || !r.on.includes(event.kind) || (r.spell && !spell) || (r.type && types.length && !types.includes(r.type))) continue;
    const spendKey = spendKeyOf(catalog, r.spend);
    const max = spendKey ? (catalog.resources ?? []).find((x) => x.key === spendKey)?.max ?? 0 : 0;
    out.push({
      id: name,
      label: name.replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()),
      note: r.note,
      max: r.max(rd),
      ones: !!r.ones,
      spendKey,
      left: spendKey ? remainingOf(state ?? { spent: {} }, spendKey, max) : null,
    });
  }
  out.push({ id: 'rule', label: 'Another rule', note: 'the DM or a rule the app does not know; nothing is spent', max: Infinity, ones: false, spendKey: null, left: null });
  return out;
}

/**
 * O evento novo com os dados escolhidos rolados de novo (o antigo riscado, o novo valendo).
 * @param {{ event: object, catalog: object, option: object, picks: string[], rng?: Function, now?: Date }} args
 */
export function rerollDiceEvent({ event, catalog, option, picks, rng = cryptoRng, now = new Date() }) {
  const chosen = new Set(picks ?? []);
  const parts = (event.rolls?.parts ?? []).map((part, p) => {
    let partDelta = 0;
    const groups = (part.groups ?? []).map((group, g) => {
      let delta = 0;
      const results = [];
      (group.results ?? []).forEach((r, i) => {
        if (!chosen.has(`${p}.${g}.${i}`)) return results.push(r);
        const value = rng(group.faces);
        delta += value - r.value;
        results.push({ ...r, kept: false, rerolled: true }, { value, kept: true });
      });
      partDelta += delta;
      return delta || results.length !== (group.results ?? []).length ? { ...group, results, total: group.total + delta } : group;
    });
    return { ...part, groups, total: part.total + partDelta };
  });
  const total = parts.reduce((s, x) => s + x.total, 0);
  const ops = option?.spendKey ? [{ op: 'spend', key: option.spendKey, amount: 1 }] : [];
  const spent = option?.spendKey ? [{ name: (catalog.resources ?? []).find((r) => r.key === option.spendKey)?.name ?? option.spendKey, amount: 1 }] : [];
  const payload = { ...event.payload, reroll: { of: event.id, source: option?.label ?? 'Another rule', dice: chosen.size } };
  delete payload.spent;
  return makeEvent(event.kind, { label: `${event.label} (reroll)`, payload: { ...payload, ...(spent.length ? { spent } : {}) }, rolls: { ...event.rolls, total, parts }, ops }, now);
}

const REROLLS = {
  'disciplined survivor': { on: ['save'], spend: { item: "Monk's Focus" }, note: 'a saving throw you failed; you must use the new roll' },
  'seeking spell': { on: ['attack'], spell: true, spend: { item: 'Font of Magic' }, note: 'a spell attack that missed; you must use the new roll' },
  'fanatical focus': { on: ['save'], needsRage: true, bonus: '@scale.barbarian.rage-damage', note: 'a saving throw you failed, once per active Rage; plus your Rage Damage bonus' },
  'draconic disciple': { on: ['check'], skills: ['itm', 'per'], label: 'Draconic Presence', note: 'a failed Intimidation or Persuasion check; your Reaction; once per Long Rest when it succeeds' },
  'unerring accuracy': { on: ['attack'], weapon: true, note: 'a monk weapon attack that missed, on your turn; once per turn' },
  'chronal shift': { on: ['attack', 'check', 'save'], spend: { item: 'Chronal Shift' }, note: 'your Reaction, after you see the roll' },
  "boon of fortune's favor": { on: ['save'], note: "a saving throw you failed; not again until the start of your next turn" },
  'arcane deflection': { on: ['save'], keep: true, bonus: '4', label: 'Arcane Deflection (+4, same roll)', note: 'your Reaction after you fail; only cantrips until the end of your next turn; +2 AC against a hit instead' },
};

/** Os nomes das features do registro (o levantamento as conta como `use`). */
export const REROLL_FEATURES = [...Object.keys(REROLLS), ...Object.keys(DICE_REROLLS)];

/** O tipo da rolagem de um evento e o que o filtro precisa, ou null. */
export function rollKindOf(event, catalog) {
  if (event?.kind === 'attack') {
    const attack = (catalog.attacks ?? []).find((a) => a.key === event.payload?.attackKey);
    return { kind: 'attack', spell: attack ? attack.kind === 'spell' || attack.kind === 'cantrip' : false, weapon: attack ? attack.kind === 'weapon' || attack.kind === 'unarmed' : false };
  }
  if (event?.kind !== 'check' || !event.rolls) return null;
  const test = event.payload?.test ?? {};
  if (test.type === 'save') return { kind: 'save', ability: test.id };
  if (test.type === 'initiative') return { kind: 'initiative' };
  return { kind: 'check', skill: test.type === 'skill' ? test.id : null };
}

/**
 * As regras que deixam rolar de novo esse evento, e "Another rule" no fim.
 * @returns {{ id: string, label: string, note?: string, spendKey: string|null, left: number|null, bonus: string|null }[]}
 */
export function rerollOptions(event, catalog, state) {
  const roll = rollKindOf(event, catalog);
  if (!roll) return [];
  const features = new Set(catalog.features ?? []);
  const raging = (state?.modifiers ?? []).some((m) => m.label === 'Rage');
  const out = [];
  for (const [name, r] of Object.entries(REROLLS)) {
    if (!features.has(name) || !r.on.includes(roll.kind)) continue;
    if ((r.spell && !roll.spell) || (r.weapon && !roll.weapon) || (r.skills && !r.skills.includes(roll.skill)) || (r.needsRage && !raging)) continue;
    const spendKey = spendKeyOf(catalog, r.spend);
    const max = spendKey ? (catalog.resources ?? []).find((x) => x.key === spendKey)?.max ?? 0 : 0;
    const left = spendKey ? remainingOf(state ?? { spent: {} }, spendKey, max) : null;
    const label = r.label ?? name.replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());
    out.push({ id: name, label, note: r.note, spendKey, left, bonus: r.bonus ?? null, ...(r.keep ? { keep: true } : {}), ...(r.spend && !spendKey ? { missing: true } : {}) });
  }
  if (state?.inspiration) out.push({ id: 'heroic-inspiration', label: 'Heroic Inspiration', note: 'you must use the new roll', spendKey: null, left: null, bonus: null, ops: inspirationSpendOps(state, catalog) });
  out.push({ id: 'rule', label: 'Another rule', note: 'the DM, an ally, or a rule the app does not know; nothing is spent', spendKey: null, left: null, bonus: null });
  return out;
}

const INSPIRATION_HIT_DIE = /whenever you spend heroic inspiration, you regain 1 expended hit (?:point )?di/i;

/** Gastar a Heroic Inspiration: a operação e o dado de vida que uma feature devolve junto. */
export function inspirationSpendOps(state, catalog) {
  const ops = [{ op: 'inspiration', value: false }];
  const gives = (catalog?.featureList ?? []).some((f) => INSPIRATION_HIT_DIE.test(plainText(f.entries ?? [])));
  if (!gives) return ops;
  const die = (catalog.resources ?? []).filter((r) => r.kind === 'hitDice' && (state?.spent?.[r.key] ?? 0) > 0).sort((a, b) => (b.faces ?? 0) - (a.faces ?? 0))[0];
  if (die) ops.push({ op: 'restore', key: die.key, amount: 1 });
  return ops;
}

/** Liga (o mestre dá) ou gasta a Heroic Inspiration pelo interruptor. */
export function inspirationEvent({ state, catalog, value, now = new Date() }) {
  const ops = value ? [{ op: 'inspiration', value: true }] : inspirationSpendOps(state, catalog);
  const back = ops.some((o) => o.op === 'restore');
  return makeEvent('modifier', { label: value ? 'Heroic Inspiration gained' : 'Heroic Inspiration spent', ops, payload: { lines: back ? ['1 Hit Point Die regained'] : [] } }, now);
}

/**
 * O evento da nova rolagem: o mesmo d20 e as mesmas partes, mais o bônus da regra.
 * @param {{ event: object, catalog: object, option: object, rng?: Function, now?: Date }} args
 */
export function rerollEvent({ event, catalog, option, rng = cryptoRng, now = new Date() }) {
  let rolls;
  if (option?.keep) {
    const extra = rollParts([{ label: option.label, formula: option.bonus ?? '0' }], { data: catalog.rollData, rng });
    rolls = { ...event.rolls, total: (event.rolls?.total ?? 0) + extra.total, parts: [...(event.rolls?.parts ?? []), ...extra.parts] };
  } else {
    const parts = (event.rolls?.parts ?? []).map((p) => ({ label: p.label, formula: p.formula }));
    if (option?.bonus) parts.push({ label: option.label, formula: option.bonus });
    const rolled = rollParts(parts, { data: catalog.rollData, rng });
    const kept = rolled.parts[0]?.groups?.[0]?.results?.find((r) => r.kept);
    const natural = kept ? kept.raw ?? kept.value : null;
    rolls = { mode: event.rolls?.mode ?? 'normal', natural, isCritical: natural === 20, isFumble: natural === 1, total: rolled.total, parts: rolled.parts };
  }
  const ops = [...(option?.spendKey ? [{ op: 'spend', key: option.spendKey, amount: 1 }] : []), ...(option?.ops ?? [])];
  const payload = { ...event.payload, reroll: { of: event.id, source: option?.label ?? 'Another rule', ...(option?.keep ? { keep: true } : {}) }, ...(event.kind === 'attack' ? { critical: rolls.isCritical } : {}) };
  delete payload.spent;
  delete payload.regained;
  if (ops.some((o) => o.op === 'restore')) payload.regained = '1 Hit Point Die regained';
  const spent = option?.spendKey ? [{ name: (catalog.resources ?? []).find((r) => r.key === option.spendKey)?.name ?? option.spendKey, amount: 1 }] : [];
  return makeEvent(event.kind, { label: `${event.label} (${option?.keep ? 'raised' : 'reroll'})`, payload: { ...payload, ...(spent.length ? { spent } : {}) }, rolls, ops }, now);
}
