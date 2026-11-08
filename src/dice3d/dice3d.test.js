// =============================================================================
// dice3d.test: os dados poliédricos e o que as animações encenam
// =============================================================================
// O QUE FAZ
//   Confere os seis dados (faces, números, opostas somando lados mais um), que a
//   orientação de cada valor o põe virado para a câmera (o dado para EXATO no número,
//   e o d20 em pé), o giro final que segue o dado, e o que d20Show e trayShow tiram de
//   um evento (vantagem, dado de mesa, crítico do limiar, d100 em dois d10).
//
// FUNÇÕES
//   near(a, b): dois vetores iguais a menos do arredondamento.
//   event(results, extra): um evento de teste de d20 como o engine grava.
//   up(die, q, value): para onde aponta, depois de girar, o que deve olhar a câmera.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { DIE_SIDES, dieQuat, makeDie, quatAxis, quatRotate, quatSlerp, twistToward } from './geometry';
import { bonusesOf, d20Show, shouldAnimate, shouldTray, trayShow, TRAY_MAX } from './rollShow';
import { gridOf, traySize } from './diceTray';

const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
const event = (results, extra = {}) => ({
  kind: 'check',
  label: 'Stealth',
  rolls: { natural: results.find((r) => r.kept)?.value, total: 17, isCritical: false, isFumble: false, parts: [{ label: 'd20', groups: [{ results }] }], ...extra },
});
const up = (die, q, value) => {
  const v = die.vertexNumbers ? die.verts[die.vertexNumbers.indexOf(value)] : die.faces.find((x) => x.number === value).normal;
  const r = quatRotate(q, v);
  return r.map((x) => x / Math.hypot(...r));
};

describe('geometry', () => {
  it('os seis dados: faces, números e opostas somando lados mais um', () => {
    const shape = { 4: [4, 3], 6: [6, 4], 8: [8, 3], 10: [10, 4], 12: [12, 5], 20: [20, 3] };
    for (const sides of DIE_SIDES) {
      const die = makeDie(sides);
      expect(die.faces).toHaveLength(shape[sides][0]);
      expect(die.faces.every((f) => f.poly.length === shape[sides][1])).toBe(true);
      expect(Math.max(...die.verts.map((v) => Math.hypot(...v)))).toBeCloseTo(1, 9);
      if (sides === 4) continue;
      expect(die.faces.map((f) => f.number).sort((a, b) => a - b)).toEqual(Array.from({ length: sides }, (_, i) => i + 1));
      for (const f of die.faces) {
        const opp = die.faces.find((g) => g.normal.every((v, k) => Math.abs(v + f.normal[k]) < 1e-9));
        expect(opp.number + f.number).toBe(sides + 1);
      }
    }
  });

  it('todo valor de todo dado termina virado para a câmera; o d20 em pé', () => {
    for (const sides of DIE_SIDES) {
      const die = makeDie(sides);
      for (let v = 1; v <= sides; v++) expect(near(up(die, dieQuat(die, v), v), [0, 0, 1])).toBe(true);
    }
    const d20 = makeDie(20);
    for (let v = 1; v <= 20; v++) {
      const f = d20.faces.find((x) => x.number === v);
      expect(near(quatRotate(dieQuat(d20, v), f.up), [0, 1, 0])).toBe(true);
    }
  });

  it('o giro final segue o dado e não tira o valor da câmera', () => {
    const die = makeDie(6);
    const now = quatAxis([0, 0, 1], 1.1);
    const tw = twistToward(die, 3, now);
    expect(near(up(die, dieQuat(die, 3, tw), 3), [0, 0, 1])).toBe(true);
  });

  it('rótulos do par do d100', () => {
    expect(makeDie(10, 'tens').label(1)).toBe('00');
    expect(makeDie(10, 'tens').label(10)).toBe('90');
    expect(makeDie(10, 'ones').label(1)).toBe('0');
  });

  it('slerp chega aos extremos', () => {
    const a = quatAxis([1, 0, 0], 0.3);
    const b = quatAxis([0, 1, 0], 2);
    expect(near(quatSlerp(a, b, 0), a)).toBe(true);
    expect(near(quatSlerp(a, b, 1), b)).toBe(true);
  });
});

