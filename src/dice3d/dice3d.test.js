// =============================================================================
// dice3d.test: a geometria do d20 e o que a animação encena
// =============================================================================
// O QUE FAZ
//   Confere o icosaedro (20 faces, números de 1 a 20, opostas somando 21), que a
//   orientação de cada face a põe de frente e em pé (o dado para EXATO no número), e
//   o que d20Show tira de um evento (vantagem, dado de mesa, crítico do limiar).
//
// FUNÇÕES
//   near(a, b): dois vetores iguais a menos do arredondamento.
//   event(results, extra): um evento de teste de d20 como o engine grava.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { icosahedron, faceQuat, quatRotate, quatSlerp, quatAxis } from './d20Canvas';
import { d20Show, shouldAnimate } from './rollShow';

const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
const event = (results, extra = {}) => ({
  kind: 'check',
  label: 'Stealth',
  rolls: { natural: results.find((r) => r.kept)?.value, total: 17, isCritical: false, isFumble: false, parts: [{ label: 'd20', groups: [{ results }] }], ...extra },
});

describe('d20Canvas', () => {
  it('icosaedro com 20 faces numeradas, opostas somando 21', () => {
    const geo = icosahedron();
    expect(geo.verts).toHaveLength(12);
    expect(geo.faces).toHaveLength(20);
    expect(geo.faces.map((f) => f.number).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const f of geo.faces) {
      const opp = geo.faces.find((g) => g.normal.every((v, i) => Math.abs(v + f.normal[i]) < 1e-9));
      expect(opp.number + f.number).toBe(21);
    }
  });

  it('cada face termina de frente para quem olha e em pé', () => {
    const geo = icosahedron();
    for (let n = 1; n <= 20; n++) {
      const q = faceQuat(geo, n);
      const f = geo.faces.find((x) => x.number === n);
      expect(near(quatRotate(q, f.normal), [0, 0, 1])).toBe(true);
      expect(near(quatRotate(q, f.up), [0, 1, 0])).toBe(true);
    }
  });

  it('slerp chega aos extremos', () => {
    const a = quatAxis([1, 0, 0], 0.3);
    const b = quatAxis([0, 1, 0], 2);
    expect(near(quatSlerp(a, b, 0), a)).toBe(true);
    expect(near(quatSlerp(a, b, 1), b)).toBe(true);
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
