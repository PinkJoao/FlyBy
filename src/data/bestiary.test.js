// =============================================================================
// bestiary.test: o bestiário sob demanda (pacote, cache e rede)
// =============================================================================
// O QUE FAZ
//   Prova o loadBestiary com o `db` do Dexie e o `fetch` simulados: o pacote do SRD
//   responde sem rede, a fonte configurada baixa o índice e os arquivos e guarda,
//   a segunda chamada lê do cache, e a fonte trocada baixa de novo.
//
// FUNÇÕES
//   (só testes)
//
// DECISÕES E ARMADILHAS
//   - O `kv` do Dexie é um Map em memória (vi.mock('./db')): os testes não têm
//     IndexedDB.
// -----------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map();
vi.mock('./db', () => ({
  default: {
    kv: {
      get: async (key) => (store.has(key) ? { key, value: store.get(key) } : undefined),
      put: async ({ key, value }) => { store.set(key, value); },
    },
  },
}));

import { loadBestiary } from './bestiary';

const BASE = 'https://example.org/data/';
let calls = [];
beforeEach(() => {
  store.clear();
  calls = [];
  globalThis.fetch = vi.fn(async (url) => {
    calls.push(url);
    const body = url.endsWith('index.json')
      ? { XMM: 'bestiary-xmm.json', XPHB: 'bestiary-xphb.json', GONE: 'bestiary-gone.json' }
      : url.endsWith('bestiary-xmm.json') ? { monster: [{ name: 'Wolf', source: 'XMM' }] }
        : url.endsWith('bestiary-xphb.json') ? { monster: [{ name: 'Bestial Spirit', source: 'XPHB' }] }
          : url.endsWith('objects.json') ? { object: [
            { name: 'Eldritch Cannon', source: 'EFA', ac: 18, entries: ['{@note Created by the {@subclassFeature Eldritch Cannon|Artificer|EFA|Artillerist|EFA|3} subclass feature.}'] },
            { name: 'Chair', source: 'X', entries: [] },
          ] }
            : null;
    return body ? { ok: true, status: 200, json: async () => body } : { ok: false, status: 404, json: async () => ({}) };
  });
});

describe('loadBestiary (DDL-0189)', () => {
  it('o pacote do SRD responde sem rede', async () => {
    const out = await loadBestiary({ db: { bestiary: { monster: [{ name: 'Wolf', source: 'XMM' }] } }, source: { kind: 'srd' } });
    expect(out).toHaveLength(1);
    expect(calls).toHaveLength(0);
  });
  it('a fonte configurada baixa o índice, os arquivos e os objetos de feature; o 404 fica de fora', async () => {
    const out = await loadBestiary({ db: {}, source: { kind: 'url', base: BASE } });
    expect(out.map((m) => m.name).sort()).toEqual(['Bestial Spirit', 'Eldritch Cannon', 'Wolf']);
    expect(out.find((m) => m.name === 'Eldritch Cannon').summonedByClass).toBe('Artificer|EFA');
    expect(calls).toHaveLength(5);
  });
  it('a segunda chamada lê do cache; outra fonte baixa de novo', async () => {
    await loadBestiary({ db: {}, source: { kind: 'url', base: BASE } });
    const n = calls.length;
    await loadBestiary({ db: {}, source: { kind: 'url', base: BASE } });
    expect(calls.length).toBe(n);
    await loadBestiary({ db: {}, source: { kind: 'url', base: 'https://other.org/data/' } });
    expect(calls.length).toBeGreaterThan(n);
  });
});
