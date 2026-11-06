// =============================================================================
// colors: as cores dos dados animados, dos tokens do tema
// =============================================================================
// O QUE FAZ
//   Lê os tokens do tema atual (--accent para a face, --warning para o ouro do
//   crítico, --danger para o vermelho da falha) para o canvas, que não lê variável de
//   CSS. Usado pelo d20 em destaque e pela bandeja (DDL-0152, DDL-0153).
//
// FUNÇÕES
//   tokenColors(): { face, gold, red, edge, text }.
//
// DECISÕES E ARMADILHAS
//   - Lido na montagem de cada animação: trocar de tema entre rolagens já vale na
//     próxima (DDL-0097).
// -----------------------------------------------------------------------------

/** As cores do dado, dos tokens do tema atual. */
export function tokenColors() {
  const css = getComputedStyle(document.documentElement);
  const read = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    face: read('--accent', '#8b5cf6'),
    gold: read('--warning', '#e0a02e'),
    red: read('--danger', '#e05050'),
    edge: 'rgba(255, 255, 255, 0.35)',
    text: '#fff',
  };
}
