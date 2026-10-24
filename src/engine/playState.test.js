// =============================================================================
// playState.test: testes do log de eventos do play mode
// =============================================================================
// FUNÇÕES
//   at(day, hour): uma data fixa de outubro de 2026.
//   ev(ops, day): um evento com operações, num dia.
//   play(...events): um documento com os eventos gravados em ordem.
//
// DECISÕES E ARMADILHAS
//   - Os pares desfazer/refazer andam com o teste do estado: o estado depois de
//     desfazer TEM de ser igual ao de antes do evento, e o refazer o de depois.
//   - A janela é testada pelos dois limites (quantidade e idade) e pela garantia
//     de que o estado não muda ao dobrar.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  emptyPlayState, applyOp, hpView, remainingOf, createPlayDoc, normalizePlayDoc,
  currentPlayState, makeEvent, recordEvent, undoEvent, redoEvent, canUndo, canRedo,
  compactPlayDoc, normalizeLimits, characterOps, deepEqual, applyCharacterOps, HISTORY_LIMITS,
} from './playState';

const at = (day, hour = 12) => new Date(Date.UTC(2026, 9, day, hour));
const ev = (ops, day = 1) => makeEvent('test', { ops }, at(day));
const play = (...events) => events.reduce((doc, e) => recordEvent(doc, e).doc, createPlayDoc('c1'));

describe('applyOp', () => {
  it('hp soma dano e temporário, com piso em 0', () => {
    let s = applyOp(emptyPlayState(), { op: 'hp', damage: 7, temp: 5 });
    expect([s.damage, s.tempHp]).toEqual([7, 5]);
    s = applyOp(s, { op: 'hp', damage: -20, temp: -9 });
    expect([s.damage, s.tempHp]).toEqual([0, 0]);
  });

  it('spend e restore contam o gasto por chave, e a chave some no zero', () => {
    let s = applyOp(emptyPlayState(), { op: 'spend', key: 'slot:3', amount: 2 });
    expect(s.spent).toEqual({ 'slot:3': 2 });
    s = applyOp(s, { op: 'restore', key: 'slot:3', amount: 1 });
    expect(s.spent).toEqual({ 'slot:3': 1 });
    s = applyOp(s, { op: 'restore', key: 'slot:3' });
    expect(s.spent).toEqual({});
    s = applyOp(s, { op: 'spend', key: 'pact', amount: -3 });
    expect(s.spent).toEqual({});
  });

  it('death soma presa entre 0 e 3, e reset zera', () => {
    let s = applyOp(emptyPlayState(), { op: 'death', failure: 2 });
    s = applyOp(s, { op: 'death', failure: 2, success: 1 });
    expect(s.death).toEqual({ success: 1, failure: 3, stable: false, dead: false });
    expect(applyOp(s, { op: 'death', reset: true }).death).toEqual({ success: 0, failure: 0, stable: false, dead: false });
  });

  it('death com set troca campos antes de somar (estável, morto, falha que tira a estabilidade)', () => {
    let s = applyOp(emptyPlayState(), { op: 'death', set: { success: 0, failure: 0, stable: true } });
    expect(s.death).toMatchObject({ stable: true, success: 0 });
    s = applyOp(s, { op: 'death', set: { stable: false }, failure: 1 });
    expect(s.death).toEqual({ success: 0, failure: 1, stable: false, dead: false });
    expect(applyOp(s, { op: 'death', set: { dead: true } }).death.dead).toBe(true);
  });

  it('condition define o nível e 0 tira', () => {
    let s = applyOp(emptyPlayState(), { op: 'condition', id: 'exhaustion', level: 2 });
    s = applyOp(s, { op: 'condition', id: 'poisoned', level: 1 });
    expect(s.conditions).toEqual({ exhaustion: 2, poisoned: 1 });
    expect(applyOp(s, { op: 'condition', id: 'poisoned', level: 0 }).conditions).toEqual({ exhaustion: 2 });
  });

  it('inspiração, concentração, combate e modificadores', () => {
    let s = emptyPlayState();
    s = applyOp(s, { op: 'inspiration', value: true });
    s = applyOp(s, { op: 'concentration', value: { name: 'Bless' } });
    s = applyOp(s, { op: 'modifier', add: { id: 'm1', label: 'Bless', target: 'attack', formula: '1d4' } });
    s = applyOp(s, { op: 'modifier', add: { id: 'm1', label: 'Bless', target: 'attack', formula: '1d4' } });
    expect(s.inspiration).toBe(true);
    expect(s.concentration).toEqual({ name: 'Bless' });
    expect(s.modifiers).toHaveLength(1);
    expect(applyOp(s, { op: 'modifier', remove: 'm1' }).modifiers).toEqual([]);
    expect(applyOp(s, { op: 'combat', value: { round: 1 } }).combat).toEqual({ round: 1 });
  });

  it('operação desconhecida ou de personagem não muda o estado', () => {
    const s = emptyPlayState();
    expect(applyOp(s, { op: 'teleport' })).toBe(s);
    expect(applyOp(s, { op: 'inventory', uid: 'x' })).toBe(s);
    expect(applyOp(s, { op: 'currency', delta: { gp: -5 } })).toBe(s);
  });

  it('não muta o estado de entrada', () => {
    const s = emptyPlayState();
    applyOp(s, { op: 'spend', key: 'pact', amount: 1 });
    applyOp(s, { op: 'condition', id: 'prone', level: 1 });
    expect(s).toEqual(emptyPlayState());
  });
});

