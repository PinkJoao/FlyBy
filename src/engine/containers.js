// =============================================================================
// containers: mochilas, bolsas e afins: o que guarda o quê, e o que pesa
// =============================================================================
// O QUE FAZ
//   Uma entrada de inventário pode declarar `container: <uid>`, apontando para outra
//   entrada, na mesma forma do `system.container` do Foundry (export e import
//   diretos; DDL-0082). Campo ADITIVO: uma ficha antiga não tem nada dentro de nada.
//
// FUNÇÕES
//   norm(s): normalização.
//   isContainerName(name, custom), containerProps(name), isWeightless(name): o
//     item é contêiner, com que capacidade, e o conteúdo pesa?
//   byUid(entries): índice uid para entrada.
//   weightCounts(entry, index, nameOf), weightContext(entries, nameOf): o peso de
//     uma entrada conta no total?
//   contentsOf(entries, uid): o que está DIRETAMENTE dentro.
//   wouldCycle(entries, uid, targetUid): mover criaria um ciclo?
//   orphanContents(inventory, removedUids): solta o conteúdo de um contêiner
//     removido (nunca some).
//
// DECISÕES E ARMADILHAS
//   - O que é contêiner sai do SRD, não de curadoria: EQUIPMENT_TYPES marca 36
//     itens, e CONTAINER_PROPS traz `weightless` e `capacity`. Nenhum dos dois é
//     derivável (a Bag of Holding "weighs 5 pounds, regardless of its contents" só
//     na prosa). Um item custom usa o `fType` do snapshot.
//   - Peso pelo RAW: o conteúdo de um contêiner `weightless` não conta; o de um
//     mundano conta; o próprio contêiner conta sempre. Um item não conta se
//     QUALQUER ancestral for weightless (o Handy Haversack tem três bolsas).
//   - `container` apontando para um uid inexistente é tratado como solto. MAX_DEPTH
//     é a rede contra um ciclo vindo de dado corrompido.
// -----------------------------------------------------------------------------

import { equipmentFoundryType } from './compendiumUuids';
import { CONTAINER_PROPS } from './compendiumUuidsData';

const norm = (s) => String(s ?? '').trim().toLowerCase();

const MAX_DEPTH = 32;

/**
 * O item é um contêiner (pelo nome, via SRD, ou pelo snapshot custom)?
 * @param {string} name
 * @param {object|null} [custom]
 */
export function isContainerName(name, custom = null) {
  if (custom?.fType === 'container') return true;
  return equipmentFoundryType(name)?.type === 'container';
}

/** { weightless, capacity } do contêiner, ou null. */
export function containerProps(name) {
  return CONTAINER_PROPS[norm(name)] ?? null;
}

/** O conteúdo deste contêiner não conta no peso? */
export function isWeightless(name) {
  return containerProps(name)?.weightless === true;
}

/**
 * Índice uid para entrada.
 * @param {object[]} entries
 */
function byUid(entries) {
  const map = new Map();
  for (const e of entries ?? []) if (e?.uid) map.set(e.uid, e);
  return map;
}

/**
 * O peso desta entrada conta no total carregado?
 * @param {object} entry
 * @param {Map<string, object>} index
 * @param {(entry: object) => string} nameOf
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
 * Marca cada entrada com weightCounts e devolve o índice.
 * @param {object[]} entries
 * @param {(entry: object) => string} nameOf
 * @returns {{index: Map<string, object>, counts: (entry: object) => boolean}}
 */
export function weightContext(entries, nameOf) {
  const index = byUid(entries);
  return { index, counts: (entry) => weightCounts(entry, index, nameOf) };
}

/** As entradas diretamente dentro de um contêiner. */
export function contentsOf(entries, uid) {
  return (entries ?? []).filter((e) => e?.container === uid);
}

/**
 * Mover `uid` para dentro de `targetUid` criaria um ciclo?
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
 * Solta o conteúdo das entradas removidas.
 * @param {object[]} inventory
 * @param {Set<string>|string[]} removedUids
 */
export function orphanContents(inventory, removedUids) {
  const gone = new Set(removedUids);
  return (inventory ?? []).map((e) =>
    (e.container && gone.has(e.container) ? { ...e, container: null } : e));
}
