// =============================================================================
// config.test: testes das URLs do sync por SHA e do manifesto
// =============================================================================
// O QUE FAZ
//   As URLs do sync por SHA e, com o material de referência na máquina, a lista de livros de magia
//   contra o `spells/index.json` do 5etools (DDL-0265: o espelho trouxe AU e WoW e o manifesto ficou em 17).
//
// FUNÇÕES
//   indexOf(file): um índice da pasta de magias do material de referência, ou null sem ele.
// -----------------------------------------------------------------------------

import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  githubRepoFromMirror,
  contentsApiUrl,
  dataCommitApiUrl,
  manifestDirs,
  SPELL_SOURCES,
  SPELL_FLUFF_SOURCES,
} from './config';

const SPELLS_DIR = 'DnD Source Material/5etools Source Code/data/spells';
const indexOf = (file) => (fs.existsSync(`${SPELLS_DIR}/${file}`) ? JSON.parse(fs.readFileSync(`${SPELLS_DIR}/${file}`, 'utf8')) : null);

describe('githubRepoFromMirror', () => {
  it('extrai owner/repo/branch de um mirror raw.githubusercontent', () => {
    expect(
      githubRepoFromMirror('https://raw.githubusercontent.com/owner/repo/main/data/'),
    ).toEqual({ owner: 'owner', repo: 'repo', branch: 'main' });
  });

  it('nenhum endereço de fonte mora no código (DDL-0091, Fase 5)', () => {
    expect(githubRepoFromMirror()).toBeNull();
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

describe('o manifesto acompanha o índice de magias do 5etools (DDL-0265)', () => {
  const spells = indexOf('index.json');
  const fluff = indexOf('fluff-index.json');
  it.skipIf(!spells)('todo livro de magia do índice está no SPELL_SOURCES', () => {
    const want = Object.values(spells).map((f) => f.replace(/^spells-|\.json$/g, '')).sort();
    expect([...SPELL_SOURCES].sort()).toEqual(want);
  });
  it.skipIf(!fluff)('todo fluff de magia do índice está no SPELL_FLUFF_SOURCES', () => {
    const want = Object.values(fluff).map((f) => f.replace(/^fluff-spells-|\.json$/g, '')).sort();
    expect([...SPELL_FLUFF_SOURCES].sort()).toEqual(want);
  });
});
