// =============================================================================
// compendiumUuids - UUIDs de compêndio do dnd5e (para os níveis FUTUROS)
// =============================================================================
// PURO (sem rede/DOM). API de consulta sobre o registro gerado
// (`compendiumUuidsData.js`, produzido por `npm run gen:uuids`).
//
// POR QUE ISTO EXISTE. No Foundry, quem concede as features de um nível é o
// `advancement[]` do item de CLASSE/SUBCLASSE: um `ItemGrant` por nível cujo
// `configuration.items[].uuid` aponta para o compêndio. A escada está presente
// INTEIRA (níveis 1..20) desde o nível 1 nos premades oficiais - os níveis ainda
// não alcançados têm a receita (`configuration.items`) preenchida e o `value`
// vazio. Sem essa escada, subir de nível dentro do Foundry não concede nada.
//
// Para os níveis JÁ alcançados continuamos usando o uuid RELATIVO (`.${_id}`) do
// item embutido no próprio ator: funciona sem compêndio nenhum e cobre TODO o
// conteúdo (inclusive não-SRD). Só os níveis futuros precisam do compêndio, e aí
// só existe o que o dnd5e publica - as 12 classes XPHB e uma subclasse por
// classe. Fora disso não emitimos escada: o comportamento volta a ser o de hoje
// (subir de nível no app e re-exportar).
// -----------------------------------------------------------------------------

import {
  PACK_CLASSES,
  PACK_SPELLS,
  CLASS_FEATURE_IDS,
  SUBCLASS_IDS,
  SUBCLASS_FEATURE_IDS,
  SPELL_IDS,
} from './compendiumUuidsData';

const norm = (s) => (s ?? '').toString().trim().toLowerCase();

/** Nomes pelos quais uma subclasse pode ser procurada (nome completo e curto).
 * As 12 subclasses do pack casam pelo nome COMPLETO ("Path of the Berserker"),
 * que é o mesmo do 5etools; o shortName ("Berserker") entra como rede. */
function subclassKeys(classId, subclass) {
  const cid = norm(classId);
  return [norm(subclass?.name), norm(subclass?.shortName)].filter(Boolean).map((n) => `${cid}|${n}`);
}

/**
 * UUID de uma feature de CLASSE no compêndio do dnd5e.
 * @param {string} classId  ex: 'barbarian'
 * @param {string} featureName
 * @returns {string|null} uuid completo, ou null se o dnd5e não publica a feature
 */
export function classFeatureUuid(classId, featureName) {
  const id = CLASS_FEATURE_IDS[`${norm(classId)}|${norm(featureName)}`];
  return id ? `${PACK_CLASSES}.${id}` : null;
}

/**
 * UUID de uma SUBCLASSE no compêndio do dnd5e.
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
 * UUID de uma feature de SUBCLASSE no compêndio do dnd5e.
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
 * UUID de uma MAGIA no compêndio do dnd5e (magias concedidas por subclasse nos
 * níveis futuros - ex: as "Oath of Devotion Spells" do premade do Paladino).
 * @param {string} spellName
 * @returns {string|null}
 */
export function spellUuid(spellName) {
  const id = SPELL_IDS[norm(spellName)];
  return id ? `${PACK_SPELLS}.${id}` : null;
}
