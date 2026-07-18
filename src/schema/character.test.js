import { describe, it, expect } from 'vitest';
import { migrate, totalLevel, classSummary, classNames, createCharacter } from './character';

describe('migrate - coerção defensiva', () => {
  it('preserva um personagem válido do builder (v2: classe ganha spells: [])', () => {
    const c = createCharacter({ name: 'X' });
    c.classes = [{ classId: 'fighter', level: 3 }];
    const m = migrate(c);
    expect(m.classes).toEqual([{ classId: 'fighter', level: 3, spells: [] }]);
    expect(m.meta.name).toBe('X');
    expect(m.schemaVersion).toBe(2);
  });

  it('preserva as spells já existentes numa classe (não sobrescreve)', () => {
    const c = createCharacter({ name: 'Y' });
    c.classes = [{ classId: 'wizard', level: 5, spells: [{ id: 'Fireball', source: 'XPHB' }] }];
    const m = migrate(c);
    expect(m.classes[0].spells).toEqual([{ id: 'Fireball', source: 'XPHB' }]);
  });

  it('coage um objeto SEM a forma do builder (ex: ator Foundry) p/ forma segura', () => {
    // Ator Foundry: tem system/items[]/type, NÃO tem classes/scores/origin.
    const foundryActor = { name: 'Hero', type: 'character', system: { abilities: {} }, items: [{ type: 'class' }] };
    const m = migrate(foundryActor);
    expect(Array.isArray(m.classes)).toBe(true); // não undefined → não quebra a UI
    expect(m.classes).toEqual([]);
    expect(m.origin).toBeTruthy();
    expect(m.scores).toBeTruthy();
    expect(m.meta).toBeTruthy();
    // funções derivadas não quebram
    expect(totalLevel(m)).toBe(0);
    expect(classSummary(m)).toBe('');
  });

  it('null/inválido → personagem novo', () => {
    expect(Array.isArray(migrate(null).classes)).toBe(true);
    expect(Array.isArray(migrate(undefined).classes)).toBe(true);
  });
});

describe('totalLevel / classSummary - resilientes a classes ausentes', () => {
  it('sem classes não quebra', () => {
    expect(totalLevel({})).toBe(0);
    expect(classSummary({})).toBe('');
    expect(totalLevel(null)).toBe(0);
  });
});

describe('classNames', () => {
  const multiclass = { classes: [{ classId: 'warlock', level: 13 }, { classId: 'cleric', level: 4 }] };

  it('lista só os nomes, sem os níveis (legenda do roster)', () => {
    expect(classNames(multiclass)).toBe('Warlock · Cleric');
    expect(classSummary(multiclass)).toBe('Warlock 13 · Cleric 4'); // o da ficha mantém os níveis
  });

  it('ignora classes sem id, e sem classes devolve vazio', () => {
    expect(classNames({ classes: [{ classId: '', level: 1 }] })).toBe('');
    expect(classNames({})).toBe('');
    expect(classNames(null)).toBe('');
  });
});

describe('migrate - campos biográficos', () => {
  it('um personagem antigo ganha os novos campos vazios', () => {
    const old = { id: 'x', identity: { alignment: 'NG', ideals: 'Freedom.' } };
    const m = migrate(old);
    expect(m.identity.ideals).toBe('Freedom.'); // preserva o que existia
    expect(m.identity.faith).toBe('');          // e completa o resto
    expect(m.identity.eyes).toBe('');
  });
});
