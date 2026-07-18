// =============================================================================
// exportPdf - gera e baixa o PDF da ficha (clean-room, Fase E)
// =============================================================================
// Importa o DOCUMENTO (`CharacterSheetDoc`) e o `@react-pdf/renderer` e faz o
// download. Mantido separado do componente por causa do react-refresh (um arquivo
// que exporta componentes não deve exportar também funções). Ambos caem no mesmo
// chunk dinâmico, então a dep pesada fica fora do bundle principal.
// -----------------------------------------------------------------------------

import { pdf } from '@react-pdf/renderer';
import CharacterSheet from './CharacterSheetDoc';
import { buildSheetModel } from './sheetModel';

/** Nome de arquivo seguro a partir do nome do personagem. */
const safeName = (character) => (character.meta?.name || 'character').replace(/[^\w.-]+/g, '_');

/**
 * Gera o PDF da ficha PREENCHIDA e dispara o download no navegador.
 * Multiclasse: o modelo traz uma ficha por classe, no mesmo arquivo.
 * @param {object} character  decisões do personagem
 * @param {object} derived    saída de `deriveFromDb(character, db)`
 * @param {object} db         compêndio (magias/inventário/features resolvidos)
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
