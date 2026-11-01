// =============================================================================
// portraitCatalog: o catálogo de retratos sugeridos, de várias fontes, sem quebrar
// =============================================================================
// O QUE FAZ
//   Monta o catálogo que a faixa e a galeria ranqueiam, juntando as fontes da
//   release v3 publicada fora do app (Reddit, Pinterest, ...) com a fatia de licença
//   livre que vem no próprio app (Wesnoth, src/data/portraitsLicensed.json). A
//   cascata (DDL-0137, §4 do estudo de fontes): manifesto do host configurado, senão
//   dos espelhos, senão a última release guardada no aparelho; a fatia licenciada
//   entra sempre.
//
// FUNÇÕES
//   CATALOG_URLS: os endereços de manifesto de VITE_PORTRAIT_CATALOG_URL (vírgulas).
//   fill(template, vars): troca {id}, {a}, {b}, {c}, {author}, {post}, {src} e
//     {thumbSrc} num modelo (os dois últimos crus: já são URLs inteiras).
//   validManifest(m): o manifesto tem a forma do formato 3?
//   sha256Hex(text): o sha256 em hex (crypto.subtle).
//   fetchText(url, fetchImpl, timeoutMs): o texto de uma URL, ou null.
//   baseOf(url): a pasta de um endereço (até a última barra).
//   loadRemote(urls, fetchImpl): { manifest, shards } da primeira base que responder.
//   partsFromRelease(release): as fontes ligadas da release, como partes do catálogo.
//   licensedPart(data): a fatia licenciada embutida, como parte do catálogo.
//   mergeParts(parts): um catálogo só, com o dicionário de tags unido (sem armas e
//     focos antigos; `robes` vira `clothes`).
//   loadPortraitCatalog(deps): o catálogo pronto; nunca rejeita.
//
// DECISÕES E ARMADILHAS
//   - Nada aqui lança para fora: host fora, manifesto inválido, fatia com sha256
//     errado ou cache vazio só tiram aquela parte. O pior caso é só a fatia
//     licenciada (e a busca guiada, que não depende do catálogo): é o que vê um
//     aparelho novo sem rede e um build sem VITE_PORTRAIT_CATALOG_URL (o espelho
//     público, um fork). O índice antigo embutido (portraitsIndex.json, 2,5 MB)
//     saiu em 2026-10-31, com o catálogo já publicado.
//   - Tempo-limite de 4 s por manifesto e 15 s por fatia; a fatia é baixada da
//     MESMA base do manifesto que respondeu, e dos espelhos se ela falhar.
//   - `enabled: false` no manifesto é o interruptor remoto: a fonte some do app sem
//     novo deploy. Fonte sem CORS registra o host em imageProxy (registerNoCorsHost)
//     para PDF e cópia passarem pelo cache wsrv.nl.
//   - A release boa vai para o IndexedDB (`kv`, chave `portraits:release`) e serve
//     offline e quando os dois hosts caem.
//   - Cada item ganha `key` = `fonte:id` (único entre fontes), `thumb` (a faixa),
//     `card` (a galeria; `image.card` do manifesto, senão `full`), `url` (prévia e cópia),
//     `bucket` (prioridade 0..7, DDL-0137) e `credit` ({ by, link } ou null).
// -----------------------------------------------------------------------------

import db from './db';
import { portraitTagAllowed } from '../engine/portraitSuggestions';
import { registerNoCorsHost } from './imageProxy';
import licensedData from './portraitsLicensed.json';

const CACHE_KEY = 'portraits:release';
const RAW_VARS = new Set(['src', 'thumbSrc']);
const TAG_ALIASES = { robes: 'clothes' };

export const CATALOG_URLS = String(import.meta.env?.VITE_PORTRAIT_CATALOG_URL ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Troca as variáveis de um modelo de URL. */
export function fill(template, vars) {
  if (!template) return '';
  const id = String(vars.id ?? '');
  const all = { a: id.slice(0, 2), b: id.slice(2, 4), c: id.slice(4, 6), ...vars };
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    RAW_VARS.has(k) ? String(all[k] ?? '') : encodeURIComponent(String(all[k] ?? '')).replace(/%2F/g, '/'),
  );
}

/** O manifesto tem a forma do formato 3? */
export function validManifest(m) {
  return (
    !!m &&
    m.format === 3 &&
    Array.isArray(m.tags) &&
    !!m.sources &&
    typeof m.sources === 'object' &&
    Object.values(m.sources).every((s) => s && Array.isArray(s.shards) && s.image?.thumb && s.image?.full)
  );
}

