// =============================================================================
// hpBonuses.test: testes dos aumentos de HP máximo
// =============================================================================
// O QUE FAZ
//   Cada entrada do registro curado, incluindo o Dwarven Toughness keyed pela
//   linhagem Hill desde o swap do DDL-0063, e a soma de taxas por nível de
//   personagem e de classe numa multiclasse.
//
// FUNÇÕES
//   base(level, classId): o personagem de teste.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { deriveHpBonus } from './hpBonuses';
import { createCharacter, createClassEntry } from '../schema/character';

const db = {
  feats: {
    feat: [
      { name: 'Tough', source: 'XPHB' },
      { name: 'Boon of Fortitude', source: 'XPHB' },
      { name: 'Alert', source: 'XPHB' },
    ],
  },
  races: {
    race: [
      {
        name: 'Dwarf',
        source: 'XPHB',
        entries: [{ type: 'entries', name: 'Dwarven Toughness', entries: ['+1 HP por nível'] }],
      },
      { name: 'Human', source: 'XPHB' },
    ],
    subrace: [
      { name: 'Mountain', source: 'PHB', raceName: 'Dwarf', raceSource: 'PHB',
        armorProficiencies: [{ light: true, medium: true }],
        entries: [{ type: 'entries', name: 'Dwarven Armor Training', entries: ['leve e média'] }] },
    ],
  },
  'class-sorcerer': {
    subclass: [
      { name: 'Draconic Sorcery', shortName: 'Draconic', source: 'XPHB', subclassFeatures: [] },
    ],
  },
};

function base(level = 5, classId = 'fighter') {
  const c = createCharacter();
  const f = createClassEntry(true);
  f.classId = classId;
  f.level = level;
  c.classes = [f];
  return c;
}

describe('deriveHpBonus', () => {
  it('sem fontes de HP: tudo zero', () => {
    const r = deriveHpBonus(base(), db);
    expect(r).toEqual({ total: 0, perLevelRate: 0, flat: 0 });
  });

  it('Tough (talento de origem): +2 por nível de personagem', () => {
    const c = base(5);
    c.origin.originFeat = { id: 'Tough', source: 'XPHB', subtype: 'origin', choices: {} };
    expect(deriveHpBonus(c, db)).toEqual({ total: 10, perLevelRate: 2, flat: 0 });
  });

  it('Boon of Fortitude (pick de slot de feat): +40 fixo', () => {
    const c = base(19);
    c.classes[0].choices = { 'feat@19': { kind: 'feat', picks: ['Boon of Fortitude|XPHB'] } };
    expect(deriveHpBonus(c, db)).toEqual({ total: 40, perLevelRate: 0, flat: 40 });
  });

  it('feat sem efeito de HP (Alert) não soma nada', () => {
    const c = base(5);
    c.origin.originFeat = { id: 'Alert', source: 'XPHB', subtype: 'origin', choices: {} };
    expect(deriveHpBonus(c, db).total).toBe(0);
  });

  it('Dwarven Toughness: +1 por nível na linhagem HILL, não na Mountain', () => {
    const c = base(7);
    c.species = { id: 'dwarf', source: 'XPHB', lineage: 'Dwarf; Hill Lineage', choices: {} };
    expect(deriveHpBonus(c, db)).toEqual({ total: 7, perLevelRate: 1, flat: 0 });
    c.species = { id: 'dwarf', source: 'XPHB', lineage: 'Dwarf; Mountain Lineage', choices: {} };
    expect(deriveHpBonus(c, db).total).toBe(0);
    c.species = { id: 'human', source: 'XPHB', choices: {} };
    expect(deriveHpBonus(c, db).total).toBe(0);
  });

  it('Draconic Resilience: +1 por nível de FEITICEIRO (flat, por classe)', () => {
    const c = base(6, 'sorcerer');
    c.classes[0].subclassId = 'Draconic';
    c.classes[0].subclassSource = 'XPHB';
    expect(deriveHpBonus(c, db)).toEqual({ total: 6, perLevelRate: 0, flat: 6 });
  });

  it('multiclasse: Draconic conta só os níveis de sorcerer; Tough conta o total', () => {
    const c = base(4, 'sorcerer');
    c.classes[0].subclassId = 'Draconic';
    c.classes[0].subclassSource = 'XPHB';
    const f = createClassEntry(false);
    f.classId = 'fighter';
    f.level = 3;
    c.classes.push(f);
    c.origin.originFeat = { id: 'Tough', source: 'XPHB', subtype: 'origin', choices: {} };
    expect(deriveHpBonus(c, db)).toEqual({ total: 18, perLevelRate: 2, flat: 4 });
  });
});
