// =============================================================================
// Fetcher do compêndio 5etools
// =============================================================================
// Baixa arquivos do manifesto tentando cada mirror em ordem até um responder.
//
// Estratégia econômica (`syncCompendium`): em vez de re-baixar TODOS os arquivos
// a cada expiração do cache, consulta a API do GitHub o SHA de blob de cada
// arquivo e baixa via raw SÓ os que mudaram - reduzindo muito a banda consumida
// do GitHub do 5etools. Fast-path por commit (nada em data/ mudou → 0 downloads)
// e fallback total se a API não puder ser usada (nunca pior que hoje).
// -----------------------------------------------------------------------------

import {
  MIRRORS,
  buildManifest,
  contentsApiUrl,
  dataCommitApiUrl,
  manifestDirs,
  githubRepoFromMirror,
} from './config';

/** Busca um único caminho tentando cada mirror em ordem. */
async function fetchWithMirrors(path, signal) {
  let lastError;
  for (const base of MIRRORS) {
    try {
      const res = await fetch(base + path, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${base + path}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      // tenta o próximo mirror
    }
  }
  throw lastError ?? new Error(`Falha ao buscar ${path}`);
}

/** GET numa URL da API do GitHub (JSON). Lança em status != 2xx. */
async function fetchApiJson(url, signal) {
  const res = await fetch(url, { signal, headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub API HTTP ${res.status} em ${url}`);
  return res.json();
}

/**
 * Baixa um conjunto de arquivos do compêndio.
 * @param {object} [options]
 * @param {{key:string,path:string}[]} [options.files]  subconjunto a baixar (padrão: manifest inteiro)
 * @param {(done: number, total: number) => void} [options.onProgress]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>} db parcial indexado por chave (ex: db.races)
 */
export async function fetchCompendium({ files, onProgress, signal } = {}) {
  const manifest = files ?? buildManifest();
  const total = manifest.length;
  let done = 0;

  const entries = await Promise.all(
    manifest.map(async ({ key, path }) => {
      const data = await fetchWithMirrors(path, signal);
      done += 1;
      onProgress?.(done, total);
      return [key, data];
    })
  );

  return Object.fromEntries(entries);
}

/**
 * Consulta a API do GitHub o SHA de blob de cada arquivo do manifest + o commit
 * mais recente que tocou `data/`. Lança se a API não puder ser usada (mirror não
 * é github, rate limit, rede) - quem chama cai no download completo.
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ shas: Record<string,string|null>, dataCommit: string|null }>}
 */
export async function fetchRemoteShas(signal) {
  if (!githubRepoFromMirror()) throw new Error('mirror não é github; sync por SHA indisponível');
  const [commitJson, ...listings] = await Promise.all([
    fetchApiJson(dataCommitApiUrl(), signal),
    ...manifestDirs().map((dir) => fetchApiJson(contentsApiUrl(dir), signal)),
  ]);
  // path do repo (ex: 'data/class/class-fighter.json') → SHA de blob.
  const byPath = new Map();
  for (const list of listings) {
    for (const e of Array.isArray(list) ? list : []) {
      if (e?.type === 'file') byPath.set(e.path, e.sha);
    }
  }
  const shas = {};
  for (const { key, path } of buildManifest()) shas[key] = byPath.get(`data/${path}`) ?? null;
  const dataCommit = Array.isArray(commitJson) ? (commitJson[0]?.sha ?? null) : null;
  return { shas, dataCommit };
}

/**
 * Atualização econômica do compêndio: baixa só os arquivos cujo SHA de blob
 * mudou no mirror, reaproveitando os do cache existente.
 *
 * - Fast-path: se `data/` não mudou desde o último sync (mesmo commit) e o cache
 *   está completo → 0 downloads.
 * - Diff por arquivo: baixa os ausentes, os de SHA diferente e os sem SHA remoto
 *   resolvido (por segurança).
 * - Fallback: se a API do GitHub não puder ser usada, baixa TUDO (comportamento
 *   antigo) - nunca pior que hoje; os SHAs ficam null e o próximo sync tenta a
 *   API de novo.
 *
 * @param {object} [options]
 * @param {object|null} [options.existingDb]
 * @param {Record<string,string>|null} [options.existingShas]
 * @param {string|null} [options.existingCommit]
 * @param {(done:number,total:number)=>void} [options.onProgress]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ db: object, shas: object|null, dataCommit: string|null, downloaded: number }>}
 */
export async function syncCompendium({
  existingDb = null,
  existingShas = null,
  existingCommit = null,
  onProgress,
  signal,
} = {}) {
  let remote;
  try {
    remote = await fetchRemoteShas(signal);
  } catch (err) {
    // API indisponível → download completo (sem SHAs; o próximo sync retenta a API).
    console.warn('[sync] API do GitHub indisponível, baixando o compêndio inteiro.', err);
    const db = await fetchCompendium({ onProgress, signal });
    return { db, shas: null, dataCommit: null, downloaded: buildManifest().length };
  }

  const manifest = buildManifest();
  const total = manifest.length;
  const complete = existingDb && manifest.every(({ key }) => existingDb[key] != null);

  // Fast-path: nada em data/ mudou e o cache já tem todos os arquivos.
  if (complete && existingCommit && remote.dataCommit && existingCommit === remote.dataCommit) {
    onProgress?.(total, total);
    return { db: existingDb, shas: existingShas ?? remote.shas, dataCommit: remote.dataCommit, downloaded: 0 };
  }

  // Diff por arquivo.
  const changed = manifest.filter(({ key }) =>
    !existingDb ||
    existingDb[key] == null ||
    !existingShas ||
    existingShas[key] == null ||
    remote.shas[key] == null ||
    existingShas[key] !== remote.shas[key]);

  let done = total - changed.length; // os reaproveitados já contam como prontos
  onProgress?.(done, total);
  const fresh = changed.length
    ? await fetchCompendium({
        files: changed,
        signal,
        onProgress: () => onProgress?.((done += 1), total),
      })
    : {};

  return {
    db: { ...(existingDb ?? {}), ...fresh },
    shas: remote.shas,
    dataCommit: remote.dataCommit,
    downloaded: changed.length,
  };
}
