// =============================================================================
// motion: o lado JS das animações (direção da troca e "reduzir movimento")
// =============================================================================
// O QUE FAZ
//   As classes de motion.css são escolhidas aqui quando dependem de estado: a
//   direção de uma troca de aba ou de passo, e se o sistema pede menos
//   movimento (a saída dos diálogos espera a animação só quando ela existe).
//
// FUNÇÕES
//   slideClass(dir): a classe de entrada para 'next', 'prev' ou nenhuma.
//   directionOf(from, to): 'next' se `to` vem depois de `from`, senão 'prev'.
//   reducedMotion(): o sistema pede menos movimento?
//
// DECISÕES E ARMADILHAS
//   - Sem direção (a primeira montagem) não há classe: a ficha não desliza ao
//     abrir, só esmaece com a página.
// -----------------------------------------------------------------------------

/** A classe de entrada para 'next', 'prev' ou nenhuma. */
export function slideClass(dir) {
  if (dir === 'next') return 'motion-next';
  if (dir === 'prev') return 'motion-prev';
  return '';
}

/** 'next' se `to` vem depois de `from`, senão 'prev'. */
export function directionOf(from, to) {
  return to >= from ? 'next' : 'prev';
}

/** O sistema pede menos movimento? */
export function reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
