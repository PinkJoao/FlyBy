// =============================================================================
// rollDialog: abre o diálogo de rolagem do play mode
// =============================================================================
// O QUE FAZ
//   O atalho que a tela do play mode chama antes de rolar: o RollPanel dentro
//   de um diálogo do app. Resolve com as opções escolhidas ({ mode, bonus,
//   manual, critical, versatile }) ou null se o jogador cancelou. Arquivo à
//   parte por causa do react-refresh (um arquivo de componentes não exporta
//   funções).
//
// FUNÇÕES
//   askRoll(props): abre o diálogo; `title` vai no cabeçalho, o resto no RollPanel.
// -----------------------------------------------------------------------------

import useDialogStore from '../../store/dialogStore';
import RollPanel from './RollPanel';

/**
 * Abre o diálogo de rolagem.
 * @returns {Promise<{ mode: string, bonus: string, manual: number[], critical: boolean, versatile: boolean }|null>}
 */
export function askRoll({ title, ...props }) {
  return useDialogStore.getState().open({
    variant: 'menu',
    title,
    message: <RollPanel {...props} />,
    dismissable: true,
    showClose: true,
    dismissValue: null,
    maxWidth: 440,
  });
}
