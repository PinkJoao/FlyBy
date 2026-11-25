// =============================================================================
// portraitSearch.test: testes da busca guiada e do link do Reddit
// =============================================================================
// O QUE FAZ
//   Cobre portraitSearchTerms, as URLs de PORTRAIT_SEARCH_SITES, redditPostId e
//   redditImageOf (post simples, galeria, +18, sem imagem).
//
// FUNÇÕES
//   (nenhuma: suíte Vitest).
//
// DECISÕES E ARMADILHAS
//   - Os posts são recortes do formato real do Arctic Shift (medido em 2026-10-31).
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { PORTRAIT_SEARCH_SITES, portraitSearchTerms, redditImageOf, redditPostId } from './portraitSearch';

describe('portraitSearchTerms', () => {
  it('pega gênero, espécie e classe', () => {
    expect(portraitSearchTerms(['female', 'tiefling', 'warlock', 'staff'])).toEqual({
      gender: 'female',
      species: 'Tiefling',
      cls: 'Warlock',
    });
  });
  it('prefere a linhagem e ignora gênero ambíguo', () => {
    const t = portraitSearchTerms(['male', 'female', 'genasi', 'fire-genasi']);
    expect(t.gender).toBeNull();
    expect(t.species).toBe('Fire Genasi');
    expect(t.cls).toBeNull();
  });
});

describe('PORTRAIT_SEARCH_SITES', () => {
  it('o Reddit busca nos subreddits de arte com espécie e classe', () => {
    const url = PORTRAIT_SEARCH_SITES.find((s) => s.id === 'reddit').urlFor(['tiefling', 'warlock']);
    expect(url).toContain('/r/DnDart+DnD+ImaginaryCharacters+characterdrawing/search/');
    expect(url).toContain('q=tiefling%20warlock');
  });
  it('sem tags ainda monta uma busca', () => {
    for (const site of PORTRAIT_SEARCH_SITES) expect(site.urlFor([])).toMatch(/^https:\/\//);
  });
});

describe('redditPostId', () => {
  it('reconhece os formatos de link', () => {
    expect(redditPostId('https://www.reddit.com/r/DnDart/comments/1xkc3tb/oc_human/')).toBe('1xkc3tb');
    expect(redditPostId('https://old.reddit.com/r/DnD/comments/abc123')).toBe('abc123');
    expect(redditPostId('https://redd.it/1xkc3tb')).toBe('1xkc3tb');
    expect(redditPostId('https://www.reddit.com/gallery/1xkcq11')).toBe('1xkcq11');
  });
  it('recusa o que não é post', () => {
    expect(redditPostId('https://i.redd.it/r2q8qwjjftyh1.jpeg')).toBeNull();
    expect(redditPostId('https://www.reddit.com/r/DnDart/')).toBeNull();
    expect(redditPostId('not a url')).toBeNull();
  });
});

describe('redditImageOf', () => {
  it('post de imagem', () => {
    expect(redditImageOf({ url: 'https://i.redd.it/r2q8qwjjftyh1.jpeg' })).toBe('https://i.redd.it/r2q8qwjjftyh1.jpeg');
  });
  it('galeria: a primeira imagem', () => {
    const post = {
      url: 'https://www.reddit.com/gallery/1xkcq11',
      is_gallery: true,
      gallery_data: { items: [{ media_id: 'qx6chkaqjtyh1' }] },
      media_metadata: { qx6chkaqjtyh1: { e: 'Image', m: 'image/png' } },
    };
    expect(redditImageOf(post)).toBe('https://i.redd.it/qx6chkaqjtyh1.png');
  });
  it('+18 e post sem imagem não devolvem nada', () => {
    expect(redditImageOf({ url: 'https://i.redd.it/x1.jpeg', over_18: true })).toBeNull();
    expect(redditImageOf({ url: 'https://www.reddit.com/r/x/comments/y' })).toBeNull();
    expect(redditImageOf(null)).toBeNull();
  });
});
