// =============================================================================
// dice.test: testes do motor de dados do play mode
// =============================================================================
// FUNÇÕES
//   seq(...values): um rng que devolve os valores em ordem e falha se acabarem.
//
// DECISÕES E ARMADILHAS
//   - Toda rolagem usa `seq`, nunca o cryptoRng: os testes são determinísticos e
//     um dado a mais ou a menos falha em vez de passar por sorte.
//   - O cryptoRng só é testado pela faixa e pela cobertura das faces.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  DiceError, cryptoRng, sequenceRng, lookup, resolveRefs, parseFormula, formatNode,
  rollFormula, validateFormula, rollParts, resolveMode, d20Test,
} from './dice';

const seq = (...values) => sequenceRng(values, () => {
  throw new Error('rolou um dado a mais');
});

describe('rollFormula: aritmética', () => {
  it('respeita a precedência, os parênteses e o sinal', () => {
    expect(rollFormula('2 + 3 * 4').total).toBe(14);
    expect(rollFormula('(2 + 3) * 4').total).toBe(20);
    expect(rollFormula('-3 + 10').total).toBe(7);
    expect(rollFormula('10 - -2').total).toBe(12);
  });

  it('arredonda para baixo o que não é inteiro', () => {
    expect(rollFormula('7 / 2').total).toBe(3);
    expect(rollFormula('floor(7 / 2) + ceil(1 / 2)').total).toBe(4);
  });

  it('aceita max, min, round e abs', () => {
    expect(rollFormula('max(1, -2)').total).toBe(1);
    expect(rollFormula('min(3, 5, 4)').total).toBe(3);
    expect(rollFormula('round(2.5) + abs(-1)').total).toBe(4);
  });
});

describe('rollFormula: dados', () => {
  it('soma os dados e os modificadores, guardando cada dado', () => {
    const r = rollFormula('2d6 + 3', { rng: seq(4, 5) });
    expect(r.total).toBe(12);
    expect(r.groups).toEqual([{ formula: '2d6', faces: 6, results: [{ value: 4, kept: true }, { value: 5, kept: true }], total: 9 }]);
  });

  it('d sem número é um dado, e d% é d100', () => {
    expect(rollFormula('d8', { rng: seq(7) }).total).toBe(7);
    expect(rollFormula('d%', { rng: seq(42) }).groups[0].faces).toBe(100);
  });

  it('kh e kl mantêm o maior ou o menor', () => {
    expect(rollFormula('2d20kh', { rng: seq(3, 17) }).total).toBe(17);
    expect(rollFormula('2d20kl', { rng: seq(3, 17) }).total).toBe(3);
    const r = rollFormula('4d6kh3', { rng: seq(1, 6, 4, 2) });
    expect(r.total).toBe(12);
    expect(r.groups[0].results.map((x) => x.kept)).toEqual([false, true, true, true]);
  });

  it('min e max mudam o valor do dado e guardam o sorteado', () => {
    const r = rollFormula('2d6min3', { rng: seq(1, 5) });
    expect(r.total).toBe(8);
    expect(r.groups[0].results[0]).toEqual({ value: 3, raw: 1, kept: true });
    expect(rollFormula('1d6max4', { rng: seq(6) }).total).toBe(4);
  });

  it('o crítico dobra os dados, não os modificadores', () => {
    const r = rollFormula('1d8 + 3', { rng: seq(5, 6), critical: true });
    expect(r.total).toBe(14);
    expect(r.groups[0].formula).toBe('2d8');
  });

  it('a contagem pode ser uma expressão sem dados', () => {
    expect(rollFormula('(@prof)d4', { data: { prof: 3 }, rng: seq(1, 2, 3) }).total).toBe(6);
  });

  it('dados dentro da contagem são erro', () => {
    expect(() => rollFormula('(1d4)d6', { rng: seq(2) })).toThrow(DiceError);
  });

  it('recusa dados demais', () => {
    expect(() => rollFormula('5000d6')).toThrow(/Too many dice/);
  });
});

describe('referências', () => {
  it('lê caminho plano e aninhado', () => {
    expect(lookup({ 'abilities.str.mod': 3 }, 'abilities.str.mod')).toBe(3);
    expect(lookup({ abilities: { str: { mod: 2 } } }, 'abilities.str.mod')).toBe(2);
    expect(lookup({}, 'x')).toBeUndefined();
  });

  it('troca número, número negativo e fórmula de dado', () => {
    const data = { prof: 2, abilities: { str: { mod: -1 } }, scale: { rogue: { 'sneak-attack': '3d6' } } };
    expect(resolveRefs('1d20 + @abilities.str.mod + @prof', data)).toBe('1d20 + (-1) + 2');
    expect(resolveRefs('@scale.rogue.sneak-attack', data)).toBe('(3d6)');
  });

  it('separa o hífen do identificador da subtração', () => {
    expect(resolveRefs('@prof-1', { prof: 3 })).toBe('3-1');
    expect(rollFormula('@prof-1', { data: { prof: 3 } }).total).toBe(2);
  });

  it('número colado numa ref de dado conta os dados daquela face', () => {
    expect(resolveRefs('3@scale.monk.die', { 'scale.monk.die': '1d8' })).toBe('3d8');
    expect(rollFormula('3@scale.monk.die', { data: { 'scale.monk.die': '1d8' }, rng: seq(1, 2, 3) }).total).toBe(6);
  });

  it('referência sem valor é erro que diz qual', () => {
    expect(() => resolveRefs('1d20 + @abilities.wis.mod', {})).toThrow('@abilities.wis.mod');
  });

  it('a fórmula do pool de Second Wind rola com os dados da ficha', () => {
    const r = rollFormula('1d10 + @classes.fighter.levels', { data: { classes: { fighter: { levels: 5 } } }, rng: seq(6) });
    expect(r.total).toBe(11);
  });
});

