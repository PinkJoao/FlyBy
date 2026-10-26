// =============================================================================
// wheelScroll: a roda vertical do mouse rola de lado as faixas marcadas
// =============================================================================
// O QUE FAZ
//   Um ouvinte só, ligado uma vez no main.jsx: girar a roda sobre um elemento com
//   `data-wheel-x` (as faixas de abas da ficha e do jogo, as sub-abas, as
//   categorias do grimório e do seletor de tags, a faixa de retratos sugeridos)
//   rola a faixa de lado, sem precisar de Shift. Importa no PC com a janela
//   estreita, quando as abas não cabem e viram uma faixa que rola.
//
// FUNÇÕES
//   wheelTargetOf(target): a faixa `data-wheel-x` mais próxima do ponteiro, ou null.
//   onWheel(e): converte a roda vertical em rolagem lateral quando dá.
//   installWheelToHorizontal(): liga o ouvinte (uma vez só).
//
// DECISÕES E ARMADILHAS
//   - OPT-IN pelo atributo, e não toda caixa que rola de lado: sobre uma tabela
//     larga (TableViewer) a roda tem de rolar a página, não a tabela (DDL-0130).
//   - Nas pontas da faixa a roda volta a rolar a página: ninguém fica preso numa
//     faixa que não anda mais. Gesto lateral de touchpad (deltaX maior) passa
//     direto, já é horizontal.
//   - Ouvinte nativo com `passive: false`, senão o preventDefault não vale; com
//     `deltaMode` de linhas (alguns mouses no Firefox) cada linha vale 16px.
// -----------------------------------------------------------------------------

const LINE_PX = 16;
let installed = false;

/** A faixa `data-wheel-x` mais próxima do ponteiro, ou null. */
function wheelTargetOf(target) {
  return target instanceof Element ? target.closest('[data-wheel-x]') : null;
}

/** Converte a roda vertical em rolagem lateral da faixa sob o ponteiro, quando dá. */
function onWheel(e) {
  if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  const el = wheelTargetOf(e.target);
  if (!el || el.scrollWidth <= el.clientWidth + 1) return;
  const delta = e.deltaMode === 1 ? e.deltaY * LINE_PX : e.deltaY;
  const atStart = el.scrollLeft <= 0 && delta < 0;
  const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && delta > 0;
  if (atStart || atEnd) return;
  e.preventDefault();
  el.scrollLeft += delta;
}

/** Liga o ouvinte global da roda (idempotente). */
export function installWheelToHorizontal() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('wheel', onWheel, { passive: false });
}
