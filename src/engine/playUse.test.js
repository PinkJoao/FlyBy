// =============================================================================
// playUse.test: testes de usar features e das recuperações especiais
// =============================================================================
// FUNÇÕES
//   seq(...values): um rng que devolve os valores em ordem e falha se acabarem.
//   st(patch): um estado de jogo com o patch por cima do descansado.
//   run(state, event): o estado depois das operações do evento.
//
// DECISÕES E ARMADILHAS
//   - O catálogo é uma fixture com um recurso de cada tipo (pool, slots, pacto,
//     dado de vida) e as activities no formato do derivePlayCatalog.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { sequenceRng } from './dice';
import { emptyPlayState, applyOp, hpView } from './playState';
import {
  left, slotKey, resolveCosts, activityEvent, specialRecovery, slotRecoveryEvent, fontOfMagicEvent, adjustResourceEvent, setResourceEvent, withResourceMax, featureLogEvent,
} from './playUse';

const seq = (...values) => sequenceRng(values, () => {
  throw new Error('rolou um dado a mais');
});
const st = (patch = {}) => ({ ...emptyPlayState(), ...patch });
const run = (state, event) => event.ops.reduce(applyOp, state);

const catalog = {
  stats: { hpMax: 40 },
  rollData: { prof: 3, abilities: { str: { mod: 4 }, dex: { mod: 1 }, con: { mod: 2 } }, classes: { wizard: { levels: 5 }, fighter: { levels: 5 } }, spells: { pact: { max: 2, level: 3 } } },
  resources: [
    { key: 'pool:second-wind', kind: 'pool', name: 'Second Wind', max: 2 },
    { key: 'pool:lay-on-hands', kind: 'pool', name: 'Lay on Hands', max: 25 },
    { key: 'pool:arcane-recovery', kind: 'pool', name: 'Arcane Recovery', max: 1 },
    { key: 'pool:font-of-magic', kind: 'pool', name: 'Sorcery Points', max: 5 },
    { key: 'slot:1', kind: 'slot', name: 'Level 1 slots', level: 1, max: 4 },
    { key: 'slot:2', kind: 'slot', name: 'Level 2 slots', level: 2, max: 3 },
    { key: 'slot:3', kind: 'slot', name: 'Level 3 slots', level: 3, max: 2 },
    { key: 'pact', kind: 'pact', name: 'Pact slots', level: 3, max: 2 },
    { key: 'hd:d10', kind: 'hitDice', name: 'd10 Hit Dice', faces: 10, max: 3 },
    { key: 'hd:d6', kind: 'hitDice', name: 'd6 Hit Dice', faces: 6, max: 2 },
  ],
};
const secondWind = {
  key: 'action:second-wind', name: 'Second Wind',
  activities: [{ id: 'a', type: 'heal', name: 'Second Wind', consumes: [{ key: 'pool:second-wind', amount: 1 }], heal: { formula: '1d10 + @classes.fighter.levels' }, damage: [], selfTarget: true }],
};
const layOnHands = {
  key: 'action:lay-on-hands', name: 'Lay on Hands',
  activities: [{ id: 'b', type: 'heal', name: 'Lay on Hands', consumes: [{ key: 'pool:lay-on-hands', amount: 1 }], heal: { formula: '@scaling' }, damage: [], scalable: true, selfTarget: false }],
};

describe('custos', () => {
  it('lê o que sobra e a chave do slot', () => {
    expect(left(catalog, st({ spent: { 'slot:1': 3 } }), 'slot:1')).toBe(1);
    expect(slotKey(catalog, 2)).toBe('slot:2');
    expect(slotKey(catalog, 9)).toBeNull();
  });

  it('a activity com escala gasta a escala escolhida', () => {
    expect(resolveCosts(catalog, st(), layOnHands.activities[0], { scaling: 7 })).toEqual([{ key: 'pool:lay-on-hands', amount: 7 }]);
  });

  it('slot: o círculo escolhido; valor negativo devolve', () => {
    const wild = { consumes: [{ spellSlot: '1', formula: '1' }] };
    expect(resolveCosts(catalog, st(), wild, { slotLevel: 2 })).toEqual([{ key: 'slot:2', amount: 1 }]);
    expect(resolveCosts(catalog, st(), wild)).toEqual([{ key: 'slot:1', amount: 1 }]);
    expect(resolveCosts(catalog, st(), { consumes: [{ spellSlot: '', formula: '-1' }] }, { slotLevel: 3 })).toEqual([{ key: 'slot:3', amount: -1 }]);
  });

  it('atributo: o Magical Cunning devolve metade do pacto, para cima', () => {
    const cunning = { consumes: [{ attribute: 'spells.pact.value', formula: '-(ceil(@spells.pact.max / 2))' }] };
    expect(resolveCosts(catalog, st(), cunning)).toEqual([{ key: 'pact', amount: -1 }]);
  });

  it('dado de vida: o maior ou o menor que SOBRA', () => {
    const durable = (which) => ({ consumes: [{ hitDice: which, formula: '1' }] });
    expect(resolveCosts(catalog, st(), durable('largest'))).toEqual([{ key: 'hd:d10', amount: 1 }]);
    expect(resolveCosts(catalog, st({ spent: { 'hd:d10': 3 } }), durable('largest'))).toEqual([{ key: 'hd:d6', amount: 1 }]);
    expect(resolveCosts(catalog, st(), durable('smallest'))).toEqual([{ key: 'hd:d6', amount: 1 }]);
  });
});

