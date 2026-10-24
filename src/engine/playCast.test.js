// =============================================================================
// playCast.test: testes de conjurar no play mode
// =============================================================================
// FUNÇÕES
//   seq(...values): um rng que devolve os valores em ordem e falha se acabarem.
//   st(patch): um estado de jogo com o patch por cima do descansado.
//   run(state, event): o estado depois das operações do evento.
//   spell(patch): uma magia no formato do catálogo.
//
// DECISÕES E ARMADILHAS
//   - As formas de lançar são o coração da fase: cada tipo de magia (cantrip, à
//     vontade, concedida com uso, arcanum, ritual, de círculo) tem o seu caso.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { sequenceRng } from './dice';
import { emptyPlayState, applyOp, hpView } from './playState';
import { castWays, castEvent, spellAttackOf, healParts, spellHealEvent } from './playCast';
import { rollDamageEvent } from './playActions';

const seq = (...values) => sequenceRng(values, () => {
  throw new Error('rolou um dado a mais');
});
const st = (patch = {}) => ({ ...emptyPlayState(), ...patch });
const run = (state, event) => event.ops.reduce(applyOp, state);
const spell = (patch = {}) => ({
  key: 'spell:class:cleric|X', name: 'X', level: 1, ritual: false, concentration: false, castType: null, uses: null,
  mechanics: { attack: null, save: null, damage: null, heal: null, upcast: null }, ...patch,
});

const catalog = {
  stats: { hpMax: 30 },
  rollData: {},
  resources: [
    { key: 'slot:1', kind: 'slot', level: 1, max: 4 },
    { key: 'slot:2', kind: 'slot', level: 2, max: 2 },
    { key: 'pact', kind: 'pact', level: 2, max: 1 },
    { key: 'granted:race|Misty Step', kind: 'granted', max: 1 },
  ],
};
const origin = { key: 'class:cleric', label: 'Cleric', attackBonus: 6, saveDc: 14, abilityMod: 3 };

describe('castWays', () => {
  it('cantrip sai de graça e só de graça', () => {
    expect(castWays(catalog, st(), spell({ level: 0 })).map((w) => w.id)).toEqual(['free']);
  });

  it('magia de círculo: todo slot igual ou maior, comum e de pacto, com o que sobra', () => {
    const ways = castWays(catalog, st({ spent: { 'slot:1': 4 } }), spell({ level: 1 }));
    expect(ways.map((w) => [w.id, w.left])).toEqual([['slot:1', 0], ['slot:2', 2], ['pact', 1]]);
    expect(castWays(catalog, st(), spell({ level: 2 })).map((w) => w.id)).toEqual(['slot:2', 'pact']);
  });

  it('concedida com uso: o uso primeiro, e os slots também', () => {
    const ways = castWays(catalog, st(), spell({ level: 2, uses: 'granted:race|Misty Step', castType: 'daily' }));
    expect(ways.map((w) => w.id)).toEqual(['uses', 'slot:2', 'pact']);
  });

  it('Mystic Arcanum: só o uso; à vontade: de graça; ritual: sem slot', () => {
    expect(castWays(catalog, st(), spell({ level: 6, arcanum: true, uses: 'granted:race|Misty Step' })).map((w) => w.id)).toEqual(['uses']);
    expect(castWays(catalog, st(), spell({ level: 1, castType: 'will' })).map((w) => w.id)[0]).toBe('free');
    expect(castWays(catalog, st(), spell({ level: 1, ritual: true })).map((w) => w.id)).toContain('ritual');
  });
});

describe('castEvent', () => {
  it('gasta o slot e liga a concentração, trocando a anterior', () => {
    const s = st({ concentration: { name: 'Bless' } });
    const sp = spell({ name: 'Hold Person', level: 2, concentration: true, mechanics: { save: 'wis' } });
    const way = castWays(catalog, s, sp).find((w) => w.id === 'slot:2');
    const e = castEvent({ catalog, state: s, origin, spell: sp, way });
    const next = run(s, e);
    expect(next.spent).toEqual({ 'slot:2': 1 });
    expect(next.concentration).toMatchObject({ name: 'Hold Person', level: 2 });
    expect(e.payload).toMatchObject({ ended: 'Bless', save: { ability: 'wis', dc: 14 }, level: 2 });
  });

  it('ritual e cantrip não gastam nada', () => {
    const sp = spell({ ritual: true });
    expect(castEvent({ catalog, state: st(), origin, spell: sp, way: castWays(catalog, st(), sp).find((w) => w.id === 'ritual') }).ops).toEqual([]);
  });
});

describe('rolagens da magia', () => {
  it('o dano ganha o upcast por círculo acima do base', () => {
    const fireball = spell({ name: 'Fireball', level: 3, mechanics: { save: 'dex', damage: { dice: '8d6', types: ['fire'] }, upcast: '1d6' } });
    const at5 = spellAttackOf(origin, fireball, 5);
    expect(at5.damage.dice).toBe('8d6 + 2d6');
    const e = rollDamageEvent({ catalog, attack: at5, rng: seq(1, 1, 1, 1, 1, 1, 1, 1, 6, 6) });
    expect(e.rolls.total).toBe(20);
    expect(spellAttackOf(origin, fireball, 3).damage.dice).toBe('8d6');
  });

  it('a cura soma o modificador quando a prosa manda, e se aplica em si mesmo', () => {
    const cure = spell({ name: 'Cure Wounds', level: 1, mechanics: { heal: { dice: '2d8', addMod: true }, upcast: '2d8' } });
    expect(healParts(origin, cure, 2)).toEqual([{ label: 'Cure Wounds', formula: '2d8 + 2d8' }, { label: 'Spellcasting modifier', formula: 3 }]);
    const s = st({ damage: 20 });
    const e = spellHealEvent({ catalog, state: s, origin, spell: cure, level: 1, options: { applyHeal: true }, rng: seq(4, 5) });
    expect(e.rolls.total).toBe(12);
    expect(hpView(run(s, e), 30).current).toBe(22);
  });
});

describe('efeito curado da magia', () => {
  const bless = spell({ name: 'Bless', level: 1, concentration: true });
  const way = { id: 'slot:1', label: 'Level 1 slot', level: 1, key: 'slot:1', left: 4 };

  it('Bless liga o efeito só quando o jogador diz que inclui a si mesmo', () => {
    expect(run(st(), castEvent({ catalog, state: st(), origin, spell: bless, way })).modifiers).toEqual([]);
    const next = run(st(), castEvent({ catalog, state: st(), origin, spell: bless, way, onSelf: true }));
    expect(next.modifiers[0]).toMatchObject({ label: 'Bless', concentration: bless.key });
  });

  it("Hunter's Mark é só em si mesmo: liga sempre; trocar de concentração tira o efeito anterior", () => {
    const hm = spell({ key: 'spell:r|HM', name: "Hunter's Mark", level: 1, concentration: true });
    const s1 = run(st(), castEvent({ catalog, state: st(), origin, spell: hm, way }));
    expect(s1.modifiers.map((m) => m.label)).toEqual(["Hunter's Mark"]);
    const s2 = run(s1, castEvent({ catalog, state: s1, origin, spell: bless, way, onSelf: true }));
    expect(s2.modifiers.map((m) => m.label)).toEqual(['Bless']);
  });
});
