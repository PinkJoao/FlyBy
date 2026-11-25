// =============================================================================
// portraitSearch: a busca guiada de retratos e o link do Reddit colado
// =============================================================================
// O QUE FAZ
//   Monta, a partir das tags da ficha, a busca que o jogador abre num site de arte
//   ("Search more on" embaixo das sugestões) e reconhece um link de post do Reddit
//   colado no campo de URL, para o app achar a imagem e o autor (DDL-0137, fase 0).
//
// FUNÇÕES
//   portraitSearchTerms(tags): espécie, classe e gênero em palavras, na ordem.
//   words(...parts): junta as partes não vazias em minúsculas.
//   PORTRAIT_SEARCH_SITES: os sites da busca guiada, cada um com `urlFor(tags)`.
//   redditPostId(text): o id de um link de post do Reddit, ou null.
//   redditImageOf(post): a imagem (i.redd.it) de um post do Arctic Shift, ou null.
//
// DECISÕES E ARMADILHAS
//   - O Reddit busca nos quatro subreddits de arte que proíbem IA (os mesmos do
//     catálogo); só espécie e classe, porque o título raramente diz mais.
//   - Uma linhagem vale como espécie ("Fire Genasi"), a subclasse só sem a classe.
//   - Post de galeria aponta para reddit.com/gallery: a imagem é a primeira de
//     `gallery_data`, montada como i.redd.it/<id>.<ext> pelo tipo em
//     `media_metadata`. Post +18 não devolve imagem.
// -----------------------------------------------------------------------------

import { tagCategoryOf, tagLabelOf } from './portraitSuggestions';

const ART_SUBREDDITS = 'DnDart+DnD+ImaginaryCharacters+characterdrawing';

/**
 * As palavras da busca: gênero, espécie e classe, quando a ficha as tem.
 * @param {string[]} tags
 * @returns {{ gender: string|null, species: string|null, cls: string|null }}
 */
export function portraitSearchTerms(tags = []) {
  const of = (cats) => tags.find((t) => cats.includes(tagCategoryOf(t))) ?? null;
  const genders = tags.filter((t) => tagCategoryOf(t) === 'gender');
  const species = of(['lineage']) ?? of(['species']);
  const cls = of(['class']) ?? of(['subclass']);
  return {
    gender: genders.length === 1 ? genders[0] : null,
    species: species ? tagLabelOf(species) : null,
    cls: cls ? tagLabelOf(cls) : null,
  };
}

const words = (...parts) => parts.filter(Boolean).join(' ').toLowerCase();
const enc = encodeURIComponent;

export const PORTRAIT_SEARCH_SITES = [
  {
    id: 'reddit',
    label: 'Reddit',
    urlFor(tags) {
      const { species, cls } = portraitSearchTerms(tags);
      const q = words(species, cls) || 'character portrait';
      return `https://www.reddit.com/r/${ART_SUBREDDITS}/search/?q=${enc(q)}&restrict_sr=1&sort=top&t=all`;
    },
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    urlFor(tags) {
      const { gender, species, cls } = portraitSearchTerms(tags);
      return `https://www.pinterest.com/search/pins/?q=${enc(words(gender, species, cls, 'dnd character art'))}`;
    },
  },
  {
    id: 'deviantart',
    label: 'DeviantArt',
    urlFor(tags) {
      const { gender, species, cls } = portraitSearchTerms(tags);
      return `https://www.deviantart.com/search?q=${enc(words(gender, species, cls, 'dnd character'))}`;
    },
  },
  {
    id: 'artstation',
    label: 'ArtStation',
    urlFor(tags) {
      const { gender, species, cls } = portraitSearchTerms(tags);
      return `https://www.artstation.com/search?sort_by=relevance&query=${enc(words(gender, species, cls, 'dnd'))}`;
    },
  },
];

/**
 * O id de um post do Reddit num link colado (reddit.com/.../comments/<id>, redd.it/<id>).
 * @param {string} text
 * @returns {string|null}
 */
export function redditPostId(text) {
  let url;
  try {
    url = new URL(String(text ?? '').trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|old|new|np|m)\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  if (host === 'redd.it' && /^[a-z0-9]{4,10}$/i.test(parts[0] ?? '')) return parts[0].toLowerCase();
  if (host !== 'reddit.com') return null;
  const at = parts.indexOf('comments');
  if (at >= 0 && /^[a-z0-9]{4,10}$/i.test(parts[at + 1] ?? '')) return parts[at + 1].toLowerCase();
  if (parts[0] === 'gallery' && /^[a-z0-9]{4,10}$/i.test(parts[1] ?? '')) return parts[1].toLowerCase();
  return null;
}

/**
 * A imagem de um post (como o Arctic Shift o devolve), ou null.
 * @param {object} post
 * @returns {string|null}
 */
export function redditImageOf(post) {
  if (!post || post.over_18) return null;
  const url = String(post.url_overridden_by_dest ?? post.url ?? '');
  if (/^https:\/\/i\.redd\.it\/[\w-]+\.(jpe?g|png|webp)$/i.test(url)) return url;
  if (!post.is_gallery) return null;
  const first = post.gallery_data?.items?.[0]?.media_id ?? Object.keys(post.media_metadata ?? {})[0];
  const meta = post.media_metadata?.[first];
  const ext = { 'image/jpg': 'jpg', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[meta?.m];
  return meta?.e === 'Image' && ext ? `https://i.redd.it/${first}.${ext}` : null;
}
