// =============================================================================
// rng - gerador determinístico do sweep (Fase T, TESTING-PLAN.md)
// =============================================================================
// Toda escolha "aleatória" do auto-builder sai daqui, semeada por linha da
// matriz: o mesmo seed reproduz exatamente o mesmo personagem, então qualquer
// falha do sweep é reproduzível com `--seed`.
// -----------------------------------------------------------------------------

/** PRNG mulberry32 - pequeno, rápido e suficiente para escolher opções. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash FNV-1a de uma string → seed 32-bit (seed por linha = base + id da linha). */
export function hashSeed(str, base = 0) {
  let h = 0x811c9dc5 ^ base;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Um item da lista (ou null se vazia). */
export function pickOne(rng, arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(rng() * arr.length)];
}

/** Cópia embaralhada (Fisher-Yates) - não muta a original. */
export function shuffled(rng, arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
