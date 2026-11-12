// =============================================================================
// playSummons.test: invocar, PV dos membros, dispensar e a ação como ataque
// =============================================================================
// O QUE FAZ
//   Prova o estado dos summons pelo log (applyEvent), a troca de concentração que
//   tira o summon anterior, a vista com o PV pelo bloco e o contexto, e a ação no
//   formato de ataque do play mode.
//
// FUNÇÕES
//   (só testes)
//
// DECISÕES E ARMADILHAS
//   - O bloco é o Bestial Spirit no formato do 5etools, reduzido ao que a vista usa.
//   - As instâncias leves (S4, DDL-0194) usam a prosa do XPHB (Spiritual Weapon, Mage
//     Hand, Bigby's Hand, Conjure Animals) e o Eldritch Cannon do EFA (objects.json).
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { emptyPlayState, applyEvent, makeEvent } from './playState';
import { summonCreaturesFor, summonOps, summonGroupView, summonVitalsEvent, dismissEvent, summonAttack, summonTurnOf, turnText, featureSummons, isSummonFeature, familiarForms, isLightSummon, lightRulesOf, lightOps } from './playSummons';
import { objectSummons, creatureStats } from './creature';
import { endConcentrationOps } from './playEffects';
import { nextTurnEvent } from './playCombat';

const spirit = {
  name: 'Bestial Spirit', source: 'XPHB', summonedBySpell: 'Summon Beast|XPHB', summonedBySpellLevel: 2,
  ac: [{ special: "11 + the spell's level" }],
  hp: { special: '20 (Air only) or 30 (Land and Water only) + 5 for each spell level above 2' },
  action: [{ name: 'Rend', entries: ['{@atkr m} {@hitYourSpellAttack Bonus equals your spell attack modifier}, reach 5 ft. {@h}{@damage 1d8 + 4 + summonSpellLevel} Piercing damage.'] }],
};
const catalog = { stats: { profBonus: 3 }, rollData: { abilities: { wis: { mod: 3 } } } };
const origin = { attackBonus: 6, saveDc: 14, abilityMod: 3 };
const spell = { name: 'Summon Beast', source: 'XPHB', key: 'spell:x|Summon Beast', concentration: true };

