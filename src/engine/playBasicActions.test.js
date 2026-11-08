// =============================================================================
// playBasicActions.test: as ações básicas com os custos de cada personagem
// =============================================================================
// O QUE FAZ
//   Confere a lista da aba Actions sobre catálogos montados à mão: a ordem do
//   livro, o custo do livro, os custos que vêm de atividade com o nome da ação (o
//   Cunning Action), os do registro (monge, orc, talentos), a ação dupla do Focus,
//   o "Other" contextual e a disponibilidade no turno.
//
// FUNÇÕES
//   basic(name, type): uma ação básica como o catálogo traz.
//   catalogWith(extra, features): um catálogo com as 18 ações e as features dadas.
//   costsOf(list, name): os custos de uma ação como texto ("Bonus Action (Keen Mind)").
//   full(state): o contexto com tudo para fazer (escudo, poção, agarrado, concentrando).
//
// DECISÕES E ARMADILHAS
//   - Os nomes das atividades do monge e do orc são os do SRD 5.2 (medidos no ator
//     montado em 2026-11-05): "Patient Defense", "Patient Defense (Focus Point)",
//     "Step of the Wind".
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { MAIN_ACTIONS, OTHER_ACTIONS, actionContext, slotChoices, actionRelevant, altCostsFor, attackStepOp, attacksPerAction, basicActionList, costLabel, costOf, offhandAttack } from './playBasicActions';
import { featureModifier } from './playEffects';

const TYPES = { 'Opportunity Attack': 'reaction', 'Two-Weapon Fighting': 'bonus', 'End Concentration': 'special', 'Improvising an Action': 'special' };
const basic = (name, type = TYPES[name] ?? 'action') => ({ key: `action:${name.toLowerCase().replace(/ /g, '-')}`, name, group: 'basic', activities: [{ id: 'a', name, activation: { type } }] });
const sword = { key: 'weapon:s', kind: 'weapon', name: 'Shortsword', range: 'melee', equipped: true, properties: ['F', 'L'] };
const dagger = { ...sword, key: 'weapon:d', name: 'Dagger' };
const everything = { attacks: [sword, dagger], resources: [], spells: [{ key: 'class:wizard', spells: [{ name: 'Fire Bolt', level: 0, prepared: true, time: 'action' }] }], stats: { speed: 30 } };
const catalogWith = (extra = [], features = [], base = everything) => ({ ...base, actions: [...[...MAIN_ACTIONS, ...OTHER_ACTIONS].map((n) => basic(n)), ...extra], features });
const full = (state = {}) => ({ ...actionContext(catalogWith(), state, [{ raw: { name: 'Shield', type: 'S|XPHB' } }, { raw: { name: 'Potion of Healing', type: 'P|XPHB' } }]), grappled: true, concentrating: true });
const cunning = { key: 'action:cunning-action', name: 'Cunning Action', group: 'class', activities: ['Dash', 'Disengage', 'Hide'].map((n) => ({ id: n.toLowerCase(), name: n, activation: { type: 'bonus' }, consumes: [] })) };
const monkFocus = {
  key: 'action:monks-focus',
  name: "Monk's Focus",
  group: 'class',
  activities: [
    { id: 'pd', name: 'Patient Defense', activation: { type: 'bonus' }, consumes: [] },
    { id: 'pdf', name: 'Patient Defense (Focus Point)', activation: { type: 'bonus' }, consumes: [{ target: 'pool:monks-focus' }] },
    { id: 'sw', name: 'Step of the Wind', activation: { type: 'bonus' }, consumes: [{ target: 'pool:monks-focus' }] },
  ],
};
const costsOf = (list, name) => list.find((a) => a.name === name).costs.map((c) => `${c.label}${c.source ? ` (${c.source})` : ''}${c.with.length ? ` +${c.with.join('+')}` : ''}`);

