// =============================================================================
// setupLink: o link de configuração da fonte de dados (Fase 4, DDL-0091)
// =============================================================================
// O QUE FAZ
//   O autor manda à mesa um link do próprio site com `?fonte=<endereço>`. Na
//   primeira abertura ele configura a fonte; depois, clicar de novo no MESMO link
//   não faz nada (R2). Este módulo lê e limpa o link, interpreta o que o jogador
//   cola no campo (um endereço ou o link inteiro), monta o link a copiar, e
//   decide o que o boot faz com a fonte gravada e o link (decideBoot).
//
// FUNÇÕES
//   parseSetupParam(search): a base do `?fonte=` de uma query string, ou null.
//   sourceFromInput(text): o endereço interpretado (parseSourceAddress) de um
//     endereço OU de um link de configuração colado, ou null.
//   resolveSourceInput(text, options): o mesmo, resolvido e testado
//     (resolveSourceAddress); é o que os campos de endereço chamam.
//   buildSetupLink(origin, base): o link a copiar.
//   takeSetupLink(): lê o link da página UMA vez e tira o parâmetro da URL.
//   decideBoot({ stored, link }): 'boot' (com a fonte), 'first' (primeira
//     visita) ou 'confirm' (link de fonte nova ou diferente).
//
// DECISÕES E ARMADILHAS
//   - R2: link com a MESMA fonte gravada vira 'boot' direto, sem tela nenhuma; o
//     boot segue cache-first, então nada é baixado de novo. Os jogadores vão usar
//     o link de configuração como se fosse o link do site.
//   - Fonte NOVA sempre confirma, mesmo sem fonte gravada: sem isso, um link de
//     terceiro trocaria a fonte de quem clicasse.
//   - takeSetupLink roda na carga do MÓDULO, antes do React: um inicializador de
//     estado roda duas vezes no StrictMode, e a segunda leitura veria a URL já
//     limpa. O parâmetro sai com replaceState, então o favorito salvo depois é o
//     link limpo e um recarregamento não repete a pergunta.
//   - O jogador de iPhone com o app instalado não consegue abrir o link DENTRO
//     do app (o link abre no Safari): por isso o campo aceita o link inteiro
//     colado, e sourceFromInput extrai o endereço.
//   - O `?fonte=` é lido com normalizeBase PURO, sem as formas do GitHub: o link
//     é gerado pelo app a partir da base gravada, e o R2 compara a base exata.
// -----------------------------------------------------------------------------

import { normalizeBase, sameSource } from './dataSource';
import { parseSourceAddress, resolveSourceAddress } from './sourceAddress';

const PARAM = 'fonte';

/** A base do `?fonte=` de uma query string, ou null. */
export function parseSetupParam(search) {
  try {
    const raw = new URLSearchParams(search ?? '').get(PARAM);
    return raw ? normalizeBase(raw) : null;
  } catch {
    return null;
  }
}

/** O endereço interpretado do que foi colado: link de configuração ou endereço. */
export function sourceFromInput(text) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  try {
    const fromParam = parseSetupParam(new URL(t).search);
    if (fromParam) return { base: fromParam };
  } catch {
    /* sem esquema: segue como endereço */
  }
  return parseSourceAddress(t);
}

/** O que foi colado, resolvido e testado (resolveSourceAddress). */
export function resolveSourceInput(text, options) {
  return resolveSourceAddress(sourceFromInput(text), options);
}

/** O link de configuração a copiar. */
export function buildSetupLink(origin, base) {
  return `${String(origin).replace(/\/$/, '')}/?${PARAM}=${encodeURIComponent(base)}`;
}

let taken;

/** Lê o link da página uma vez só e tira o parâmetro da URL. */
export function takeSetupLink() {
  if (taken !== undefined) return taken;
  taken = null;
  if (typeof window === 'undefined') return taken;
  const params = new URLSearchParams(window.location.search);
  if (!params.has(PARAM)) return taken;
  const base = parseSetupParam(window.location.search);
  taken = base ? { kind: 'url', base } : { kind: 'invalid' };
  params.delete(PARAM);
  const query = params.toString();
  const clean = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  try {
    window.history.replaceState(window.history.state, '', clean);
  } catch {
    /* sem history: o parâmetro fica, e a decisão segue igual */
  }
  return taken;
}

/**
 * O que o boot faz com a fonte gravada e o link de configuração.
 * @param {{ stored: object|null, link: object|null }} args
 * @returns {{ action: 'boot'|'first'|'confirm', source?: object, link?: object }}
 */
export function decideBoot({ stored, link }) {
  const valid = link?.kind === 'url' ? link : null;
  if (valid && !sameSource(stored, valid)) return { action: 'confirm', link: valid };
  if (stored) return { action: 'boot', source: stored };
  return { action: 'first' };
}
