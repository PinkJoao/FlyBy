// =============================================================================
// sourceAddress: o endereço que o usuário cola, até uma base de dados testada
// =============================================================================
// O QUE FAZ
//   O campo da fonte de dados (DDL-0091) aceita mais do que o raw da pasta
//   `data/`: o link do repositório no GitHub (com ou sem `.git`), um link de
//   `tree`, `blob` ou `raw` de um branch, um link de release (`releases/tag`,
//   `releases/download`, `releases/latest`), um raw da raiz do repo ou de um
//   arquivo, e tudo isso sem o `https://`. A interpretação é pura e síncrona; o
//   que pede a API do GitHub (o branch padrão, a última release) e a prova de
//   que a pasta tem dados no formato 5etools ficam no resolve, assíncrono.
//
// FUNÇÕES
//   withScheme(text): o texto com `https://` quando falta e parece um host.
//   withoutFile(segments): os segmentos sem o arquivo `.json` final.
//   dataFolder(segments): a pasta de dados dentro de um repo.
//   rawBase(owner, repo, ref, inside): a base raw de um ref do repo.
//   parseGithub(segments): um link de github.com (release, branch ou repo).
//   parseRaw(segments): um link raw.githubusercontent.com.
//   parseSourceAddress(text): `{ base }` já pronta, `{ owner, repo, ref }` quando
//     falta perguntar à API ('default' ou 'latest'), ou null.
//   getJson(url, fetchImpl, signal): GET de JSON que não lança fora de 2xx.
//   probe(base, fetchImpl, signal): 'ok', 'not-found' ou 'network'.
//   apiField(owner, repo, route, field, fetchImpl, signal): um campo da API do
//     repo, ou a marca de 404.
//   candidateRefs(parsed, fetchImpl, signal): os refs a tentar, ou null.
//   resolveSourceAddress(parsed, options): `{ ok, base, reason }`, com a base
//     testada; a base vem mesmo na falha quando há uma a oferecer.
//   describeProblem(result): a frase da interface para uma falha.
//
// DECISÕES E ARMADILHAS
//   - O app conhece o FORMATO, nunca um endereço (DDL-0091, Fase 5): nenhum dono
//     ou repositório real aqui, nos testes ou nos textos de dica.
//   - Tudo do GitHub vira o raw `raw.githubusercontent.com/<dono>/<repo>/<ref>/`,
//     a forma que githubRepoFromMirror (config.js) entende: assim o sync por SHA
//     segue valendo. Por isso o `refs/heads/` e o `refs/tags/` dos links raw
//     novos saem (o raw aceita o nome puro), senão o branch lido seria "refs".
//   - Dentro de um repo a pasta é cortada no ÚLTIMO segmento `data`, perde o
//     arquivo final e, vazia, vira `data`. Num host qualquer só o arquivo final
//     sai: a estrutura de um servidor alheio não é a do 5etools, e um link de
//     configuração (parseSetupParam) continua lido sem transformação nenhuma,
//     para o R2 comparar a base exata.
//   - Uma tag congela os dados naquela versão: o sync por SHA não vê nada novo
//     depois. `releases/latest` também resolve para a tag do momento.
//   - Sem resposta da API (rate limit de 60 req/h, rede), o branch padrão é
//     tentado como `main` e depois `master`; sem release, `latest` cai no branch
//     padrão. 404 na API do repo é repositório inexistente ou privado.
//   - A prova baixa arquivos PEQUENOS (PROBES) e confere a forma do JSON, não só o
//     status: um site que devolve HTML para qualquer caminho passaria por 200.
//   - fetchImpl padrão é um wrapper: `fetch` solto da `window` lança "Illegal
//     invocation" no Chrome.
// -----------------------------------------------------------------------------

import { normalizeBase, describeSource } from './dataSource';

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);
const RAW_HOST = 'raw.githubusercontent.com';
const GITHUB_API = 'https://api.github.com';
const FALLBACK_BRANCHES = ['main', 'master'];
const BRANCH_LINKS = new Set(['tree', 'blob', 'raw']);

/** Os arquivos pequenos que provam o formato 5etools, com a lista que cada um traz. */
export const PROBES = [
  { path: 'senses.json', key: 'sense' },
  { path: 'skills.json', key: 'skill' },
];

/** O texto com esquema: sem `://`, um primeiro segmento com ponto ganha `https://`. */
function withScheme(text) {
  if (text.includes('://')) return text;
  return text.split('/')[0].includes('.') ? `https://${text}` : text;
}

/** Os segmentos sem o arquivo `.json` final. */
function withoutFile(segments) {
  const last = segments[segments.length - 1];
  return last && last.toLowerCase().endsWith('.json') ? segments.slice(0, -1) : segments;
}

/** A pasta dentro do repo: corta no último `data`; vazia, é `data`. */
function dataFolder(segments) {
  let segs = withoutFile(segments);
  const at = segs.lastIndexOf('data');
  if (at !== -1) segs = segs.slice(0, at + 1);
  return segs.length ? segs.join('/') : 'data';
}

/** A base raw de um ref do repo. */
function rawBase(owner, repo, ref, inside = []) {
  return normalizeBase(`https://${RAW_HOST}/${owner}/${repo}/${ref}/${dataFolder(inside)}/`);
}

