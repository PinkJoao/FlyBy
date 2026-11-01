// =============================================================================
// portraitCatalog.test: a cascata do catálogo de retratos nunca quebra
// =============================================================================
// O QUE FAZ
//   Cobre loadPortraitCatalog com fetch e cache falsos, nos casos do §4.4 do estudo
//   de fontes (DDL-0137): host principal bom, principal fora (espelho), os dois fora
//   (cache), nada guardado (índice antigo ou só a fatia licenciada), manifesto
//   inválido, fatia com sha256 errado, fonte desligada; e fill, validManifest e
//   mergeParts.
//
// FUNÇÕES
//   release(opts): um manifesto v3 e as fatias dele, com sha256 de verdade.
//   fakeFetch(routes): um fetch que responde pelas rotas dadas e 404 no resto.
//   memoryCache(initial): um cache em memória com o que foi gravado.
//
// DECISÕES E ARMADILHAS
//   - A fatia licenciada de teste é pequena e explícita (não o JSON embutido), para
//     os números não mudarem quando o gerador do Wesnoth rodar de novo.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { fill, loadPortraitCatalog, mergeParts, sha256Hex, validManifest } from './portraitCatalog';

const LICENSED = {
  source: 'wesnoth',
  credit: { by: 'Battle for Wesnoth (GPL)', link: 'https://github.com/wesnoth/blob' },
  tags: ['elf', 'ranger'],
  items: [['elves-ranger.webp', [0, 1], 6, 'elves/ranger.webp']],
};

async function release({ redditEnabled = true, mirrors = [] } = {}) {
  const redditShard = JSON.stringify({ source: 'reddit', items: [['x1.jpeg', [0, 1], 5, 'artist', 'p1']] });
  const pinShard = JSON.stringify({ source: 'pinterest', items: [['ab12cd' + 'e'.repeat(26), [0], 1]] });
  const manifest = {
    format: 3,
    version: '2026-10-31.1',
    count: 2,
    mirrors,
    tags: ['tiefling', 'warlock'],
    sources: {
      reddit: {
        enabled: redditEnabled,
        image: { thumb: 'https://wsrv.nl/?url=i.redd.it/{id}&w=300', full: 'https://i.redd.it/{id}', cors: true },
        credit: { by: 'u/{author}', link: 'https://redd.it/{post}' },
        shards: [{ file: 'reddit-1.json', sha256: await sha256Hex(redditShard) }],
      },
      pinterest: {
        enabled: true,
        image: { thumb: 'https://img.example/236x/{a}/{b}/{c}/{id}.jpg', full: 'https://img.example/736x/{a}/{b}/{c}/{id}.jpg', cors: false },
        credit: null,
        shards: [{ file: 'pinterest-1.json', sha256: await sha256Hex(pinShard) }],
      },
    },
  };
  return { manifest, redditShard, pinShard };
}

const fakeFetch = (routes) => async (url) => {
  const body = routes[url];
  if (body === undefined) return { ok: false, text: async () => '' };
  return { ok: true, text: async () => body };
};

function memoryCache(initial = null) {
  const store = { value: initial, writes: 0 };
  return {
    store,
    read: async () => store.value,
    write: async (v) => {
      store.value = v;
      store.writes++;
    },
  };
}


describe('peças', () => {
  it('fill troca as variáveis e os pedaços do id', () => {
    expect(fill('https://h/{a}/{b}/{c}/{id}.jpg', { id: 'abcdef12' })).toBe('https://h/ab/cd/ef/abcdef12.jpg');
    expect(fill('u/{author}', { author: 'some one' })).toBe('u/some%20one');
    expect(fill('{src}', { src: 'https://w/a.jpg?token=x&y=1' })).toBe('https://w/a.jpg?token=x&y=1');
  });
  it('validManifest recusa o que não é v3', () => {
    expect(validManifest({ format: 2, tags: [], sources: {} })).toBe(false);
    expect(validManifest(null)).toBe(false);
  });
  it('mergeParts une os dicionários', () => {
    const merged = mergeParts([
      { source: 'a', items: [{ id: '1', tags: ['elf'], bucket: 2, thumb: 't', url: 'u', credit: null }] },
      { source: 'b', items: [{ id: '1', tags: ['dwarf', 'elf'], bucket: 1, thumb: 't', url: 'u', credit: null }] },
    ]);
    expect(merged.tags).toEqual(['elf', 'dwarf']);
    expect(merged.items.map((i) => [i.key, i.idxs])).toEqual([
      ['a:1', [0]],
      ['b:1', [1, 0]],
    ]);
  });
});

