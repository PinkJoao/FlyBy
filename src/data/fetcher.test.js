// =============================================================================
// fetcher.test: testes da decisão do sync por SHA
// =============================================================================
// O QUE FAZ
//   Testa O QUE o sync baixa (fast-path, diff por arquivo, cache incompleto,
//   fallback) com um manifest pequeno e controlado, sem depender dos ~65 arquivos
//   reais.
//
// FUNÇÕES
//   installFetch({ commit, shas, apiFails, notFound }): um fetch mockado roteado
//     por URL. `commit` e `shas` controlam a resposta da API, `apiFails` a
//     derruba, `notFound` dá 404 nesses arquivos, e `rawHits` registra o que foi
//     baixado do raw.
// -----------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./config', () => {
  const repo = { owner: 'o', repo: 'r', branch: 'main' };
  return {
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

const BASE = 'https://raw.example/data/';

function installFetch({ commit = 'c1', shas = { races: 'R1', 'class-fighter': 'F1' }, apiFails = false, notFound = [] } = {}) {
  const rawHits = [];
  globalThis.fetch = vi.fn(async (url) => {
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
    const key = u.includes('class-fighter') ? 'class-fighter' : 'races';
    rawHits.push(key);
    if (notFound.includes(key)) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, json: async () => ({ __file: key }) };
  });
  return { rawHits };
}

afterEach(() => vi.restoreAllMocks());
beforeEach(() => vi.clearAllMocks());

describe('syncCompendium', () => {
  it('cold start (sem cache): baixa tudo e registra SHAs + commit', async () => {
    const { rawHits } = installFetch();
    const res = await syncCompendium({ base: BASE });
    expect(res.downloaded).toBe(2);
    expect(rawHits.sort()).toEqual(['class-fighter', 'races']);
    expect(res.shas).toEqual({ races: 'R1', 'class-fighter': 'F1' });
    expect(res.dataCommit).toBe('c1');
    expect(res.db.races).toEqual({ __file: 'races' });
  });

  it('diff: baixa SÓ o arquivo cujo SHA mudou, reaproveitando o resto', async () => {
    const { rawHits } = installFetch({ commit: 'c2', shas: { races: 'R1', 'class-fighter': 'F2' } });
    const res = await syncCompendium({
      base: BASE,
      existingDb: { races: { old: 'races' }, 'class-fighter': { old: 'fighter' } },
      existingShas: { races: 'R1', 'class-fighter': 'F1' },
      existingCommit: 'c1',
    });
    expect(res.downloaded).toBe(1);
    expect(rawHits).toEqual(['class-fighter']);
    expect(res.db.races).toEqual({ old: 'races' });
    expect(res.db['class-fighter']).toEqual({ __file: 'class-fighter' });
    expect(res.shas).toEqual({ races: 'R1', 'class-fighter': 'F2' });
  });

  it('fast-path: mesmo commit de data/ + cache completo → ZERO downloads', async () => {
    const { rawHits } = installFetch({ commit: 'c1' });
    const res = await syncCompendium({
      base: BASE,
      existingDb: { races: { r: 1 }, 'class-fighter': { f: 1 } },
      existingShas: { races: 'R1', 'class-fighter': 'F1' },
      existingCommit: 'c1',
    });
    expect(res.downloaded).toBe(0);
    expect(rawHits).toEqual([]);
    expect(res.db.races).toEqual({ r: 1 });
  });

  it('cache incompleto (arquivo novo no manifest) baixa só o que falta', async () => {
    const { rawHits } = installFetch({ commit: 'c1' });
    const res = await syncCompendium({
      base: BASE,
      existingDb: { races: { r: 1 } },
      existingShas: { races: 'R1' },
      existingCommit: 'c1',
    });
    expect(res.downloaded).toBe(1);
    expect(rawHits).toEqual(['class-fighter']);
  });

  it('API do GitHub indisponível → fallback: baixa tudo, SHAs null', async () => {
    const { rawHits } = installFetch({ apiFails: true });
    const res = await syncCompendium({
      base: BASE,
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

describe('syncCompendium - fonte do usuário (DDL-0091)', () => {
  it('arquivo 404 fica de fora e volta em `missing`, sem derrubar o resto', async () => {
    installFetch({ notFound: ['class-fighter'] });
    const res = await syncCompendium({ base: BASE });
    expect(Object.keys(res.db)).toEqual(['races']);
    expect(res.missing).toEqual(['class-fighter']);
  });

  it('fonte sem arquivo nenhum é erro (endereço errado, não fonte parcial)', async () => {
    installFetch({ notFound: ['class-fighter', 'races'] });
    await expect(syncCompendium({ base: BASE })).rejects.toThrow(/nenhum arquivo/);
  });

  it('o que a fonte não tem conta como completo: fast-path com zero downloads', async () => {
    const { rawHits } = installFetch({ notFound: ['class-fighter'] });
    const res = await syncCompendium({
      base: BASE,
      existingDb: { races: { r: 1 } },
      existingShas: { races: 'R1' },
      existingCommit: 'c1',
      existingMissing: ['class-fighter'],
    });
    expect(res.downloaded).toBe(0);
    expect(rawHits).toEqual([]);
  });

  it('erro de REDE continua lançando (o cache vale)', async () => {
    installFetch();
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).includes('raw.example')) throw new TypeError('Failed to fetch');
      return original(url);
    });
    await expect(syncCompendium({ base: BASE })).rejects.toThrow(/Failed to fetch/);
  });
});
