// =============================================================================
// RollButton: o botão que rola, com o atalho de pular o diálogo
// =============================================================================
// O QUE FAZ
//   Um toque abre o diálogo de rolagem; um TOQUE LONGO (no celular) ou o clique
//   com Shift (no desktop) rola direto, sem perguntar, como o Shift do Foundry
//   (docs/PLAY-MODE-PLAN.md 3.5). Chama onRoll(quick), com quick verdadeiro no
//   atalho.
//
// FUNÇÕES
//   RollButton(props): o botão.
//     start(), cancel(), click(e): o toque longo e o clique.
//
// DECISÕES E ARMADILHAS
//   - O toque longo dispara sozinho aos 500 ms; o click que o navegador manda ao
//     soltar o dedo é engolido (`fired`), senão o diálogo abriria em seguida.
//   - O menu de contexto do toque longo é cancelado, senão o celular abre o
//     "copiar texto" por cima.
// -----------------------------------------------------------------------------

import { useRef } from 'react';

const LONG_PRESS_MS = 500;

/**
 * O botão de rolar.
 * @param {{ onRoll: (quick: boolean) => void, className?: string, title?: string, children: any, disabled?: boolean }} props
 */
export default function RollButton({ onRoll, className, title, children, disabled = false }) {
  const timer = useRef(null);
  const fired = useRef(false);

  /** Começa a contar o toque longo. */
  const start = () => {
    fired.current = false;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fired.current = true;
      onRoll(true);
    }, LONG_PRESS_MS);
  };

  /** Solta antes do tempo: não é toque longo. */
  const cancel = () => clearTimeout(timer.current);

  /** O clique: abre o diálogo, ou rola direto com Shift; depois de um toque longo, nada. */
  const click = (e) => {
    cancel();
    if (fired.current) {
      fired.current = false;
      return;
    }
    onRoll(e.shiftKey);
  };

  return (
    <button
      type="button"
      className={className}
      title={title ? `${title} (hold or Shift-click to roll without the dialog)` : undefined}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={click}
    >
      {children}
    </button>
  );
}
