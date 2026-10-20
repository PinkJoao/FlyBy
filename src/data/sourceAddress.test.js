// =============================================================================
// sourceAddress.test: as formas de link aceitas e a prova antes de gravar
// =============================================================================
// O QUE FAZ
//   parseSourceAddress em cada forma do GitHub (repo, `.git`, tree, blob,
//   release, raw com e sem `refs/`, sem esquema) e num host qualquer; e
//   resolveSourceAddress com um fetch falso: branch padrão e última release
//   pela API, o fallback sem API, a prova pela FORMA do JSON e as falhas.
//   Só donos e repositórios fictícios (DDL-0091, Fase 5).
//
// FUNÇÕES
//   fakeFetch(table): o fetch falso e a lista das URLs pedidas.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { parseSourceAddress, resolveSourceAddress, describeProblem } from './sourceAddress';

const RAW = 'https://raw.githubusercontent.com/owner/repo';

describe('parseSourceAddress: GitHub', () => {
  it('o repositório puro, com ou sem esquema e .git, pede o branch padrão', () => {
    const want = { owner: 'owner', repo: 'repo', ref: 'default' };
    expect(parseSourceAddress('https://github.com/owner/repo')).toEqual(want);
    expect(parseSourceAddress('github.com/owner/repo')).toEqual(want);
    expect(parseSourceAddress('https://www.github.com/owner/repo.git')).toEqual(want);
    expect(parseSourceAddress('https://github.com/owner/repo/issues')).toEqual(want);
  });

  it('tree, blob e raw de um branch viram o raw da pasta data/', () => {
    expect(parseSourceAddress('https://github.com/owner/repo/tree/dev')).toEqual({ base: `${RAW}/dev/data/` });
    expect(parseSourceAddress('https://github.com/owner/repo/tree/main/data/class')).toEqual({ base: `${RAW}/main/data/` });
    expect(parseSourceAddress('https://github.com/owner/repo/blob/main/data/races.json')).toEqual({ base: `${RAW}/main/data/` });
    expect(parseSourceAddress('https://github.com/owner/repo/raw/main/data/spells/sources.json')).toEqual({ base: `${RAW}/main/data/` });
  });

  it('release: a tag vira o ref; latest e a página de releases pedem a API', () => {
    expect(parseSourceAddress('https://github.com/owner/repo/releases/tag/v2.0.1')).toEqual({ base: `${RAW}/v2.0.1/data/` });
    expect(parseSourceAddress('https://github.com/owner/repo/releases/download/v2.0.1/pack.zip')).toEqual({ base: `${RAW}/v2.0.1/data/` });
    expect(parseSourceAddress('https://github.com/owner/repo/releases/latest')).toEqual({ owner: 'owner', repo: 'repo', ref: 'latest' });
    expect(parseSourceAddress('https://github.com/owner/repo/releases')).toEqual({ owner: 'owner', repo: 'repo', ref: 'latest' });
  });

  it('raw: tira refs/heads e refs/tags, completa data/ e tira o arquivo', () => {
    expect(parseSourceAddress(`${RAW}/refs/heads/main/data/senses.json`)).toEqual({ base: `${RAW}/main/data/` });
    expect(parseSourceAddress(`${RAW}/refs/tags/v1/data/`)).toEqual({ base: `${RAW}/v1/data/` });
    expect(parseSourceAddress(`${RAW}/main`)).toEqual({ base: `${RAW}/main/data/` });
    expect(parseSourceAddress(`${RAW}/main/data/`)).toEqual({ base: `${RAW}/main/data/` });
    expect(parseSourceAddress(RAW)).toEqual({ owner: 'owner', repo: 'repo', ref: 'default' });
  });

  it('um repo chamado data não confunde o corte da pasta', () => {
    expect(parseSourceAddress('https://github.com/data/data/tree/main')).toEqual({
      base: 'https://raw.githubusercontent.com/data/data/main/data/',
    });
  });

  it('link sem dono e repo não serve', () => {
    expect(parseSourceAddress('https://github.com/owner')).toBeNull();
    expect(parseSourceAddress('https://github.com/')).toBeNull();
  });
});

describe('parseSourceAddress: outros hosts', () => {
  it('só tira o arquivo final; a estrutura de um servidor alheio fica como está', () => {
    expect(parseSourceAddress('https://host.example/game/data/class/class-fighter.json')).toEqual({
      base: 'https://host.example/game/data/class/',
    });
    expect(parseSourceAddress('host.example/my-files')).toEqual({ base: 'https://host.example/my-files/' });
  });

  it('recusa http, texto solto e vazio', () => {
    expect(parseSourceAddress('http://host.example/data/')).toBeNull();
    expect(parseSourceAddress('hello')).toBeNull();
    expect(parseSourceAddress('   ')).toBeNull();
  });
});

