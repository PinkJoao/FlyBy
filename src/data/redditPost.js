// =============================================================================
// redditPost: acha a imagem e o autor de um post do Reddit pelo Arctic Shift
// =============================================================================
// O QUE FAZ
//   Quando o jogador cola o link de um post do Reddit no campo de URL do retrato,
//   pergunta ao Arctic Shift (arquivo público do Reddit, com CORS e sem chave) pela
//   imagem e pelo autor, para o retrato entrar com o crédito (DDL-0137, fase 0).
//
// FUNÇÕES
//   resolveRedditPost(text, opts): { image, author, post } do link, ou null.
//   resolvePortraitUrl(text): { url, credit } do que foi colado (link do Reddit
//     vira a imagem com crédito; o resto passa como está).
//
// DECISÕES E ARMADILHAS
//   - Tempo-limite de 6 s e nenhum erro para fora: sem resposta, o link passa como
//     URL comum e o jogador vê que não carregou (o Reddit não serve imagem pelo
//     link do post), como acontecia antes.
//   - A consulta por id é a rápida do Arctic Shift (~1 s, medida em 2026-10-26); a
//     busca por texto dele é lenta e falha muito, e não é usada no app.
// -----------------------------------------------------------------------------

import { redditImageOf, redditPostId } from '../engine/portraitSearch';

const API = 'https://arctic-shift.photon-reddit.com/api/posts/ids';

/**
 * A imagem e o autor de um post do Reddit.
 * @param {string} text o link colado
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 * @returns {Promise<{ image: string, author: string|null, post: string }|null>}
 */
export async function resolveRedditPost(text, { fetchImpl = fetch, timeoutMs = 6000 } = {}) {
  const id = redditPostId(text);
  if (!id) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${API}?ids=${id}`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const post = (await res.json())?.data?.[0];
    const image = redditImageOf(post);
    if (!image) return null;
    const author = post.author && post.author !== '[deleted]' ? post.author : null;
    return { image, author, post: id };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * O que gravar a partir do texto colado no campo de URL do retrato.
 * @param {string} text
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<{ url: string, credit: { by: string|null, link: string }|null }>}
 */
export async function resolvePortraitUrl(text, opts) {
  const found = await resolveRedditPost(text, opts);
  if (!found) return { url: text, credit: null };
  return {
    url: found.image,
    credit: { by: found.author ? `u/${found.author}` : null, link: `https://redd.it/${found.post}` },
  };
}
