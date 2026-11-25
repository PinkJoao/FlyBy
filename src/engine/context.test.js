// =============================================================================
// context.test: testes do contexto de derivação
// =============================================================================
// O QUE FAZ
//   Saves só da classe original e os níveis de feature numa multiclasse (Rogue 4 /
//   Warlock 2).
//
// FUNÇÕES
//   rogueWarlock(originalIsRogue): a multiclasse mínima de teste.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { createCharacter, createClassEntry } from '../schema/character';
import { buildContext } from './context';
import { expand } from './expander';
import { deriveCharacter } from './index';
import { fighterClassData, warlockClassData, rogueClassData } from './fixtures/classData';

/** Rogue 4 / Warlock 2, com a classe original escolhida. */
function rogueWarlock(originalIsRogue = true) {
  const c = createCharacter({ name: 'Multiclasse' });
  const rogue = createClassEntry(originalIsRogue);
  rogue.classId = 'rogue';
  rogue.level = 4;
  const warlock = createClassEntry(!originalIsRogue);
  warlock.classId = 'warlock';
  warlock.level = 2;
  c.classes = [rogue, warlock];
  return c;
}

const classDb = { fighter: fighterClassData, warlock: warlockClassData, rogue: rogueClassData };

describe('buildContext - multiclasse', () => {
  it('hitDieMax cobre todas as classes', () => {
    const ctx = buildContext(rogueWarlock(), classDb);
    expect(ctx.hitDieMax).toEqual({ rogue: 8, warlock: 8 });
  });

  it('saves vêm SÓ da classe original (Rogue)', () => {
    const ctx = buildContext(rogueWarlock(true), classDb);
    expect(ctx.proficientSaves).toEqual(['dex', 'int']);
  });

  it('se a original for Warlock, saves mudam para WIS/CHA', () => {
    const ctx = buildContext(rogueWarlock(false), classDb);
    expect(ctx.proficientSaves).toEqual(['wis', 'cha']);
  });

  it('nível total e bônus de proficiência do multiclasse', () => {
    const c = rogueWarlock();
    const d = deriveCharacter(c, buildContext(c, classDb));
    expect(d.level).toBe(6);
    expect(d.proficiencyBonus).toBe(3);
  });
});

describe('expand - features de classe', () => {
  it('reúne features das duas classes, filtradas por nível', () => {
    const grants = expand(rogueWarlock(), { classDataById: classDb });
    const names = grants.map((g) => g.name);
    expect(names).toContain('Sneak Attack');
    expect(names).toContain('Cunning Action');
    expect(names).toContain('Pact Magic');
    expect(names).toContain('Eldritch Invocations');
    expect(names).not.toContain('Pact Boon');
  });

  it('marca o ponto de ganho de subclasse', () => {
    const grants = expand(rogueWarlock(), { classDataById: classDb });
    const sub = grants.find((g) => g.gainsSubclass);
    expect(sub?.name).toBe('Roguish Archetype');
  });
});