describe('loadPortraitCatalog', () => {
  it('host principal bom: fontes da release + licenciada, crédito montado, cache gravado', async () => {
    const { manifest, redditShard, pinShard } = await release();
    const cache = memoryCache();
    const cat = await loadPortraitCatalog({
      urls: ['https://main.example/portraits-manifest.json'],
      fetchImpl: fakeFetch({
        'https://main.example/portraits-manifest.json': JSON.stringify(manifest),
        'https://main.example/reddit-1.json': redditShard,
        'https://main.example/pinterest-1.json': pinShard,
      }),
      cache,
      licensed: LICENSED,
    });
    expect(cat.sources).toEqual(['wesnoth', 'reddit', 'pinterest']);
    const reddit = cat.items.find((i) => i.key === 'reddit:x1.jpeg');
    expect(reddit).toMatchObject({ url: 'https://i.redd.it/x1.jpeg', bucket: 5, credit: { by: 'u/artist', link: 'https://redd.it/p1' } });
    expect(cat.items.find((i) => i.source === 'pinterest').thumb).toBe('https://img.example/236x/ab/12/cd/ab12cd' + 'e'.repeat(26) + '.jpg');
    expect(cat.items.find((i) => i.source === 'wesnoth')).toMatchObject({ url: '/portraits-licensed/elves-ranger.webp', bucket: 6 });
    expect(cache.store.writes).toBe(1);
  });

  it('principal fora: usa o espelho do manifesto do segundo endereço', async () => {
    const { manifest, redditShard, pinShard } = await release();
    const cat = await loadPortraitCatalog({
      urls: ['https://main.example/portraits-manifest.json', 'https://mirror.example/portraits-manifest.json'],
      fetchImpl: fakeFetch({
        'https://mirror.example/portraits-manifest.json': JSON.stringify(manifest),
        'https://mirror.example/reddit-1.json': redditShard,
        'https://mirror.example/pinterest-1.json': pinShard,
      }),
      cache: memoryCache(),
      licensed: LICENSED,
    });
    expect(cat.items).toHaveLength(3);
  });

  it('fatia que falha na base do manifesto vem do espelho listado nele', async () => {
    const { manifest, redditShard, pinShard } = await release({ mirrors: ['https://mirror.example'] });
    const cat = await loadPortraitCatalog({
      urls: ['https://main.example/portraits-manifest.json'],
      fetchImpl: fakeFetch({
        'https://main.example/portraits-manifest.json': JSON.stringify(manifest),
        'https://main.example/pinterest-1.json': pinShard,
        'https://mirror.example/reddit-1.json': redditShard,
      }),
      cache: memoryCache(),
      licensed: LICENSED,
    });
    expect(cat.sources).toContain('reddit');
  });

  it('os dois hosts fora: usa a release guardada', async () => {
    const { manifest, redditShard, pinShard } = await release();
    const cached = { manifest, shards: { 'reddit-1.json': redditShard, 'pinterest-1.json': pinShard } };
    const cat = await loadPortraitCatalog({
      urls: ['https://main.example/portraits-manifest.json'],
      fetchImpl: async () => {
        throw new Error('offline');
      },
      cache: memoryCache(cached),
      licensed: LICENSED,
    });
    expect(cat.sources).toEqual(['wesnoth', 'reddit', 'pinterest']);
  });

  it('nada guardado e sem índice antigo: só a fatia licenciada', async () => {
    const cat = await loadPortraitCatalog({
      urls: ['https://main.example/portraits-manifest.json'],
      fetchImpl: fakeFetch({}),
      cache: memoryCache(),
      licensed: LICENSED,
    });
    expect(cat.sources).toEqual(['wesnoth']);
    expect(cat.items).toHaveLength(1);
  });

  it('sem endereço configurado e sem cache: só a fatia licenciada', async () => {
    const cat = await loadPortraitCatalog({
      urls: [],
      cache: memoryCache(),
      licensed: LICENSED,
    });
    expect(cat.sources).toEqual(['wesnoth']);
  });

  it('manifesto inválido e cache quebrado não estouram', async () => {
    const cat = await loadPortraitCatalog({
      urls: ['https://main.example/portraits-manifest.json'],
      fetchImpl: fakeFetch({ 'https://main.example/portraits-manifest.json': '{"format":2}' }),
      cache: { read: async () => ({ manifest: { format: 1 } }), write: async () => {} },
      licensed: LICENSED,
    });
    expect(cat.sources).toEqual(['wesnoth']);
  });

  it('fatia com sha256 errado fica fora; a outra entra', async () => {
    const { manifest, pinShard } = await release();
    const cat = await loadPortraitCatalog({
      urls: ['https://main.example/portraits-manifest.json'],
      fetchImpl: fakeFetch({
        'https://main.example/portraits-manifest.json': JSON.stringify(manifest),
        'https://main.example/reddit-1.json': '{"items":[["evil.png",[0],7,"x","y"]]}',
        'https://main.example/pinterest-1.json': pinShard,
      }),
      cache: memoryCache(),
      licensed: LICENSED,
    });
    expect(cat.sources).toEqual(['wesnoth', 'pinterest']);
  });

  it('o interruptor remoto tira a fonte', async () => {
    const { manifest, pinShard } = await release({ redditEnabled: false });
    const cat = await loadPortraitCatalog({
      urls: ['https://main.example/portraits-manifest.json'],
      fetchImpl: fakeFetch({
        'https://main.example/portraits-manifest.json': JSON.stringify(manifest),
        'https://main.example/pinterest-1.json': pinShard,
      }),
      cache: memoryCache(),
      licensed: LICENSED,
    });
    expect(cat.sources).toEqual(['wesnoth', 'pinterest']);
  });
});
