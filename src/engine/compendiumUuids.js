// =============================================================================
// compendiumUuids: os uuids de compêndio do dnd5e
// =============================================================================
// O QUE FAZ
//   A API de consulta sobre o registro gerado (compendiumUuidsData.js, por `npm
//   run gen:uuids`). No Foundry, quem concede as features de um nível é o
//   advancement do item de classe: um ItemGrant por nível apontando para o
//   compêndio, presente INTEIRO (1 a 20) desde o nível 1 nos premades. Sem essa
//   escada, subir de nível dentro do Foundry não concede nada (DDL-0055). Os
//   níveis já alcançados usam o uuid RELATIVO do item embutido; só os futuros
//   precisam do compêndio, e aí só existe o que o dnd5e publica.
//
// FUNÇÕES
//   norm(s), subclassKeys(classId, subclass): normalização e chaves.
//   classFeatureUuid(classId, featureName), subclassUuid(classId, subclass),
//     subclassFeatureUuid(classId, subclass, featureName), classUuid(classId): os
//     uuids de classe e subclasse.
//   subclassIdentifier(classId, subclass): o `system.identifier` canônico.
//   spellUuid(spellName): o uuid de uma magia.
//   flatUuid(map, pack, name), originUuid(name), featUuid(name),
//     equipmentUuid(name): a procedência (`_stats.compendiumSource`).
//   srdSpeciesName(raceObj), suffixMatch(pool, base, name), srdOriginName(name):
//     os nomes que o dnd5e dá à mesma espécie e ao mesmo traço.
//   equipmentFoundryType(name): { type, subtype } de inventário, ou null.
//
// DECISÕES E ARMADILHAS
//   - Sem uuid, sem escada: conteúdo fora do SRD (Artificer, subclasses não SRD)
//     não ganha passo futuro, e apontar para um near-match faria o Foundry trocar o
//     conteúdo do jogador.
//   - Procedência é por nome EXATO: um item que difere do publicado (linhagem
//     mesclada, "+1 Longsword") fica sem, o que é correto.
//   - Apóstrofo tipográfico vira reto dos dois lados (o gerador faz o mesmo).
//   - Subclasse casa pelo nome COMPLETO; o shortName é rede. O identificador do
//     SRD é citado em fórmula (`@subclasses.hand.levels`) e não sai do nome
//     (TC-0074).
//   - Magia de nome próprio também pelo nome CURTO do SRD (TC-0079): é o mesmo
//     documento, não um near-match.
//   - srdSpeciesName é DERIVADO: nome idêntico; mesma base com a palavra-chave do
//     sufixo do SRD contida no nosso ("High" em "High Elf Lineage"; ambíguo não
//     casa); a base nua só quando o documento guarda a linhagem dentro de si
//     (SPECIES_SELF_LINEAGE: o Dragonborn). srdOriginName faz o mesmo com traços;
//     sem casamento numa espécie publicada, o traço não é documento lá.
//   - equipmentFoundryType: o tipo decide equipar ou consumir e NÃO sai do código
//     do 5etools (o `G` vira loot, equipment ou consumable item a item; TC-0066).
// -----------------------------------------------------------------------------

import {
  PACK_CLASSES,
  PACK_SPELLS,
  PACK_ORIGINS,
  PACK_FEATS,
  PACK_EQUIPMENT,
  CLASS_IDS,
  CLASS_FEATURE_IDS,
  SUBCLASS_IDS,
  SUBCLASS_FEATURE_IDS,
  SPELL_IDS,
  ORIGIN_IDS,
  FEAT_IDS,
  EQUIPMENT_IDS,
  EQUIPMENT_TYPES,
  SUBCLASS_IDENTIFIERS,
  SPECIES_NAMES,
  SPECIES_SELF_LINEAGE,
  ORIGIN_NAMES,
} from './compendiumUuidsData';
import { srdSpellNames } from './spells';

const norm = (s) => (s ?? '').toString().trim().toLowerCase().replace(/’/g, "'");

/** Os nomes pelos quais uma subclasse pode ser procurada. */
function subclassKeys(classId, subclass) {
  const cid = norm(classId);
  return [norm(subclass?.name), norm(subclass?.shortName)].filter(Boolean).map((n) => `${cid}|${n}`);
}

/**
 * O uuid de uma feature de classe, ou null.
 * @param {string} classId
 * @param {string} featureName
 * @returns {string|null}
 */
export function classFeatureUuid(classId, featureName) {
  const id = CLASS_FEATURE_IDS[`${norm(classId)}|${norm(featureName)}`];
  return id ? `${PACK_CLASSES}.${id}` : null;
}

/**
 * O uuid de uma subclasse, ou null.
 * @param {string} classId
 * @param {{name?: string, shortName?: string}} subclass
 * @returns {string|null}
 */