describe('ações básicas', () => {
  it('as 12 principais na ordem do livro, e as 6 do Other (com tudo para fazer)', () => {
    const list = basicActionList(catalogWith(), null, full());
    expect(list.filter((a) => a.group === 'main').map((a) => a.name)).toEqual(MAIN_ACTIONS);
    expect(list.filter((a) => a.group === 'other').map((a) => a.name)).toEqual(OTHER_ACTIONS);
  });
  it('o custo do livro, com Free e Varies pelo nome', () => {
    const list = basicActionList(catalogWith(), null, full());
    expect(costsOf(list, 'Dash')).toEqual(['Action']);
    expect(costsOf(list, 'Opportunity Attack')).toEqual(['Reaction']);
    expect(costsOf(list, 'Two-Weapon Fighting')).toEqual(['Bonus Action']);
    expect(costOf(basic('End Concentration'))).toBe('free');
    expect(costOf(basic('Improvising an Action'))).toBe('varies');
    expect(costLabel('free')).toBe('Free');
  });
  it('o Cunning Action entra pelas atividades com o nome da ação', () => {
    const list = basicActionList(catalogWith([cunning], ['cunning action']), null);
    expect(costsOf(list, 'Dash')).toEqual(['Action', 'Bonus Action (Cunning Action)']);
    expect(costsOf(list, 'Hide')).toEqual(['Action', 'Bonus Action (Cunning Action)']);
    expect(costsOf(list, 'Dodge')).toEqual(['Action']);
    expect(list.find((a) => a.name === 'Dash').costs[1].via).toEqual({ action: 'action:cunning-action', activity: 'dash' });
  });
  it('o monge: Disengage e Dash grátis como bônus, e as versões com Focus fazem duas ações', () => {
    const list = basicActionList(catalogWith([monkFocus], ["monk's focus"]), null);
    expect(costsOf(list, 'Disengage')).toEqual(['Action', 'Bonus Action (Patient Defense)', 'Bonus Action (Patient Defense (Focus Point)) +Dodge', 'Bonus Action (Step of the Wind) +Dash']);
    expect(costsOf(list, 'Dodge')).toEqual(['Action', 'Bonus Action (Patient Defense (Focus Point)) +Disengage']);
    expect(costsOf(list, 'Dash')).toEqual(['Action', 'Bonus Action (Step of the Wind)', 'Bonus Action (Step of the Wind) +Disengage']);
    const focused = list.find((a) => a.name === 'Dodge').costs[1];
    expect(focused.via).toEqual({ action: 'action:monks-focus', activity: 'pdf' });
  });
  it('registro sem atividade: só a feature presente conta', () => {
    const list = basicActionList(catalogWith([], ['keen mind', 'nimble escape']), null);
    expect(costsOf(list, 'Study')).toEqual(['Action', 'Bonus Action (Keen Mind)']);
    expect(costsOf(list, 'Hide')).toEqual(['Action', 'Bonus Action (Nimble Escape)']);
    expect(costsOf(list, 'Search')).toEqual(['Action']);
    expect(altCostsFor(catalogWith([], [])).size).toBe(0);
  });
  it('registro com atividade que o ator não tem é ignorado (nada inventado)', () => {
    expect(altCostsFor(catalogWith([], ['adrenaline rush'])).size).toBe(0);
  });
  it('só aparece o que o personagem tem o que fazer (P4)', () => {
    const bare = { attacks: [], resources: [], spells: [], stats: { speed: 0 } };
    const names = basicActionList(catalogWith([], [], bare), {}).map((a) => a.name);
    expect(names).toEqual(['Dodge', 'Help', 'Hide', 'Influence', 'Ready', 'Search', 'Study', 'Improvising an Action']);
    const one = { ...everything, attacks: [sword] };
    const ctx = actionContext(catalogWith([], [], one), {}, []);
    expect(['Attack', 'Magic', 'Dash', 'Opportunity Attack'].map((n) => actionRelevant(n, ctx))).toEqual([true, true, true, true]);
    expect(['Two-Weapon Fighting', 'Utilize', 'Escape a Grapple', 'Don or Doff a Shield', 'End Concentration'].map((n) => actionRelevant(n, ctx))).toEqual([false, false, false, false, false]);
    const two = actionContext(catalogWith(), { conditions: { grappled: 1 }, concentration: { spell: 'Bless' } }, [{ raw: { type: 'S|XPHB' } }, { raw: { type: 'P|XPHB' } }]);
    expect(['Two-Weapon Fighting', 'Utilize', 'Escape a Grapple', 'Don or Doff a Shield', 'End Concentration'].map((n) => actionRelevant(n, two))).toEqual([true, true, true, true, true]);
    expect(actionRelevant('Two-Weapon Fighting', actionContext(catalogWith([], [], { ...everything, attacks: [sword, { ...dagger, equipped: false }] }), {}))).toBe(false);
  });
  it('Magic ganha os custos das magias que o personagem lança', () => {
    const cat = catalogWith([], [], { ...everything, spells: [{ key: 'class:wizard', spells: [{ name: 'Shield', level: 1, prepared: true, time: 'reaction' }, { name: 'Misty Step', level: 2, prepared: true, time: 'bonus' }, { name: 'Fireball', level: 3, prepared: false, time: 'action' }] }] });
    expect(costsOf(basicActionList(cat, {}), 'Magic')).toEqual(['Action', 'Bonus Action (a spell)', 'Reaction (a spell)']);
  });
  it('disponibilidade: só em combate, por custo; gasto não some', () => {
    const cat = catalogWith([cunning], ['cunning action']);
    expect(basicActionList(cat, {}).every((a) => a.available)).toBe(true);
    const list = basicActionList(cat, { combat: { round: 1, used: { action: true } } });
    const dash = list.find((a) => a.name === 'Dash');
    expect(dash.costs.map((c) => c.available)).toEqual([false, true]);
    expect(dash.available).toBe(true);
    expect(list.find((a) => a.name === 'Dodge').available).toBe(false);
  });
});

