// =============================================================================
// media - URLs de imagem do 5etools
// =============================================================================

const IMG_BASE = 'https://5e.tools/img/';

/** Monta a URL de uma imagem a partir do href do fluff (5etools). */
export function imgUrl(href) {
  if (!href) return null;
  if (href.type === 'external') return href.url;
  if (href.path) return IMG_BASE + href.path;
  return null;
}
