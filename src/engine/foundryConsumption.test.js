// =============================================================================
// foundryConsumption.test: a ligação dos alvos de consumo ao item do ator
// =============================================================================
// O QUE FAZ
//   Prova cada forma de alvo (vazio, `_id`, `feat:<identifier>` com e sem prefixo,
//   uuid de compêndio, os dois objetos do overlay) e as duas limpezas (activityUses
//   sem usos e feature sem `uses`), mais as correções de export que o T2d achou no
//   Foundry real (identifier do Channel Divinity, Persistent Rage, Unarmored
//   Movement).
//
// FUNÇÕES
//   feat(name, opts), act(targets, opts): fábricas de item e activity.
//
// DECISÕES E ARMADILHAS
//   - Os casos vêm do lote do sweep importado no Foundry 13 com dnd5e 5.3.3
//     (2026-11-08): cada um foi um botão morto ou um pool sem dono lá.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { consumptionTargetItem, linkConsumptionTargets } from './foundryConsumption';
import { featureIdentifier } from './foundryItems';
import { srdFeatureMechanics } from './foundryActivities';
import { effectChangesFor } from './foundryEffects';

function feat(name, { id = name.replace(/\W/g, '').slice(0, 16), ident = '', uses = '', src = '', acts = {} } = {}) {
  return {
    _id: id,
    name,
    type: 'feat',
    system: { identifier: ident, uses: { max: uses, spent: 0, recovery: [] }, activities: acts },
    _stats: { compendiumSource: src || null },
  };
}

function act(targets, { uses = '' } = {}) {
  return { a1: { _id: 'a1', type: 'utility', uses: { max: uses, spent: 0 }, consumption: { targets, scaling: {}, spellSlot: true } } };
}

describe('consumptionTargetItem', () => {
  const cd = feat('Channel Divinity', { id: 'CD', ident: 'channel-divinity-paladin', uses: '2' });
  const focus = feat("Monk's Focus", { id: 'MF', uses: '5' });
  const bi = feat('Bardic Inspiration', { id: 'BI', uses: '3' });
  const rage = feat('Rage', { id: 'RG', uses: '6', src: 'Compendium.dnd5e.classes24.Item.phbbrbRage000000' });
  const me = feat('Sacred Weapon', { id: 'SW' });
  const items = [cd, focus, bi, rage, me];

  it('vazio é o próprio item; `_id` é o item', () => {
    expect(consumptionTargetItem('', me, items)).toBe(me);
    expect(consumptionTargetItem('CD', me, items)).toBe(cd);
  });

  it('`feat:<identifier>` exato e por prefixo, nos dois sentidos', () => {
    expect(consumptionTargetItem('feat:channel-divinity-paladin', me, items)).toBe(cd);
    expect(consumptionTargetItem('feat:channel-divinity', me, items)).toBe(cd);
    const old = feat('Channel Divinity', { id: 'C2', ident: 'channel-divinity', uses: '2' });
    expect(consumptionTargetItem('feat:channel-divinity-cleric', me, [old])).toBe(old);
  });

  it('uuid de compêndio pelo compendiumSource', () => {
    expect(consumptionTargetItem('Compendium.dnd5e.classes24.Item.phbbrbRage000000', me, items)).toBe(rage);
  });

  it('os objetos do overlay: `{ prop, uid }` e `{ consumes: { name } }` pelo nome do recurso', () => {
    expect(consumptionTargetItem({ prop: 'classFeature', uid: 'Bardic Inspiration|Bard|XPHB|1' }, me, items)).toBe(bi);
    expect(consumptionTargetItem({ consumes: { name: 'Focus Point' } }, me, items)).toBe(focus);
    expect(consumptionTargetItem({ consumes: { name: 'Channel Divinity' } }, me, items)).toBe(cd);
    expect(consumptionTargetItem({ consumes: { name: 'Nothing Here' } }, me, items)).toBeNull();
  });
});

