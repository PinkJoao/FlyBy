// =============================================================================
// classData.test: testes do parser de classe
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { parseClass, parseFeatureRef, skillCode, featuresUpToLevel, isOriginalEntry, classProficiencies, multiclassSkillChoice } from './classData';
import { fighterClassData, warlockClassData, rogueClassData } from './fixtures/classData';

describe('skillCode', () => {
  it('mapeia nomes compostos para códigos', () => {
    expect(skillCode('sleight of hand')).toBe('slt');
    expect(skillCode('animal handling')).toBe('ani');
    expect(skillCode('Perception')).toBe('prc');
  });
});

describe('parseFeatureRef', () => {
  it('faz parse de string "Nome|Classe|Fonte|Nível"', () => {
    expect(parseFeatureRef('Action Surge|Fighter||2')).toEqual({
      name: 'Action Surge',
      className: 'Fighter',
      source: '',
      level: 2,
      gainsSubclass: false,
    });
  });

  it('faz parse do formato objeto com gainSubclassFeature', () => {
    expect(
      parseFeatureRef({ classFeature: 'Martial Archetype|Fighter||3', gainSubclassFeature: true })
    ).toEqual({
      name: 'Martial Archetype',
      className: 'Fighter',
      source: '',
      level: 3,
      gainsSubclass: true,
    });
  });
});

describe('parseClass', () => {
  it('Fighter: dado, saves, perícias, subclasse', () => {
    const p = parseClass(fighterClassData);
    expect(p.hitDieMax).toBe(10);
    expect(p.proficientSaves).toEqual(['str', 'con']);
    expect(p.skillChoice.count).toBe(2);
    expect(p.skillChoice.from).toContain('ani');
    expect(p.skillChoice.from).toContain('acr');
    expect(p.subclassTitle).toBe('Martial Archetype');
    expect(p.nativeSubclassLevel).toBe(3);
  });

  it('Warlock: dado d8, saves WIS/CHA, pact caster', () => {
    const p = parseClass(warlockClassData);
    expect(p.hitDieMax).toBe(8);
    expect(p.proficientSaves).toEqual(['wis', 'cha']);
    expect(p.spellcasting.ability).toBe('cha');
    expect(p.spellcasting.casterProgression).toBe('pact');
    expect(p.nativeSubclassLevel).toBe(1);
  });

  it('Rogue: dado d8, saves DEX/INT, 4 perícias', () => {
    const p = parseClass(rogueClassData);
    expect(p.hitDieMax).toBe(8);
    expect(p.proficientSaves).toEqual(['dex', 'int']);
    expect(p.skillChoice.count).toBe(4);
    expect(p.nativeSubclassLevel).toBe(3);
  });

  it('skills como {any:N} (Bard) viram escolha aberta', () => {
    const bard = { name: 'Bard', startingProficiencies: { skills: [{ any: 3 }] } };
    const p = parseClass(bard);
    expect(p.skillChoice).toEqual({ from: [], count: 3, any: true });
  });

  it('skills {choose} marca any:false', () => {
    expect(parseClass(fighterClassData).skillChoice.any).toBe(false);
  });
});

describe('featuresUpToLevel', () => {
  it('filtra features acima do nível', () => {
    const names = featuresUpToLevel(fighterClassData, 6).map((f) => f.name);
    expect(names).toContain('Fighting Style');
    expect(names).toContain('Extra Attack');
    expect(names).not.toContain('Indomitable');
  });
});

describe('multiclasse (XPHB p. 44, TC-0217, TC-0218)', () => {
  const bard = {
    name: 'Bard',
    startingProficiencies: { armor: ['light'], skills: [{ any: 3 }] },
    multiclassing: { proficienciesGained: { armor: ['light'], skills: [{ choose: { from: ['stealth', 'arcana'], count: 1 } }] } },
  };
  it('isOriginalEntry: a marca, ou a primeira quando nenhuma está marcada', () => {
    const a = { classId: 'a', isOriginalClass: false };
    const b = { classId: 'b', isOriginalClass: true };
    expect(isOriginalEntry({ classes: [a, b] }, b)).toBe(true);
    expect(isOriginalEntry({ classes: [a, b] }, a)).toBe(false);
    const c = { classId: 'c' };
    const d = { classId: 'd' };
    expect(isOriginalEntry({ classes: [c, d] }, c)).toBe(true);
    expect(isOriginalEntry({ classes: [c, d] }, d)).toBe(false);
  });
  it('classProficiencies: a inicial dá tudo, a secundária o proficienciesGained, e sem ele nada', () => {
    expect(classProficiencies(bard, true).skills).toEqual([{ any: 3 }]);
    expect(classProficiencies(bard, false).skills[0].choose.count).toBe(1);
    expect(classProficiencies({ startingProficiencies: { armor: ['light'] } }, false)).toEqual({});
  });
  it('multiclassSkillChoice: a perícia do multiclasse em códigos', () => {
    expect(multiclassSkillChoice(bard)).toEqual({ from: ['ste', 'arc'], count: 1, any: false });
    expect(multiclassSkillChoice({}).count).toBe(0);
  });
});
