// =============================================================================
// currency.test: testes da conversão de moedas
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { toCopper, toGp, fromCopper, fewestCoins, convertCoins, spendCoins, gpText } from './currency';

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

describe('a janela das moedas', () => {
  const purse = { pp: 2, gp: 35, ep: 1, sp: 33, cp: 5 };

  it('o troco nunca gera electrum', () => {
    expect(fromCopper(150)).toEqual({ pp: 0, gp: 1, ep: 0, sp: 5, cp: 0 });
    const few = fewestCoins(purse);
    expect(few.ep).toBe(0);
    expect(toCopper(few)).toBe(toCopper(purse));
  });

  it('converter para cima usa só o que dá moeda inteira', () => {
    const r = convertCoins(purse, 'sp', 'gp', 33);
    expect(r).toMatchObject({ used: 30, got: 3 });
    expect(r.currency).toMatchObject({ sp: 3, gp: 38 });
    expect(toCopper(r.currency)).toBe(toCopper(purse));
  });

  it('converter para baixo e para electrum, e nunca mais do que se tem', () => {
    expect(convertCoins(purse, 'pp', 'gp', 9)).toMatchObject({ used: 2, got: 20 });
    expect(convertCoins(purse, 'gp', 'ep', 3)).toMatchObject({ used: 3, got: 6 });
    expect(convertCoins(purse, 'sp', 'pp', 33)).toMatchObject({ used: 0, got: 0, currency: purse });
    expect(convertCoins(purse, 'gp', 'gp', 3).got).toBe(0);
  });

  it('gastar tira da moeda, ou troca as outras, ou diz que não há', () => {
    expect(spendCoins(purse, 'gp', 10)).toMatchObject({ gp: 25, pp: 2 });
    const changed = spendCoins(purse, 'gp', 40);
    expect(toCopper(changed)).toBe(toCopper(purse) - 4000);
    expect(spendCoins(purse, 'gp', 4000)).toBeNull();
  });

  it('o texto curto do total', () => {
    expect(gpText({ gp: 12, sp: 5 })).toBe((12.5).toLocaleString());
    expect(gpText({ gp: 1234, sp: 9 })).toBe((1234).toLocaleString());
  });
});
