// =============================================================================
// imageSourceDialog: abre o escolhedor de imagem num diálogo
// =============================================================================
// O QUE FAZ
//   O atalho que o retrato (CharacterIdentity) e a imagem de item (InventoryTab)
//   chamam: o ImageSourcePanel dentro de um menu() do DialogHost, com o título de
//   quem chamou. Arquivo à parte por causa do react-refresh (um arquivo de
//   componentes não exporta funções), no molde do pdfExportDialog.
//
// FUNÇÕES
//   showImageSource({ title, ...panel }): abre o diálogo com o painel.
//
// DECISÕES E ARMADILHAS
//   - Nome em minúscula (imageSourceDialog.jsx) ao lado de ImageSourcePanel.jsx, e
//     nunca ImageSourceDialog.jsx: no Windows os dois nomes seriam o mesmo arquivo
//     (DDL-0007, §7 do manual).
// -----------------------------------------------------------------------------

import { menu } from './dialog';
import ImageSourcePanel from './ImageSourcePanel';

/**
 * Abre o escolhedor de imagem num diálogo.
 * @param {{ title: string } & Record<string, any>} opts as props do ImageSourcePanel e o título
 */
export function showImageSource({ title, ...panel }) {
  return menu({
    title,
    maxWidth: 440,
    content: <ImageSourcePanel {...panel} />,
  });
}
