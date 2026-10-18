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
//   exportCharacterPdf(character, derived, db): o PDF preenchido (uma ficha por
//     classe).
// -----------------------------------------------------------------------------

import { pdf } from '@react-pdf/renderer';
import CharacterSheet from './CharacterSheetDoc';
import { buildSheetModel } from './sheetModel';

/** Um nome de arquivo seguro. */
const safeName = (character) => (character.meta?.name || 'character').replace(/[^\w.-]+/g, '_');

/**
 * Gera o PDF da ficha preenchida e baixa.
 * @param {object} character
 * @param {object} derived
 * @param {object} db
 */
export async function exportCharacterPdf(character, derived, db) {
  const model = buildSheetModel(character, derived, db);
  const blob = await pdf(<CharacterSheet model={model} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName(character)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