describe('valores atuais', () => {
  it('hpView deriva o atual do máximo de agora', () => {
    const s = { ...emptyPlayState(), damage: 12, tempHp: 4 };
    expect(hpView(s, 30)).toEqual({ max: 30, current: 18, temp: 4 });
    expect(hpView(s, 10).current).toBe(0);
    expect(hpView(s, 40).current).toBe(28);
  });

  it('remainingOf desconta o gasto do máximo', () => {
    const s = { ...emptyPlayState(), spent: { 'slot:1': 3 } };
    expect(remainingOf(s, 'slot:1', 4)).toBe(1);
    expect(remainingOf(s, 'slot:1', 2)).toBe(0);
    expect(remainingOf(s, 'slot:2', 3)).toBe(3);
  });
});

describe('log, desfazer e refazer', () => {
  const hit = ev([{ op: 'hp', damage: 8 }]);
  const cast = ev([{ op: 'spend', key: 'slot:1', amount: 1 }, { op: 'concentration', value: { name: 'Bless' } }]);

  it('o estado é o baseline com os eventos até o cursor', () => {
    const doc = play(hit, cast);
    expect(doc.cursor).toBe(2);
    const s = currentPlayState(doc);
    expect(s.damage).toBe(8);
    expect(s.spent).toEqual({ 'slot:1': 1 });
  });

  it('desfazer volta o evento inteiro (todas as operações juntas) e refazer reaplica', () => {
    const doc = play(hit, cast);
    const u = undoEvent(doc);
    expect(u.event).toBe(cast);
    expect(currentPlayState(u.doc)).toEqual(currentPlayState(play(hit)));
    const r = redoEvent(u.doc);
    expect(r.event).toBe(cast);
    expect(currentPlayState(r.doc)).toEqual(currentPlayState(doc));
  });

  it('canUndo e canRedo seguem o cursor; sem nada, undo e redo dão null', () => {
    const empty = createPlayDoc('c1');
    expect([canUndo(empty), canRedo(empty)]).toEqual([false, false]);
    expect(undoEvent(empty)).toBeNull();
    expect(redoEvent(empty)).toBeNull();
    const u = undoEvent(play(hit)).doc;
    expect([canUndo(u), canRedo(u)]).toEqual([false, true]);
  });

  it('evento novo depois de desfazer descarta o ramo refazível', () => {
    const doc = undoEvent(undoEvent(play(hit, cast)).doc).doc;
    const heal = ev([{ op: 'hp', damage: -3 }]);
    const { doc: next, discarded } = recordEvent(doc, heal);
    expect(discarded).toEqual([hit, cast]);
    expect(next.events).toEqual([heal]);
    expect(canRedo(next)).toBe(false);
  });

  it('a rolagem gravada volta igual no refazer', () => {
    const roll = makeEvent('roll', { rolls: { total: 17, parts: [] }, label: 'Athletics' }, at(1));
    const r = redoEvent(undoEvent(play(roll)).doc);
    expect(r.event.rolls.total).toBe(17);
  });

  it('makeEvent dá id, data e os campos', () => {
    const e = makeEvent('damage', { ops: [{ op: 'hp', damage: 2 }], label: 'Goblin' }, at(3));
    expect(e).toMatchObject({ kind: 'damage', label: 'Goblin', at: '2026-10-03T12:00:00.000Z', rolls: null, payload: {} });
    expect(typeof e.id).toBe('string');
  });
});

describe('janela do histórico', () => {
  it('o padrão é 500 ações ou 30 dias, e os limites são saneados', () => {
    expect(HISTORY_LIMITS).toEqual({ maxEvents: 500, maxAgeDays: 30 });
    expect(normalizeLimits({ maxEvents: '20', maxAgeDays: 0 })).toEqual({ maxEvents: 20, maxAgeDays: 30 });
    expect(normalizeLimits()).toEqual(HISTORY_LIMITS);
  });

  it('dobra o excesso de quantidade no baseline sem mudar o estado', () => {
    const events = Array.from({ length: 6 }, (_, i) => ev([{ op: 'hp', damage: i + 1 }], 20));
    const doc = play(...events);
    const { doc: compact, folded } = compactPlayDoc(doc, { maxEvents: 4 }, at(21));
    expect(folded).toBe(2);
    expect(compact.events).toEqual(events.slice(2));
    expect(compact.cursor).toBe(4);
    expect(compact.baseline.damage).toBe(3);
    expect(currentPlayState(compact)).toEqual(currentPlayState(doc));
  });

  it('dobra o que passou da idade', () => {
    const doc = play(ev([{ op: 'hp', damage: 1 }], 1), ev([{ op: 'hp', damage: 2 }], 2), ev([{ op: 'hp', damage: 4 }], 25));
    const { doc: compact, folded } = compactPlayDoc(doc, { maxAgeDays: 10 }, at(30));
    expect(folded).toBe(2);
    expect(compact.events).toHaveLength(1);
    expect(currentPlayState(compact).damage).toBe(7);
  });

  it('nunca dobra o ramo refazível', () => {
    const events = Array.from({ length: 5 }, (_, i) => ev([{ op: 'spend', key: 'pact', amount: 1 }], i + 1));
    const doc = undoEvent(undoEvent(play(...events)).doc).doc;
    const { doc: compact } = compactPlayDoc(doc, { maxEvents: 1, maxAgeDays: 1 }, at(20));
    expect(compact.cursor).toBe(0);
    expect(compact.events).toEqual(events.slice(3));
    expect(currentPlayState(compact).spent).toEqual({ pact: 3 });
    expect(currentPlayState(redoEvent(compact).doc).spent).toEqual({ pact: 4 });
  });

  it('dentro da janela não mexe em nada', () => {
    const doc = play(ev([{ op: 'hp', damage: 1 }], 20));
    const r = compactPlayDoc(doc, HISTORY_LIMITS, at(21));
    expect(r.folded).toBe(0);
    expect(r.doc).toBe(doc);
  });
});

