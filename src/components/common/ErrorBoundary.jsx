// =============================================================================
// ErrorBoundary: barreira que troca um pedaço quebrado da tela por nada (ou reserva)
// =============================================================================
// O QUE FAZ
//   Envolve um pedaço opcional da interface (a faixa e a galeria de retratos) para
//   que um erro de renderização ali não derrube o escolhedor nem a ficha: o pedaço
//   some (ou mostra `fallback`) e o resto segue (DDL-0137).
//
// FUNÇÕES
//   ErrorBoundary: componente de classe (getDerivedStateFromError, componentDidCatch).
//
// DECISÕES E ARMADILHAS
//   - Barreira de erro só existe como classe no React; é o único componente de classe
//     do app.
//   - O erro vai para o console (componentDidCatch), para não sumir em silêncio no dev,
//     e para `onError` (a galeria fecha a si mesma por ele).
// -----------------------------------------------------------------------------

import { Component } from 'react';

/** Mostra `fallback` (ou nada) no lugar dos filhos que lançarem ao renderizar. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Parte da tela falhou e foi escondida:', error);
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