describe('activityEvent', () => {
  it('Second Wind: gasta 1, rola e cura o próprio personagem, num evento só', () => {
    const s = st({ damage: 20 });
    const e = activityEvent({ catalog, state: s, action: secondWind, activity: secondWind.activities[0], rng: seq(6) });
    const next = run(s, e);
    expect(next.spent).toEqual({ 'pool:second-wind': 1 });
    expect(hpView(next, 40).current).toBe(20 + 11);
    expect(e.payload).toMatchObject({ costs: [{ name: 'Second Wind', amount: 1 }], short: [], healed: { healed: 11 } });
  });

  it('Lay on Hands em outro: gasta a escala e só mostra a cura', () => {
    const e = activityEvent({ catalog, state: st({ damage: 10 }), action: layOnHands, activity: layOnHands.activities[0], options: { scaling: 5 } });
    expect(e.ops).toEqual([{ op: 'spend', key: 'pool:lay-on-hands', amount: 5 }]);
    expect(e.rolls.total).toBe(5);
    expect(e.payload.healed).toBeNull();
  });

  it('sem recurso suficiente, o evento sai e marca o que faltou', () => {
    const e = activityEvent({ catalog, state: st({ spent: { 'pool:second-wind': 2 } }), action: secondWind, activity: secondWind.activities[0], rng: seq(1) });
    expect(e.payload.short).toEqual(['Second Wind']);
  });

  it('ataque de feature: acerto com modificador e PB, dano dobrado no crítico', () => {
    const strike = {
      key: 'action:empowered', name: 'Empowered Strikes',
      activities: [{ id: 'c', type: 'attack', name: 'Strike', consumes: [], attack: { ability: 'dex' }, damage: [{ formula: '1d8 + @mod', types: ['force'] }] }],
    };
    const e = activityEvent({ catalog, state: st(), action: strike, activity: strike.activities[0], rng: seq(20, 3, 5) });
    expect(e.payload.attack).toEqual({ total: 24, natural: 20, critical: true });
    expect(e.rolls.damage).toBe(3 + 5 + 1);
  });
});

