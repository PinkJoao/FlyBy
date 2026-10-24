// =============================================================================
// playEffects.test: testes de condições, modificadores e efeitos
// =============================================================================
// FUNÇÕES
//   st(patch): um estado de jogo com o patch por cima do descansado.
//   run(state, event): o estado depois das operações do evento.
//   ids(effects): os ids dos efeitos de uma rolagem.
//
// DECISÕES E ARMADILHAS
//   - Cada condição testada é conferida contra o texto do XPHB: o que ela faz nas
//     rolagens DO personagem; o resto é lembrete e não entra na soma.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { emptyPlayState, applyOp } from './playState';
import {
  conditionList, rollEffects, applyEffects, effectiveDefenses, effectiveAc, effectiveSpeed, makeModifier,
  featureModifier, spellModifier, endConcentrationOps, restModifierOps, conditionEvent, modifierEvent, removeModifierEvent,
} from './playEffects';

const st = (patch = {}) => ({ ...emptyPlayState(), ...patch });
const run = (state, event) => event.ops.reduce(applyOp, state);
const ids = (effects) => effects.map((e) => e.id);
const catalog = {
  stats: { ac: 15, speed: 30 },
  defenses: { resist: ['fire'], immune: [], vulnerable: [] },
  rollData: { 'scale.barbarian.rage-damage': 3, 'scale.rogue.sneak-attack': '3d6' },
  features: ['improved critical', 'reliable talent'],
};

describe('condições', () => {
  it('as incluídas entram junto (Unconscious traz Incapacitated e Prone)', () => {
    expect(conditionList(st({ conditions: { unconscious: 1 } })).ids.sort()).toEqual(['incapacitated', 'prone', 'unconscious']);
  });

  it('Poisoned: desvantagem em ataque e teste, nada no save', () => {
    const s = st({ conditions: { poisoned: 1 } });
    expect(applyEffects(rollEffects(s, catalog, { kind: 'attack' })).disadvantage).toBe(1);
    expect(applyEffects(rollEffects(s, catalog, { kind: 'check', ability: 'dex' })).disadvantage).toBe(1);
    expect(rollEffects(s, catalog, { kind: 'save', ability: 'con' })).toEqual([]);
  });

  it('Paralyzed: falha automática em saves de FOR e DES; deslocamento zero', () => {
    const s = st({ conditions: { paralyzed: 1 } });
    expect(applyEffects(rollEffects(s, catalog, { kind: 'save', ability: 'dex' })).autoFail).toBe(true);
    expect(applyEffects(rollEffects(s, catalog, { kind: 'save', ability: 'wis' })).autoFail).toBe(false);
    expect(effectiveSpeed(catalog, s)).toBe(0);
  });

  it('Restrained: desvantagem em save de DES; Invisible: vantagem no ataque e na iniciativa', () => {
    expect(applyEffects(rollEffects(st({ conditions: { restrained: 1 } }), catalog, { kind: 'save', ability: 'dex' })).disadvantage).toBe(1);
    const inv = st({ conditions: { invisible: 1 } });
    expect(applyEffects(rollEffects(inv, catalog, { kind: 'attack' })).advantage).toBe(1);
    expect(applyEffects(rollEffects(inv, catalog, { kind: 'initiative', ability: 'dex' })).advantage).toBe(1);
  });

  it('Exaustão: -2 por nível em todo d20 e -5 pés por nível', () => {
    const s = st({ conditions: { exhaustion: 2 } });
    for (const kind of ['attack', 'check', 'save', 'deathSave', 'concentration', 'initiative']) {
      expect(applyEffects(rollEffects(s, catalog, { kind, ability: 'str' })).parts).toEqual([{ label: 'Exhaustion 2', formula: -4 }]);
    }
    expect(rollEffects(s, catalog, { kind: 'damage' })).toEqual([]);
    expect(effectiveSpeed(catalog, s)).toBe(20);
  });

  it('Frightened é condicional: vem ligado e com a nota', () => {
    const [e] = rollEffects(st({ conditions: { frightened: 1 } }), catalog, { kind: 'attack' });
    expect(e).toMatchObject({ defaultOn: true, dis: 1, note: 'while the source of fear is in sight' });
    expect(applyEffects([e], []).disadvantage).toBe(0);
  });

  it('incapacitar quebra a concentração, o que dependia dela e a Rage, no mesmo evento', () => {
    const rage = featureModifier({ key: 'action:rage' }, catalog);
    const bless = spellModifier({ name: 'Bless', key: 'spell:x|Bless', concentration: true }).modifier;
    const s = st({ concentration: { name: 'Bless' }, modifiers: [rage, bless] });
    const next = run(s, conditionEvent({ state: s, id: 'stunned', level: 1 }));
    expect(next.concentration).toBeNull();
    expect(next.modifiers).toEqual([]);
    expect(next.conditions).toEqual({ stunned: 1 });
  });
});

