// TC-0059/0075/0077: os grants que uma feature de CLASSE faz só em prosa.
import { describe, it, expect } from 'vitest';
import {
  CLASS_FEATURE_GRANTS,
  classGrantGroups,
  classGrantChoices,
  deriveClassFeatureGrants,
  buildClassGrantAdvancements,
} from './classFeatureGrants';
import { finalScores } from './abilities';

const charWith = (classId, level) => ({ classes: [{ classId, source: 'XPHB', level, isOriginalClass: true }] });

describe('classGrantGroups - gate por nível', () => {
  it('só devolve o que o nível já alcançou', () => {
    expect(classGrantGroups('rogue', 1).map((g) => g.feature)).toEqual(["Thieves' Cant"]);
    expect(classGrantGroups('rogue', 15).map((g) => g.feature)).toEqual(["Thieves' Cant", 'Slippery Mind']);
    expect(classGrantGroups('monk', 13)).toEqual([]);
    expect(classGrantGroups('wizard', 20)).toEqual([]); // classe sem grant em prosa
  });
});

describe('deriveClassFeatureGrants', () => {
  it('idioma: Druidic (Druida 1) e Thieves’ Cant (Ladino 1)', () => {
    expect(deriveClassFeatureGrants(charWith('druid', 1)).languages).toEqual(['Druidic']);
    expect(deriveClassFeatureGrants(charWith('rogue', 1)).languages).toEqual(["Thieves' Cant"]);
  });

  it('salvaguarda: Slippery Mind (15) dá Wis+Cha; Disciplined Survivor (14) dá TODAS', () => {
    expect(deriveClassFeatureGrants(charWith('rogue', 14)).saves).toEqual([]);
    expect(deriveClassFeatureGrants(charWith('rogue', 15)).saves).toEqual(['wis', 'cha']);
    expect(deriveClassFeatureGrants(charWith('monk', 14)).saves).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha']);
  });

  it('capstone: +4/+4 só no nível 20, com teto 25', () => {
    expect(deriveClassFeatureGrants(charWith('barbarian', 19)).abilityBoosts).toEqual([]);
    expect(deriveClassFeatureGrants(charWith('barbarian', 20)).abilityBoosts).toEqual([
      { ability: 'str', amount: 4, max: 25 },
      { ability: 'con', amount: 4, max: 25 },
    ]);
  });

  it('o teto 25 do capstone ultrapassa o 20 dos ASIs, e para em 25', () => {
    const boosts = deriveClassFeatureGrants(charWith('monk', 20)).abilityBoosts;
    // Dex 20 (saturada pelos ASIs) + 4 = 24; Wis 22 + 4 pararia em 25.
    const scores = finalScores({ scores: { dex: 20, wis: 22, str: 10, con: 10, int: 10, cha: 10 } }, boosts);
    expect(scores.dex).toBe(24);
    expect(scores.wis).toBe(25);
  });
});

describe('classGrantChoices', () => {
  it("o Thieves' Cant abre UMA escolha de idioma, com o pool aberto", () => {
    const [ch] = classGrantChoices('rogue', 1);
    expect(ch).toMatchObject({
      id: 'classgrant-lang@1',
      kind: 'language',
      count: 1,
      level: 1,
      feature: { name: "Thieves' Cant", level: 1 },
      pool: { type: 'any', of: 'language' },
    });
  });

  it('classe sem escolha de idioma não emite descritor', () => {
    expect(classGrantChoices('druid', 20)).toEqual([]);
    expect(classGrantChoices('monk', 20)).toEqual([]);
  });
});

describe('buildClassGrantAdvancements (lado Foundry)', () => {
  const db = { 'class-rogue': { class: [{ name: 'Rogue', source: 'XPHB' }] }, 'class-monk': { class: [{ name: 'Monk', source: 'XPHB' }] } };

  it('salvaguarda vira Trait no nível DELA, já aplicado', () => {
    const advs = buildClassGrantAdvancements({ classId: 'rogue', source: 'XPHB', level: 20 }, db);
    const trait = advs.find((a) => a.type === 'Trait');
    expect(trait).toMatchObject({ level: 15, title: 'Slippery Mind' });
    expect(trait.configuration.grants).toEqual(['saves:wis', 'saves:cha']);
    expect(trait.value.chosen).toEqual(['saves:wis', 'saves:cha']);
  });

  it('capstone vira ASI de valores FIXOS; `value` só no nível alcançado', () => {
    const at20 = buildClassGrantAdvancements({ classId: 'monk', source: 'XPHB', level: 20 }, db)
      .find((a) => a.type === 'AbilityScoreImprovement');
    expect(at20).toMatchObject({ level: 20, title: 'Body and Mind' });
    expect(at20.configuration.fixed).toMatchObject({ dex: 4, wis: 4, str: 0 });
    expect(at20.configuration.max).toBe(25);
    expect(at20.value).toEqual({ type: 'asi', assignments: {} });
    // Nível 5: o passo existe na escada (a classe inteira), mas PENDENTE.
    const at5 = buildClassGrantAdvancements({ classId: 'monk', source: 'XPHB', level: 5 }, db)
      .find((a) => a.type === 'AbilityScoreImprovement');
    expect(at5.value).toEqual({});
  });

  it('classe sem grant não gera advancement nenhum', () => {
    expect(buildClassGrantAdvancements({ classId: 'wizard', source: 'XPHB', level: 20 }, {})).toEqual([]);
  });
});

describe('o registro é fechado e documentado', () => {
  it('cobre exatamente as quatro classes da varredura', () => {
    expect(Object.keys(CLASS_FEATURE_GRANTS).sort()).toEqual(['barbarian', 'druid', 'monk', 'rogue']);
  });
});