describe('parseFormula e validateFormula', () => {
  it('normaliza o texto', () => {
    expect(formatNode(parseFormula('2D20KH1+5'))).toBe('2d20kh + 5');
    expect(formatNode(parseFormula('1d6min3 - max(1, 2)'))).toBe('1d6min3 - max(1, 2)');
  });

  it('aponta o erro de sintaxe', () => {
    expect(validateFormula('1d20 +')).toMatch(/ends too early/);
    expect(validateFormula('1d20 + foo')).toMatch(/Unknown word "foo"/);
    expect(validateFormula('2 $ 3')).toMatch(/Unexpected character/);
    expect(validateFormula('')).toMatch(/empty/);
    expect(validateFormula('(1 + 2')).toMatch(/Expected "\)"/);
    expect(validateFormula('1d20 + @prof', { prof: 2 })).toBeNull();
  });
});

describe('rng', () => {
  it('cryptoRng fica na faixa e cobre todas as faces', () => {
    const seen = new Set();
    for (let i = 0; i < 2000; i++) {
      const v = cryptoRng(6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it('sequenceRng recusa valor fora do dado (dado físico digitado errado)', () => {
    expect(() => rollFormula('1d6', { rng: sequenceRng([7]) })).toThrow(/not a valid result for a d6/);
  });

  it('sequenceRng cai no fallback quando os valores acabam', () => {
    expect(rollFormula('2d6', { rng: sequenceRng([3], () => 4) }).total).toBe(7);
  });
});

describe('rollParts', () => {
  it('rola cada parte rotulada e soma, pulando as vazias', () => {
    const r = rollParts([
      { label: 'Longsword', formula: '1d8' },
      { label: 'Strength', formula: 3 },
      { label: 'Nada', formula: '' },
      { label: 'Divine Favor', formula: '1d4' },
    ], { rng: seq(6, 2) });
    expect(r.total).toBe(11);
    expect(r.parts.map((p) => [p.label, p.total])).toEqual([['Longsword', 6], ['Strength', 3], ['Divine Favor', 2]]);
  });

  it('o crítico vale para todas as partes', () => {
    const r = rollParts([{ label: 'a', formula: '1d6' }, { label: 'b', formula: '1d4' }], { rng: seq(1, 2, 3, 4), critical: true });
    expect(r.total).toBe(10);
  });
});

describe('d20Test', () => {
  it('vantagem e desvantagem se anulam', () => {
    expect(resolveMode(1, 0)).toBe('advantage');
    expect(resolveMode(0, 2)).toBe('disadvantage');
    expect(resolveMode(2, 1)).toBe('normal');
    expect(resolveMode(true, false)).toBe('advantage');
    expect(resolveMode(0, 0)).toBe('normal');
  });

  it('na vantagem vale o maior d20, e o natural é o mantido', () => {
    const r = d20Test({ parts: [{ label: 'Strength', formula: 3 }], advantage: 1, rng: seq(4, 15) });
    expect(r.mode).toBe('advantage');
    expect(r.natural).toBe(15);
    expect(r.total).toBe(18);
    expect(r.parts[0].formula).toBe('2d20kh');
  });

  it('na desvantagem vale o menor', () => {
    expect(d20Test({ disadvantage: true, rng: seq(4, 15) }).natural).toBe(4);
  });

  it('marca crítico pelo limiar e falha crítica no 1', () => {
    expect(d20Test({ rng: seq(20) }).isCritical).toBe(true);
    expect(d20Test({ rng: seq(19) }).isCritical).toBe(false);
    expect(d20Test({ rng: seq(19), critThreshold: 19 }).isCritical).toBe(true);
    expect(d20Test({ rng: seq(1) }).isFumble).toBe(true);
  });

  it('o piso do d20 (Reliable Talent) sobe o total mas não muda o natural', () => {
    const r = d20Test({ parts: [{ label: 'Stealth', formula: 7 }], d20Min: 10, rng: seq(3) });
    expect(r.total).toBe(17);
    expect(r.natural).toBe(3);
  });

  it('as partes podem citar a ficha e trazer dados (Bless)', () => {
    const r = d20Test({ parts: [{ label: 'Dexterity', formula: '@abilities.dex.mod' }, { label: 'Bless', formula: '1d4' }], data: { abilities: { dex: { mod: 2 } } }, rng: seq(10, 3) });
    expect(r.total).toBe(15);
  });

  it('o resultado é serializável (vai inteiro no evento)', () => {
    const r = d20Test({ advantage: 1, rng: seq(8, 12) });
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});
