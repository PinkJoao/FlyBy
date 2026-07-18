import { describe, it, expect } from 'vitest';
import {
  githubRepoFromMirror,
  contentsApiUrl,
  dataCommitApiUrl,
  manifestDirs,
} from './config';

describe('githubRepoFromMirror', () => {
  it('extrai owner/repo/branch de um mirror raw.githubusercontent', () => {
    expect(
      githubRepoFromMirror('https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/'),
    ).toEqual({ owner: '5etools-mirror-3', repo: '5etools-src', branch: 'main' });
  });

  it('o mirror primário real do app é github (sync por SHA ativo)', () => {
    expect(githubRepoFromMirror()).toMatchObject({ repo: '5etools-src', branch: 'main' });
  });

  it('retorna null para hosts que não são o raw do github (sync desativa)', () => {
    expect(githubRepoFromMirror('https://example.com/mirror/data/')).toBeNull();
    expect(githubRepoFromMirror('')).toBeNull();
    expect(githubRepoFromMirror(null)).toBeNull();
  });
});

describe('URLs da API do GitHub', () => {
  const repo = { owner: 'o', repo: 'r', branch: 'main' };

  it('contentsApiUrl aponta para o diretório com ref', () => {
    expect(contentsApiUrl('data/class', repo)).toBe(
      'https://api.github.com/repos/o/r/contents/data/class?ref=main',
    );
  });

  it('dataCommitApiUrl pede o último commit que tocou data/', () => {
    expect(dataCommitApiUrl(repo)).toBe(
      'https://api.github.com/repos/o/r/commits?path=data&sha=main&per_page=1',
    );
  });

  it('ambos retornam null sem repo github', () => {
    expect(contentsApiUrl('data', null)).toBeNull();
    expect(dataCommitApiUrl(null)).toBeNull();
  });
});

describe('manifestDirs', () => {
  it('cobre os diretórios reais do manifest, sem repetição', () => {
    const dirs = manifestDirs();
    expect(dirs).toContain('data');
    expect(dirs).toContain('data/class');
    expect(dirs).toContain('data/spells');
    expect(dirs).toContain('data/generated');
    expect(new Set(dirs).size).toBe(dirs.length);
  });
});