describe('efeitos de feature e de magia', () => {
  it('Rage: vantagem em FOR, dano extra só em ataque com FOR, resistência física', () => {
    const s = st({ modifiers: [featureModifier({ key: 'action:rage' }, catalog)] });
    expect(applyEffects(rollEffects(s, catalog, { kind: 'check', ability: 'str' })).advantage).toBe(1);
    expect(applyEffects(rollEffects(s, catalog, { kind: 'save', ability: 'str' })).advantage).toBe(1);
    expect(applyEffects(rollEffects(s, catalog, { kind: 'save', ability: 'dex' })).advantage).toBe(0);
    expect(applyEffects(rollEffects(s, catalog, { kind: 'damage', attackAbility: 'str', weapon: true })).parts).toEqual([{ label: 'Rage damage', formula: '@scale.barbarian.rage-damage' }]);
    expect(applyEffects(rollEffects(s, catalog, { kind: 'damage', attackAbility: 'dex', weapon: true })).parts).toEqual([]);
    expect(effectiveDefenses(catalog, s).resist.sort()).toEqual(['bludgeoning', 'fire', 'piercing', 'slashing']);
  });

  it('Bless soma 1d4 no ataque, no save, no save de concentração e no de morte', () => {
    const { modifier } = spellModifier({ name: 'Bless', key: 'k', concentration: true });
    const s = st({ modifiers: [modifier] });
    for (const kind of ['attack', 'save', 'concentration', 'deathSave']) {
      expect(applyEffects(rollEffects(s, catalog, { kind, ability: 'wis' })).parts).toEqual([{ label: 'Bless', formula: '1d4' }]);
    }
    expect(applyEffects(rollEffects(s, catalog, { kind: 'check', ability: 'wis' })).parts).toEqual([]);
    expect(modifier.concentration).toBe('k');
  });

  it("Hunter's Mark é rider opcional; Shield of Faith soma 2 na CA", () => {
    const hm = spellModifier({ name: "Hunter's Mark", key: 'h', concentration: true });
    expect(hm.self).toBe(true);
    const s = st({ modifiers: [hm.modifier, spellModifier({ name: 'Shield of Faith', key: 's', concentration: true }).modifier] });
    const [rider] = rollEffects(s, catalog, { kind: 'damage', weapon: true }).filter((e) => e.source === "Hunter's Mark");
    expect(rider.defaultOn).toBe(false);
    expect(effectiveAc(catalog, s)).toBe(17);
    expect(spellModifier({ name: 'Fireball' })).toBeNull();
  });

  it('Sneak Attack é rider opcional com a escala; as passivas mudam o crítico e o piso', () => {
    expect(rollEffects(st(), catalog, { kind: 'damage', weapon: true }).find((e) => e.id === 'rider:sneak-attack')).toMatchObject({ defaultOn: false, part: { formula: '@scale.rogue.sneak-attack' } });
    expect(applyEffects(rollEffects(st(), catalog, { kind: 'attack', weapon: true })).critThreshold).toBe(19);
    expect(applyEffects(rollEffects(st(), catalog, { kind: 'check', proficient: true })).d20Min).toBe(10);
    expect(applyEffects(rollEffects(st(), catalog, { kind: 'check', proficient: false })).d20Min).toBeNull();
  });
});

describe('modificadores manuais e duração', () => {
  it('o "-2 em tudo" do mestre pega cada alvo pedido, e a perícia por nome', () => {
    const m = makeModifier({ label: 'DM penalty', effects: [{ targets: ['attack', 'check', 'save'], formula: '-2' }, { targets: ['skill:ste'], mode: 'advantage' }] });
    const s = st({ modifiers: [m] });
    expect(applyEffects(rollEffects(s, catalog, { kind: 'save', ability: 'con' })).parts).toEqual([{ label: 'DM penalty', formula: '-2' }]);
    expect(applyEffects(rollEffects(s, catalog, { kind: 'check', ability: 'dex', skill: 'ste' })).advantage).toBe(1);
    expect(ids(rollEffects(s, catalog, { kind: 'damage' }))).toEqual([]);
  });

  it('o descanso tira o que é de descanso; terminar a concentração tira o que dependia dela', () => {
    const manual = makeModifier({ label: 'Forever', effects: [] });
    const short = makeModifier({ label: 'Until rest', duration: 'shortRest', effects: [] });
    const long = makeModifier({ label: 'Until long rest', duration: 'longRest', effects: [] });
    const rage = featureModifier({ key: 'action:rage' }, catalog);
    const conc = makeModifier({ label: 'Bless', source: 'spell', concentration: 'k', effects: [] });
    const s = st({ concentration: { name: 'Bless' }, modifiers: [manual, short, long, rage, conc] });
    const removed = (ops) => ops.map((o) => s.modifiers.find((m) => m.id === o.remove).label).sort();
    expect(removed(restModifierOps(s, 'sr'))).toEqual(['Rage', 'Until rest']);
    expect(removed(restModifierOps(s, 'lr'))).toEqual(['Bless', 'Rage', 'Until long rest', 'Until rest']);
    expect(endConcentrationOps(s)).toEqual([{ op: 'concentration', value: null }, { op: 'modifier', remove: conc.id }]);
  });

  it('ligar e tirar modificador viram eventos', () => {
    const m = makeModifier({ label: 'Haste', ac: 2, speed: 30, effects: [] });
    const on = run(st(), modifierEvent({ modifier: m }));
    expect(effectiveAc(catalog, on)).toBe(17);
    expect(effectiveSpeed(catalog, on)).toBe(60);
    expect(run(on, removeModifierEvent({ state: on, id: m.id })).modifiers).toEqual([]);
  });
});
