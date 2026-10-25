// =============================================================================
// imageProxy: imagem da web legível (CORS), direto ou pelo cache público wsrv.nl
// =============================================================================
// O QUE FAZ
//   Algumas telas precisam LER os pixels de uma imagem de outro domínio (o PDF
//   redesenha o retrato num canvas; o download baixa o arquivo). Isso só funciona
//   quando o servidor manda `Access-Control-Allow-Origin`. Aqui tenta-se direto e,
//   se o servidor não mandar, pelo wsrv.nl, um cache de imagens aberto que devolve
//   a mesma imagem COM o cabeçalho.
//
// FUNÇÕES
//   corsProxyUrl(src): a URL do wsrv.nl para uma imagem http(s), ou null.
//   knownNoCors(src): o domínio da imagem está em NO_CORS_HOSTS.
//   decodeCors(src): carrega com `crossOrigin = 'anonymous'` e espera decodificar.
//   loadCorsImage(src): uma <img> decodificada e legível pelo canvas (direto, depois
//     pelo proxy); rejeita se nenhuma das duas der.
//   fetchImageBlob(src): o arquivo da imagem como Blob (direto, depois pelo proxy).
//
// DECISÕES E ARMADILHAS
//   - O i.pinimg.com, de onde vêm TODOS os retratos sugeridos, não manda CORS
//     (medido em 2026-10-25): sem o proxy, o PDF perdia o retrato em silêncio
//     (DDL-0127). O proxy só recebe a URL pública da imagem, nada do personagem, e
//     só é chamado quando o caminho direto falha ou nem tem como dar.
//   - data: e blob: são do próprio app: vão direto, sem proxy.
//   - Uma tentativa direta que falha por CORS deixa um erro no console e custa uma
//     ida e volta: os domínios que SABIDAMENTE não mandam CORS (NO_CORS_HOSTS,
//     medidos) vão direto ao proxy; o resto tenta direto primeiro.
// -----------------------------------------------------------------------------

const PROXY = 'https://wsrv.nl/?url=';
const NO_CORS_HOSTS = new Set(['i.pinimg.com']);

/** O domínio da imagem sabidamente não manda CORS. */
function knownNoCors(src) {
  try {
    return NO_CORS_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

/**
 * A URL do cache wsrv.nl para uma imagem http(s); null para data:, blob: e o resto.
 * @param {string} src
 */
export function corsProxyUrl(src) {
  if (!/^https?:\/\//i.test(String(src || ''))) return null;
  return `${PROXY}${encodeURIComponent(src)}`;
}

/** Carrega uma imagem com `crossOrigin = 'anonymous'`, resolvendo quando decodificar. */
function decodeCors(src) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  return img.decode().then(() => img);
}

/**
 * Uma imagem decodificada que o canvas pode ler: direto, ou pelo proxy.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export async function loadCorsImage(src) {
  if (knownNoCors(src)) return decodeCors(corsProxyUrl(src));
  try {
    return await decodeCors(src);
  } catch (err) {
    const proxied = corsProxyUrl(src);
    if (!proxied) throw err;
    return decodeCors(proxied);
  }
}

/**
 * O arquivo da imagem como Blob: direto, ou pelo proxy.
 * @param {string} src
 * @returns {Promise<Blob>}
 */
export async function fetchImageBlob(src) {
  const get = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  };
  if (knownNoCors(src)) return get(corsProxyUrl(src));
  try {
    return await get(src);
  } catch (err) {
    const proxied = corsProxyUrl(src);
    if (!proxied) throw err;
    return get(proxied);
  }
}
