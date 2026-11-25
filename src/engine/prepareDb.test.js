// =============================================================================
// prepareDb.test: a herança `_copy` dos itens resolvida para todos os consumidores
// =============================================================================
// O QUE FAZ
//   O item que copia outro item, o que copia um item base, o db sem cópia devolvido igual e o objeto recebido intacto
//   (DDL-0267).
//
// FUNÇÕES
//   (só testes)
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { prepareDb } from './prepareDb';

describe('prepareDb', () => {
  const blade = { name: 'Ashbringer', source: 'WoW', type: 'M|XPHB', rarity: 'artifact', entries: ['A', { type: 'entries', name: 'Steal Life', entries: ['x'] }] };
  const truth = { name: 'Ashbringer (True State)', source: 'WoW', _copy: { name: 'Ashbringer', source: 'WoW', _mod: { entries: { mode: 'removeArr', names: ['Steal Life'] } } } };
  const flask = { name: "Alchemist's Fire (flask)", source: 'XPHB', type: 'G|XPHB', entries: ['fire'] };
  const doom = { name: "Alchemist's Doom", source: 'SCC', _copy: { name: "Alchemist's Fire (flask)", source: 'XPHB' } };

  it('resolve a cópia de um item e a de um item base', () => {
    const db = { items: { item: [blade, truth, doom] }, 'items-base': { baseitem: [flask] } };
    const out = prepareDb(db);
    const t = out.items.item.find((i) => i.name === 'Ashbringer (True State)');
    expect(t).toMatchObject({ type: 'M|XPHB', rarity: 'artifact', entries: ['A'] });
    expect(t._copy).toBeUndefined();
    expect(out.items.item.find((i) => i.name === "Alchemist's Doom")).toMatchObject({ source: 'SCC', type: 'G|XPHB', entries: ['fire'] });
    expect(out['items-base'].baseitem).toBe(db['items-base'].baseitem);
    expect(db.items.item[1]._copy).toBeDefined();
  });

  it('o Flaming Sphere do XPHB segue o SRD: Conjuração (DDL-0268); o resto fica igual', () => {
    const sphere = { name: 'Flaming Sphere', source: 'XPHB', school: 'V' };
    const other = { name: 'Fireball', source: 'XPHB', school: 'V' };
    const db = { 'spells-xphb': { spell: [sphere, other] }, 'spells-phb': { spell: [{ name: 'Flaming Sphere', source: 'PHB', school: 'C' }] } };
    const out = prepareDb(db);
    expect(out['spells-xphb'].spell.map((s) => s.school)).toEqual(['C', 'V']);
    expect(out['spells-phb']).toBe(db['spells-phb']);
    expect(sphere.school).toBe('V');
  });

  it('sem cópia, devolve o próprio db', () => {
    const db = { items: { item: [blade] } };
    expect(prepareDb(db)).toBe(db);
    expect(prepareDb(null)).toBeNull();
  });
});
