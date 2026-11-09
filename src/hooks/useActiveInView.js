// =============================================================================
// useActiveInView: a aba aberta sempre à vista na faixa de abas
// =============================================================================
// O QUE FAZ
//   Quando a aba ativa muda (toque, deslize, guia, tutorial), rola a faixa de
//   abas de lado até a aba ativa ficar no meio dela. Sem isso, deslizar pelas
//   abas no celular abria uma aba que estava fora da faixa e ninguém via qual era.
//
// FUNÇÕES
//   useActiveInView(ref, key): rola a faixa `ref` até o filho com
//     `data-active="true"` sempre que `key` muda.
//
// DECISÕES E ARMADILHAS
//   - Rola SÓ a faixa (`scrollTo` com `left`), nunca `scrollIntoView`: ele rola
//     também a página na vertical e tirava o leitor do lugar.
//   - Mede pelo `getBoundingClientRect`, não pelo `offsetLeft`, que é relativo ao
//     primeiro ancestral posicionado e não à faixa.
//   - Suave, menos com "reduzir movimento" (`reducedMotion`, DDL-0100).
// -----------------------------------------------------------------------------

import { useEffect } from 'react';
import { reducedMotion } from '../motion';

/** Rola a faixa `ref` até o filho com `data-active="true"` quando `key` muda. */
export default function useActiveInView(ref, key) {
  useEffect(() => {
    const row = ref.current;
    const tab = row?.querySelector('[data-active="true"]');
    if (!row || !tab || row.scrollWidth <= row.clientWidth + 1) return;
    const rowBox = row.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    const center = tabBox.left - rowBox.left + row.scrollLeft - (row.clientWidth - tabBox.width) / 2;
    const left = Math.max(0, Math.min(center, row.scrollWidth - row.clientWidth));
    if (Math.abs(left - row.scrollLeft) < 1) return;
    row.scrollTo({ left, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [ref, key]);
}
