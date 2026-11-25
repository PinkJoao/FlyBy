// =============================================================================
// cache: o cache do compêndio no navegador (Dexie)
// =============================================================================
// O QUE FAZ
//   Guarda o dataset do 5etools no IndexedDB, com timestamp, para o app abrir
//   instantâneo e funcionar offline. O compêndio é gravado POR ARQUIVO na tabela
//   `compendium` (db.js), junto com o SHA de blob de cada arquivo e o commit de
//   data/ do último sync, que alimentam o sync incremental (fetcher.js).
//
// FUNÇÕES
//   readCache(): { db, savedAt, shas, dataCommit, source, missing }, com o db
//     montado das linhas.
//   writeCache(dbObj, meta): grava o compêndio inteiro e carimba o timestamp, a
//     fonte de onde veio e os arquivos que ela não tem.
//   clearCache(): limpa SÓ o compêndio e os metadados dele (forceCacheUpdate);
//     os personagens e a fonte configurada não são tocados.
//   getCompendiumFile(key): lê um único arquivo (ainda sem uso: a base para uma
//     leitura lazy no mobile).
//   isFresh(savedAt): dentro da validade (30 dias)?
//   isComplete(dbObj, missing): tem todos os arquivos do manifest atual, ou sabe
//     que a fonte não tem os que faltam?
//
// DECISÕES E ARMADILHAS
//   - A API é estável para o useDataEngine. readCache monta o db inteiro porque
//     todo consumidor espera isso; se a memória no mobile virar gargalo, troca-se
//     por leitura seletiva via getCompendiumFile sem mexer no resto.
//   - writeCache recebe sempre o conjunto COMPLETO: o incremental está no que se
//     BAIXA, não em como se persiste.
//   - Um cache "fresco" ainda pode estar incompleto: uma versão nova do app pode
//     pedir arquivos novos (como os fluff-class-*), e isComplete força o refetch.
//   - O cache lembra a FONTE de onde veio (DDL-0091): trocar de fonte não pode
//     misturar arquivos de duas. `missing` é o que a fonte do usuário não tem
//     (404), para uma fonte parcial não contar como incompleta para sempre.
// -----------------------------------------------------------------------------

import db from './db';
import { CACHE_TTL, buildManifest } from './config';

const SAVED_AT_KEY = 'compendium:savedAt';
const DATA_COMMIT_KEY = 'compendium:dataCommit';
const SOURCE_KEY = 'compendium:source';
const MISSING_KEY = 'compendium:missing';

/**
 * Lê o compêndio cacheado, o timestamp, os SHAs por arquivo e o commit de data/.
 * @returns {Promise<{ db: object|null, savedAt: number|null, shas: object|null, dataCommit: string|null, source: object|null, missing: string[] }>}
 */
export async function readCache() {
  const [savedRow, commitRow, sourceRow, missingRow, rows] = await Promise.all([
    db.kv.get(SAVED_AT_KEY),
    db.kv.get(DATA_COMMIT_KEY),
    db.kv.get(SOURCE_KEY),
    db.kv.get(MISSING_KEY),
    db.compendium.toArray(),
  ]);
  const savedAt = savedRow?.value ?? null;
  const dataCommit = commitRow?.value ?? null;
  const source = sourceRow?.value ?? null;
  const missing = Array.isArray(missingRow?.value) ? missingRow.value : [];
  if (!rows.length) return { db: null, savedAt, shas: null, dataCommit, source, missing };
  const dbObj = {};
  const shas = {};
  for (const r of rows) {
    dbObj[r.key] = r.data;
    if (r.sha != null) shas[r.key] = r.sha;
  }
  return { db: dbObj, savedAt, shas: Object.keys(shas).length ? shas : null, dataCommit, source, missing };
}

/**
 * Grava o compêndio (substitui o anterior) e devolve o timestamp.
 * @param {object} dbObj
 * @param {object} [meta]
 * @param {Record<string,string>|null} [meta.shas]
 * @param {string|null} [meta.dataCommit]
 * @param {object|null} [meta.source]
 * @param {string[]} [meta.missing]
 * @returns {Promise<number>}
 */
export async function writeCache(dbObj, { shas = null, dataCommit = null, source = null, missing = [] } = {}) {
  const savedAt = Date.now();
  const entries = Object.entries(dbObj).map(([key, data]) => ({
    key,
    data,
    ...(shas?.[key] != null ? { sha: shas[key] } : {}),
  }));
  await db.transaction('rw', db.compendium, db.kv, async () => {
    await db.compendium.clear();
    await db.compendium.bulkPut(entries);
    await db.kv.put({ key: SAVED_AT_KEY, value: savedAt });
    if (dataCommit != null) await db.kv.put({ key: DATA_COMMIT_KEY, value: dataCommit });
    else await db.kv.delete(DATA_COMMIT_KEY);
    if (source) await db.kv.put({ key: SOURCE_KEY, value: source });
    else await db.kv.delete(SOURCE_KEY);
    await db.kv.put({ key: MISSING_KEY, value: missing ?? [] });
  });
  return savedAt;
}

/** Limpa só o compêndio, o timestamp e o commit. */
export async function clearCache() {
  await db.transaction('rw', db.compendium, db.kv, async () => {
    await db.compendium.clear();
    await db.kv.delete(SAVED_AT_KEY);
    await db.kv.delete(DATA_COMMIT_KEY);
    await db.kv.delete(SOURCE_KEY);
    await db.kv.delete(MISSING_KEY);
  });
}

/**
 * Lê um único arquivo do compêndio.
 * @param {string} key
 * @returns {Promise<object|null>}
 */
export async function getCompendiumFile(key) {
  const row = await db.compendium.get(key);
  return row?.data ?? null;
}

/**
 * O timestamp ainda está na validade (30 dias)?
 * @param {number|null} savedAt
 */
export function isFresh(savedAt) {
  if (!savedAt) return false;
  return Date.now() - savedAt < CACHE_TTL;
}

/**
 * O cache tem todos os arquivos do manifest atual (ou sabe que a fonte não os tem)?
 * @param {object|null} dbObj
 * @param {string[]} [missing]
 */
export function isComplete(dbObj, missing = []) {
  if (!dbObj) return false;
  const known = new Set(missing ?? []);
  return buildManifest().every(({ key }) => dbObj[key] != null || known.has(key));
}
