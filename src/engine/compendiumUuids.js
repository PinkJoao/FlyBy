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

// Apóstrofo tipográfico → reto: o pack usa o reto, o 5etools mistura os dois
// ("Explorer’s Pack" x "Explorer's Pack"). Normalizado dos DOIS lados (o
// gerador aplica a mesma regra), então qualquer forma casa.
const norm = (s) => (s ?? '').toString().trim().toLowerCase().replace(/’/g, "'");

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
 * `system.identifier` canônico de uma subclasse, quando o dnd5e a publica. Não é
 * um rótulo: o sistema o referencia em fórmula (`@subclasses.hand.levels`), e ele
 * é mais curto que o nome ("Warrior of the Open Hand" → `hand`), então o slug do
 * nome não serve (TC-0074). Fora do SRD devolve null e o slug continua valendo.
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
 * Uma magia de nome próprio é procurada também pelo nome CURTO do SRD
 * ("Tasha's Hideous Laughter" → "Hideous Laughter", TC-0079): é o MESMO
 * documento com o título despido do Product Identity, não um near-match - a
 * regra de "nome exato ou nada" do bloco abaixo continua valendo para o resto.
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

// ---------------------------------------------------------------------------
// `_stats.compendiumSource` dos itens EMBUTIDOS
// ---------------------------------------------------------------------------
// Diferente das escadas acima, isto não muda comportamento: é a PROCEDÊNCIA do
// item, o que dá ao Foundry o vínculo com a entrada do compêndio (ícone de
// origem, "atualizar do compêndio"). Os premades preenchem em todo item.
// A busca é por nome EXATO: um item nosso que difira do publicado (linhagem
// mesclada "Elf; Drow Lineage", variante mágica "+1 Longsword") não casa e fica
// sem procedência - que é o correto, não queremos apontar para o documento errado.

/** Procedência de um item por nome, no pacote indicado. */
function flatUuid(map, pack, name) {
  const id = map[norm(name)];
  return id ? `${pack}.${id}` : null;
}

/** Espécie, traço de espécie ou background (pacote origins24). */
export function originUuid(name) {
  return flatUuid(ORIGIN_IDS, PACK_ORIGINS, name);
}

/**
 * O nome que o dnd5e dá à MESMA espécie. As duas edições escrevem a linhagem de
 * formas diferentes - o SRD usa vírgula e a palavra-chave ("Elf, High"), o
 * 5etools funde a frase inteira ("Elf; High Elf Lineage") -, então o item de raça
 * exportado saía com um nome que nenhum documento publicado tem: sem procedência
 * de compêndio, e diferente do que o jogador vê num ator oficial.
 *
 * A ponte é DERIVADA, não curada (a lista de nomes é gerada do SRD):
 *  1. nome idêntico → ele mesmo;
 *  2. mesma base + a palavra-chave do sufixo do SRD contida no nosso sufixo
 *     ("High" ⊂ "High Elf Lineage"); ambíguo (duas casando) → nada;
 *  3. a base NUA, mas só quando o documento do SRD guarda a linhagem dentro de
 *     si (`SPECIES_SELF_LINEAGE`): "Dragonborn" é a espécie inteira, com a
 *     ancestralidade como escolha interna, então o de prata é aquele documento.
 *     Onde não é o caso, as nossas linhagens são acréscimo curado (o Halfling do
 *     DDL-0063) e herdar o nome apontaria para o documento errado.
 * Sem casamento devolve null, e o chamador fica com o nome do 5etools.
 * @param {object|null} raceObj  raça RESOLVIDA (linhagem inclusa)
 * @returns {string|null}
 */
export function srdSpeciesName(raceObj) {
  const name = raceObj?.name;
  if (!name) return null;
  const exact = SPECIES_NAMES.find((n) => norm(n) === norm(name));
  if (exact) return exact;
  const base = raceObj._baseName ?? name;
  if (norm(base) === norm(name)) return null; // sem linhagem: só o casamento exato vale
  const suffixed = suffixMatch(SPECIES_NAMES, base, name);
  if (suffixed !== undefined) return suffixed;
  const bare = SPECIES_NAMES.find((n) => norm(n) === norm(base));
  return bare && SPECIES_SELF_LINEAGE.includes(bare) ? bare : null;
}

/**
 * Nome do pool cuja PALAVRA-CHAVE de sufixo (o que vem depois da vírgula) está
 * contida no nome que temos: "Elven Lineage, High Elf" casa "Elven Lineage
 * (High Elf)", "Gnomish Lineage, Rock" casa "Gnomish Lineage (Rock Gnome)".
 * `undefined` = nenhum candidato com vírgula; `null` = ambíguo (não se adivinha).
 */
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
 * O nome que o dnd5e dá ao MESMO traço de espécie. Mesma divergência de grafia do
 * `srdSpeciesName`: o SRD escreve "Elven Lineage, High Elf" onde o 5etools diz
 * "Elven Lineage (High Elf)", e "Giant Ancestry" onde nós dizemos "Giant Ancestry
 * (Cloud)". Casa por nome exato, depois pela palavra-chave do sufixo, depois pela
 * base nua. Sem casamento devolve null - e para uma espécie que o SRD PUBLICA
 * isso quer dizer que o traço não é um documento lá (o Dragonborn não tem um item
 * "Damage Resistance": aquilo vive num passo de advancement), então não vale
 * emitir um item por ele.
 * @param {string} name  nome do traço no 5etools
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

/** Talento (pacote feats24). */
export function featUuid(name) {
  return flatUuid(FEAT_IDS, PACK_FEATS, name);
}

/** Item de equipamento/inventário (pacote equipment24). */
export function equipmentUuid(name) {
  return flatUuid(EQUIPMENT_IDS, PACK_EQUIPMENT, name);
}

/**
 * Classificação de inventário do dnd5e para um item, pelo NOME: `{type, subtype}`
 * (ex: Torch → `{type:'consumable', subtype:'trinket'}`). O tipo decide se o item
 * pode ser equipado/consumido na ficha do Foundry, e **não é derivável** do código
 * de tipo do 5etools: o `G` de "adventuring gear" vira `loot`, `equipment` OU
 * `consumable` item a item no SRD (TC-0066). Item fora do pacote → null, e o
 * chamador fica com a classificação por grupo, que é o comportamento antigo.
 * @param {string} name
 * @returns {{type: string, subtype: string}|null}
 */
export function equipmentFoundryType(name) {
  const entry = EQUIPMENT_TYPES[norm(name)];
  if (!entry) return null;
  const [type, subtype = ''] = entry.split('/');
  return type ? { type, subtype } : null;
}

/** Documento da CLASSE em si (não uma feature dela). */
export function classUuid(classId) {
  const id = CLASS_IDS[norm(classId)];
  return id ? `${PACK_CLASSES}.${id}` : null;
}
