// =============================================================================
// dataSource.test: a fonte de dados configurável (DDL-0091)
// =============================================================================
// O QUE FAZ
//   As funções puras: a normalização da base (https, host minúsculo, barra
//   final), a comparação entre fontes e o rótulo. A persistência é do IndexedDB e
//   fica para o navegador.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { normalizeBase, sameSource, describeSource, SRD_SOURCE } from './dataSource';

describe('normalizeBase', () => {
  it('põe a barra final, baixa o host e tira query e âncora', () => {
    expect(normalizeBase(' https://Example.COM/a/data?x=1#y ')).toBe('https://example.com/a/data/');
    expect(normalizeBase('https://example.com/a/data/')).toBe('https://example.com/a/data/');
  });

  it('recusa o que não é https', () => {
    expect(normalizeBase('http://example.com/data/')).toBeNull();
    expect(normalizeBase('ftp://example.com/')).toBeNull();
    expect(normalizeBase('not a url')).toBeNull();
    expect(normalizeBase('')).toBeNull();
  });
});

describe('sameSource', () => {
  it('compara pela base normalizada', () => {
    expect(sameSource({ kind: 'url', base: 'https://EXAMPLE.com/data' }, { kind: 'url', base: 'https://example.com/data/' })).toBe(true);
    expect(sameSource({ kind: 'url', base: 'https://a.com/data/' }, { kind: 'url', base: 'https://b.com/data/' })).toBe(false);
  });

  it('SRD é igual a SRD e diferente de URL', () => {
    expect(sameSource(SRD_SOURCE, { kind: 'srd' })).toBe(true);
    expect(sameSource(SRD_SOURCE, { kind: 'url', base: 'https://example.com/data/' })).toBe(false);
    expect(sameSource(null, SRD_SOURCE)).toBe(false);
  });
});

describe('describeSource', () => {
  it('o rótulo mostra host e caminho, ou o SRD', () => {
    expect(describeSource(SRD_SOURCE)).toBe('SRD 5.2 (built in)');
    expect(describeSource({ kind: 'url', base: 'https://example.com/x/data/' })).toBe('example.com/x/data/');
  });
});
