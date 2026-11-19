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
import { castWays, castEvent, slotPoolsFor, spellAttackOf, healParts, spellHealEvent, isZoneSpell, activeZone, endZoneEvent, zoneUsedOps, spellTempFormula, projectileCount, timesFormula } from './playCast';
import { spellCosts } from './playBasicActions';
import { rollDamageEvent, rollAttackEvent } from './playActions';

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
  it('o ritual do grimório pelo Ritual Adept só tem o caminho do ritual (TC-0158)', () => {
    expect(castWays(catalog, st(), spell({ level: 1, ritual: true, ritualOnly: true })).map((w) => w.id)).toEqual(['ritual']);
  });

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

describe('slotPoolsFor (cabeçalho do círculo)', () => {
  const pools = (cat, level, state = st()) => slotPoolsFor(cat, state, level).map((p) => `${p.label} ${p.left}/${p.max}`);
  it('multiclasse com bruxo: o espaço do círculo e o pacto, que serve até o círculo dele', () => {
    expect(pools(catalog, 1)).toEqual(['Level 1 slots 4/4', 'Pact slots (level 2) 1/1']);
    expect(pools(catalog, 2)).toEqual(['Level 2 slots 2/2', 'Pact slots (level 2) 1/1']);
    expect(pools(catalog, 3)).toEqual([]);
    expect(pools(catalog, 0)).toEqual([]);
  });
  it('bruxo puro 5: pacto 2x círculo 3 em todos os grupos até o 3; o gasto aparece', () => {
    const warlock = { resources: [{ key: 'pact', kind: 'pact', level: 3, max: 2 }] };
    expect([1, 2, 3, 4].map((l) => pools(warlock, l).length)).toEqual([1, 1, 1, 0]);
    expect(pools(warlock, 2, st({ spent: { pact: 1 } }))).toEqual(['Pact slots (level 3) 1/2']);
  });
  it('bruxo 11: o Mystic Arcanum não é espaço (o grupo 6 não mostra nada)', () => {
    const warlock = { resources: [{ key: 'pact', kind: 'pact', level: 5, max: 3 }, { key: 'granted:class:warlock|Circle of Death', kind: 'granted', max: 1 }] };
    expect(pools(warlock, 5)).toEqual(['Pact slots (level 5) 3/3']);
    expect(pools(warlock, 6)).toEqual([]);
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

describe('gastos para lançar (SPELL_COSTS)', () => {
  const fireBolt = { name: 'Fire Bolt', time: 'action', level: 0 };
  const shield = { name: 'Shield', time: 'reaction', level: 1 };
  const font = { key: 'pool:font-of-magic', kind: 'pool', name: 'Font of Magic', item: 'Font of Magic', max: 5 };

  it('sem feature, só o tempo da magia', () => {
    expect(spellCosts(fireBolt, { features: [], resources: [] }).map((c) => c.cost)).toEqual(['action']);
  });

  it('Quickened Spell: magia de ação também pela bônus, gastando 2 Sorcery Points', () => {
    const cat = { features: ['quickened spell'], resources: [font] };
    const [base, quick] = spellCosts(fireBolt, cat);
    expect(base).toMatchObject({ cost: 'action', label: 'Action', source: null });
    expect(quick).toMatchObject({ cost: 'bonus', label: 'Bonus Action', source: 'Quickened Spell', spend: { key: 'pool:font-of-magic', amount: 2 } });
    expect(spellCosts(shield, cat)).toHaveLength(1);
  });

  it('feature de uma magia só: Mantle of Majesty (Command sem slot), Misty Escape (reação)', () => {
    const glamour = spellCosts({ name: 'Command', time: 'action', level: 1 }, { features: ['mantle of majesty'], resources: [] });
    expect(glamour[1]).toMatchObject({ cost: 'bonus', source: 'Mantle of Majesty', noSlot: true });
    expect(spellCosts(fireBolt, { features: ['mantle of majesty'], resources: [] })).toHaveLength(1);
    const misty = spellCosts({ name: 'Misty Step', time: 'bonus', level: 2 }, { features: ['misty escape'], resources: [] });
    expect(misty.map((c) => c.cost)).toEqual(['bonus', 'reaction']);
  });
});


describe('o modificador de conjuração no dano da magia (DDL-0245)', () => {
  it('Spiritual Weapon soma o modificador; Fireball não', () => {
    const origin = { attackBonus: 7, saveDc: 15, abilityMod: 4 };
    const sw = spellAttackOf(origin, { key: 'k', name: 'Spiritual Weapon', level: 2, mechanics: { attack: 'M', damage: { dice: '1d8', types: ['force'], addMod: true }, upcast: '1d8' } }, 2);
    expect(sw.damage).toMatchObject({ dice: '1d8', bonus: 4 });
    const fb = spellAttackOf(origin, { key: 'f', name: 'Fireball', level: 3, mechanics: { save: 'dex', damage: { dice: '8d6', types: ['fire'] }, upcast: '1d6' } }, 3);
    expect(fb.damage.bonus).toBe(0);
  });
});

describe('magia de área ativa (DDL-0249)', () => {
  const hunger = spell({ key: 'spell:w|Hunger of Hadar', name: 'Hunger of Hadar', level: 3, concentration: true, mechanics: { attack: null, save: null, damage: { dice: '2d6', types: ['cold'], later: true }, heal: null, upcast: null } });
  const cordon = spell({ key: 'spell:w|Cordon of Arrows', name: 'Cordon of Arrows', level: 2, mechanics: { attack: null, save: 'dex', damage: { dice: '2d4', types: ['piercing'], later: true }, heal: null, upcast: null } });
  const way3 = { id: 'slot:3', key: 'slot:3', level: 3, left: 2 };

  it("é a de dano depois sem efeito curado nem instância leve", () => {
    expect(isZoneSpell(hunger)).toBe(true);
    expect(isZoneSpell(spell({ name: "Hunter's Mark", mechanics: { damage: { dice: '1d6', later: true } } }))).toBe(false);
    expect(isZoneSpell(spell({ name: 'Produce Flame', mechanics: { damage: { dice: '1d8', later: true } } }))).toBe(false);
    expect(isZoneSpell(spell({ name: 'Fireball', mechanics: { damage: { dice: '8d6' } } }))).toBe(false);
  });

  it('a de concentração fica ativa pela concentração e acaba com ela', () => {
    const s = run(st(), castEvent({ state: st(), catalog, origin, spell: hunger, way: way3 }));
    expect(activeZone(s, hunger)).toEqual({ level: 3, concentration: true, castUsed: [] });
    const ended = run(s, endZoneEvent({ state: s, spell: hunger }));
    expect(activeZone(ended, hunger)).toBeNull();
    expect(ended.concentration).toBeNull();
  });

  it('a sem concentração ganha um marcador; lançar de novo troca o marcador, e encerrar o tira', () => {
    const way2 = { id: 'slot:2', key: 'slot:2', level: 2, left: 2 };
    let s = run(st(), castEvent({ state: st(), catalog, origin, spell: cordon, way: way2 }));
    expect(activeZone(s, cordon)).toMatchObject({ level: 2, concentration: false });
    s = run(s, castEvent({ state: s, catalog, origin, spell: cordon, way: way2 }));
    expect(s.modifiers.filter((m) => m.zone === cordon.key)).toHaveLength(1);
    s = run(s, endZoneEvent({ state: s, spell: cordon }));
    expect(activeZone(s, cordon)).toBeNull();
  });

  it('o extra de uma rolagem por lançamento fica na zona e volta a valer ao lançar de novo (DDL-0251)', () => {
    const id = 'prose:empowered-evocation:0';
    let s = run(st(), castEvent({ state: st(), catalog, origin, spell: hunger, way: way3 }));
    s = run(s, { ops: zoneUsedOps(s, hunger, [id]) });
    expect(activeZone(s, hunger).castUsed).toEqual([id]);
    expect(zoneUsedOps(s, hunger, [id])).toEqual([]);
    s = run(s, castEvent({ state: s, catalog, origin, spell: hunger, way: way3 }));
    expect(activeZone(s, hunger).castUsed).toEqual([]);
    const way2 = { id: 'slot:2', key: 'slot:2', level: 2, left: 2 };
    let c = run(st(), castEvent({ state: st(), catalog, origin, spell: cordon, way: way2 }));
    c = run(c, { ops: zoneUsedOps(c, cordon, [id]) });
    expect(activeZone(c, cordon).castUsed).toEqual([id]);
    expect(c.modifiers.filter((m) => m.zone === cordon.key)).toHaveLength(1);
  });
});

describe('projéteis (TC-0175, DDL-0249)', () => {
  it('Eldritch Blast pelo nível do personagem; Magic Missile e Scorching Ray pelo círculo', () => {
    expect(projectileCount({ name: 'Eldritch Blast' }, 0, 4).count).toBe(1);
    expect(projectileCount({ name: 'Eldritch Blast' }, 0, 11)).toEqual({ count: 3, noun: 'beam' });
    expect(projectileCount({ name: 'Eldritch Blast' }, 0, 17).count).toBe(4);
    expect(projectileCount({ name: 'Magic Missile' }, 1).count).toBe(3);
    expect(projectileCount({ name: 'Magic Missile' }, 4).count).toBe(6);
    expect(projectileCount({ name: 'Scorching Ray' }, 2).count).toBe(3);
    expect(projectileCount({ name: 'Scorching Ray' }, 3).count).toBe(4);
    expect(projectileCount({ name: 'Fireball' }, 3)).toBeNull();
  });

  it('a fórmula de k projéteis iguais', () => {
    expect(timesFormula('1d4 + 1', 3)).toBe('3d4 + 3');
    expect(timesFormula('2d6', 2)).toBe('4d6');
  });
});

describe('o ataque de magia de círculo guarda o círculo (TC-0174, DDL-0249)', () => {
  it('o evento do ataque leva o círculo e o nome, para o dano do card', () => {
    const ray = spell({ key: 'spell:class:cleric|Guiding Bolt', name: 'Guiding Bolt', level: 1, mechanics: { attack: 'R', save: null, damage: { dice: '4d6', types: ['radiant'] }, heal: null, upcast: '1d6' } });
    const atk = spellAttackOf(origin, ray, 3);
    expect(atk.level).toBe(3);
    const e = rollAttackEvent({ catalog, attack: atk, rng: seq(12) });
    expect(e.payload).toMatchObject({ attackKey: ray.key, level: 3, name: 'Guiding Bolt' });
  });
});


describe('as invocações de 2014 que gastam espaço e o temporário ao lançar (DDL-0257)', () => {
  const cat = { resources: [{ key: 'pact', kind: 'pact', name: 'Pact slots', level: 5, max: 3 }, { key: 'granted:w|Slow', kind: 'granted', name: 'Slow', max: 1 }] };
  const slow = { key: 'spell:w|Slow', name: 'Slow', level: 3, castType: 'daily', uses: 'granted:w|Slow', slot: true, mechanics: {} };
  it('Mire the Mind: só o espaço de pacto, gastando também o uso por descanso', () => {
    const ways = castWays(cat, st(), slow);
    expect(ways.map((w) => w.id)).toEqual(['pact']);
    expect(ways[0]).toMatchObject({ key: 'pact', also: 'granted:w|Slow' });
    const s = run(st(), castEvent({ state: st(), catalog: cat, origin: { key: 'w', label: 'Warlock' }, spell: slow, way: ways[0] }));
    expect(s.spent).toMatchObject({ pact: 1, 'granted:w|Slow': 1 });
  });
  it('sem o `slot`, o uso por descanso continua de graça', () => {
    expect(castWays(cat, st(), { ...slow, slot: false }).map((w) => w.id)).toEqual(['uses', 'pact']);
  });
  it('False Life e Armor of Agathys pelo círculo', () => {
    expect(spellTempFormula({ name: 'False Life', level: 1 }, 1)).toBe('2d4 + 4');
    expect(spellTempFormula({ name: 'False Life', level: 1 }, 3)).toBe('2d4 + 14');
    expect(spellTempFormula({ name: 'Armor of Agathys', level: 1 }, 2)).toBe('10');
    expect(spellTempFormula({ name: 'Shield', level: 1 }, 1)).toBeNull();
  });
});

describe('magia de item: pelas cargas, nunca pelos espaços (DDL-0257)', () => {
  const cat = { ...catalog, resources: [...catalog.resources, { key: 'charges:w1', kind: 'charges', max: 7 }] };
  const fireball = spell({ name: 'Fireball', level: 3, itemUid: 'w1', chargeKey: 'charges:w1', chargeCost: 1, chargeUpcast: true, chargeCap: 3 });

  it('uma forma por carga até o teto do texto, o círculo subindo', () => {
    const ways = castWays(cat, st({ spent: { 'charges:w1': 2 } }), fireball);
    expect(ways.map((w) => [w.id, w.level, w.amount, w.left])).toEqual([['charges:1', 3, 1, 5], ['charges:2', 4, 2, 5], ['charges:3', 5, 3, 5]]);
  });

  it('sem upcast: só o custo; o lançamento gasta as cargas da forma', () => {
    const web = spell({ name: 'Web', level: 2, itemUid: 'w1', chargeKey: 'charges:w1', chargeCost: 1, chargeUpcast: false });
    expect(castWays(cat, st(), web).map((w) => w.id)).toEqual(['charges:1']);
    const ev = castEvent({ catalog: cat, state: st(), origin, spell: fireball, way: castWays(cat, st(), fireball)[2] });
    expect(run(st(), ev).spent['charges:w1']).toBe(3);
  });

  it('a magia por dia do item usa só o uso', () => {
    const daily = spell({ name: 'Misty Step', level: 2, itemUid: 'c1', castType: 'daily', uses: 'granted:race|Misty Step' });
    expect(castWays(cat, st(), daily).map((w) => w.id)).toEqual(['uses']);
  });
});