export function subclassUuid(classId, subclass) {
  for (const k of subclassKeys(classId, subclass)) {
    if (SUBCLASS_IDS[k]) return `${PACK_CLASSES}.${SUBCLASS_IDS[k]}`;
  }
  return null;
}

/**
 * O `system.identifier` canônico de uma subclasse publicada, ou null.
 * @param {string} classId
 * @param {{name?: string, shortName?: string}} subclass
 * @returns {string|null}
 */
export function subclassIdentifier(classId, subclass) {
  for (const k of subclassKeys(classId, subclass)) {
    if (SUBCLASS_IDENTIFIERS[k]) return SUBCLASS_IDENTIFIERS[k];
  }
  return null;
}

/**
 * O uuid de uma feature de subclasse, ou null.
 * @param {string} classId
 * @param {{name?: string, shortName?: string}} subclass
 * @param {string} featureName
 * @returns {string|null}
 */
export function subclassFeatureUuid(classId, subclass, featureName) {
  const f = norm(featureName);
  for (const k of subclassKeys(classId, subclass)) {
    const id = SUBCLASS_FEATURE_IDS[`${k}|${f}`];
    if (id) return `${PACK_CLASSES}.${id}`;
  }
  return null;
}

/**
 * O uuid de uma magia, também pelo nome curto do SRD.
 * @param {string} spellName
 * @returns {string|null}
 */
export function spellUuid(spellName) {
  for (const n of srdSpellNames(spellName)) {
    const id = SPELL_IDS[norm(n)];
    if (id) return `${PACK_SPELLS}.${id}`;
  }
  return null;
}

/** A procedência de um item por nome, num pacote. */
function flatUuid(map, pack, name) {
  const id = map[norm(name)];
  return id ? `${pack}.${id}` : null;
}

/** Espécie, traço de espécie ou background (origins24). */
export function originUuid(name) {
  return flatUuid(ORIGIN_IDS, PACK_ORIGINS, name);
}

/**
 * O nome que o dnd5e dá à mesma espécie, ou null.
 * @param {object|null} raceObj
 * @returns {string|null}
 */
export function srdSpeciesName(raceObj) {
  const name = raceObj?.name;
  if (!name) return null;
  const exact = SPECIES_NAMES.find((n) => norm(n) === norm(name));
  if (exact) return exact;
  const base = raceObj._baseName ?? name;
  if (norm(base) === norm(name)) return null;
  const suffixed = suffixMatch(SPECIES_NAMES, base, name);
  if (suffixed !== undefined) return suffixed;
  const bare = SPECIES_NAMES.find((n) => norm(n) === norm(base));
  return bare && SPECIES_SELF_LINEAGE.includes(bare) ? bare : null;
}

/** O nome do pool cuja palavra-chave de sufixo casa (null se ambíguo). */
function suffixMatch(pool, base, name) {
  const b = norm(base);
  const suffix = norm(name).slice(b.length);
  const matches = pool
    .filter((n) => norm(n).startsWith(`${b},`))
    .filter((n) => suffix.includes(norm(n).slice(b.length + 1).trim()));
  if (matches.length === 1) return matches[0];
  return matches.length ? null : undefined;
}

/**
 * O nome que o dnd5e dá ao mesmo traço de espécie, ou null.
 * @param {string} name
 * @returns {string|null}
 */
export function srdOriginName(name) {
  if (!name) return null;
  const n = norm(name);
  const exact = ORIGIN_NAMES.find((x) => norm(x) === n);
  if (exact) return exact;
  const base = n.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (base === n) return null;
  const suffixed = suffixMatch(ORIGIN_NAMES, base, n);
  if (suffixed !== undefined) return suffixed;
  return ORIGIN_NAMES.find((x) => norm(x) === base) ?? null;
}

/** Talento (feats24). */
export function featUuid(name) {
  return flatUuid(FEAT_IDS, PACK_FEATS, name);
}

/** Item de equipamento (equipment24). */
export function equipmentUuid(name) {
  return flatUuid(EQUIPMENT_IDS, PACK_EQUIPMENT, name);
}

/**
 * A classificação de inventário do dnd5e para um item, ou null.
 * @param {string} name
 * @returns {{type: string, subtype: string}|null}
 */
export function equipmentFoundryType(name) {
  const entry = EQUIPMENT_TYPES[norm(name)];
  if (!entry) return null;
  const [type, subtype = ''] = entry.split('/');
  return type ? { type, subtype } : null;
}

/** O documento da classe em si. */
export function classUuid(classId) {
  const id = CLASS_IDS[norm(classId)];
  return id ? `${PACK_CLASSES}.${id}` : null;
}