describe('summons no play mode (DDL-0192)', () => {
  it('a magia acha a criatura pelo summonedBySpell', () => {
    expect(summonCreaturesFor([spirit, { name: 'Wolf', source: 'XMM' }], spell)).toEqual([spirit]);
  });
  it('invocar, ferir um membro, a vista e dispensar', () => {
    let state = emptyPlayState();
    state = applyEvent(state, makeEvent('cast', { ops: summonOps({ state, creature: spirit, spell, level: 3, variant: 'Air', count: 2, origin, catalog }) }));
    expect(state.summons).toHaveLength(1);
    const g = state.summons[0];
    expect(g.members).toHaveLength(2);
    state = applyEvent(state, summonVitalsEvent({ group: g, member: summonGroupView(g, spirit).members[1], kind: 'hurt', amount: 10 }));
    const v = summonGroupView(state.summons[0], spirit);
    expect(v.stats.ac.value).toBe(14);
    expect(v.members.map((m) => m.current)).toEqual([25, 15]);
    const rend = summonAttack(g, v.stats.actions[0], v.stats);
    expect(rend.attack.bonus).toBe(6);
    expect(rend.damage.dice).toBe('1d8 + 4 + 3');
    state = applyEvent(state, dismissEvent(state.summons[0]));
    expect(state.summons).toHaveLength(0);
  });
  it('PV do membro: temporário que não soma e absorve, máximo que sobe com o atual, cura, corte do máximo (DDL-0201)', () => {
    let state = emptyPlayState();
    state = applyEvent(state, makeEvent('cast', { ops: summonOps({ state, creature: spirit, spell, level: 3, variant: 'Air', origin, catalog }) }));
    const id = state.summons[0].id;
    const step = (kind, amount, opts = {}) => {
      const g = state.summons.find((x) => x.id === id);
      const ev = summonVitalsEvent({ group: g, member: summonGroupView(g, spirit).members[0], kind, amount, ...opts });
      state = applyEvent(state, ev);
      return { ev, m: summonGroupView(state.summons[0], spirit).members[0] };
    };
    expect(step('temp', 5).m).toMatchObject({ max: 25, current: 25, temp: 5 });
    expect(step('temp', 3).m.temp).toBe(5);
    expect(step('temp', 3, { replace: true }).m.temp).toBe(3);
    expect(step('hurt', 10).m).toMatchObject({ current: 18 });
    expect(state.summons[0].members[0].temp).toBe(0);
    expect(step('max', 5).m).toMatchObject({ max: 30, current: 23 });
    const heal = step('heal', 100);
    expect(heal.m.current).toBe(30);
    expect(heal.ev.payload).toMatchObject({ from: 23, to: 30 });
    expect(step('hurt', 100).m.current).toBe(0);
    expect(state.summons[0].members[0].damage).toBe(30);
    expect(step('heal', 4).m.current).toBe(4);
    const cut = step('hurt', 3, { affectMax: true });
    expect(cut.m).toMatchObject({ max: 27, current: 1 });
    expect(cut.ev.payload.maxCut).toBe(3);
  });
  it('a concentração que acaba, por qualquer caminho, tira o summon ligado (DDL-0193)', () => {
    let state = emptyPlayState();
    state = applyEvent(state, makeEvent('cast', { ops: [...summonOps({ state, creature: spirit, spell, level: 2, origin, catalog }), { op: 'concentration', value: { name: 'Summon Beast' } }] }));
    expect(endConcentrationOps(state).filter((o) => o.op === 'summon')).toHaveLength(1);
    state = applyEvent(state, makeEvent('concentration', { ops: endConcentrationOps(state) }));
    expect(state.summons).toHaveLength(0);
  });
  it('sem concentração, sai na rodada certa; a rodada diz quem age depois de você', () => {
    let state = { ...emptyPlayState(), combat: { round: 1, used: {} } };
    const sp = { ...spell, concentration: false, durationRounds: 2 };
    const turn = summonTurnOf(['The creature shares your Initiative count, but it takes its turn immediately after yours. It obeys your verbal commands (no action required by you).']);
    expect(turn).toEqual({ order: 'after', command: 'free' });
    expect(turnText(turn)).toBe('Acts right after you · commands are free');
    state = applyEvent(state, makeEvent('cast', { ops: summonOps({ state, creature: spirit, spell: sp, level: 2, origin, catalog, turn }) }));
    const r2 = nextTurnEvent({ state });
    expect(r2.payload.after).toEqual(['Bestial Spirit']);
    state = applyEvent(state, r2);
    const r3 = nextTurnEvent({ state });
    expect(r3.payload.ended).toContain('Bestial Spirit');
    state = applyEvent(state, r3);
    expect(state.summons).toHaveLength(0);
  });
  it('o Steel Defender pede Ação Bônus pela prosa da feature', () => {
    expect(summonTurnOf(['you can take a {@variantrule Bonus Action|XPHB} to command it to take an action']).command).toBe('bonus');
  });
  it('companheiros de classe e as formas do Find Familiar', () => {
    const bestiary = [
      { name: 'Steel Defender', source: 'TCE', summonedByClass: 'Artificer|TCE' },
      { name: 'Steel Defender', source: 'EFA', summonedByClass: 'Artificer|EFA' },
      { name: 'Owl', source: 'XMM', type: 'beast', cr: '0' },
      { name: 'Cat', source: 'XMM', type: 'beast', cr: '0' },
      { name: 'Wolf', source: 'XMM', type: 'beast', cr: '1/4' },
    ];
    expect(isSummonFeature('Steel Defender')).toBe(true);
    expect(isSummonFeature('Wild Shape')).toBe(false);
    expect(featureSummons(bestiary, 'Steel Defender').map((m) => m.source)).toEqual(['EFA']);
    expect(familiarForms(bestiary).map((m) => m.name)).toEqual(['Cat', 'Owl']);
  });
  it('a regra da instância leve vem da prosa da magia', () => {
    expect(isLightSummon({ name: 'Spiritual Weapon' })).toBe(true);
    expect(isLightSummon({ name: 'Spirit Guardians' })).toBe(false);
    expect(lightRulesOf(['As a {@variantrule Bonus Action|XPHB} on your later turns, you can move the force up to 20 feet and repeat the attack against a creature within 5 feet of it.']))
      .toEqual({ command: 'bonus', ac: null, hp: null, replaces: false });
    expect(lightRulesOf(['The hand vanishes if it is ever more than 30 feet away from you or if you cast this spell again.', 'As a {@action Magic|XPHB} action on your later turns, you can control the hand thus again.']))
      .toEqual({ command: 'action', ac: null, hp: null, replaces: true });
    const bigby = lightRulesOf(['The hand is an object that has AC 20 and {@variantrule Hit Points|XPHB} equal to your {@variantrule Hit Points|XPHB} maximum.', 'When you cast the spell and as a Bonus Action on your later turns, you can move the hand up to 60 feet']);
    expect(bigby).toEqual({ command: 'bonus', ac: 20, hp: 'casterMax', replaces: false });
    expect(lightRulesOf(['when you move on your turn, you can also move the pack up to 30 feet']).command).toBe('free');
  });
  it('a instância leve entra sem bloco, com os PV do invocador, e o Mage Hand troca o anterior', () => {
    const bigby = { name: "Bigby's Hand", source: 'XPHB', key: 'spell:x|Bigby', concentration: true };
    const ops = lightOps({ state: emptyPlayState(), spell: bigby, level: 5, origin, catalog, rules: { command: 'bonus', ac: 20, hp: 'casterMax', replaces: false }, casterHpMax: 44 });
    let state = applyEvent(emptyPlayState(), makeEvent('cast', { label: 'Bigby', ops }));
    const g = state.summons[0];
    expect(g.ref).toBeNull();
    expect(g.light).toEqual({ ac: 20, hp: 44 });
    expect(g.ctx.spellLevel).toBe(5);
    expect(summonGroupView(g, null).members).toEqual([{ index: 0, max: 44, current: 44, conditions: [] }]);
    state = applyEvent(state, summonVitalsEvent({ group: g, member: summonGroupView(g, null).members[0], kind: 'hurt', amount: 10 }));
    expect(summonGroupView(state.summons[0], null).members[0].current).toBe(34);
    const hand = { name: 'Mage Hand', source: 'XPHB', key: 'spell:x|Mage Hand' };
    const rules = { command: 'action', ac: null, hp: null, replaces: true };
    state = applyEvent(state, makeEvent('cast', { label: 'Mage Hand', ops: lightOps({ state, spell: hand, level: 0, origin, catalog, rules }) }));
    expect(state.summons.find((x) => x.spell.name === 'Mage Hand').members).toEqual([]);
    state = applyEvent(state, makeEvent('cast', { label: 'Mage Hand', ops: lightOps({ state, spell: hand, level: 0, origin, catalog, rules }) }));
    expect(state.summons.filter((x) => x.spell.name === 'Mage Hand')).toHaveLength(1);
    expect(state.summons).toHaveLength(2);
  });
  it('o Eldritch Cannon do EFA é objeto: CA, PV pelo nível de artífice e as três opções', () => {
    const [cannon] = objectSummons([
      { name: 'Eldritch Cannon', source: 'EFA', ac: 18, hp: { special: '5 × your artificer level (casting {@spell Mending|XPHB} on the cannon restores {@dice 2d6} hit points to it)' },
        entries: ['{@note Created by the {@subclassFeature Eldritch Cannon|Artificer|EFA|Artillerist|EFA|3} subclass feature.}'],
        actionEntries: [{ type: 'entries', name: 'Activate Cannon', entries: ['As a {@variantrule Bonus Action|XPHB}, you order the cannon to use the Flamethrower, Force Ballista, or Protector option below:', { type: 'list', items: [
          { type: 'item', name: 'Flamethrower', entries: ['Each creature in that area makes a Dexterity saving throw against {@dcYourSpellSave}, taking {@damage 2d8} Fire damage on a failed save'] },
          { type: 'item', name: 'Force Ballista', entries: ['Make a ranged spell attack originating from the cannon at one creature or object within 120 feet of it. On a hit, the target takes {@damage 2d8} Force damage'] },
          { type: 'item', name: 'Protector', entries: ['a number of {@variantrule Temporary Hit Points|XPHB} equal to {@dice 1d8} plus your Intelligence modifier'] },
        ] }] }] },
      { name: 'Chair', source: 'X', entries: [] },
    ]);
    expect(cannon.summonedByClass).toBe('Artificer|EFA');
    expect(featureSummons([cannon], 'Eldritch Cannon', 'EFA')).toEqual([cannon]);
    expect(summonTurnOf(cannon.actionEntries).command).toBe('bonus');
    const stats = creatureStats(cannon, { classLevel: 5, pb: 3, spellAttack: 7, spellDc: 15 });
    expect(stats.ac.value).toBe(18);
    expect(stats.hp.value).toBe(25);
    expect(stats.actions.map((a) => a.name)).toEqual(['Flamethrower', 'Force Ballista', 'Protector']);
    expect(stats.actions[0].save).toEqual({ ability: 'dex', dc: 15 });
    expect(stats.actions[1].attack).toEqual({ bonus: 7, kind: 'ranged' });
    expect(stats.actions[1].damage).toEqual([{ formula: '2d8', type: 'force' }]);
  });
});
