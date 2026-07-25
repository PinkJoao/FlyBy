// =============================================================================
// anchors - chaves dos data-tour usadas pelo tutorial
// =============================================================================
// O tutorial (TutorialOverlay) resolve o alvo de cada passo por
// `document.querySelector('[data-tour="<chave>"]')`. Estas constantes sao a
// FONTE UNICA das chaves, compartilhadas entre os componentes (que marcam o
// elemento) e os tours (que o referenciam), para nao haver string solta a
// divergir. Um componente novo que queira virar alvo de um passo declara a
// chave aqui e a poe no `data-tour` do elemento.
// -----------------------------------------------------------------------------

export const TUT = {
  // --- SelectorPanel (o seletor generico) ---
  SELECTOR_SEARCH: 'sel-search',
  SELECTOR_FILTERS: 'sel-filters', // desktop: painel fixo a esquerda
  SELECTOR_FILTERS_TOGGLE: 'sel-filters-toggle', // mobile: botao que abre a gaveta
  SELECTOR_RESULTS: 'sel-results',
  SELECTOR_PREVIEW: 'sel-preview', // desktop: coluna de detalhe a direita
  SELECTOR_DETAIL: 'sel-detail', // mobile: tela de detalhe (aberta pelo tour)
  SELECTOR_SELECT: 'sel-select',
};
