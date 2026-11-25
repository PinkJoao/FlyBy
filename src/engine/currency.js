// =============================================================================
// currency: a conversão entre moedas (Fase B1)
// =============================================================================
// O QUE FAZ
//   `character.currency` guarda as 5 moedas (pp, gp, ep, sp, cp). Aqui se converte
//   de e para COBRE, a menor unidade: o preço da loja vem em cobre do 5e.tools, e o
//   total exibido é em gp.
//
// FUNÇÕES
//   toCopper(currency), toGp(currency): o total em cobre e em ouro.
//   fromCopper(copper): reparte um total, maior denominação primeiro, sem electrum.
//   fewestCoins(currency): o mesmo total no menor número de moedas.
//   convertCoins(currency, from, to, amount): troca moedas de um tipo por outro
//     `{ used, got, currency }`; só o que dá moeda inteira.
//   spendCoins(currency, denom, amount): gasta; faltando daquela moeda, troca as
//     outras; null quando o total não chega.
//   gpText(currency): o total em ouro, curto, para um botão.
//
// DECISÕES E ARMADILHAS
//   - O troco nunca gera electrum (decisão do dono, DDL-0321): a moeda existe na bolsa e
//     só entra à mão.
//   - Numa COMPRA a mistura de moedas do jogador é simplificada para o menor
//     número de moedas que soma o mesmo total. Nunca fica negativo.
// -----------------------------------------------------------------------------

const CP_PER = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 };
export const DENOMINATIONS = ['pp', 'gp', 'ep', 'sp', 'cp'];

/** Total em peças de cobre. */
export function toCopper(currency) {
  return DENOMINATIONS.reduce((sum, k) => sum + (currency?.[k] ?? 0) * CP_PER[k], 0);
}

/** Total em peças de ouro, para exibição. */
export function toGp(currency) {
  return toCopper(currency) / 100;
}

/**
 * Reparte um total em cobre nas 5 moedas (troco mínimo).
 * @param {number} copper
 * @returns {{pp:number, gp:number, ep:number, sp:number, cp:number}}
 */
export function fromCopper(copper) {
  let remaining = Math.max(0, Math.round(copper));
  const out = {};
  for (const k of DENOMINATIONS) {
    out[k] = k === 'ep' ? 0 : Math.floor(remaining / CP_PER[k]);
    remaining -= out[k] * CP_PER[k];
  }
  return out;
}

/** O mesmo total no menor número de moedas. */
export function fewestCoins(currency) {
  return fromCopper(toCopper(currency));
}

/** Troca moedas de um tipo por outro; só o que dá moeda inteira. */
export function convertCoins(currency, from, to, amount) {
  const n = Math.max(0, Math.min(Math.floor(amount) || 0, currency?.[from] ?? 0));
  const up = CP_PER[to] > CP_PER[from];
  const step = up ? CP_PER[to] / CP_PER[from] : 1;
  const got = from === to ? 0 : up ? Math.floor(n / step) : (n * CP_PER[from]) / CP_PER[to];
  const used = up ? got * step : got ? n : 0;
  return {
    used,
    got,
    step,
    currency: got ? { ...currency, [from]: (currency[from] ?? 0) - used, [to]: (currency[to] ?? 0) + got } : currency,
  };
}

/** Gasta uma quantia; faltando daquela moeda, troca as outras; null se não há o bastante. */
export function spendCoins(currency, denom, amount) {
  const n = Math.max(0, Math.floor(amount) || 0);
  if ((currency?.[denom] ?? 0) >= n) return { ...currency, [denom]: (currency?.[denom] ?? 0) - n };
  const left = toCopper(currency) - n * CP_PER[denom];
  return left < 0 ? null : fromCopper(left);
}

/** O total em ouro, curto: sem centavos a partir de 1.000. */
export function gpText(currency) {
  const gp = toGp(currency);
  return gp >= 1000 ? Math.floor(gp).toLocaleString() : gp.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
