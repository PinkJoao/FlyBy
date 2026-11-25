// =============================================================================
// wheelScroll: as faixas que rolam de lado (roda do mouse e esmaecido de borda)
// =============================================================================
// O QUE FAZ
//   Liga, uma vez no main.jsx, o comportamento de toda faixa marcada com
//   `data-wheel-x` (as abas da ficha e do jogo, as sub-abas, as categorias do
//   grimório e do seletor de tags, a faixa de retratos sugeridos):
//   - girar a roda sobre ela rola de lado, sem Shift (importa no PC com a janela
//     estreita, quando as abas não cabem);
//   - o atributo `data-fade` diz qual borda ainda tem conteúdo ('start', 'end' ou
//     'both'), e o index.css esmaece essa borda. É a pista de que a faixa rola,
//     já que ela não mostra barra.
//
// FUNÇÕES
//   wheelTargetOf(target): a faixa `data-wheel-x` mais próxima do ponteiro, ou null.
//   onWheel(e): converte a roda vertical em rolagem lateral quando dá.
//   updateFade(el): recalcula o `data-fade` de uma faixa; onRowScroll(e) o chama
//     ao rolar.
//   track(el), untrack(el), scan(node, fn): acompanham as faixas que montam e
//     desmontam (ResizeObserver, rolagem, MutationObserver).
//   installWheelToHorizontal(): liga tudo (uma vez só).
//
// DECISÕES E ARMADILHAS
//   - OPT-IN pelo atributo, e não toda caixa que rola de lado: sobre uma tabela
//     larga (TableViewer) a roda tem de rolar a página, não a tabela (DDL-0130).
//   - Nas pontas da faixa a roda volta a rolar a página: ninguém fica preso numa
//     faixa que não anda mais. Gesto lateral de touchpad (deltaX maior) e Ctrl+roda
//     (zoom) passam direto.
//   - Ouvinte nativo com `passive: false`, senão o preventDefault não vale; com
//     `deltaMode` de linhas (alguns mouses no Firefox) cada linha vale 16px.
//   - O esmaecido é DINÂMICO (DDL-0131): uma máscara fixa apagava a última aba
//     mesmo quando tudo cabia. O ResizeObserver vê a faixa mudar de largura; o
//     `load` em captura vê as miniaturas chegando (a faixa cresce sem mudar de
//     tamanho); o MutationObserver acha as faixas que o React monta depois e
//     recalcula a faixa cujo conteúdo mudou (abas trocadas, contadores).
// -----------------------------------------------------------------------------

const LINE_PX = 16;
const SELECTOR = '[data-wheel-x]';
let installed = false;
let resizer = null;
const tracked = new WeakSet();

/** A faixa `data-wheel-x` mais próxima do ponteiro, ou null. */
function wheelTargetOf(target) {
  return target instanceof Element ? target.closest(SELECTOR) : null;
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

/** Recalcula qual borda da faixa ainda tem conteúdo ('start', 'end', 'both' ou nenhuma). */
function updateFade(el) {
  const max = el.scrollWidth - el.clientWidth;
  let fade = '';
  if (max > 1) {
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft < max - 1;
    fade = start && end ? 'both' : start ? 'start' : end ? 'end' : '';
  }
  if (fade) {
    if (el.dataset.fade !== fade) el.dataset.fade = fade;
  } else if ('fade' in el.dataset) {
    delete el.dataset.fade;
  }
}

const onRowScroll = (e) => updateFade(e.currentTarget);

/** Passa a acompanhar uma faixa. */
function track(el) {
  if (tracked.has(el)) return;
  tracked.add(el);
  resizer?.observe(el);
  el.addEventListener('scroll', onRowScroll, { passive: true });
  updateFade(el);
}

/** Para de acompanhar uma faixa que saiu da página. */
function untrack(el) {
  if (!tracked.has(el)) return;
  tracked.delete(el);
  resizer?.unobserve(el);
  el.removeEventListener('scroll', onRowScroll);
}

/** Aplica `fn` ao nó e às faixas dentro dele. */
function scan(node, fn) {
  if (!(node instanceof Element)) return;
  if (node.matches(SELECTOR)) fn(node);
  node.querySelectorAll(SELECTOR).forEach(fn);
}

/** Liga a roda e o esmaecido das faixas laterais (idempotente). */
export function installWheelToHorizontal() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('wheel', onWheel, { passive: false });

  if (typeof ResizeObserver !== 'undefined') {
    resizer = new ResizeObserver((entries) => entries.forEach((entry) => updateFade(entry.target)));
  }
  document.addEventListener(
    'load',
    (e) => {
      const row = wheelTargetOf(e.target);
      if (row) updateFade(row);
    },
    true,
  );
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => scan(n, track));
        m.removedNodes.forEach((n) => scan(n, untrack));
        const row = wheelTargetOf(m.target);
        if (row) updateFade(row);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
  scan(document.body, track);
}
