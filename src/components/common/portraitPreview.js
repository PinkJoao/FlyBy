// =============================================================================
// portraitPreview: a prévia em tela cheia dos retratos sugeridos
// =============================================================================
// O QUE FAZ
//   Abre o ImageViewer com a lista de retratos sugeridos (carrossel com deslize e
//   setas) e só dois botões: X vermelho, que recusa e volta, e check verde, que usa o
//   retrato que está na tela. A galeria (PortraitSuggestionsModal) e a faixa do
//   escolhedor (PortraitSuggestionStrip) abrem pelo mesmo caminho.
//
// FUNÇÕES
//   openPortraitPreview(items, index, onSelect): abre a prévia na posição `index`.
//
// DECISÕES E ARMADILHAS
//   - Recusar só fecha a prévia: não há "esconder" (removido a pedido, DDL-0128).
//   - A ação check recebe a imagem ATUAL do carrossel (`onClick(cur)`), não a que foi
//     tocada para abrir: o jogador pode ter deslizado até outra.
// -----------------------------------------------------------------------------

import { showImageViewer } from '../../store/imageViewerStore';

/**
 * Abre a prévia dos retratos sugeridos com X (recusar) e check (usar).
 * @param {Array<{ url: string }>} items
 * @param {number} index
 * @param {(url: string) => void} onSelect
 */
export function openPortraitPreview(items, index, onSelect) {
  showImageViewer(
    items.map((it) => ({ src: it.url, alt: 'Suggested portrait' })),
    Math.max(0, index),
    [
      { label: 'Not this one', icon: 'close', tone: 'danger' },
      { label: 'Use this portrait', icon: 'check', tone: 'success', onClick: (cur) => onSelect(cur.src) },
    ],
  );
}
