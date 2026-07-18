import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Manifest pequeno e controlado + helpers de API fixos, para testar a decisão do
// sync (o que baixa) sem depender dos ~65 arquivos reais.
vi.mock('./config', () => {
  const repo = { owner: 'o', repo: 'r', branch: 'main' };
  return {
    MIRRORS: ['https://raw.example/data/'],
    buildManifest: () => [
      { key: 'races', path: 'races.json' },
      { key: 'class-fighter', path: 'class/class-fighter.json' },
    ],
    manifestDirs: () => ['data', 'data/class'],
    githubRepoFromMirror: () => repo,
    contentsApiUrl: (dir) => `https://api.github.com/contents/${dir}`,
    dataCommitApiUrl: () => 'https://api.github.com/commits',
  };
});

import { syncCompendium } from './fetcher';

// Roteia o fetch mockado por URL. `commit` e `shas` controlam a resposta da API;
// `rawHits` registra quais arquivos foram baixados do raw.
function installFetch({ commit = 'c1', shas = { races: 'R1', 'class-fighter': 'F1' }, apiFails = false } = {}) {
  const rawHits = [];
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('api.github.com')) {
      if (apiFails) return { ok: false, status: 403, json: async () => ({}) };
      if (u.includes('/commits')) return { ok: true, json: async () => [{ sha: commit }] };
      if (u.endsWith('/contents/data'))
        return { ok: true, json: async () => [{ type: 'file', path: 'data/races.json', sha: shas.races }] };
      if (u.endsWith('/contents/data/class'))
        return {
          ok: true,
          json: async () => [{ type: 'file', path: 'data/class/class-fighter.json', sha: shas['class-fighter'] }],
        };
    }
    // raw
    const key = u.includes('class-fighter') ? 'class-fighter' : 'races';
    rawHits.push(key);
    return { ok: true, json: async () => ({ __file: key }) };
  });
  return { rawHits };
}

afterEach(() => vi.restoreAllMocks());
beforeEach(() => vi.clearAllMocks());

describe('syncCompendium', () => {
  it('cold start (sem cache): baixa tudo e registra SHAs + commit', async () => {
    const { rawHits } = installFetch();
    const res = await syncCompendium({});
    expect(res.downloaded).toBe(2);
    expect(rawHits.sort()).toEqual(['class-fighter', 'races']);
    expect(res.shas).toEqual({ races: 'R1', 'class-fighter': 'F1' });
    expect(res.dataCommit).toBe('c1');
    expect(res.db.races).toEqual({ __file: 'races' });
  });

  it('diff: baixa SÓ o arquivo cujo SHA mudou, reaproveitando o resto', async () => {
    const { rawHits } = installFetch({ commit: 'c2', shas: { races: 'R1', 'class-fighter': 'F2' } });
    const res = await syncCompendium({
      existingDb: { races: { old: 'races' }, 'class-fighter': { old: 'fighter' } },
      existingShas: { races: 'R1', 'class-fighter': 'F1' }, // fighter mudou F1→F2
      existingCommit: 'c1',
    });
    expect(res.downloaded).toBe(1);
    expect(rawHits).toEqual(['class-fighter']); // races NÃO foi baixado
    expect(res.db.races).toEqual({ old: 'races' }); // reaproveitado do cache
    expect(res.db['class-fighter']).toEqual({ __file: 'class-fighter' }); // atualizado
    expect(res.shas).toEqual({ races: 'R1', 'class-fighter': 'F2' });
  });

  it('fast-path: mesmo commit de data/ + cache completo → ZERO downloads', async () => {
    const { rawHits } = installFetch({ commit: 'c1' });
    const res = await syncCompendium({
      existingDb: { races: { r: 1 }, 'class-fighter': { f: 1 } },
      existingShas: { races: 'R1', 'class-fighter': 'F1' },
      existingCommit: 'c1', // == remote
    });
    expect(res.downloaded).toBe(0);
    expect(rawHits).toEqual([]);
    expect(res.db.races).toEqual({ r: 1 });
  });

  it('cache incompleto (arquivo novo no manifest) baixa só o que falta', async () => {
    const { rawHits } = installFetch({ commit: 'c1' });
    const res = await syncCompendium({
      existingDb: { races: { r: 1 } }, // falta class-fighter
      existingShas: { races: 'R1' },
      existingCommit: 'c1', // mesmo commit, mas incompleto → sem fast-path
    });
    expect(res.downloaded).toBe(1);
    expect(rawHits).toEqual(['class-fighter']);
  });

  it('API do GitHub indisponível → fallback: baixa tudo, SHAs null', async () => {
    const { rawHits } = installFetch({ apiFails: true });
    const res = await syncCompendium({
      existingDb: { races: { r: 1 }, 'class-fighter': { f: 1 } },
      existingShas: { races: 'R1', 'class-fighter': 'F1' },
      existingCommit: 'c1',
    });
    expect(res.downloaded).toBe(2);
    expect(rawHits.sort()).toEqual(['class-fighter', 'races']);
    expect(res.shas).toBeNull();
    expect(res.dataCommit).toBeNull();
  });
});