/** Um fetch falso: cada URL devolve o que a tabela diz; ausente é 404, 'down' é erro de rede. */
function fakeFetch(table) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const entry = table[url];
    if (entry === 'down') throw new TypeError('Failed to fetch');
    if (entry === undefined) return { ok: false, status: 404, json: async () => ({}) };
    if (typeof entry === 'number') return { ok: entry < 400, status: entry, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => entry };
  };
  return { impl, calls };
}

const SENSES = { sense: [{ name: 'Blindsight' }] };
const API = 'https://api.github.com/repos/owner/repo';

describe('resolveSourceAddress', () => {
  it('base pronta: a prova confere a forma do JSON', async () => {
    const { impl } = fakeFetch({ [`${RAW}/main/data/senses.json`]: SENSES });
    expect(await resolveSourceAddress({ base: `${RAW}/main/data/` }, { fetchImpl: impl })).toEqual({ ok: true, base: `${RAW}/main/data/` });
  });

  it('a segunda prova vale quando a primeira falta', async () => {
    const { impl } = fakeFetch({ [`${RAW}/main/data/skills.json`]: { skill: [] } });
    expect((await resolveSourceAddress({ base: `${RAW}/main/data/` }, { fetchImpl: impl })).ok).toBe(true);
  });

  it('200 sem a forma esperada (um site que devolve HTML) é not-found, com a base', async () => {
    const { impl } = fakeFetch({ 'https://host.example/senses.json': { html: true } });
    const r = await resolveSourceAddress({ base: 'https://host.example/' }, { fetchImpl: impl });
    expect(r).toEqual({ ok: false, base: 'https://host.example/', reason: 'not-found' });
  });

  it('sem rede é network', async () => {
    const { impl } = fakeFetch({
      'https://host.example/senses.json': 'down',
      'https://host.example/skills.json': 'down',
    });
    expect((await resolveSourceAddress({ base: 'https://host.example/' }, { fetchImpl: impl })).reason).toBe('network');
  });

  it('repo puro: o branch padrão vem da API', async () => {
    const { impl } = fakeFetch({ [API]: { default_branch: 'trunk' }, [`${RAW}/trunk/data/senses.json`]: SENSES });
    expect(await resolveSourceAddress({ owner: 'owner', repo: 'repo', ref: 'default' }, { fetchImpl: impl })).toEqual({
      ok: true,
      base: `${RAW}/trunk/data/`,
    });
  });

  it('API sem resposta (rate limit): tenta main e depois master', async () => {
    const { impl, calls } = fakeFetch({ [API]: 403, [`${RAW}/master/data/senses.json`]: SENSES });
    const r = await resolveSourceAddress({ owner: 'owner', repo: 'repo', ref: 'default' }, { fetchImpl: impl });
    expect(r).toEqual({ ok: true, base: `${RAW}/master/data/` });
    expect(calls).toContain(`${RAW}/main/data/senses.json`);
  });

  it('repo inexistente ou privado é no-repo, sem base a oferecer', async () => {
    const { impl } = fakeFetch({});
    expect(await resolveSourceAddress({ owner: 'owner', repo: 'repo', ref: 'default' }, { fetchImpl: impl })).toEqual({
      ok: false,
      base: null,
      reason: 'no-repo',
    });
  });

  it('latest: a tag da última release; sem release, o branch padrão', async () => {
    const withRelease = fakeFetch({ [`${API}/releases/latest`]: { tag_name: 'v3.1.0' }, [`${RAW}/v3.1.0/data/senses.json`]: SENSES });
    expect((await resolveSourceAddress({ owner: 'owner', repo: 'repo', ref: 'latest' }, { fetchImpl: withRelease.impl })).base).toBe(`${RAW}/v3.1.0/data/`);

    const noRelease = fakeFetch({ [API]: { default_branch: 'main' }, [`${RAW}/main/data/senses.json`]: SENSES });
    expect((await resolveSourceAddress({ owner: 'owner', repo: 'repo', ref: 'latest' }, { fetchImpl: noRelease.impl })).base).toBe(`${RAW}/main/data/`);
  });

  it('nada interpretado é invalid', async () => {
    expect(await resolveSourceAddress(null)).toEqual({ ok: false, base: null, reason: 'invalid' });
  });
});

describe('describeProblem', () => {
  it('cada falha tem a sua frase, com o lugar quando há base', () => {
    expect(describeProblem({ reason: 'not-found', base: `${RAW}/main/data/` })).toContain('raw.githubusercontent.com/owner/repo/main/data/');
    expect(describeProblem({ reason: 'no-repo', base: null })).toContain('no public repository');
    expect(describeProblem({ reason: 'network', base: 'https://host.example/' })).toContain('Could not reach');
    expect(describeProblem({ reason: 'invalid', base: null })).toContain('setup link');
  });
});
