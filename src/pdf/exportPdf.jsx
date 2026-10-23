// =============================================================================
// exportPdf: gera e baixa o PDF da ficha
// =============================================================================
// O QUE FAZ
//   Junta o documento e o @react-pdf/renderer e dispara o download. Separado do
//   componente por causa do react-refresh (um arquivo de componentes não exporta
//   funções). Os dois caem no mesmo chunk dinâmico, fora do bundle principal.
//
// FUNÇÕES
//   safeName(character): o nome de arquivo.
//   exportCharacterPdf(character, derived, db, options): registra as fontes, gera
//     a ficha com as opções do jogador (DDL-0105) e baixa.
// -----------------------------------------------------------------------------

import { pdf } from '@react-pdf/renderer';
import CharacterSheet from './CharacterSheetDoc';
import { buildSheetModel } from './sheetModel';
import { registerPdfFonts } from './fonts';

/** Um nome de arquivo seguro. */
const safeName = (character) => (character.meta?.name || 'character').replace(/[^\w.-]+/g, '_');

/**
 * Gera o PDF da ficha preenchida e baixa.
 * @param {object} character
 * @param {object} derived
 * @param {object} db
 * @param {object} [options] as opções do pdfOptions
 */
export async function exportCharacterPdf(character, derived, db, options) {
  registerPdfFonts();
  const model = buildSheetModel(character, derived, db, options);
  const blob = await pdf(<CharacterSheet model={model} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName(character)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
