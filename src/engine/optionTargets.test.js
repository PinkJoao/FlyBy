// =============================================================================
// optionTargets.test: a cantrip que uma invocação melhora, e as opções repetíveis
// =============================================================================
// O QUE FAZ
//   Prova a leitura do texto (Agonizing Blast, Eldritch Spear, Repelling Blast), o filtro das
//   cantrips, a repetição (a chave do `sub` de cada ocorrência, a cantrip que não repete) e as
//   escolhas lidas do personagem para o jogo (DDL-0240).
//
// FUNÇÕES
//   (só testes)
// -----------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { cantripTargetChoice, cantripPasses, isRepeatableOption, subKeyOf, withTargetOptions, optionTargets } from './optionTargets';

const agonizing = { name: 'Agonizing Blast', source: 'XPHB', entries: ['Choose one of your known Warlock cantrips that deals damage. You can add your Charisma modifier to that spell\'s damage rolls.', { type: 'entries', name: 'Repeatable', entries: ['You can gain this invocation more than once. Each time you do so, choose a different eligible cantrip.'] }] };
const spear = { name: 'Eldritch Spear', source: 'XPHB', entries: ['Choose one of your known Warlock cantrips that deals damage and has a range of 10+ feet.'] };
const repel = { name: 'Repelling Blast', source: 'XPHB', entries: ['Choose one of your known Warlock cantrips that requires an attack roll.'] };
const eb = { name: 'Eldritch Blast', source: 'XPHB', level: 0, damageInflict: ['force'], spellAttack: ['R'], range: { distance: { type: 'feet', amount: 120 } } };
const thunder = { name: 'Thunderclap', source: 'XPHB', level: 0, damageInflict: ['thunder'], range: { distance: { type: 'self' } } };
const hand = { name: 'Mage Hand', source: 'XPHB', level: 0, range: { distance: { type: 'feet', amount: 30 } } };
const db = { 'spells-xphb': { spell: [eb, thunder, hand] } };

describe('a cantrip escolhida', () => {
  it('lê o filtro do texto', () => {
    expect(cantripTargetChoice(agonizing).pool.cantripFilter).toEqual({ className: 'Warlock', damage: true, range10: false, attack: false });
    expect(cantripTargetChoice(spear).pool.cantripFilter).toMatchObject({ damage: true, range10: true });
    expect(cantripTargetChoice(repel).pool.cantripFilter).toMatchObject({ attack: true });
    expect(cantripTargetChoice({ entries: ['You gain darkvision.'] })).toBeNull();
  });

  it('filtra por dano, alcance e ataque', () => {
    expect([eb, thunder, hand].filter((s) => cantripPasses(s, { damage: true })).map((s) => s.name)).toEqual(['Eldritch Blast', 'Thunderclap']);
    expect([eb, thunder].filter((s) => cantripPasses(s, { damage: true, range10: true })).map((s) => s.name)).toEqual(['Eldritch Blast']);
    expect([eb, thunder].filter((s) => cantripPasses(s, { attack: true })).map((s) => s.name)).toEqual(['Eldritch Blast']);
  });

  it('as opções vêm das cantrips de bruxo do personagem, sem as já tomadas', () => {
    const character = { classes: [{ classId: 'warlock', spells: [{ id: 'Eldritch Blast', source: 'XPHB' }, { id: 'Thunderclap', source: 'XPHB' }, { id: 'Mage Hand', source: 'XPHB' }] }] };
    const [ch] = withTargetOptions([cantripTargetChoice(agonizing)], { character, db, taken: ['Eldritch Blast'] });
    expect(ch.pool.options.map((o) => o.value)).toEqual(['Thunderclap']);
  });
});

describe('a opção repetível', () => {
  it('pelo texto, e a chave do sub de cada ocorrência', () => {
    expect(isRepeatableOption(agonizing)).toBe(true);
    expect(isRepeatableOption(spear)).toBe(false);
    const picks = ['Agonizing Blast|XPHB', 'Devil\'s Sight|XPHB', 'Agonizing Blast|XPHB'];
    expect(picks.map((_, i) => subKeyOf(picks, i))).toEqual(['Agonizing Blast|XPHB', 'Devil\'s Sight|XPHB', 'Agonizing Blast|XPHB#2']);
  });

  it('as escolhas do personagem por opção', () => {
    const picks = ['Agonizing Blast|XPHB', 'Agonizing Blast|XPHB'];
    const character = { classes: [{ choices: { 'optfeat@EI': { kind: 'optionalfeature', picks, sub: { 'Agonizing Blast|XPHB': { cantripTarget: { picks: ['Eldritch Blast'] } }, 'Agonizing Blast|XPHB#2': { cantripTarget: { picks: ['Thunderclap'] } } } } } }] };
    expect(optionTargets(character)).toEqual({ 'agonizing blast': ['Eldritch Blast', 'Thunderclap'] });
  });
});
