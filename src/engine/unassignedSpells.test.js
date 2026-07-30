import { describe, it, expect } from 'vitest';
import { assignCargoSpell, discardCargoSpell } from './unassignedSpells';

const character = () => ({
  classes: [
    { uid: 'u1', classId: 'ranger', spells: [{ id: 'Cure Wounds', source: 'XPHB' }] },
    { uid: 'u2', classId: 'rogue', spells: [] },
  ],
  unassignedSpells: [
    { id: 'Magic Missile', source: 'XPHB' },
    { id: 'Shield', source: 'XPHB' },
    { id: 'Magic Missile', source: 'XPHB' },
  ],
});

describe('assignCargoSpell', () => {
  it('move a magia do balde para as escolhas da classe', () => {
    const c = assignCargoSpell(character(), 'u1', 1);
    expect(c.unassignedSpells.map((r) => r.id)).toEqual(['Magic Missile', 'Magic Missile']);
    expect(c.classes[0].spells.map((r) => r.id)).toEqual(['Cure Wounds', 'Shield']);
    // as outras classes ficam intactas
    expect(c.classes[1].spells).toEqual([]);
  });

  // O ponto do índice: com duas cópias iguais, atribuir UMA não pode levar a
  // outra junto - um filtro por nome+fonte removeria as duas.
  it('com a MESMA magia duas vezes, tira só a cópia escolhida', () => {
    const c = assignCargoSpell(character(), 'u1', 0);
    expect(c.unassignedSpells.map((r) => r.id)).toEqual(['Shield', 'Magic Missile']);
    expect(c.classes[0].spells.map((r) => r.id)).toEqual(['Cure Wounds', 'Magic Missile']);
  });

  it('guarda só id+source (a decisão nasce preparada, como qualquer outra)', () => {
    const c = assignCargoSpell(character(), 'u2', 1);
    expect(c.classes[1].spells).toEqual([{ id: 'Shield', source: 'XPHB' }]);
  });

  it('índice ou classe inexistente não mexe em nada', () => {
    const base = character();
    expect(assignCargoSpell(base, 'u1', 99)).toBe(base);
    expect(assignCargoSpell(base, 'nao-existe', 0)).toBe(base);
  });

  it('não muta o personagem original', () => {
    const base = character();
    assignCargoSpell(base, 'u1', 0);
    expect(base.unassignedSpells).toHaveLength(3);
    expect(base.classes[0].spells).toHaveLength(1);
  });
});

describe('discardCargoSpell', () => {
  it('tira só a cópia da posição pedida', () => {
    const c = discardCargoSpell(character(), 2);
    expect(c.unassignedSpells.map((r) => r.id)).toEqual(['Magic Missile', 'Shield']);
  });

  it('índice inexistente não mexe em nada', () => {
    const base = character();
    expect(discardCargoSpell(base, 99)).toBe(base);
  });
});
