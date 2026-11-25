// =============================================================================
// bestiary: as criaturas, sob demanda, da fonte configurada ou do pacote do SRD
// =============================================================================
// O QUE FAZ
//   O bestiário não entra no manifesto do compêndio (4.528 criaturas, 12 MB em 107
//   arquivos): só a ficha que precisa de uma criatura (um summon, o Wild Shape, o
//   FlyBy do mestre) o pede. Na fonte SRD as 335 criaturas do SRD 5.2 já vêm no
//   pacote embutido (`db.bestiary`); na fonte configurada, a primeira chamada
//   baixa o `bestiary/index.json` e todos os arquivos listados nele, junta as
//   criaturas e guarda no aparelho. Plano: docs/SUMMONS-TRANSFORMATIONS-PLAN.md
//   (U2 e U3, DDL-0189).
//
// FUNÇÕES
//   bestiaryFromDb(db): as criaturas que o db já traz (o pacote do SRD), ou null.
//   readBestiaryCache(source): o bestiário guardado para esta fonte, ou null.
//   fetchBestiary(base, signal): baixa o índice e todos os arquivos dele, e os
//     objetos que uma feature cria (`objects.json`, objectSummons).
//   loadBestiary(options): as criaturas para a fonte ativa (pacote, cache ou rede).
//
// DECISÕES E ARMADILHAS
//   - Guardado no `kv` (chave BESTIARY_KEY), NÃO na tabela do compêndio: o
//     `writeCache` da sincronização apaga a tabela inteira, e o bestiário iria
//     junto a cada atualização mensal.
//   - O cache vale para a MESMA fonte (`sameSource`) e por CACHE_TTL (30 dias), como
//     o compêndio; trocar a fonte baixa de novo.
//   - Arquivo do índice que dá 404 fica de fora (MISSING) em vez de derrubar o
//     resto, como no compêndio; índice que não existe é erro (a fonte não tem
//     bestiário).
//   - O Eldritch Cannon é objeto (S4, DDL-0194): o `objects.json` vem junto, e só os
//     criados por feature entram. A chave ganhou `:v2` para o cache antigo, sem
//     eles, baixar de novo.
// -----------------------------------------------------------------------------

import db from './db';
import { CACHE_TTL } from './config';
import { fetchWithMirrors, MISSING } from './fetcher';
import { sameSource } from './dataSource';
import { objectSummons } from '../engine/creature';

const BESTIARY_KEY = 'bestiary:data:v2';

/** As criaturas que o db já traz (o pacote do SRD), ou null. */
export function bestiaryFromDb(dbObj) {
  const list = dbObj?.bestiary?.monster;
  return Array.isArray(list) && list.length ? list : null;
}

/** O bestiário guardado para esta fonte e ainda na validade, ou null. */
export async function readBestiaryCache(source) {
  const row = await db.kv.get(BESTIARY_KEY);
  const v = row?.value;
  if (!v || !sameSource(v.source, source) || Date.now() - (v.savedAt ?? 0) > CACHE_TTL) return null;
  return Array.isArray(v.monster) ? v.monster : null;
}

/**
 * Baixa o índice do bestiário e todos os arquivos dele.
 * @param {string} base
 * @param {AbortSignal} [signal]
 * @returns {Promise<object[]>}
 */
export async function fetchBestiary(base, signal) {
  const index = await fetchWithMirrors('bestiary/index.json', signal, [base]);
  if (index === MISSING || !index || typeof index !== 'object') throw new Error('A fonte não tem o bestiário (bestiary/index.json).');
  const files = [...new Set(Object.values(index).filter((f) => typeof f === 'string'))];
  const [parts, objects] = await Promise.all([
    Promise.all(files.map((f) => fetchWithMirrors(`bestiary/${f}`, signal, [base]))),
    fetchWithMirrors('objects.json', signal, [base]),
  ]);
  return [...parts.filter((p) => p !== MISSING).flatMap((p) => p?.monster ?? []), ...objectSummons(objects === MISSING ? [] : objects?.object)];
}

/**
 * As criaturas para a fonte ativa: o pacote do SRD, o cache do aparelho ou a rede.
 * @param {{ db?: object, source?: object|null, signal?: AbortSignal }} options
 * @returns {Promise<object[]>}
 */
export async function loadBestiary({ db: dbObj = null, source = null, signal } = {}) {
  const bundled = bestiaryFromDb(dbObj);
  if (bundled || source?.kind === 'srd' || !source?.base) return bundled ?? [];
  const cached = await readBestiaryCache(source);
  if (cached) return cached;
  const monster = await fetchBestiary(source.base, signal);
  await db.kv.put({ key: BESTIARY_KEY, value: { source, savedAt: Date.now(), monster } });
  return monster;
}
