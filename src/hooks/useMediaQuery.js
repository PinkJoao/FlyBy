// =============================================================================
// useMediaQuery: uma media query do CSS, viva no React
// =============================================================================
// O QUE FAZ
//   Diz se a media query vale agora e re-renderiza quando ela muda (girar o
//   celular, redimensionar a janela). Serve quando a ESTRUTURA muda com a largura
//   (o histórico do play mode vira aba), e não só o estilo, que fica no CSS.
//
// FUNÇÕES
//   useMediaQuery(query): verdadeiro enquanto a query vale.
//
// DECISÕES E ARMADILHAS
//   - useSyncExternalStore, assinando o `change` do MediaQueryList: sem estado
//     copiado num useState, a primeira pintura já sai com o valor certo.
//   - Sem matchMedia (testes, ambiente sem janela), a query não vale.
// -----------------------------------------------------------------------------

import { useSyncExternalStore } from 'react';

/** Verdadeiro enquanto a media query vale. */
export default function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}
