// Testes dos helpers PUROS do harness de sweep (Fase T). Nada aqui toca o
// compêndio local - a varredura em si roda só via `npm run sweep`.
import { describe, it, expect } from 'vitest';
import { mulberry32, hashSeed, pickOne, shuffled } from './rng';
import { scanBadValues, expectedProfBonus } from './invariants';
import { normalizeBag, decisionSummary, diffSummaries, classifyDiffs, WAIVERS, KNOWN_ISSUES } from './roundtrip';

describe('rng', () => {
  it('é determinístico por seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('hashSeed é estável e sensível ao base', () => {
    expect(hashSeed('class:fighter/Champion')).toBe(hashSeed('class:fighter/Champion'));
    expect(hashSeed('x', 1)).not.toBe(hashSeed('x', 2));
  });
  it('pickOne/shuffled respeitam o seed e não mutam', () => {
    const arr = [1, 2, 3, 4];
    const s = shuffled(mulberry32(7), arr);
    expect(arr).toEqual([1, 2, 3, 4]);
    expect([...s].sort()).toEqual([1, 2, 3, 4]);
    expect(pickOne(mulberry32(7), [])).toBeNull();
  });
});

describe('scanBadValues', () => {
  it('acha NaN e undefined dentro de arrays, com caminho', () => {
    const out = scanBadValues({ a: { b: NaN }, c: [1, undefined, 3] });
    expect(out.some((s) => s.startsWith('a.b'))).toBe(true);
    expect(out.some((s) => s.includes('c[1]'))).toBe(true);
  });
  it('não revisita objetos compartilhados nem estoura com ciclos', () => {
    const shared = { x: 1 };
    const cyc = { shared };
    cyc.self = cyc;
    expect(scanBadValues({ a: shared, b: shared, cyc })).toEqual([]);
  });
  it('expectedProfBonus segue a tabela 5e', () => {
    expect([1, 4, 5, 8, 9, 12, 13, 16, 17, 20].map(expectedProfBonus)).toEqual([2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  });
});

describe('normalizeBag / decisionSummary', () => {
  it('ordena picks, minusculiza e derruba entradas vazias', () => {
    const bag = {
      skill: { kind: 'skill', picks: ['prc', 'ani'] },
      empty: { kind: 'tool', picks: [] },
      feat: { kind: 'feat', picks: ['Alert|XPHB'], sub: { 'Alert|XPHB': {} } },
    };
    const n = normalizeBag(bag);
    expect(n.skill.picks).toEqual(['ani', 'prc']);
    expect(n.empty).toBeUndefined();
    expect(n.feat).toEqual({ kind: 'feat', picks: ['alert|xphb'] }); // sub vazio some
  });
  it('weapon mastery normaliza os DOIS formatos aceitos (TC-0003)', () => {
    const a = normalizeBag({ weaponMastery: { kind: 'weapon', picks: ['Club', 'Glaive'] } });
    const b = normalizeBag({ weaponMastery: { kind: 'weapon', picks: ['Club|PHB', 'Glaive|PHB'] } });
    expect(a).toEqual(b);
  });
  it('origem funde o choice-bag com os arrays legados (import grava nos arrays)', () => {
    const builder = decisionSummary({
      origin: { choices: { skill: { kind: 'skill', picks: ['ani', 'med'] } }, abilityBoosts: [] },
      classes: [],
    });
    const imported = decisionSummary({
      origin: { choices: {}, skillProficiencies: ['ani', 'med'], abilityBoosts: [] },
      classes: [],
    });
    expect(builder.origin.skills).toEqual(imported.origin.skills);
  });
});

describe('diffSummaries / classifyDiffs', () => {
  it('recursa arrays de objetos POR ÍNDICE (caminhos internos, não um diff só)', () => {
    const a = { classes: [{ classId: 'fighter', choices: { skill: { picks: ['ani'] } } }] };
    const b = { classes: [{ classId: 'fighter', choices: { skill: { picks: ['prc'] } } }] };
    const diffs = diffSummaries(a, b);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe('classes[0].choices.skill.picks');
  });
  it('arrays de primitivas comparam como um valor só', () => {
    const diffs = diffSummaries({ spells: ['a', 'b'] }, { spells: ['a'] });
    expect(diffs).toEqual([{ path: 'spells', before: ['a', 'b'], after: ['a'] }]);
  });
  it('classifica waiver > known > real, nessa ordem', () => {
    const waivers = [{ id: 'w1', test: (d) => d.path.startsWith('species.') }];
    const known = [{ id: 'TC-9999', test: (d) => d.path === 'origin.tools' }];
    const diffs = [
      { path: 'species.choices.size-0.picks', before: ['s'], after: undefined },
      { path: 'origin.tools', before: ['x'], after: [] },
      { path: 'classes[0].level', before: 20, after: 19 },
    ];
    const { real, known: hits, waived } = classifyDiffs(diffs, { waivers, known });
    expect(waived.map((d) => d.waiver)).toEqual(['w1']);
    expect(hits.map((d) => d.issue)).toEqual(['TC-9999']);
    expect(real).toHaveLength(1);
    expect(real[0].path).toBe('classes[0].level');
  });
  it('todo KNOWN_ISSUE/WAIVER real referencia um id válido (baseline hoje: vazio)', () => {
    for (const k of KNOWN_ISSUES) expect(k.id).toMatch(/^TC-\d{4}$/);
    for (const w of WAIVERS) expect(typeof w.reason).toBe('string');
  });
});
