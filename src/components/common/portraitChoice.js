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
//   suggestionNow(item): { portrait, portraitCredit } de uma sugestão, NA HORA: o
//     endereço da imagem e o crédito.
//   suggestionCopy(item): a cópia da imagem para a ficha (data URL), ou null quando não
//     dá para ler os bytes.
//   applySuggestion(item, id, apply): grava a sugestão na hora e troca pela cópia
//     quando ela chega, só se o retrato do personagem `id` ainda for aquele endereço.
//   portraitViewerImage(meta): a imagem do visualizador com o crédito ("Art: ...").
//
// DECISÕES E ARMADILHAS
//   - Upload e imagem colada não têm autor conhecido: quem grava esses zera o
//     crédito, senão o crédito do retrato anterior ficaria no novo.
//   - A cópia da sugestão (D3 do plano do catálogo) protege a ficha: se a fonte
//     apagar a imagem, o retrato continua. Se a leitura falhar (sem CORS e sem o
//     cache wsrv.nl), fica o endereço, como antes.
//   - A cópia vem DEPOIS (DDL-0314): baixar a imagem inteira (direto, ou pelo wsrv.nl
//     quando o host não manda CORS) e reduzi-la levava um ou dois segundos, e a galeria
//     ficava aberta sem resposta. Agora o retrato entra na hora pelo endereço (a mesma
//     imagem que a sugestão mostrava) e a cópia substitui em silêncio. A troca lê o
//     personagem MAIS NOVO do store e desiste se o retrato já mudou.
// -----------------------------------------------------------------------------

import { fetchImageBlob } from '../../data/imageProxy';
import { resolvePortraitUrl } from '../../data/redditPost';
import { fileToPortrait } from './imageFile';
import useCharacterStore from '../../store/characterStore';

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
export function suggestionNow(item) {
  const portraitCredit = item.credit && (item.credit.by || item.credit.link) ? item.credit : null;
  return { portrait: item.url, portraitCredit };
}

/**
 * A cópia da imagem sugerida para a ficha, ou null.
 * @param {{ url: string }} item
 */
export async function suggestionCopy(item) {
  try {
    const blob = await fetchImageBlob(item.url);
    return await fileToPortrait(new File([blob], 'portrait', { type: blob.type || 'image/jpeg' }));
  } catch {
    return null;
  }
}

/**
 * Grava a sugestão na hora e a cópia quando chegar, se o retrato ainda for o mesmo.
 * @param {object} item a sugestão
 * @param {string} id o personagem
 * @param {(character: object, fields: object) => void} apply grava os campos no personagem dado
 * @param {object} current o personagem como está agora
 */
export function applySuggestion(item, id, apply, current) {
  apply(current, suggestionNow(item));
  suggestionCopy(item).then((copy) => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === id);
    if (copy && latest?.meta?.portrait === item.url) apply(latest, { portrait: copy });
  });
}

/**
 * A imagem do retrato para o visualizador em tela cheia, com o crédito.
 * @param {object} meta
 */
export function portraitViewerImage(meta) {
  const c = meta?.portraitCredit;
  return { src: meta?.portrait, alt: 'Portrait', credit: c?.by ?? undefined };
}