describe('trayShow', () => {
  const dmg = (groups, extra = {}) => ({ kind: 'damageRoll', label: 'Longsword', payload: {}, rolls: { total: 11, parts: [{ label: 'Longsword', groups }], ...extra } });

  it('um dado por resultado, com o descartado marcado', () => {
    const show = trayShow(dmg([{ faces: 8, results: [{ value: 5, kept: true }, { value: 2, kept: true }] }, { faces: 20, results: [{ value: 3, kept: false }] }]));
    expect(show.dice).toEqual([{ sides: 8, value: 5, kept: true }, { sides: 8, value: 2, kept: true }, { sides: 20, value: 3, kept: false }]);
    expect(show).toMatchObject({ total: 11, label: 'Longsword', tag: null, more: 0 });
  });

  it('o d100 vira dezenas e unidades; 100 é 00 e 0', () => {
    const show = trayShow(dmg([{ faces: 100, results: [{ value: 47, kept: true }, { value: 100, kept: true }] }]));
    expect(show.dice).toEqual([
      { sides: 10, mode: 'tens', value: 5, kept: true },
      { sides: 10, mode: 'ones', value: 8, kept: true },
      { sides: 10, mode: 'tens', value: 1, kept: true },
      { sides: 10, mode: 'ones', value: 1, kept: true },
    ]);
  });

  it('dado sem sólido vira ficha; muitos dados cortam em TRAY_MAX', () => {
    expect(trayShow(dmg([{ faces: 3, results: [{ value: 2, kept: true }] }])).dice[0]).toMatchObject({ token: true });
    const many = trayShow(dmg([{ faces: 6, results: Array.from({ length: 30 }, () => ({ value: 1, kept: true })) }]));
    expect(many.dice).toHaveLength(TRAY_MAX);
    expect(many.more).toBe(30 - TRAY_MAX);
  });

  it('teste de d20, dado de mesa e evento sem dados ficam fora; crítico ganha selo', () => {
    expect(trayShow(event([{ value: 12, kept: true }]))).toBeNull();
    expect(trayShow(dmg([{ faces: 6, results: [{ value: 4, kept: true }] }], { physical: true }))).toBeNull();
    expect(trayShow(dmg([]))).toBeNull();
    expect(trayShow({ ...dmg([{ faces: 6, results: [{ value: 4, kept: true }] }]), payload: { critical: true } }).tag).toBe('Critical');
  });

  it('a bandeja só roda com All dice; o tamanho encolhe com muitos dados', () => {
    const show = trayShow(dmg([{ faces: 6, results: [{ value: 4, kept: true }] }]));
    expect(shouldTray(show, { setting: 'all' })).toBe(true);
    expect(shouldTray(show, { setting: 'd20' })).toBe(false);
    expect(shouldTray(show, { setting: 'all', reduced: true })).toBe(false);
    expect(traySize(20, 375, 600)).toBeLessThan(traySize(2, 375, 600));
  });
});

describe('rollShow', () => {
  it('um d20, com o rótulo e o total', () => {
    const show = d20Show(event([{ value: 12, kept: true }]));
    expect(show).toMatchObject({ dice: [{ value: 12, kept: true }], total: 17, label: 'Stealth', tag: null });
  });

  it('vantagem: dois dados, o descartado marcado; a face é o valor bruto', () => {
    const show = d20Show(event([{ value: 10, raw: 4, kept: true }, { value: 3, kept: false }]));
    expect(show.dice).toEqual([{ value: 4, kept: true }, { value: 3, kept: false }]);
  });

  it('dado de mesa e evento sem d20 não animam', () => {
    expect(d20Show(event([{ value: 12, kept: true }], { physical: true }))).toBeNull();
    expect(d20Show({ kind: 'damageRoll', rolls: { parts: [{ label: 'Longsword', groups: [] }] } })).toBeNull();
    expect(d20Show({ kind: 'heal' })).toBeNull();
  });

  it('o crítico segue o limiar do evento; o selo depende do tipo', () => {
    const atk = { ...event([{ value: 19, kept: true }], { isCritical: true, natural: 19 }), kind: 'attack' };
    expect(d20Show(atk)).toMatchObject({ crit: true, tag: 'Critical hit' });
    expect(d20Show(event([{ value: 20, kept: true }], { isCritical: true, natural: 20 })).tag).toBe('Natural 20');
    expect(d20Show(event([{ value: 1, kept: true }], { isFumble: true, natural: 1 })).tag).toBe('Natural 1');
  });

  it('a preferência e o movimento reduzido desligam', () => {
    const show = d20Show(event([{ value: 12, kept: true }]));
    expect(shouldAnimate(show, { setting: 'd20' })).toBe(true);
    expect(shouldAnimate(show, { setting: 'off' })).toBe(false);
    expect(shouldAnimate(show, { reduced: true })).toBe(false);
    expect(shouldAnimate(null)).toBe(false);
  });
});

describe('bônus do d20', () => {
  it('fixos e rolados na ordem; parte fixa zerada fica de fora', () => {
    const parts = [
      { label: 'Dexterity', total: 4, groups: [] },
      { label: 'Proficiency', total: 0, groups: [] },
      { label: 'Bless', total: 3, groups: [{ faces: 4, results: [{ value: 3, kept: true }] }] },
    ];
    expect(bonusesOf(parts)).toEqual([
      { label: 'Dexterity', total: 4, dice: [] },
      { label: 'Bless', total: 3, dice: [{ sides: 4, value: 3, kept: true }] },
    ]);
  });

  it('d20Show começa no valor do d20 e soma até o total gravado', () => {
    const e = { kind: 'check', label: 'Stealth', rolls: { natural: 12, total: 19, isCritical: false, isFumble: false, parts: [
      { label: 'd20', total: 12, groups: [{ faces: 20, results: [{ value: 12, kept: true }] }] },
      { label: 'Dexterity', total: 4, groups: [] },
      { label: 'Bless', total: 3, groups: [{ faces: 4, results: [{ value: 3, kept: true }] }] },
    ] } };
    const show = d20Show(e);
    expect(show.base + show.bonuses.reduce((s, b) => s + b.total, 0)).toBe(show.total);
  });

  it('a grade da bandeja cabe todos os dados', () => {
    for (const n of [1, 2, 5, 12, 24]) {
      const g = gridOf(n, 375, 600);
      expect(g.cols * g.rows).toBeGreaterThanOrEqual(n);
    }
  });
});

