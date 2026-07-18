import { describe, it, expect } from 'vitest';
import { toCopper, toGp, fromCopper } from './currency';

describe('toCopper', () => {
  it('converte cada moeda pro total em cobre (pp=1000, gp=100, ep=50, sp=10, cp=1)', () => {
    expect(toCopper({ pp: 1, gp: 2, ep: 1, sp: 3, cp: 4 })).toBe(1000 + 200 + 50 + 30 + 4);
  });

  it('moedas ausentes contam como 0', () => {
    expect(toCopper({ gp: 5 })).toBe(500);
    expect(toCopper(null)).toBe(0);
  });
});

describe('toGp', () => {
  it('total em ouro = cobre / 100', () => {
    expect(toGp({ gp: 10 })).toBe(10);
    expect(toGp({ sp: 5 })).toBe(0.5);
  });
});

describe('fromCopper', () => {
  it('reparte no MENOR número de moedas (troco mínimo)', () => {
    expect(fromCopper(1234)).toEqual({ pp: 1, gp: 2, ep: 0, sp: 3, cp: 4 });
  });

  it('zero → tudo zero', () => {
    expect(fromCopper(0)).toEqual({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 });
  });

  it('negativo → capado em zero (nunca fica devendo)', () => {
    expect(fromCopper(-500)).toEqual({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 });
  });

  it('arredonda frações de cobre', () => {
    expect(fromCopper(10.6)).toEqual({ pp: 0, gp: 0, ep: 0, sp: 1, cp: 1 });
  });
});