/** O sha256 de um texto, em hex. */
export async function sha256Hex(text) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** O texto de uma URL, ou null (erro, status ruim ou tempo esgotado). */
async function fetchText(url, fetchImpl, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const baseOf = (url) => url.replace(/[^/]*$/, '');

/**
 * A release da primeira base que responder: manifesto válido e fatias conferidas.
 * @param {string[]} urls endereços de manifesto
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<{ manifest: object, shards: Record<string, string> }|null>}
 */
export async function loadRemote(urls, fetchImpl) {
  for (const url of urls) {
    const text = await fetchText(url, fetchImpl, 4000);
    let manifest;
    try {
      manifest = text ? JSON.parse(text) : null;
    } catch {
      manifest = null;
    }
    if (!validManifest(manifest)) continue;
    const bases = [baseOf(url), ...(manifest.mirrors ?? []).map((m) => (m.endsWith('/') ? m : `${m}/`))];
    const shards = {};
    for (const src of Object.values(manifest.sources)) {
      if (src.enabled === false) continue;
      for (const shard of src.shards) {
        for (const base of [...new Set(bases)]) {
          const content = await fetchText(base + shard.file, fetchImpl, 15000);
          if (content && (await sha256Hex(content)) === shard.sha256) {
            shards[shard.file] = content;
            break;
          }
        }
      }
    }
    return { manifest, shards };
  }
  return null;
}

/**
 * As fontes ligadas de uma release como partes do catálogo.
 * @param {{ manifest: object, shards: Record<string, string> }} release
 */
export function partsFromRelease({ manifest, shards }) {
  const parts = [];
  for (const [name, src] of Object.entries(manifest.sources)) {
    if (src.enabled === false) continue;
    if (src.image.cors === false) {
      try {
        registerNoCorsHost(new URL(fill(src.image.full, { id: 'x' })).hostname);
      } catch {
        // modelo sem host absoluto: nada a registrar
      }
    }
    const items = [];
    for (const shard of src.shards) {
      const content = shards[shard.file];
      if (!content) continue;
      let rows;
      try {
        rows = JSON.parse(content).items ?? [];
      } catch {
        continue;
      }
      for (const [id, idxs, bucket, author, post, rawSrc, thumbSrc] of rows) {
        const vars = { id, author, post, src: rawSrc, thumbSrc };
        const credit = src.credit
          ? { by: author ? fill(src.credit.by, vars) : null, link: post ? fill(src.credit.link, vars) : null }
          : null;
        items.push({
          id,
          tags: idxs.map((i) => manifest.tags[i]).filter(Boolean),
          bucket: Number(bucket) || 0,
          thumb: fill(src.image.thumb, vars),
          card: fill(src.image.card ?? src.image.full, vars),
          url: fill(src.image.full, vars),
          credit,
        });
      }
    }
    if (items.length) parts.push({ source: name, items });
  }
  return parts;
}

/** A fatia licenciada embutida (Wesnoth) como parte do catálogo. */
export function licensedPart(data = licensedData) {
  const items = (data?.items ?? []).map(([id, idxs, bucket, path]) => ({
    id,
    tags: idxs.map((i) => data.tags[i]).filter(Boolean),
    bucket: Number(bucket) || 0,
    thumb: `/portraits-licensed/${id}`,
    url: `/portraits-licensed/${id}`,
    credit: { by: data.credit?.by ?? null, link: data.credit?.link ? `${data.credit.link}/${path}` : null },
  }));
  return { source: data?.source ?? 'licensed', items };
}

/**
 * Junta as partes num catálogo só, com o dicionário de tags unido.
 * @param {Array<{ source: string, items: Array<{ id: string, tags: string[], bucket: number, thumb: string, url: string, credit: object|null }> }>} parts
 * @returns {{ tags: string[], items: Array<object>, sources: string[] }}
 */
export function mergeParts(parts) {
  const tags = [];
  const index = new Map();
  const items = [];
  for (const part of parts) {
    for (const it of part.items) {
      const idxs = [];
      const itemTags = new Set(it.tags.map((t) => TAG_ALIASES[t] ?? t).filter(portraitTagAllowed));
      for (const t of itemTags) {
        if (!index.has(t)) {
          index.set(t, tags.length);
          tags.push(t);
        }
        idxs.push(index.get(t));
      }
      items.push({
        key: `${part.source}:${it.id}`,
        source: part.source,
        idxs,
        bucket: it.bucket,
        thumb: it.thumb,
        card: it.card ?? it.url,
        url: it.url,
        credit: it.credit,
      });
    }
  }
  return { tags, items, sources: parts.map((p) => p.source) };
}

const defaultCache = {
  read: async () => (await db.kv.get(CACHE_KEY))?.value ?? null,
  write: (value) => db.kv.put({ key: CACHE_KEY, value }),
};

/**
 * O catálogo pronto, pela cascata; nunca rejeita.
 * @param {{ urls?: string[], fetchImpl?: typeof fetch, cache?: { read: () => Promise<any>, write: (v: any) => Promise<any> }, licensed?: object }} [deps]
 */
export async function loadPortraitCatalog({
  urls = CATALOG_URLS,
  fetchImpl = (...a) => fetch(...a),
  cache = defaultCache,
  licensed = licensedData,
} = {}) {
  const parts = [];
  let release = urls.length ? await loadRemote(urls, fetchImpl).catch(() => null) : null;
  if (release && Object.keys(release.shards).length) {
    cache.write(release).catch(() => {});
  } else {
    release = await cache.read().catch(() => null);
    if (release && !validManifest(release.manifest)) release = null;
  }
  if (release) parts.push(...partsFromRelease(release));
  parts.unshift(licensedPart(licensed));
  return mergeParts(parts);
}
