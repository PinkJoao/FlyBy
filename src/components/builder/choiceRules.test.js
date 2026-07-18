import { describe, it, expect } from 'vitest';
import { kindRuleEntry, namedRuleEntry } from './choiceRules';

// db mínimo: só as regras de glossário que o mapa de kinds referencia (as
// mesmas entradas de variantrules.json/XPHB + Tool Proficiencies/XGE).
const db = {
  variantrules: {
    variantrule: [
      { name: 'Size', source: 'XPHB', ruleType: 'C', entries: ['A creature belongs to a size category…'] },
      { name: 'Skill', source: 'XPHB', ruleType: 'C', entries: ['A skill is an area of specialization…'] },
      { name: 'Expertise', source: 'XPHB', ruleType: 'C', entries: ['Expertise doubles your Proficiency Bonus…'] },
      { name: 'Tool Proficiencies', source: 'XGE', ruleType: 'O', entries: ['Tools have more uses…'] },
      { name: 'Saving Throw', source: 'XPHB', ruleType: 'C', entries: ['A saving throw represents…'] },
      { name: 'Resistance', source: 'XPHB', ruleType: 'C', entries: ['If you have Resistance…'] },
    ],
  },
};

describe('kindRuleEntry - fallback de regra do glossário por kind de escolha', () => {
  it('resolve size/skill/expertise para as regras XPHB', () => {
    expect(kindRuleEntry(db, 'size')).toMatchObject({ type: 'variantrule', name: 'Size', source: 'XPHB' });
    expect(kindRuleEntry(db, 'skill')).toMatchObject({ name: 'Skill', source: 'XPHB' });
    expect(kindRuleEntry(db, 'expertise')).toMatchObject({ name: 'Expertise', source: 'XPHB' });
  });

  it('resolve tool para a regra Tool Proficiencies do XGE', () => {
    expect(kindRuleEntry(db, 'tool')).toMatchObject({ name: 'Tool Proficiencies', source: 'XGE' });
  });

  it('resolve os kinds de save e traço de dano', () => {
    expect(kindRuleEntry(db, 'save')).toMatchObject({ name: 'Saving Throw' });
    expect(kindRuleEntry(db, 'resist')).toMatchObject({ name: 'Resistance' });
  });

  it('kind sem mapa (language, weapon, feat…) ou termo ausente do db → null', () => {
    expect(kindRuleEntry(db, 'language')).toBeNull();
    expect(kindRuleEntry(db, 'weapon')).toBeNull();
    expect(kindRuleEntry(db, 'feat')).toBeNull();
    // 'immune' está no mapa, mas o db do teste não tem "Immunity" → título vira
    // texto puro, nunca um link morto.
    expect(kindRuleEntry(db, 'immune')).toBeNull();
    expect(kindRuleEntry(null, 'size')).toBeNull();
  });
});

describe('namedRuleEntry - regra por nome para títulos de seção', () => {
  it('resolve "Ability Score and Modifier" (título Ability Score Boosts)', () => {
    const withRule = {
      variantrules: {
        variantrule: [{ name: 'Ability Score and Modifier', source: 'XPHB', ruleType: 'C', entries: ['Each ability has a score…'] }],
      },
    };
    expect(namedRuleEntry(withRule, 'Ability Score and Modifier|XPHB')).toMatchObject({
      type: 'variantrule',
      name: 'Ability Score and Modifier',
      source: 'XPHB',
    });
  });

  it('termo ausente ou db nulo → null', () => {
    expect(namedRuleEntry(db, 'Nonexistent Rule|XPHB')).toBeNull();
    expect(namedRuleEntry(null, 'Size|XPHB')).toBeNull();
  });
});
