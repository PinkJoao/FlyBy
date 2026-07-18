// =============================================================================
// Camada de cache do compêndio (Dexie)
// =============================================================================
// Guarda o dataset do 5etools no navegador, com timestamp, para o app abrir
// instantâneo e funcionar offline. O compêndio é gravado POR ARQUIVO na tabela
// `compendium` (ver db.js).
//
// API mantida estável para o useDataEngine:
//   readCache()  → { db, savedAt }   (db = objeto montado a partir das linhas)
//   writeCache(db), clearCache(), isFresh(savedAt)
//
// Extra para uso futuro (mobile/lazy): getCompendiumFile(key) lê uma única
// linha sem carregar o resto.
// -----------------------------------------------------------------------------

import db from './db';
import { CACHE_TTL, buildManifest } from './config';

const SAVED_AT_KEY = 'compendium:savedAt';
// Commit mais recente de data/ no último sync (fast-path do sync por SHA).
const DATA_COMMIT_KEY = 'compendium:dataCommit';

/**
 * Lê o compêndio cacheado, o timestamp, os SHAs de blob por arquivo (para o sync
 * incremental) e o commit de data/ do último sync.
 * Hoje monta o objeto `db` inteiro (todos os consumidores atuais esperam isso);
 * quando a memória no mobile virar gargalo, dá pra trocar por leitura seletiva
 * via getCompendiumFile sem mexer no resto da app.
 * @returns {Promise<{ db: object|null, savedAt: number|null, shas: object|null, dataCommit: string|null }>}
 */
export async function readCache() {
  const [savedRow, commitRow, rows] = await Promise.all([
    db.kv.get(SAVED_AT_KEY),
    db.kv.get(DATA_COMMIT_KEY),
    db.compendium.toArray(),
  ]);
  const savedAt = savedRow?.value ?? null;
  const dataCommit = commitRow?.value ?? null;
  if (!rows.length) return { db: null, savedAt, shas: null, dataCommit };
  const dbObj = {};
  const shas = {};
  for (const r of rows) {
    dbObj[r.key] = r.data;
    if (r.sha != null) shas[r.key] = r.sha;
  }
  return { db: dbObj, savedAt, shas: Object.keys(shas).length ? shas : null, dataCommit };
}

/**
 * Grava o compêndio (substitui o anterior) e carimba o timestamp atual. Guarda
 * também o SHA de blob de cada arquivo e o commit de data/ (para o sync
 * incremental do próximo boot). O `dbObj` é sempre o conjunto COMPLETO (o
 * incremental está no que se BAIXA, não em como se persiste).
 * @param {object} dbObj  objeto indexado por chave de arquivo (ex: { races, 'class-fighter' })
 * @param {object} [meta]
 * @param {Record<string,string>|null} [meta.shas]  chave→SHA de blob (opcional)
 * @param {string|null} [meta.dataCommit]  commit de data/ (opcional)
 * @returns {Promise<number>} savedAt
 */
export async function writeCache(dbObj, { shas = null, dataCommit = null } = {}) {
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
  });
  return savedAt;
}

/**
 * Limpa SÓ o compêndio + timestamp + commit (usado pelo forceCacheUpdate).
 * Os personagens NÃO são tocados.
 */
export async function clearCache() {
  await db.transaction('rw', db.compendium, db.kv, async () => {
    await db.compendium.clear();
    await db.kv.delete(SAVED_AT_KEY);
    await db.kv.delete(DATA_COMMIT_KEY);
  });
}

/**
 * Lê um único arquivo do compêndio sem carregar o resto.
 * (Ainda não usado - base para leitura lazy no mobile.)
 * @param {string} key  ex: 'races', 'class-fighter'
 * @returns {Promise<object|null>}
 */
export async function getCompendiumFile(key) {
  const row = await db.compendium.get(key);
  return row?.data ?? null;
}

/**
 * Diz se um timestamp ainda está dentro da validade (30 dias).
 * @param {number|null} savedAt
 */
export function isFresh(savedAt) {
  if (!savedAt) return false;
  return Date.now() - savedAt < CACHE_TTL;
}

/**
 * Diz se o cache contém TODOS os arquivos do manifest atual. Quando uma versão
 * nova do app passa a pedir arquivos extras (ex.: fluff-class-*), um cache
 * antigo - mesmo "fresco" - está incompleto e precisa de refetch.
 * @param {object|null} dbObj
 */
export function isComplete(dbObj) {
  if (!dbObj) return false;
  return buildManifest().every(({ key }) => dbObj[key] != null);
}
