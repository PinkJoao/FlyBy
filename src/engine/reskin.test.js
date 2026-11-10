// =============================================================================
// reskin.test: a reedição cosmética de classe (`reskinOf`) resolve para a base
// =============================================================================
// O QUE FAZ
//   Prova o DDL-0190 com um db mínimo no formato do espelho atual do 5etools: o
//   stub "Druid|WoW" não é o padrão, a ficha gravada com ele resolve para o XPHB, e
//   as subclasses copiadas dele saem da lista.
//
// FUNÇÕES
//   (só testes)
//
// DECISÕES E ARMADILHAS
//   - O stub tem a forma medida no espelho em 2026-11-09 (reskinOf, _copy,
//     includeSubclassesFrom), sem `startingEquipment`.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { resolveClassObj, reskinSources } from './resolve';
import { makeSubclassEntity } from '../selector/entities/subclass';

const db = {
  'class-druid': {
    class: [
      { name: 'Druid', source: 'PHB', reprintedAs: ['Druid|XPHB'], startingEquipment: {} },
      { name: 'Druid', source: 'XPHB', startingEquipment: { defaultData: [{ A: [] }] } },
      { name: 'Druid', source: 'WoW', reskinOf: ['Druid|XPHB'], _copy: { name: 'Druid', source: 'XPHB' }, includeSubclassesFrom: ['Druid|XPHB'] },
    ],
    subclass: [
      { name: 'Circle of the Moon', shortName: 'Moon', source: 'XPHB', className: 'Druid', classSource: 'XPHB', subclassFeatures: [] },
      { name: 'Circle of the Moon', shortName: 'Moon', source: 'WoW', className: 'Druid', classSource: 'WoW', _copy: { name: 'Circle of the Moon', source: 'XPHB', shortName: 'Moon', className: 'Druid', classSource: 'XPHB' } },
    ],
  },
};

describe('reedição cosmética de classe (DDL-0190)', () => {
  it('sem fonte, a classe padrão é a XPHB, não o stub', () => {
    expect(resolveClassObj(db, 'druid').source).toBe('XPHB');
  });
  it('a ficha gravada como WoW resolve para a XPHB, com o kit inicial', () => {
    const c = resolveClassObj(db, 'druid', 'WoW');
    expect(c.source).toBe('XPHB');
    expect(c.startingEquipment).toBeTruthy();
  });
  it('as subclasses copiadas da reedição saem da lista', () => {
    expect([...reskinSources(db, 'druid')]).toEqual(['WoW']);
    const list = makeSubclassEntity('druid').list(db);
    expect(list.map((s) => s.source)).toEqual(['XPHB']);
  });
});
