// =============================================================================
// media: as URLs de imagem do 5etools
// =============================================================================
// FUNÇÕES
//   imgUrl(href): a URL a partir do href do fluff.
// -----------------------------------------------------------------------------

const IMG_BASE = 'https://5e.tools/img/';

/** A URL de uma imagem a partir do href do fluff. */
export function imgUrl(href) {
  if (!href) return null;
  if (href.type === 'external') return href.url;
  if (href.path) return IMG_BASE + href.path;
  return null;
}