describe('linkConsumptionTargets', () => {
  it('reescreve todo alvo resolvido para o `_id` e conta o que não resolve', () => {
    const cd = feat('Channel Divinity', { id: 'CD', ident: 'channel-divinity-paladin', uses: '2' });
    const sw = feat('Sacred Weapon', { id: 'SW', acts: act([{ type: 'itemUses', value: '1', target: 'feat:channel-divinity-paladin' }]) });
    const gs = feat('Guided Strike', { id: 'GS', acts: act([{ type: 'itemUses', value: '1', target: { consumes: { name: 'Channel Divinity' } } }]) });
    const lost = feat('Lost', { id: 'LO', acts: act([{ type: 'itemUses', value: '1', target: { consumes: { name: 'Ki' } } }]) });
    const unresolved = linkConsumptionTargets([cd, sw, gs, lost]);
    expect(sw.system.activities.a1.consumption.targets[0].target).toBe('CD');
    expect(gs.system.activities.a1.consumption.targets[0].target).toBe('CD');
    expect(lost.system.activities.a1.consumption.targets[0].target).toEqual({ consumes: { name: 'Ki' } });
    expect(unresolved).toBe(1);
  });

  it('activityUses sem usos na activity vira o pool do item; feature sem uses perde o alvo próprio', () => {
    const psi = feat('Psionic Power', { id: 'PP', uses: '4' });
    const bulwark = feat('Bulwark of Force', {
      id: 'BF',
      uses: '1',
      acts: act([
        { type: 'itemUses', value: '1', target: { prop: 'subclassFeature', uid: 'Psionic Power|Fighter|XPHB|Psi Warrior|XPHB|3' } },
        { type: 'activityUses', value: '-1' },
      ]),
    });
    const aspect = feat('Aspect of the Wilds', { id: 'AW', acts: act([{ type: 'itemUses', value: '1' }]) });
    linkConsumptionTargets([psi, bulwark, aspect]);
    expect(bulwark.system.activities.a1.consumption.targets).toEqual([
      { type: 'itemUses', value: '1', target: 'PP' },
      { type: 'itemUses', value: '-1', target: '' },
    ]);
    expect(aspect.system.activities.a1.consumption.targets).toEqual([]);
  });

  it('o próprio item com uses, e alvos de outro tipo, ficam como estão', () => {
    const sw = feat('Second Wind', { id: 'SW', uses: '2', acts: act([{ type: 'itemUses', value: '1' }, { type: 'hitDice', target: 'smallest', value: '1' }]) });
    linkConsumptionTargets([sw]);
    expect(sw.system.activities.a1.consumption.targets).toEqual([
      { type: 'itemUses', value: '1' },
      { type: 'hitDice', target: 'smallest', value: '1' },
    ]);
  });
});

describe('correções do T2d no export', () => {
  it('Channel Divinity leva o identifier do SRD; o resto, o slug do nome', () => {
    expect(featureIdentifier('Channel Divinity', 'paladin')).toBe('channel-divinity-paladin');
    expect(featureIdentifier('Channel Divinity', 'cleric')).toBe('channel-divinity-cleric');
    expect(featureIdentifier('Divine Sense', 'paladin')).toBe('divine-sense');
  });

  it('Persistent Rage devolve a escala `rages` que a classe do SRD publica', () => {
    const s = JSON.stringify(srdFeatureMechanics('Persistent Rage', 'barbarian'));
    expect(s).toContain('-@scale.barbarian.rages"');
    expect(s).not.toContain('-@scale.barbarian.rage"');
  });

  it('Unarmored Movement soma a escala do monge', () => {
    expect(effectChangesFor('Unarmored Movement', 'monk')[0].value).toBe('@scale.monk.unarmored-movement');
  });
});

describe('linkConsumptionTargets não muta a entrada', () => {
  it('a activity compartilhada (registro do SRD) sai intacta para o próximo ator', () => {
    const shared = act([{ type: 'itemUses', value: '1', target: 'feat:channel-divinity-paladin' }]);
    const build = (cdId) => [
      feat('Channel Divinity', { id: cdId, ident: 'channel-divinity-paladin', uses: '2' }),
      feat('Abjure Foes', { id: 'AF', acts: shared }),
    ];
    const first = build('FIRSTCD');
    linkConsumptionTargets(first);
    const second = build('SECONDCD');
    linkConsumptionTargets(second);
    expect(shared.a1.consumption.targets[0].target).toBe('feat:channel-divinity-paladin');
    expect(first[1].system.activities.a1.consumption.targets[0].target).toBe('FIRSTCD');
    expect(second[1].system.activities.a1.consumption.targets[0].target).toBe('SECONDCD');
  });
});