describe('recuperações especiais', () => {
  const arcane = { key: 'action:arcane-recovery', name: 'Arcane Recovery', activities: [{ id: 'r', name: 'Recover', consumes: [{ key: 'pool:arcane-recovery', amount: 1 }] }] };

  it('Arcane Recovery: orçamento de metade do nível de Mago, para cima', () => {
    expect(specialRecovery(arcane, catalog)).toMatchObject({ kind: 'slots', budget: 3, maxLevel: 5 });
    const s = st({ spent: { 'slot:1': 2, 'slot:2': 1 } });
    const e = slotRecoveryEvent({ catalog, state: s, action: arcane, picks: { 1: 1, 2: 1 } });
    expect(run(s, e).spent).toEqual({ 'slot:1': 1, 'pool:arcane-recovery': 1 });
    expect(e.payload).toMatchObject({ total: 3, over: false });
    expect(slotRecoveryEvent({ catalog, state: s, action: arcane, picks: { 3: 1, 1: 1 } }).payload.over).toBe(true);
  });

  it('Font of Magic: criar gasta pontos pela tabela; converter devolve o círculo em pontos', () => {
    const font = { key: 'action:font-of-magic', name: 'Font of Magic', activities: [] };
    const s = st({ spent: { 'slot:3': 1 } });
    const create = fontOfMagicEvent({ catalog, state: s, action: font, mode: 'create', level: 3 });
    expect(run(s, create).spent).toEqual({ 'pool:font-of-magic': 5 });
    expect(create.payload.noSpentSlot).toBe(false);
    expect(fontOfMagicEvent({ catalog, state: st(), action: font, mode: 'create', level: 2 }).payload.noSpentSlot).toBe(true);
    const back = fontOfMagicEvent({ catalog, state: st({ spent: { 'pool:font-of-magic': 4 } }), action: font, mode: 'convert', level: 2 });
    expect(run(st({ spent: { 'pool:font-of-magic': 4 } }), back).spent).toEqual({ 'slot:2': 1, 'pool:font-of-magic': 2 });
  });

  it('ajuste manual gasta ou devolve', () => {
    expect(adjustResourceEvent({ catalog, key: 'slot:1', delta: 1 }).ops).toEqual([{ op: 'spend', key: 'slot:1', amount: 1 }]);
    expect(adjustResourceEvent({ catalog, key: 'slot:1', delta: -2 }).ops).toEqual([{ op: 'restore', key: 'slot:1', amount: 2 }]);
  });

  it('ajuste manual com o estado: tira só o que sobra e põe só o que foi gasto (DDL-0202)', () => {
    const max = catalog.resources.find((r) => r.key === 'slot:1').max;
    const s = st({ spent: { 'slot:1': 1 } });
    const take = adjustResourceEvent({ catalog, key: 'slot:1', delta: 99, state: s });
    expect(take.ops).toEqual([{ op: 'spend', key: 'slot:1', amount: max - 1 }]);
    expect(take.payload.asked).toBe(99);
    const give = adjustResourceEvent({ catalog, key: 'slot:1', delta: -5, state: s });
    expect(give.ops).toEqual([{ op: 'restore', key: 'slot:1', amount: 1 }]);
    expect(run(s, give).spent['slot:1'] ?? 0).toBe(0);
    expect(adjustResourceEvent({ catalog, key: 'slot:1', delta: 1, state: s }).payload.asked).toBeUndefined();
  });

  it('painel Current | Max: o fim que o jogador pôs vira gasto e ajuste do máximo (DDL-0209)', () => {
    const key = 'pool:second-wind';
    const s = st({ spent: { [key]: 1 } });
    const cur = setResourceEvent({ catalog, key, left: 0, max: 2, state: s });
    expect(cur.ops).toEqual([{ op: 'spend', key, amount: 1 }]);
    expect(cur.payload).toMatchObject({ delta: 1, was: { left: 1, max: 2 }, now: { left: 0, max: 2 } });
    const up = setResourceEvent({ catalog, key, left: 2, max: 3, state: s });
    expect(up.ops).toEqual([{ op: 'resourceMax', key, amount: 1 }]);
    const after = run(s, up);
    expect(after.resourceMax).toEqual({ [key]: 1 });
    const adjusted = withResourceMax(catalog, after).resources.find((r) => r.key === key);
    expect(adjusted).toMatchObject({ max: 3, sheetMax: 2 });
    const back = setResourceEvent({ catalog: withResourceMax(catalog, after), key, left: 2, max: 2, state: after });
    expect(back.ops).toEqual([{ op: 'resourceMax', key, amount: -1 }, { op: 'restore', key, amount: 1 }]);
    const done = run(after, back);
    expect(done.resourceMax).toEqual({});
    expect(done.spent[key]).toBeUndefined();
    expect(withResourceMax(catalog, done)).toBe(catalog);
  });

  it('painel: o que resta nunca passa do máximo nem fica negativo', () => {
    const key = 'pool:second-wind';
    const e = setResourceEvent({ catalog, key, left: 9, max: 1, state: st() });
    expect(e.payload.now).toEqual({ left: 1, max: 1 });
    expect(run(st(), e).resourceMax).toEqual({ [key]: -1 });
    expect(setResourceEvent({ catalog, key, left: -3, max: -2, state: st() }).payload.now).toEqual({ left: 0, max: 0 });
  });
});

describe('efeito curado da feature', () => {
  it('usar a Rage gasta o uso e liga o efeito no mesmo evento', () => {
    const rage = { key: 'action:rage', name: 'Rage', activities: [{ id: 'r', type: 'utility', name: '', consumes: [{ key: 'pool:second-wind', amount: 1 }], damage: [] }] };
    const e = activityEvent({ catalog, state: st(), action: rage, activity: rage.activities[0] });
    const next = run(st(), e);
    expect(next.modifiers[0]).toMatchObject({ label: 'Rage', resist: ['bludgeoning', 'piercing', 'slashing'] });
    expect(e.payload.effect).toBe('Rage');
  });
});

