import { describe, it, expect } from 'vitest';
import { createCharacter, createClassEntry } from '../schema/character';
import { maxHp, hpBreakdown } from './hitpoints';

function fighter(level, { con = 10, original = true } = {}) {
  const c = createCharacter();
  c.scores = { str: 10, dex: 10, con, int: 10, wis: 10, cha: 10 };
  const f = createClassEntry(original);
  f.classId = 'fighter';
  f.level = level;
  c.classes = [f];
  return c;
}

describe('maxHp - cálculo padrão (nv1 máx, demais média + CON)', () => {
  it('Fighter 1 (d10, CON 10) = 10', () => {
    expect(maxHp(fighter(1), { fighter: 10 })).toBe(10);
  });

  it('Fighter 3 (d10, CON 10) = 10 + 6 + 6 = 22', () => {
    expect(maxHp(fighter(3), { fighter: 10 })).toBe(22);
  });

  it('CON soma em cada nível: Fighter 3, CON 14 (+2) = 22 + 6 = 28', () => {
    expect(maxHp(fighter(3, { con: 14 }), { fighter: 10 })).toBe(28);
  });

  it('multiclasse: nível 1 da classe original é máx; da 2ª é média', () => {
    const c = createCharacter();
    const f = createClassEntry(true);
    f.classId = 'fighter';
    f.level = 3; // 10 + 6 + 6 = 22
    const w = createClassEntry(false);
    w.classId = 'wizard';
    w.level = 1; // média (d6/2+1 = 4), NÃO máx
    c.classes = [f, w];
    expect(maxHp(c, { fighter: 10, wizard: 6 })).toBe(26);
  });

  it('hpBreakdown devolve hp por classe (base sem CON + contribuição de CON)', () => {
    const bd = hpBreakdown(fighter(3), { fighter: 10 });
    expect(bd).toEqual([{ classId: 'fighter', level: 3, hitDie: 10, subclassId: null, base: 22, con: 0, hp: 22 }]);
  });
});
