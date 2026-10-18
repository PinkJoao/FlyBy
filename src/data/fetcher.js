// =============================================================================
// fetcher: o download do compêndio 5etools
// =============================================================================
// O QUE FAZ
//   Baixa os arquivos do manifest tentando cada mirror em ordem até um responder.
//   A estratégia econômica é o syncCompendium: em vez de re-baixar TUDO a cada
//   expiração do cache, pergunta à API do GitHub o SHA de blob de cada arquivo e
//   baixa pelo raw SÓ o que mudou, o que poupa a banda do GitHub do 5etools
//   (DDL-0036).
//
// FUNÇÕES
//   fetchWithMirrors(path, signal, bases): um caminho, tentando cada base; 404
//     em todas devolve MISSING.
//   fetchApiJson(url, signal): GET na API do GitHub; lança fora de 2xx.
//   fetchCompendium(options): baixa um conjunto de arquivos (o manifest inteiro
//     por padrão), com progresso e cancelamento.
//   fetchRemoteShas(signal, base): o SHA de cada arquivo e o commit de data/;
//     lança se a API não puder ser usada.
//   syncCompendium(options): a atualização econômica.
//
// DECISÕES E ARMADILHAS
//   - Fast-path: se data/ não mudou desde o último sync (mesmo commit) E o cache
//     está completo, 0 downloads. Mesmo commit com cache incompleto não pula.
//   - Diff por arquivo: baixa os ausentes, os de SHA diferente e os sem SHA
//     remoto resolvido, por segurança. Os reaproveitados contam como prontos no
//     progresso.
//   - Fallback: sem a API (mirror fora do GitHub, rate limit, rede), baixa TUDO e
//     grava os SHAs como null; o próximo sync tenta a API de novo. Nunca é pior do
//     que o download completo.
//   - A fonte é do USUÁRIO (DDL-0091): um arquivo que ela não tem (404) fica de
//     fora e volta em `missing`, em vez de derrubar o Promise.all inteiro; o
//     engine degrada sem a chave. Erro de REDE continua lançando (o cache vale).
//     Fonte sem arquivo nenhum lança: é endereço errado, não fonte parcial.
//   - `existingMissing` conta como completo, senão o fast-path nunca valeria
//     numa fonte parcial e ela pediria os mesmos 404 a cada abertura.
// -----------------------------------------------------------------------------

import {
  buildManifest,
  contentsApiUrl,
  dataCommitApiUrl,
  manifestDirs,
  githubRepoFromMirror,
} from './config';

/** O arquivo que a fonte não tem (404 em todas as bases). */
export const MISSING = Symbol('missing');

/** Busca um caminho tentando cada base em ordem; 404 em todas devolve MISSING. */
async function fetchWithMirrors(path, signal, bases) {
  let lastError;
  let notFound = 0;
  for (const base of bases) {
    try {
      const res = await fetch(base + path, { signal });
      if (res.status === 404) {
        notFound += 1;
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${base + path}`);
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  if (notFound === bases.length) return MISSING;
  throw lastError ?? new Error(`Falha ao buscar ${path}`);
}

/** GET numa URL da API do GitHub; lança em status fora de 2xx. */
async function fetchApiJson(url, signal) {
  const res = await fetch(url, { signal, headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub API HTTP ${res.status} em ${url}`);
  return res.json();
}

/**
 * Baixa um conjunto de arquivos do compêndio.
 * @param {object} [options]
 * @param {{key:string,path:string}[]} [options.files]
 * @param {(done: number, total: number) => void} [options.onProgress]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
export async function fetchCompendium({ files, onProgress, signal, base } = {}) {
  const manifest = files ?? buildManifest();
  const total = manifest.length;
  if (!base) throw new Error('Nenhuma fonte de dados configurada.');
  const bases = [base];
  let done = 0;

  const entries = await Promise.all(
    manifest.map(async ({ key, path }) => {
      const data = await fetchWithMirrors(path, signal, bases);
      done += 1;
      onProgress?.(done, total);
      return [key, data];
    })
  );

  const found = entries.filter(([, data]) => data !== MISSING);
  if (manifest.length && !found.length) throw new Error('A fonte não tem nenhum arquivo do compêndio.');
  return Object.fromEntries(found);
}

/**
 * O SHA de cada arquivo do manifest e o commit de data/.
 * @param {AbortSignal} [signal]
 * @param {string} [base]
 * @returns {Promise<{ shas: Record<string,string|null>, dataCommit: string|null }>}
 */
export async function fetchRemoteShas(signal, base) {
  const repo = githubRepoFromMirror(base);
  if (!repo) throw new Error('mirror não é github; sync por SHA indisponível');
  const [commitJson, ...listings] = await Promise.all([
    fetchApiJson(dataCommitApiUrl(repo), signal),
    ...manifestDirs().map((dir) => fetchApiJson(contentsApiUrl(dir, repo), signal)),
  ]);
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
 * Atualiza o compêndio baixando só os arquivos que mudaram.
 * @param {object} [options]
 * @param {object|null} [options.existingDb]
 * @param {Record<string,string>|null} [options.existingShas]
 * @param {string|null} [options.existingCommit]
 * @param {(done:number,total:number)=>void} [options.onProgress]
 * @param {AbortSignal} [options.signal]
 * @param {string} [options.base]
 * @param {string[]} [options.existingMissing]
 * @returns {Promise<{ db: object, shas: object|null, dataCommit: string|null, downloaded: number, missing: string[] }>}
 */
export async function syncCompendium({
  existingDb = null,
  existingShas = null,
  existingCommit = null,
  existingMissing = [],
  onProgress,
  signal,
  base,
} = {}) {
  const manifest = buildManifest();
  const missingOf = (db) => manifest.filter(({ key }) => db?.[key] == null).map(({ key }) => key);

  let remote;
  try {
    remote = await fetchRemoteShas(signal, base);
  } catch (err) {
    console.warn('[sync] API do GitHub indisponível, baixando o compêndio inteiro.', err);
    const db = await fetchCompendium({ onProgress, signal, base });
    return { db, shas: null, dataCommit: null, downloaded: manifest.length, missing: missingOf(db) };
  }

  const total = manifest.length;
  const known = new Set(existingMissing ?? []);
  const complete = existingDb && manifest.every(({ key }) => existingDb[key] != null || known.has(key));

  if (complete && existingCommit && remote.dataCommit && existingCommit === remote.dataCommit) {
    onProgress?.(total, total);
    return { db: existingDb, shas: existingShas ?? remote.shas, dataCommit: remote.dataCommit, downloaded: 0, missing: missingOf(existingDb) };
  }

  const changed = manifest.filter(({ key }) =>
    !existingDb ||
    existingDb[key] == null ||
    !existingShas ||
    existingShas[key] == null ||
    remote.shas[key] == null ||
    existingShas[key] !== remote.shas[key]);

  let done = total - changed.length;
  onProgress?.(done, total);
  const fresh = changed.length
    ? await fetchCompendium({
        files: changed,
        signal,
        base,
        onProgress: () => onProgress?.((done += 1), total),
      })
    : {};

  const merged = { ...(existingDb ?? {}), ...fresh };
  return {
    db: merged,
    shas: remote.shas,
    dataCommit: remote.dataCommit,
    downloaded: changed.length,
    missing: missingOf(merged),
  };
}