describe('Extra Attack, Two-Weapon Fighting e Dodge', () => {
  const inCombat = (used = {}) => ({ combat: { round: 3, used }, conditions: {} });
  it('quantos ataques a ação Attack dá', () => {
    expect(attacksPerAction({ features: [] })).toBe(1);
    expect(attacksPerAction({ features: ['extra attack'] })).toBe(2);
    expect(attacksPerAction({ features: ['extra attack', 'two extra attacks'] })).toBe(3);
    expect(attacksPerAction({ features: ['three extra attacks'] })).toBe(4);
    expect(attacksPerAction({ features: ['thirsting blade'] })).toBe(2);
  });
  it('o primeiro ataque gasta a ação; o do Extra Attack só conta, e o card segue livre', () => {
    const cat = catalogWith([], ['extra attack']);
    const first = attackStepOp(cat, inCombat()).value.used;
    expect(first).toMatchObject({ action: true, attacks: 1 });
    const mid = inCombat(first);
    const attack = basicActionList(cat, mid).find((a) => a.name === 'Attack');
    expect(attack.available).toBe(true);
    expect(attack.attacks).toEqual({ done: 1, max: 2 });
    expect(attackStepOp(cat, mid).value.used).toMatchObject({ action: true, attacks: 2 });
    const done = inCombat({ action: true, attacks: 2 });
    expect(basicActionList(cat, done).find((a) => a.name === 'Attack').available).toBe(false);
    expect(attackStepOp(cat, done).value.used.attacks).toBe(1);
    expect(attackStepOp(cat, {})).toBeNull();
  });
  it('a outra mão não soma o modificador positivo, a não ser com o estilo', () => {
    const sword = { key: 'weapon:s', name: 'Shortsword', ability: 'dex', damage: { dice: '1d6', bonus: 4 } };
    const cat = { features: [], rollData: { abilities: { dex: { mod: 3 } } } };
    expect(offhandAttack(sword, cat)).toMatchObject({ key: 'weapon:s#offhand', name: 'Shortsword (off-hand)', damage: { bonus: 1 } });
    expect(offhandAttack(sword, { ...cat, features: ['two-weapon fighting'] }).damage.bonus).toBe(4);
    expect(offhandAttack({ ...sword, damage: { dice: '1d6', bonus: -1 } }, { features: [], rollData: { abilities: { dex: { mod: -1 } } } }).damage.bonus).toBe(-1);
  });
  it('o Dodge liga o efeito até o próximo turno', () => {
    const m = featureModifier({ key: 'action:dodge' }, {});
    expect(m).toMatchObject({ label: 'Dodge', maxRounds: 1, notes: ['Attacks against you have Disadvantage'] });
    expect(m.effects[0]).toMatchObject({ targets: ['save:dex'], mode: 'advantage' });
  });
});

describe('o que cada gasto do turno paga', () => {
  const secondWind = { key: 'action:second-wind', name: 'Second Wind', group: 'class', activities: [{ id: 'sw', name: 'Second Wind', activation: { type: 'bonus' }, consumes: [] }] };
  it('bônus: as ações básicas com esse custo e as features, sem repetir o Cunning Action', () => {
    const cat = catalogWith([cunning, secondWind], ['cunning action']);
    const ctx = actionContext(cat, {}, []);
    const list = basicActionList(cat, {}, ctx);
    const r = slotChoices('bonus', list, cat, {});
    expect(r.basics.map((b) => b.name)).toEqual(expect.arrayContaining(['Dash', 'Disengage', 'Hide']));
    expect(r.basics.every((b) => b.item.costs.every((c) => c.cost === 'bonus'))).toBe(true);
    expect(r.features.map((x) => x.name)).toEqual(['Second Wind']);
    expect(r.available).toBe(true);
  });
  it('o "Use an Object" do Fast Hands não repete o Utilize pela bônus', () => {
    const fastHands = { key: 'action:fast-hands', name: 'Fast Hands', group: 'subclass', activities: [
      { id: 'u', name: 'Use an Object', activation: { type: 'bonus' }, consumes: [] },
      { id: 's', name: 'Sleight of Hand', activation: { type: 'bonus' }, consumes: [] },
    ] };
    const cat = catalogWith([fastHands], ['fast hands'], { ...everything, usable: [] });
    const list = basicActionList(cat, {}, actionContext(cat, {}, [{ group: 'consumable', raw: { name: 'Potion of Healing', type: 'P' }, quantity: 1 }]));
    const r = slotChoices('bonus', list, cat, {});
    expect(r.features.map((x) => x.name)).toEqual(['Fast Hands: Sleight of Hand']);
  });
  it('gasto usado desliga, a não ser o Attack que continua (Extra Attack)', () => {
    const cat = catalogWith([], ['extra attack'], { ...everything, attacks: [sword] });
    const state = { combat: { round: 1, used: { action: true, attacks: 1 } }, conditions: {} };
    const list = basicActionList(cat, state, actionContext(cat, state, []));
    expect(slotChoices('action', list, cat, state).available).toBe(true);
    const spent = { combat: { round: 1, used: { reaction: true } }, conditions: {} };
    const after = basicActionList(cat, spent, actionContext(cat, spent, []));
    expect(slotChoices('reaction', after, cat, spent).available).toBe(false);
  });
});