describe('normalizePlayDoc', () => {
  it('sem documento, cria um descansado', () => {
    expect(normalizePlayDoc(null, 'c9')).toEqual(createPlayDoc('c9'));
  });

  it('completa o baseline e prende o cursor', () => {
    const doc = normalizePlayDoc({ characterId: 'c1', baseline: { damage: 4, death: { failure: 1 } }, events: [{ ops: [] }, null], cursor: 9 }, 'c1');
    expect(doc.baseline.damage).toBe(4);
    expect(doc.baseline.death).toEqual({ success: 0, failure: 1, stable: false, dead: false });
    expect(doc.baseline.spent).toEqual({});
    expect(doc.events).toHaveLength(1);
    expect(doc.cursor).toBe(1);
  });
});

describe('operações de personagem', () => {
  const potion = { uid: 'p1', itemId: 'Potion of Healing', source: 'XPHB', quantity: 2, equipped: false, attuned: false };
  const arrows = { uid: 'a1', itemId: 'Arrows', source: 'XPHB', quantity: 20, equipped: false, attuned: false };
  const character = { inventory: [arrows, potion], currency: { gp: 10, sp: 0 } };

  it('characterOps separa inventário e moedas das operações de estado', () => {
    const e = ev([{ op: 'hp', damage: -7 }, { op: 'inventory', uid: 'p1' }, { op: 'currency', delta: { gp: -1 } }]);
    expect(characterOps(e).map((o) => o.op)).toEqual(['inventory', 'currency']);
  });

  it('beber uma poção baixa a quantidade, e desfazer devolve', () => {
    const ops = [{ op: 'inventory', uid: 'p1', before: potion, after: { ...potion, quantity: 1 } }];
    const fwd = applyCharacterOps(character, ops, 'forward');
    expect(fwd.conflicts).toEqual([]);
    expect(fwd.character.inventory[1].quantity).toBe(1);
    const back = applyCharacterOps(fwd.character, ops, 'backward');
    expect(back.character.inventory).toEqual(character.inventory);
  });

  it('a última poção sai do inventário e volta no mesmo lugar', () => {
    const one = { ...potion, quantity: 1 };
    const start = { ...character, inventory: [one, arrows] };
    const ops = [{ op: 'inventory', uid: 'p1', before: one, after: null, index: 0 }];
    const fwd = applyCharacterOps(start, ops, 'forward');
    expect(fwd.character.inventory).toEqual([arrows]);
    expect(applyCharacterOps(fwd.character, ops, 'backward').character.inventory).toEqual([one, arrows]);
  });

  it('item editado no builder depois conflita e não é tocado', () => {
    const ops = [{ op: 'inventory', uid: 'p1', before: potion, after: { ...potion, quantity: 1 } }];
    const edited = { ...character, inventory: [arrows, { ...potion, quantity: 5 }] };
    const back = applyCharacterOps(edited, ops, 'backward');
    expect(back.conflicts).toEqual(ops);
    expect(back.character.inventory).toEqual(edited.inventory);
  });

  it('moedas somam o delta, desfazem, e conflitam se ficariam negativas', () => {
    const ops = [{ op: 'currency', delta: { gp: -4, sp: 5 } }];
    const fwd = applyCharacterOps(character, ops, 'forward');
    expect(fwd.character.currency).toEqual({ gp: 6, sp: 5 });
    expect(applyCharacterOps(fwd.character, ops, 'backward').character.currency).toEqual({ gp: 10, sp: 0 });
    const broke = applyCharacterOps(character, [{ op: 'currency', delta: { gp: -11 } }], 'forward');
    expect(broke.conflicts).toHaveLength(1);
    expect(broke.character.currency).toEqual(character.currency);
  });

  it('deepEqual ignora a ordem das chaves e o undefined', () => {
    expect(deepEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(deepEqual({ a: 1, x: undefined }, { a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
  });
});
