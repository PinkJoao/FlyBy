// =============================================================================
// dialogContext: o "fechar" do diálogo para o conteúdo dentro dele
// =============================================================================
// O QUE FAZ
//   O DialogHost envolve cada card num provider com a função que o resolve; um
//   conteúdo React passado como `message` (o MenuList de um submenu) fecha o
//   próprio diálogo por useDialogClose, sem conhecer o id dele.
//
// FUNÇÕES
//   useDialogClose(): a função que fecha o diálogo atual (resolve com o valor
//     dado); fora de um diálogo, não faz nada.
// -----------------------------------------------------------------------------

import { createContext, useContext } from 'react';

export const DialogCloseContext = createContext(null);

/** A função que fecha o diálogo atual; fora de um diálogo, não faz nada. */
export function useDialogClose() {
  return useContext(DialogCloseContext) ?? (() => {});
}
