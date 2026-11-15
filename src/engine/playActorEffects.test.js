// =============================================================================
// playActorEffects.test: a ponte dos Active Effects do ator, dos dois lados
// =============================================================================
// O QUE FAZ
//   Prova que a lista fechada traduz o que tem de traduzir (vantagem do Danger Sense,
//   reroll do Luck, a Aura of Protection em todo save, a Elven Accuracy só com DES ou
//   mental) e que NÃO traduz o que a ficha já soma ou o que é interruptor (o efeito
//   desligado da Rage, a CA, a feature do registro curado).
//
// FUNÇÕES
//   item(name, changes, extra): um item de feature com um efeito.
//   catalogOf(items): o catálogo mínimo com os efeitos do ator.
//   labels(list): os rótulos dos extras, com "(off)" nos desligados.
//   st(patch): o estado de jogo vazio com o que o teste muda.
//
// DECISÕES E ARMADILHAS
//   - O ator é montado à mão: o teste prova a tradução, não o export (que o sweep prova).
// -----------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { actorRollEffects, targetOf, formulaOf } from './playActorEffects';
import { rollEffects, applyEffects } from './playEffects';
import { emptyPlayState } from './playState';
import { d20Test, sequenceRng } from './dice';

const item = (name, changes, extra = {}) => ({ type: 'feat', name, effects: [{ transfer: true, disabled: false, changes: changes.map(([key, value]) => ({ key, mode: 2, value })), ...extra }] });
const catalogOf = (items) => ({ actorEffects: actorRollEffects({ items }), features: [], rollData: {} });
const labels = (list) => list.filter((e) => e.id.startsWith('actor:')).map((e) => `${e.label}${e.defaultOn ? '' : ' (off)'}`);
const st = (patch = {}) => ({ ...emptyPlayState(), ...patch });

describe('a lista fechada', () => {
  it('traduz modo de rolagem, bônus e flags; recusa o que a ficha já soma', () => {
    expect(targetOf('system.abilities.dex.save.roll.mode')).toMatchObject({ kinds: ['save'], ability: 'dex', mode: true });
    expect(targetOf('flags.dnd5e.initiativeAdv')).toMatchObject({ kinds: ['initiative'] });
    expect(targetOf('system.bonuses.rwak.attack')).toMatchObject({ kinds: ['attack'], weapon: true, melee: false });
    expect(targetOf('system.attributes.ac.bonus')).toBeNull();
    expect(targetOf('system.attributes.movement.walk')).toBeNull();
    expect(targetOf('system.traits.dr.value')).toBeNull();
    expect(formulaOf('+ @attributes.prof')).toBe('@prof');
  });

  it('ignora o efeito desligado (Rage), o não transferido e a feature do registro curado', () => {
    const items = [
      item('Rage', [['system.abilities.str.save.roll.mode', '1']], { disabled: true }),
      item('Bless', [['system.bonuses.abilities.save', '1d4']], { transfer: false }),
      item('Dread Ambusher', [['system.attributes.init.bonus', '@abilities.wis.mod']]),
      { type: 'weapon', name: 'Longsword', effects: [{ transfer: true, changes: [{ key: 'system.bonuses.mwak.attack', value: '1' }] }] },
    ];
    expect(actorRollEffects({ items })).toEqual([]);
  });
});

describe('no diálogo da rolagem', () => {
  const c = catalogOf([
    item('Danger Sense', [['system.abilities.dex.save.roll.mode', '1']]),
    item('Luck', [['flags.dnd5e.halflingLucky', 'true']]),
    item('Aura of Protection', [['system.bonuses.abilities.save', '@abilities.cha.mod']]),
    item('Elven Accuracy', [['flags.dnd5e.elvenAccuracy', 'true']]),
    item('Frost Rune', [['system.abilities.str.bonuses.check', '+2']]),
    item('Improved Circle Forms', [['system.abilities.con.bonuses.save', '@abilities.wis.mod']]),
  ]);

  it('Danger Sense só no save de DES, e desliga com Incapacitated; a Aura em todo save, morte e concentração', () => {
    expect(labels(rollEffects(st(), c, { kind: 'save', ability: 'dex' }))).toEqual(['Danger Sense', 'Luck (reroll a 1)', 'Aura of Protection']);
    expect(labels(rollEffects(st(), c, { kind: 'save', ability: 'wis' }))).toEqual(['Luck (reroll a 1)', 'Aura of Protection']);
    expect(labels(rollEffects(st({ conditions: { incapacitated: 1 } }), c, { kind: 'save', ability: 'dex' }))).toContain('Danger Sense (off)');
    expect(labels(rollEffects(st(), c, { kind: 'deathSave' }))).toContain('Aura of Protection');
    expect(labels(rollEffects(st(), c, { kind: 'concentration' }))).toEqual(['Luck (reroll a 1)', 'Aura of Protection', 'Improved Circle Forms (off)']);
  });

  it('o condicional aparece desligado; a forma do Wild Shape liga o Improved Circle Forms', () => {
    expect(labels(rollEffects(st(), c, { kind: 'check', ability: 'str', skill: 'ath' }))).toContain('Frost Rune (off)');
    expect(labels(rollEffects(st({ form: { name: 'Wolf' } }), c, { kind: 'save', ability: 'con' }))).toContain('Improved Circle Forms');
  });

  it('Elven Accuracy só em ataque de DES ou mental; com vantagem rola 3d20', () => {
    expect(labels(rollEffects(st(), c, { kind: 'attack', attackAbility: 'str' }))).not.toContain('Elven Accuracy (3d20 with Advantage)');
    const applied = applyEffects(rollEffects(st(), c, { kind: 'attack', attackAbility: 'dex' }));
    expect(applied).toMatchObject({ elven: true, rerollOnes: true });
    const r = d20Test({ advantage: 1, elven: true, rng: sequenceRng([3, 17, 9]) });
    expect(r.natural).toBe(17);
    expect(r.parts[0].groups[0].results).toHaveLength(3);
  });

  it('o Luck rola de novo o 1, uma vez só, e o 1 fica descartado', () => {
    const r = d20Test({ rerollOnes: true, rng: sequenceRng([1, 1]) });
    expect(r.natural).toBe(1);
    expect(r.parts[0].groups[0].results.map((x) => [x.value, x.kept])).toEqual([[1, false], [1, true]]);
    const adv = d20Test({ advantage: 1, rerollOnes: true, rng: sequenceRng([1, 12, 15]) });
    expect(adv.natural).toBe(15);
  });
});
