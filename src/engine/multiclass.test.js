import { describe, it, expect } from 'vitest';
import {
  multiclassRequirements,
  meetsRequirement,
  requirementText,
  unmetMulticlassReqs,
} from './multiclass';
import { createCharacter } from '../schema/character';

const db = {
  'class-paladin': { class: [{ name: 'Paladin', source: 'XPHB', multiclassing: { requirements: null } }, { name: 'Paladin', source: 'PHB', multiclassing: { requirements: { str: 13, cha: 13 } } }] },
  'class-cleric': { class: [{ name: 'Cleric', source: 'PHB', multiclassing: { requirements: { wis: 13 } } }] },
  'class-fighter': { class: [{ name: 'Fighter', source: 'PHB', multiclassing: { requirements: { or: [{ str: 13, dex: 13 }] } } }] },
};

describe('multiclassRequirements', () => {
  it('varre as fontes até achar (XPHB null → PHB)', () => {
    expect(multiclassRequirements(db, 'paladin')).toEqual({ str: 13, cha: 13 });
  });
});

describe('meetsRequirement', () => {
  it('AND: paladino exige Str E Cha 13', () => {
    expect(meetsRequirement({ str: 13, cha: 13 }, { str: 15, cha: 13 })).toBe(true);
    expect(meetsRequirement({ str: 13, cha: 13 }, { str: 15, cha: 10 })).toBe(false);
  });
  it('OR: guerreiro exige Str OU Dex 13', () => {
    const req = { or: [{ str: 13, dex: 13 }] };
    expect(meetsRequirement(req, { str: 8, dex: 14 })).toBe(true);
    expect(meetsRequirement(req, { str: 8, dex: 8 })).toBe(false);
  });
});

describe('requirementText', () => {
  it('formata AND e OR', () => {
    expect(requirementText({ str: 13, cha: 13 })).toBe('Str 13 & Cha 13');
    expect(requirementText({ or: [{ str: 13, dex: 13 }] })).toBe('Str 13 or Dex 13');
  });
});

describe('unmetMulticlassReqs', () => {
  function paladin(scores = {}) {
    const c = createCharacter({ name: 'T' });
    c.classes = [{ classId: 'paladin', source: 'XPHB', level: 3, isOriginalClass: true, hitPoints: {}, choices: {} }];
    Object.assign(c.scores, { str: 15, cha: 14, wis: 10, ...scores });
    return c;
  }

  it('sem requisito quando ficaria só uma classe', () => {
    expect(unmetMulticlassReqs(db, createCharacter(), 'paladin')).toEqual([]);
  });

  it('avisa o requisito da classe NOVA não cumprido (cleric wis 13)', () => {
    const out = unmetMulticlassReqs(db, paladin(), 'cleric');
    expect(out).toEqual([{ classId: 'cleric', text: 'Wis 13' }]);
  });

  it('avisa também o requisito da ORIGINAL (para sair)', () => {
    // Paladino com Cha 10 quer pegar Cleric: falha o próprio (para sair) e o cleric.
    const out = unmetMulticlassReqs(db, paladin({ cha: 10, wis: 10 }), 'cleric');
    expect(out.map((u) => u.classId).sort()).toEqual(['cleric', 'paladin']);
  });

  it('nada quando cumpre tudo', () => {
    expect(unmetMulticlassReqs(db, paladin({ wis: 13 }), 'cleric')).toEqual([]);
  });

  it('TROCAR a classe única não é multiclasse (ignora o slot editado)', () => {
    // Paladino com Cha 10 (não cumpre nem o próprio req) TROCANDO p/ cleric no
    // slot 0 → build de classe única → sem aviso.
    const c = paladin({ cha: 10, wis: 10 });
    expect(unmetMulticlassReqs(db, c, 'cleric', 0)).toEqual([]);
    // Mas ADICIONAR cleric num novo slot (index 1) → multiclasse → avisa.
    const out = unmetMulticlassReqs(db, c, 'cleric', 1);
    expect(out.map((u) => u.classId).sort()).toEqual(['cleric', 'paladin']);
  });
});
