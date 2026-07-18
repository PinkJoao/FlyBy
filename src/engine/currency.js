// =============================================================================
// currency - conversão entre moedas (Fase B1, estágio 3)
// =============================================================================
// Puro. `character.currency` guarda as 5 moedas discretas (pp/gp/ep/sp/cp);
// aqui convertemos pra/de peças de COBRE (a menor unidade) - usado pra compras
// na loja (preço do item vem em cobre, do 5e.tools) e pro total exibido em gp.
// -----------------------------------------------------------------------------

const CP_PER = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 };
export const DENOMINATIONS = ['pp', 'gp', 'ep', 'sp', 'cp'];

/** Valor total em peças de COBRE (a menor unidade). */
export function toCopper(currency) {
  return DENOMINATIONS.reduce((sum, k) => sum + (currency?.[k] ?? 0) * CP_PER[k], 0);
}

/** Valor total em peças de OURO (p/ exibição, ex: "42.5 gp"). */
export function toGp(currency) {
  return toCopper(currency) / 100;
}

/**
 * Reparte um total em cobre nas 5 moedas (maior denominação primeiro - troco
 * mínimo). Usado ao COMPRAR: a mistura de moedas do jogador é simplificada pro
 * menor número de moedas que soma o mesmo total. Nunca fica negativo.
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
