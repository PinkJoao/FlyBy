// =============================================================================
// RollButton: o botão que rola, com o atalho de pular o diálogo no desktop
// =============================================================================
// O QUE FAZ
//   Um toque abre o diálogo de rolagem; no desktop, o clique com Shift rola direto,
//   sem perguntar, como o Shift do Foundry (docs/PLAY-MODE-PLAN.md 3.5). Chama
//   onRoll(quick), com quick verdadeiro no atalho.
//
// FUNÇÕES
//   RollButton(props): o botão.
//
// DECISÕES E ARMADILHAS
//   - Sem TOQUE LONGO (DDL-0114): no navegador do celular ele disputava com a
//     seleção de texto e o menu do sistema e não funcionava de forma confiável. O
//     substituto para rolar direto no celular ainda será decidido.
// -----------------------------------------------------------------------------

/**
 * O botão de rolar.
 * @param {{ onRoll: (quick: boolean) => void, className?: string, title?: string, children: any, disabled?: boolean }} props
 */
export default function RollButton({ onRoll, className, title, children, disabled = false }) {
  return (
    <button
      type="button"
      className={className}
      title={title ? `${title} (Shift-click to roll without the dialog)` : undefined}
      disabled={disabled}
      onClick={(e) => onRoll(e.shiftKey)}
    >
      {children}
    </button>
  );
}