/** Um link de github.com: release, branch ou o repo puro. */
function parseGithub([owner, rawRepo, kind, ...rest]) {
  if (!owner || !rawRepo) return null;
  const repo = rawRepo.toLowerCase().endsWith('.git') ? rawRepo.slice(0, -4) : rawRepo;
  if (kind === 'releases') {
    const [mode, tag] = rest;
    if ((mode === 'tag' || mode === 'download') && tag) return { base: rawBase(owner, repo, tag) };
    return { owner, repo, ref: 'latest' };
  }
  if (BRANCH_LINKS.has(kind) && rest[0]) return { base: rawBase(owner, repo, rest[0], rest.slice(1)) };
  return { owner, repo, ref: 'default' };
}

/** Um link raw: tira o `refs/heads/` ou `refs/tags/`; sem ref, falta o branch. */
function parseRaw([owner, repo, ...rest]) {
  if (!owner || !repo) return null;
  const inside = rest[0] === 'refs' && (rest[1] === 'heads' || rest[1] === 'tags') ? rest.slice(2) : rest;
  if (!inside[0]) return { owner, repo, ref: 'default' };
  return { base: rawBase(owner, repo, inside[0], inside.slice(1)) };
}

/** O que o texto colado aponta: base pronta, repo a resolver pela API, ou null. */
export function parseSourceAddress(text) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  let u;
  try {
    u = new URL(withScheme(t));
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.host.toLowerCase();
  const segs = u.pathname.split('/').filter(Boolean);
  if (GITHUB_HOSTS.has(host)) return parseGithub(segs);
  if (host === RAW_HOST) return parseRaw(segs);
  const base = normalizeBase(`https://${host}/${withoutFile(segs).join('/')}`);
  return base ? { base } : null;
}

/** GET de JSON; `{ status }` sem corpo fora de 2xx, `{ json }` dentro, lança na rede. */
async function getJson(url, fetchImpl, signal) {
  const res = await fetchImpl(url, { signal });
  if (!res.ok) return { status: res.status };
  try {
    return { status: res.status, json: await res.json() };
  } catch {
    return { status: res.status };
  }
}

/** A prova: 'ok', 'not-found' (respondeu sem os dados) ou 'network'. */
async function probe(base, fetchImpl, signal) {
  let reached = false;
  for (const { path, key } of PROBES) {
    try {
      const { json } = await getJson(base + path, fetchImpl, signal);
      reached = true;
      if (Array.isArray(json?.[key])) return 'ok';
    } catch (e) {
      if (signal?.aborted) throw e;
    }
  }
  return reached ? 'not-found' : 'network';
}

/** O campo de uma rota da API do repo, `{ missing }` no 404, ou `{}` sem resposta útil. */
async function apiField(owner, repo, route, field, fetchImpl, signal) {
  try {
    const { status, json } = await getJson(`${GITHUB_API}/repos/${owner}/${repo}${route}`, fetchImpl, signal);
    if (status === 404) return { missing: true };
    return typeof json?.[field] === 'string' ? { value: json[field] } : {};
  } catch (e) {
    if (signal?.aborted) throw e;
    return {};
  }
}

/** Os refs a tentar, em ordem, ou null se o repo não existe. */
async function candidateRefs({ owner, repo, ref }, fetchImpl, signal) {
  if (ref === 'latest') {
    const release = await apiField(owner, repo, '/releases/latest', 'tag_name', fetchImpl, signal);
    if (release.value) return [release.value];
  }
  const repoInfo = await apiField(owner, repo, '', 'default_branch', fetchImpl, signal);
  if (repoInfo.missing) return null;
  return repoInfo.value ? [repoInfo.value] : FALLBACK_BRANCHES;
}

/**
 * Resolve o endereço interpretado até uma base testada.
 * @returns {Promise<{ ok: boolean, base: string|null, reason?: 'invalid'|'no-repo'|'not-found'|'network' }>}
 */
export async function resolveSourceAddress(parsed, { fetchImpl = (...args) => fetch(...args), signal } = {}) {
  if (!parsed) return { ok: false, base: null, reason: 'invalid' };
  if (parsed.base) {
    const result = await probe(parsed.base, fetchImpl, signal);
    return result === 'ok' ? { ok: true, base: parsed.base } : { ok: false, base: parsed.base, reason: result };
  }
  const refs = await candidateRefs(parsed, fetchImpl, signal);
  if (!refs) return { ok: false, base: null, reason: 'no-repo' };
  let reason = 'not-found';
  for (const ref of refs) {
    const base = rawBase(parsed.owner, parsed.repo, ref);
    reason = await probe(base, fetchImpl, signal);
    if (reason === 'ok') return { ok: true, base };
  }
  return { ok: false, base: rawBase(parsed.owner, parsed.repo, refs[0]), reason };
}

/** A frase da interface para uma falha do resolve. */
export function describeProblem(result) {
  const where = result?.base ? describeSource({ kind: 'url', base: result.base }) : '';
  switch (result?.reason) {
    case 'no-repo':
      return 'GitHub has no public repository at that link. Check the owner and repository name.';
    case 'not-found':
      return `No game data in the 5etools format was found at ${where}.`;
    case 'network':
      return `Could not reach ${where}. Check your connection and try again.`;
    default:
      return 'That is not a link FlyBy can read. Paste a setup link, a GitHub repository or release link, or the https:// address of a data folder.';
  }
}
