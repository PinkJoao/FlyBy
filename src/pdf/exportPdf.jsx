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
//   pdfPortrait(src): o retrato convertido para PNG pelo canvas, quando preciso.
//   exportCharacterPdf(character, derived, db, options): registra as fontes, gera
//     a ficha com as opções do jogador (DDL-0105) e baixa.
//
// DECISÕES E ARMADILHAS
//   - O @react-pdf só lê PNG e JPEG, e o retrato do app é WebP (o upload é
//     reduzido para WebP em imageFile.js) ou GIF: sem a conversão ele sumia da
//     ficha. A conversão é do navegador (canvas), por isso mora aqui e não no
//     sheetModel, que é puro. Retrato remoto que o navegador não deixa ler (CORS)
//     sai sem imagem, nunca derruba a ficha.
// -----------------------------------------------------------------------------

import { pdf } from '@react-pdf/renderer';
import CharacterSheet from './CharacterSheetDoc';
import { buildSheetModel } from './sheetModel';
import { registerPdfFonts } from './fonts';

/** Um nome de arquivo seguro. */
const safeName = (character) => (character.meta?.name || 'character').replace(/[^\w.-]+/g, '_');

const PORTRAIT_SIDE = 600;

/** O retrato num formato que o PDF lê (PNG ou JPEG), ou null. */
async function pdfPortrait(src) {
  if (!src) return null;
  if (/^data:image\/(png|jpe?g);/i.test(src)) return src;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    await img.decode();
    const scale = Math.min(1, PORTRAIT_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Gera o PDF da ficha preenchida e baixa.
 * @param {object} character
 * @param {object} derived
 * @param {object} db
 * @param {object} [options] as opções do pdfOptions
 */
export async function exportCharacterPdf(character, derived, db, options) {
  registerPdfFonts();
  const portrait = await pdfPortrait(character.meta?.portrait);
  const model = buildSheetModel({ ...character, meta: { ...character.meta, portrait } }, derived, db, options);
  const blob = await pdf(<CharacterSheet model={model} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName(character)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
