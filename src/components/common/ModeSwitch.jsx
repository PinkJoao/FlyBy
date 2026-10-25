// =============================================================================
// ModeSwitch: o seletor Sheet | Play no topo da página do personagem
// =============================================================================
// O QUE FAZ
//   Os dois modos da mesma página (DDL-0117): a ficha (montar o personagem) e o
//   jogo (jogar com ele). Delega para SegmentedControl na escala grande (`size="lg"`
//   e `equal`) e chama onChange com 'sheet' ou 'play'.
//
// FUNÇÕES
//   ModeSwitch(props): o seletor.
//
// DECISÕES E ARMADILHAS
//   - MODES dá a ordem e o rótulo; a ordem é também a direção da animação da troca
//     (a ficha à esquerda, o jogo à direita).
//   - É um grupo de botões com aria-pressed, não abas: o conteúdo inteiro da página
//     troca, e as abas de verdade ficam embaixo.
// -----------------------------------------------------------------------------

import SegmentedControl from './SegmentedControl';

const MODES = [
  { value: 'sheet', label: 'Sheet' },
  { value: 'play', label: 'Play' },
];

/**
 * O seletor de modo.
 * @param {{ mode: 'sheet'|'play', onChange: (mode: string) => void }} props
 */
export default function ModeSwitch({ mode, onChange }) {
  return (
    <SegmentedControl
      value={mode}
      options={MODES}
      onChange={onChange}
      size="lg"
      equal
      ariaLabel="Mode"
    />
  );
}
