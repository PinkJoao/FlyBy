// =============================================================================
// containers - mochilas, bolsas e afins: o que guarda o quê, e o que pesa
// =============================================================================
// Puro: sem rede/DOM. Uma entrada de inventário pode declarar `container: <uid>`,
// apontando para OUTRA entrada - a mesma forma do `system.container` do Foundry,
// e por isso o export/import é direto. Campo ADITIVO (sem bump de schema): uma
// ficha salva antes disto simplesmente não tem ninguém dentro de nada.
//
// **O que é contêiner sai do SRD, não de curadoria:** `EQUIPMENT_TYPES` marca 36
// itens como `container` (mochila, bolsa, saco, baú, aljava, Bag of Holding…), e
// `CONTAINER_PROPS` traz `weightless` + `capacity` de cada um. Nenhum dos dois é
// derivável do 5etools - que a Bag of Holding "weighs 5 pounds, regardless of
// its contents" está só na PROSA dela.
//
// **A regra de peso é o RAW:** o conteúdo de um contêiner `weightless` não conta
// no peso carregado; o de um mundano conta. O peso do PRÓPRIO contêiner conta
// sempre (é ele que você carrega). Como um contêiner pode estar dentro de outro
// (o Handy Haversack tem três bolsas), a pergunta é sobre a CADEIA de pais: um
// item não conta se QUALQUER ancestral for weightless.
// -----------------------------------------------------------------------------

import { equipmentFoundryType } from './compendiumUuids';
import { CONTAINER_PROPS } from './compendiumUuidsData';

const norm = (s) => String(s ?? '').trim().toLowerCase();

/** Profundidade máxima ao subir a cadeia de pais - rede contra um ciclo que
 * tenha entrado por dado corrompido ou por um ator externo malformado. */
const MAX_DEPTH = 32;

/**
 * O item é um contêiner? Vale para um item do catálogo (pelo nome, via SRD) e
 * para um item CUSTOM importado (que carrega o próprio `fType` do Foundry).
 * @param {string} name  nome do item
 * @param {object|null} [custom]  snapshot Foundry de um item não-catalogado
 */
export function isContainerName(name, custom = null) {
  if (custom?.fType === 'container') return true;
  return equipmentFoundryType(name)?.type === 'container';
}

/** `{weightless, capacity}` do contêiner, ou null se o item não for um. */
export function containerProps(name) {
  return CONTAINER_PROPS[norm(name)] ?? null;
}

/** O conteúdo deste contêiner não conta no peso carregado? */
export function isWeightless(name) {
  return containerProps(name)?.weightless === true;
}

/**
 * Índice uid → entrada, para subir a cadeia de pais sem varrer a lista a cada
 * passo.
 * @param {object[]} entries  entradas de inventário (cruas ou derivadas)
 */
function byUid(entries) {
  const map = new Map();
  for (const e of entries ?? []) if (e?.uid) map.set(e.uid, e);
  return map;
}

/**
 * O peso desta entrada conta no total carregado? Não conta quando ALGUM
 * ancestral é um contêiner weightless. Um `container` apontando para um uid que
 * não existe é tratado como solto (degrada em vez de sumir).
 * @param {object} entry
 * @param {Map<string, object>} index
 * @param {(entry: object) => string} nameOf  como obter o nome de uma entrada
 */
function weightCounts(entry, index, nameOf) {
  let parent = entry?.container ? index.get(entry.container) : null;
  for (let depth = 0; parent && depth < MAX_DEPTH; depth += 1) {
    if (isWeightless(nameOf(parent))) return false;
    parent = parent.container ? index.get(parent.container) : null;
  }
  return true;
}

/**
 * Marca cada entrada com `weightCounts` (se o peso dela entra no total) e devolve
 * o índice, para o chamador não montá-lo duas vezes.
 * @param {object[]} entries
 * @param {(entry: object) => string} nameOf
 * @returns {{index: Map<string, object>, counts: (entry: object) => boolean}}
 */
export function weightContext(entries, nameOf) {
  const index = byUid(entries);
  return { index, counts: (entry) => weightCounts(entry, index, nameOf) };
}

/** As entradas DIRETAMENTE dentro de um contêiner (não recursivo). */
export function contentsOf(entries, uid) {
  return (entries ?? []).filter((e) => e?.container === uid);
}

/**
 * Mover `uid` para dentro de `targetUid` criaria um ciclo? (Um contêiner não pode
 * acabar dentro de si mesmo, direta ou indiretamente.) `targetUid` null = tirar
 * de qualquer contêiner, que nunca cria ciclo.
 * @param {object[]} entries
 * @param {string} uid
 * @param {string|null} targetUid
 */
export function wouldCycle(entries, uid, targetUid) {
  if (!targetUid) return false;
  if (targetUid === uid) return true;
  const index = byUid(entries);
  let node = index.get(targetUid);
  for (let depth = 0; node && depth < MAX_DEPTH; depth += 1) {
    if (node.uid === uid) return true;
    node = node.container ? index.get(node.container) : null;
  }
  return false;
}

/**
 * Tira do contêiner tudo que estava dentro das entradas removidas, em vez de
 * deixar os filhos apontando para um pai que não existe mais. Usado ao remover
 * um contêiner do inventário: o conteúdo volta a ser item solto, nunca some.
 * @param {object[]} inventory  o array CRU do personagem
 * @param {Set<string>|string[]} removedUids
 */
export function orphanContents(inventory, removedUids) {
  const gone = new Set(removedUids);
  return (inventory ?? []).map((e) =>
    (e.container && gone.has(e.container) ? { ...e, container: null } : e));
}
