// =============================================================================
// fonts: o registro das fontes da ficha PDF no @react-pdf
// =============================================================================
// O QUE FAZ
//   Registra o Cinzel e o Alegreya estáticos de src/pdf/fonts/ (gerados por
//   `npm run gen:pdf-fonts`, DDL-0105). No browser os arquivos são assets do
//   Vite, baixados só quando a ficha é gerada; fora dele (o preview e os testes)
//   quem chama passa `resolve`, que converte a URL do Vite num caminho do disco.
//
// FUNÇÕES
//   fontUrl(file): a URL do Vite de um arquivo de fonte.
//   registerPdfFonts(resolve): registra as famílias uma vez.
//
// DECISÕES E ARMADILHAS
//   - A hifenização automática está DESLIGADA: em nome de magia, de item e em
//     célula de tabela ela parte palavras de um jeito que o livro nunca faz.
//   - O registro é idempotente: gerar a segunda ficha não registra de novo.
// -----------------------------------------------------------------------------

import { Font } from '@react-pdf/renderer';
import { FONTS } from './theme';

const FILES = import.meta.glob('./fonts/*.ttf', { eager: true, query: '?url', import: 'default' });

/** A URL do Vite de um arquivo de fonte. */
const fontUrl = (file) => FILES[`./fonts/${file}`];

let registered = false;

/**
 * Registra as fontes da ficha, uma vez.
 * @param {(url: string) => string} [resolve] converte a URL num caminho (fora do browser)
 */
export function registerPdfFonts(resolve = (u) => u) {
  if (registered) return;
  registered = true;
  const src = (file) => resolve(fontUrl(file));
  Font.register({
    family: FONTS.title,
    fonts: [
      { src: src('Cinzel-Regular.ttf'), fontWeight: 400 },
      { src: src('Cinzel-Bold.ttf'), fontWeight: 700 },
    ],
  });
  Font.register({
    family: FONTS.body,
    fonts: [
      { src: src('Alegreya-Regular.ttf'), fontWeight: 400 },
      { src: src('Alegreya-Bold.ttf'), fontWeight: 700 },
      { src: src('Alegreya-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
      { src: src('Alegreya-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
}
