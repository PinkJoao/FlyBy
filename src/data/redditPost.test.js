// =============================================================================
// redditPost.test: testes da resolução do link do Reddit pelo Arctic Shift
// =============================================================================
// O QUE FAZ
//   Cobre resolveRedditPost e resolvePortraitUrl com um fetch falso: post bom,
//   autor apagado, resposta ruim, erro de rede e texto que não é link do Reddit.
//
// FUNÇÕES
//   fakeFetch(body, ok): um fetch que devolve `body` como JSON.
//
// DECISÕES E ARMADILHAS
//   - Nenhum teste toca a rede: o fetch é sempre injetado.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { resolvePortraitUrl, resolveRedditPost } from './redditPost';

const fakeFetch = (body, ok = true) => async () => ({ ok, json: async () => body });
const LINK = 'https://www.reddit.com/r/DnDart/comments/1xkc3tb/oc_human/';

describe('resolveRedditPost', () => {
  it('devolve a imagem, o autor e o id', async () => {
    const r = await resolveRedditPost(LINK, {
      fetchImpl: fakeFetch({ data: [{ author: 'error404artista', url: 'https://i.redd.it/r2q8qwjjftyh1.jpeg' }] }),
    });
    expect(r).toEqual({ image: 'https://i.redd.it/r2q8qwjjftyh1.jpeg', author: 'error404artista', post: '1xkc3tb' });
  });
  it('autor apagado vira null', async () => {
    const r = await resolveRedditPost(LINK, {
      fetchImpl: fakeFetch({ data: [{ author: '[deleted]', url: 'https://i.redd.it/a.png' }] }),
    });
    expect(r.author).toBeNull();
  });
  it('falhas não estouram', async () => {
    expect(await resolveRedditPost(LINK, { fetchImpl: fakeFetch({}, false) })).toBeNull();
    expect(await resolveRedditPost(LINK, { fetchImpl: async () => { throw new Error('offline'); } })).toBeNull();
    expect(await resolveRedditPost('https://example.com/a.png', { fetchImpl: fakeFetch({}) })).toBeNull();
  });
});

describe('resolvePortraitUrl', () => {
  it('link do Reddit vira imagem com crédito', async () => {
    const r = await resolvePortraitUrl(LINK, {
      fetchImpl: fakeFetch({ data: [{ author: 'artist', url: 'https://i.redd.it/x.png' }] }),
    });
    expect(r).toEqual({ url: 'https://i.redd.it/x.png', credit: { by: 'u/artist', link: 'https://redd.it/1xkc3tb' } });
  });
  it('outra URL passa como está', async () => {
    expect(await resolvePortraitUrl('https://example.com/a.png', { fetchImpl: fakeFetch({}) })).toEqual({
      url: 'https://example.com/a.png',
      credit: null,
    });
  });
});
