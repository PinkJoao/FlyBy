// =============================================================================
// portraitChoice: o que gravar na ficha quando o jogador escolhe um retrato
// =============================================================================
// O QUE FAZ
//   Converte o que o jogador escolheu (texto colado no campo de URL, sugestão do
//   catálogo) nos dois campos da ficha: `meta.portrait` (a imagem) e
//   `meta.portraitCredit` (`{ by, link }` do artista, ou null). Usado pela página
//   do personagem (CharacterIdentity) e pelo passo do guia (NamePortraitStep).
//
// FUNÇÕES
//   portraitFromText(text): { portrait, portraitCredit } do texto colado; link de
//     post do Reddit vira a imagem com o autor (resolvePortraitUrl).
//   portraitFromSuggestion(item): { portrait, portraitCredit } de uma sugestão; a
//     imagem é COPIADA para a ficha quando dá para ler os bytes.
//   portraitViewerImage(meta): a imagem do visualizador com o crédito ("Art: ...").
//
// DECISÕES E ARMADILHAS
//   - Upload e imagem colada não têm autor conhecido: quem grava esses zera o
//     crédito, senão o crédito do retrato anterior ficaria no novo.
//   - A cópia da sugestão (D3 do plano do catálogo) protege a ficha: se a fonte
//     apagar a imagem, o retrato continua. Se a leitura falhar (sem CORS e sem o
//     cache wsrv.nl), grava o endereço, como antes.
// -----------------------------------------------------------------------------

import { fetchImageBlob } from '../../data/imageProxy';
import { resolvePortraitUrl } from '../../data/redditPost';
import { fileToPortrait } from './imageFile';

/**
 * Os campos do retrato a partir do texto colado no campo de URL.
 * @param {string} text
 * @returns {Promise<{ portrait: string, portraitCredit: { by: string|null, link: string }|null }>}
 */
export async function portraitFromText(text) {
  const { url, credit } = await resolvePortraitUrl(text);
  return { portrait: url, portraitCredit: credit };
}

/**
 * Os campos do retrato a partir de uma sugestão do catálogo.
 * @param {{ url: string, credit?: { by: string|null, link: string|null }|null }} item
 */
export async function portraitFromSuggestion(item) {
  const portraitCredit = item.credit && (item.credit.by || item.credit.link) ? item.credit : null;
  try {
    const blob = await fetchImageBlob(item.url);
    const portrait = await fileToPortrait(new File([blob], 'portrait', { type: blob.type || 'image/jpeg' }));
    return { portrait, portraitCredit };
  } catch {
    return { portrait: item.url, portraitCredit };
  }
}

/**
 * A imagem do retrato para o visualizador em tela cheia, com o crédito.
 * @param {object} meta
 */
export function portraitViewerImage(meta) {
  const c = meta?.portraitCredit;
  return { src: meta?.portrait, alt: 'Portrait', credit: c?.by ?? undefined };
}