describe('rolar só o ataque ou só o efeito', () => {
  const breath = {
    key: 'action:claw', name: 'Claw',
    activities: [{ id: 'c', type: 'attack', name: 'Claw', consumes: [{ key: 'pool:second-wind', amount: 1 }], attack: { ability: 'str' }, damage: [{ formula: '1d6', types: ['slashing'] }] }],
  };
  const act = breath.activities[0];

  it('only attack rola o d20 e gasta; o efeito fica de fora', () => {
    const e = activityEvent({ catalog, state: st(), action: breath, activity: act, options: { only: 'attack' }, rng: seq(15, 4) });
    expect(e.rolls.parts.map((p) => p.label)).toEqual(['d20', 'Modifier', 'Proficiency']);
    expect(e.rolls.damage).toBeNull();
    expect(e.payload.only).toBe('attack');
    expect(e.ops).toContainEqual({ op: 'spend', key: 'pool:second-wind', amount: 1 });
  });

  it('only effect com free (o cartão do histórico) rola o dano sem gastar', () => {
    const e = activityEvent({ catalog, state: st(), action: breath, activity: act, options: { only: 'effect', free: true }, rng: seq(4) });
    expect(e.rolls.parts.map((p) => p.label)).toEqual(['slashing']);
    expect(e.rolls.total).toBe(4);
    expect(e.ops.filter((o) => o.op === 'spend')).toEqual([]);
  });
});


describe('featureLogEvent', () => {
  it('registra o nome e o custo sem rolar nem gastar', () => {
    const e = featureLogEvent({ catalog, feature: { key: 'feature:storm-aura|3', name: 'Storm Aura' }, cost: 'bonus' });
    expect(e.kind).toBe('use');
    expect(e.label).toBe('Storm Aura');
    expect(e.ops).toEqual([]);
    expect(e.payload).toMatchObject({ logged: true, cost: 'bonus', featureKey: 'feature:storm-aura|3', costs: [] });
  });

  it('com spend gasta um do pool', () => {
    const e = featureLogEvent({ catalog, feature: { name: 'Second Wind' }, spend: 'pool:second-wind' });
    expect(e.ops).toEqual([{ op: 'spend', key: 'pool:second-wind', amount: 1 }]);
    expect(e.payload.costs[0].amount).toBe(1);
    expect(e.payload.cost).toBeNull();
  });

  it('com modificador e salvaguarda do registro: liga o efeito e mostra a CD', () => {
    const modifier = { id: 'm', label: 'Reckless Attack', maxRounds: 1, effects: [] };
    const e = featureLogEvent({ catalog, state: st(), feature: { name: 'Reckless Attack' }, modifier, save: { abilities: ['con'], dc: 14 } });
    expect(e.ops).toEqual([{ op: 'modifier', add: modifier }]);
    expect(e.payload).toMatchObject({ effect: 'Reckless Attack', save: { dc: 14 } });
  });

  it('com roll, rola a fórmula do registro no evento', () => {
    const e = featureLogEvent({ catalog, feature: { name: "Commander's Strike" }, roll: { label: "Ally's damage bonus", formula: '1d8' }, rng: seq(6) });
    expect(e.rolls.total).toBe(6);
    expect(e.payload.rolled).toBe(true);
  });

  it('apply cura com o total e restore devolve todo o gasto do pool', () => {
    const s = { ...st(), damage: 10, spent: { 'pool:second-wind': 2 } };
    const e = featureLogEvent({ catalog, state: s, feature: { name: 'Uncanny Metabolism' }, roll: { label: 'Hit Points regained', formula: '1d8' }, apply: 'heal', restore: 'pool:second-wind', rng: seq(5) });
    expect(e.ops).toContainEqual({ op: 'restore', key: 'pool:second-wind', amount: 2 });
    expect(e.payload.healed).toMatchObject({ amount: 5 });
    expect(e.payload.lines[0]).toContain('2 regained');
  });

  it('apply temp dá PV temporários sem somar', () => {
    const e = featureLogEvent({ catalog, state: { ...st(), tempHp: 3 }, feature: { name: 'Form of Dread' }, roll: { label: 'Temporary Hit Points', formula: '1d10' }, apply: 'temp', rng: seq(7) });
    expect(e.ops).toContainEqual({ op: 'hp', temp: 4 });
    expect(e.payload.temp).toMatchObject({ from: 3, to: 7 });
  });
});
