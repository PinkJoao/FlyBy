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
//   fromCopper(copper): reparte um total nas 5 moedas, maior denominação primeiro.
//
// DECISÕES E ARMADILHAS
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
    out[k] = Math.floor(remaining / CP_PER[k]);
    remaining -= out[k] * CP_PER[k];
  }
  return out;
}
