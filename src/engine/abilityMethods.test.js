import { describe, it, expect } from 'vitest';
import {
  pointCost,
  pointsSpent,
  pointsRemaining,
  canPointBuyStep,
  initialScores,
  assignStandardArray,
  recommendedScores,
  isDefaultScores,
  matchesAnyRecommendation,
  RECOMMENDED_SCORES,
  STANDARD_ARRAY,
  POINT_BUY_BUDGET,
} from './abilityMethods';

const AB = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

describe('point buy', () => {
  it('custo por score segue a tabela 5e', () => {
    expect(pointCost(8)).toBe(0);
    expect(pointCost(13)).toBe(5);
    expect(pointCost(14)).toBe(7);
    expect(pointCost(15)).toBe(9);
  });

  it('todos em 8 gastam 0 → 27 restantes', () => {
    const s = initialScores('point-buy', AB);
    expect(pointsSpent(s, AB)).toBe(0);
    expect(pointsRemaining(s, AB)).toBe(27);
  });

  it('impede passar de 15 ou estourar o orçamento', () => {
    const s = { str: 15, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
    expect(canPointBuyStep(s, AB, 'str', 1)).toBe(false); // acima de 15
    const mid = { str: 15, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }; // 9 gastos
    expect(canPointBuyStep(mid, AB, 'dex', 1)).toBe(true); // →9 = 10 ok
    const full = { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 }; // 27 gastos
    expect(pointsSpent(full, AB)).toBe(27);
    expect(canPointBuyStep(full, AB, 'int', 1)).toBe(false); // →9 = 28 > 27
  });
});

describe('standard array', () => {
  it('inicia como uma permutação do array padrão', () => {
    const s = initialScores('standard-array', AB);
    expect(AB.map((a) => s[a]).sort((x, y) => y - x)).toEqual([...STANDARD_ARRAY]);
  });

  it('atribuir um valor troca com quem já o tinha (mantém permutação)', () => {
    const s = initialScores('standard-array', AB); // str15 dex14 con13 int12 wis10 cha8
    const next = assignStandardArray(s, AB, 'str', 8); // str quer 8 (estava com cha)
    expect(next.str).toBe(8);
    expect(next.cha).toBe(15); // cha recebe o antigo str
    // ainda é uma permutação do array
    expect(AB.map((a) => next[a]).sort((x, y) => y - x)).toEqual([...STANDARD_ARRAY]);
  });
});

describe('recomendação por classe', () => {
  it('toda recomendação é uma permutação do standard array (válida em qualquer método)', () => {
    for (const [classId, rec] of Object.entries(RECOMMENDED_SCORES)) {
      expect(AB.map((a) => rec[a]).sort((x, y) => y - x), classId).toEqual([...STANDARD_ARRAY]);
      // permutação do array custa exatamente o orçamento do point buy.
      expect(pointsSpent(rec, AB), classId).toBe(POINT_BUY_BUDGET);
    }
  });

  it('valores conferem com a tabela do PHB (amostra) + Artificer custom', () => {
    expect(recommendedScores('wizard')).toEqual({ str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 });
    expect(recommendedScores('barbarian')).toEqual({ str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 });
    expect(recommendedScores('artificer')).toEqual({ str: 14, dex: 12, con: 13, int: 15, wis: 10, cha: 8 });
    expect(recommendedScores('nope')).toBe(null);
  });

  it('initialScores parte da recomendação da classe em TODOS os métodos', () => {
    const wiz = RECOMMENDED_SCORES.wizard;
    for (const m of ['point-buy', 'standard-array', 'manual']) {
      expect(initialScores(m, AB, 'wizard')).toEqual(wiz);
    }
    // sem classe → padrão genérico de cada método (comportamento antigo).
    expect(initialScores('point-buy', AB)).toEqual({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
    expect(initialScores('manual', AB, 'nope')).toEqual({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  });

  it('isDefaultScores só p/ tudo-10; matchesAnyRecommendation reconhece auto-semeado', () => {
    expect(isDefaultScores({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, AB)).toBe(true);
    expect(isDefaultScores(RECOMMENDED_SCORES.cleric, AB)).toBe(false);
    expect(matchesAnyRecommendation(RECOMMENDED_SCORES.cleric, AB)).toBe(true);
    // um spread digitado à mão (não é permutação/recomendação) não casa.
    expect(matchesAnyRecommendation({ str: 16, dex: 16, con: 16, int: 8, wis: 8, cha: 8 }, AB)).toBe(false);
  });
});
