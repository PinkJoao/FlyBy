// =============================================================================
// dataSource: de onde o app tira o compêndio (DDL-0091, "traga seus dados")
// =============================================================================
// O QUE FAZ
//   A fonte é uma CONFIGURAÇÃO do usuário, guardada no IndexedDB (tabela kv):
//     { kind: 'srd' }: o pacote SRD 5.2 embutido (src/data/srdBundle.json), sem
//       rede nenhuma.
//     { kind: 'url', base }: uma pasta `data/` no formato do 5etools, terminando
//       em `/`; o sync por SHA vale quando é um raw do GitHub.
//
// FUNÇÕES
//   normalizeBase(url): a base comparável (https, host minúsculo, barra final),
//     ou null se não serve.
//   sameSource(a, b): as duas fontes são a mesma?
//   describeSource(src): o rótulo curto para a interface.
//   readSource(): a fonte configurada, ou null.
//   writeSource(src): grava a fonte (normalizada).
//
// DECISÕES E ARMADILHAS
//   - Sem fonte configurada, o app PERGUNTA (a primeira visita, Fase 3); não há
//     fonte padrão, e nenhum endereço mora no código (Fase 5). O cache de antes
//     da Fase 2 é reconhecido pelo CONTEÚDO, não pelo endereço (useDataEngine).
//   - SOURCE_PLACEHOLDER mostra a forma de um raw do GitHub com o dono e o repo
//     mascarados: ajuda a reconhecer o endereço sem pôr nenhum no código (Fase 5).
//   - `https` obrigatório: uma fonte http seria bloqueada como conteúdo misto no
//     site publicado, e falharia sem explicação.
// -----------------------------------------------------------------------------

import db from './db';

const SOURCE_KEY = 'dataSource';

export const SRD_SOURCE = Object.freeze({ kind: 'srd' });

/** O texto de dica dos campos de endereço: a FORMA esperada, sem endereço real. */
export const SOURCE_PLACEHOLDER = 'https://raw.githubusercontent.com/.../main/data/';

/** A base comparável, ou null se não serve. */
export function normalizeBase(url) {
  let u;
  try {
    u = new URL(String(url ?? '').trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  u.hash = '';
  u.search = '';
  const path = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
  return `https://${u.host.toLowerCase()}${path}`;
}

/** As duas fontes são a mesma? */
export function sameSource(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'srd') return true;
  return normalizeBase(a.base) === normalizeBase(b.base);
}

/** O rótulo curto para a interface. */
export function describeSource(src) {
  if (!src) return 'Not configured';
  if (src.kind === 'srd') return 'SRD 5.2 (built in)';
  try {
    const u = new URL(src.base);
    return `${u.host}${u.pathname}`;
  } catch {
    return String(src.base ?? '');
  }
}

/** A fonte configurada, ou null. */
export async function readSource() {
  try {
    const row = await db.kv.get(SOURCE_KEY);
    const v = row?.value;
    if (v?.kind === 'srd') return SRD_SOURCE;
    if (v?.kind === 'url' && normalizeBase(v.base)) return { kind: 'url', base: normalizeBase(v.base) };
  } catch {
    /* banco indisponível: segue sem fonte gravada */
  }
  return null;
}

/** Grava a fonte (normalizada); lança se a URL não serve. */
export async function writeSource(src) {
  let value;
  if (src?.kind === 'srd') value = { kind: 'srd' };
  else {
    const base = normalizeBase(src?.base);
    if (!base) throw new Error('A fonte precisa ser um endereço https.');
    value = { kind: 'url', base };
  }
  await db.kv.put({ key: SOURCE_KEY, value });
  return value;
}
