// =============================================================================
// Schema do Personagem - o contrato central do builder
// =============================================================================
// Princípio de ouro: guardamos DECISÕES, não estado computado. O personagem
// salvo registra o que o jogador escolheu (scores base, talentos, perícias). O
// engine (Fase 3) deriva os números finais; o export (Fase 6) hidrata em
// documentos Foundry.
//
// Regras: somente 2024, com conteúdo legado adaptado. Criação custom - sem
// backgrounds prontos: a origem é montada peça por peça. Multiclasse suportado.
//
// Tipos via JSDoc (o projeto é JS puro + React Compiler; JSDoc dá dicas no
// editor sem precisar de build TypeScript).
// -----------------------------------------------------------------------------

import { migrateLegacyTiefling } from '../engine/legacyFiendishLegacies';
import { migrateHalflingSpecies } from '../engine/legacyHalflingLineages';

/** Versão atual do schema. Incremente ao mudar a forma + adicione um migrate.
 * v2 (2026-07-09): `ClassEntry.spells` - magias preparadas pelo jogador por
 * classe (Spellbook, Fase B2). Personagens v1 recebem `spells: []` no migrate. */
export const CHARACTER_SCHEMA_VERSION = 2;

/** As seis habilidades, na ordem canônica. */
export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/**
 * @typedef {'str'|'dex'|'con'|'int'|'wis'|'cha'} Ability
 */

/**
 * @typedef {Object} AbilityScores  Scores BASE, antes de qualquer bônus.
 * @property {number} str
 * @property {number} dex
 * @property {number} con
 * @property {number} int
 * @property {number} wis
 * @property {number} cha
 */

/**
 * Como os scores base foram gerados.
 * @typedef {(
 *   { type: 'standard-array' } |
 *   { type: 'point-buy' } |
 *   { type: 'manual' } |
 *   { type: 'rolled', rolls: number[][] }
 * )} ScoreMethod
 */

/**
 * @typedef {Object} CharacterMeta
 * @property {string} name
 * @property {string|null} portrait    URL ou data-URI.
 * @property {string} createdAt        ISO 8601.
 * @property {string} updatedAt        ISO 8601.
 * @property {string[]} tags
 * @property {boolean} [creating]      criação guiada em andamento (retoma o wizard).
 * @property {boolean} [guided]        guidance ativa nesta ficha (botão ✦ / level-up).
 */

/**
 * @typedef {Object} CharacterIdentity
 * @property {string} alignment
 * @property {string} appearance
 * @property {string} backstory
 * @property {string} personality
 * @property {string} ideals
 * @property {string} bonds
 * @property {string} flaws
 * @property {string} [eyes]
 * @property {string} [hair]
 * @property {string} [height]
 * @property {string} [age]
 * @property {string} [faith]
 */

/**
 * Configuração de regras da casa.
 * @typedef {Object} RulesConfig
 * @property {number} subclassLevel    Nível padronizado em que a subclasse entra.
 * @property {boolean} allowLegacyContent  Conteúdo pré-2024 adaptado (MPMM etc.).
 */

/**
 * Referência a uma entidade do compêndio (5etools), identificada por
 * nome+fonte. O `hash` (estilo Plutonium) é resolvido na hidratação do export.
 * @typedef {Object} ContentRef
 * @property {string} id        Identificador da entidade (ex: "human").
 * @property {string} source    Fonte (ex: "XPHB", "MPMM").
 */

/**
 * Um bônus de atributo escolhido (origem ou ASI).
 * @typedef {Object} AbilityBoost
 * @property {Ability} ability
 * @property {number} amount    Geralmente +1 ou +2.
 */

/**
 * Escolha de talento, com sub-escolhas internas (ASI embutido, magia, etc.).
 * @typedef {Object} FeatChoice
 * @property {string} id
 * @property {string} source
 * @property {'origin'|'general'|'fightingStyle'|'eldritchInvocation'|'epicBoon'} subtype
 * @property {Record<string, unknown>} choices
 */

/**
 * Espécie + sub-escolhas (subraça, boosts de linhagem, etc.).
 * @typedef {Object} SpeciesChoice
 * @property {string} id
 * @property {string} source
 * @property {string|null} [lineage]  nome da versão de linhagem (`_versions`),
 *   ex: "Elf; Drow Lineage"; null/ausente = raça base ou sem linhagens.
 * @property {Record<string, unknown>} choices
 */

/**
 * Origem custom - substitui o "background" pronto. Tudo escolhido individualmente.
 * As proficiências (2 perícias, 1 ferramenta) e o idioma livre ficam em `choices`
 * (choice-bag genérico, lido pelo engine como qualquer outra escolha). Os arrays
 * skill/tool/languages permanecem para conteúdo legado/import.
 * @typedef {Object} CustomOrigin
 * @property {AbilityBoost[]} abilityBoosts
 * @property {FeatChoice|null} originFeat
 * @property {Object} choices       choice-bag (skill×2, tool×1, language×1).
 * @property {string[]} skillProficiencies
 * @property {string[]} toolProficiencies
 * @property {string[]} languages
 */

/**
 * Uma escolha feita em um nível específico de uma classe.
 * @typedef {(
 *   { type: 'feat', feat: FeatChoice } |
 *   { type: 'asi', boosts: AbilityBoost[] } |
 *   { type: 'skill-proficiency', skills: string[] } |
 *   { type: 'skill-expertise', skills: string[] } |
 *   { type: 'fighting-style', featId: string, source: string } |
 *   { type: 'spells-known', spells: ContentRef[] } |
 *   { type: 'cantrips-known', spells: ContentRef[] } |
 *   { type: 'feature-option', featureId: string, optionId: string } |
 *   { type: 'weapon-mastery', weapons: string[] } |
 *   { type: 'custom', label: string, value: unknown }
 * )} LevelChoice
 */

/**
 * Uma classe do personagem (uma entrada por classe; multiclasse = várias).
 * @typedef {Object} ClassEntry
 * @property {string} uid              Id interno estável (para React keys/edição).
 * @property {string} classId          Ex: "fighter".
 * @property {string} source           Ex: "XPHB".
 * @property {number} level
 * @property {boolean} isOriginalClass Vira details.originalClass no export.
 * @property {string|null} subclassId
 * @property {string|null} subclassSource
 * @property {Record<number, number|'max'>} hitPoints  Por nível: rolado ou "max".
 * @property {Object} choices   Choice-bag da classe (perícias, ASI/talento, etc.),
 *   lido pelo engine como qualquer outra escolha (ver engine/choices).
 * @property {ContentRef[]} spells  Magias PREPARADAS pelo jogador nesta classe
 *   (cantrips escolhidos + magias de círculo). Só a DECISÃO; slots/limites/DC são
 *   derivados (engine/spellcasting). Magias concedidas (subclasse/raça/talento)
 *   NÃO ficam aqui - são derivadas e sempre preparadas (Fase B2, DDL-0008).
 */

/**
 * @typedef {Object} Currency
 * @property {number} pp @property {number} gp @property {number} ep
 * @property {number} sp @property {number} cp
 */

/**
 * @typedef {Object} InventoryItem
 * @property {string} uid
 * @property {string} itemId
 * @property {string} source
 * @property {number} quantity
 * @property {boolean} equipped
 * @property {boolean} attuned
 * @property {string} [customName]
 * @property {string|null} [customImg]  imagem custom (data-URL ou URL) - sobrepõe a arte do 5etools
 */

/**
 * O documento raiz salvo no IndexedDB.
 * @typedef {Object} Character
 * @property {string} id
 * @property {number} schemaVersion
 * @property {'pt-BR'|'en'} locale
 * @property {CharacterMeta} meta
 * @property {CharacterIdentity} identity
 * @property {AbilityScores} scores
 * @property {ScoreMethod} scoreMethod
 * @property {RulesConfig} rulesConfig
 * @property {SpeciesChoice|null} species
 * @property {CustomOrigin} origin
 * @property {ClassEntry[]} classes
 * @property {number} hpBonus   Ajuste MANUAL do HP máximo (± no mini-card), somado
 *   ao HP derivado. Exporta como `attributes.hp.bonuses.overall` no Foundry.
 * @property {Currency} currency
 * @property {InventoryItem[]} inventory
 */

/** Gera um id único (usa crypto.randomUUID quando disponível). */
export function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Scores base padrão (tudo 10 = sem modificador). */
function defaultScores() {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
}

/**
 * Cria uma classe vazia (nível 1, sem escolhas ainda).
 * @param {boolean} isOriginalClass
 * @returns {ClassEntry}
 */
export function createClassEntry(isOriginalClass = true) {
  return {
    uid: makeId(),
    classId: '',
    source: '',
    level: 1,
    isOriginalClass,
    subclassId: null,
    subclassSource: null,
    hitPoints: {}, // vazio = cálculo padrão (nv1 máx, demais média + CON)
    choices: {},
    spells: [], // magias preparadas pelo jogador (Fase B2)
  };
}

/**
 * Cria uma entrada de inventário (item avulso, quantidade 1, sem equipar/atunar).
 * @param {string} itemId  nome do item (ex: "Longsword")
 * @param {string} source
 * @returns {InventoryItem}
 */
export function createInventoryItem(itemId, source) {
  return { uid: makeId(), itemId, source, quantity: 1, equipped: false, attuned: false };
}

/**
 * Cria um personagem novo com defaults sãos.
 * @param {Partial<{ name: string, locale: 'pt-BR'|'en', subclassLevel: number,
 *   creating: boolean, guided: boolean, scoreMethod: string }>} [opts]
 * @returns {Character}
 */
export function createCharacter(opts = {}) {
  const now = new Date().toISOString();
  // Método de geração de atributos: o guia usa Standard Array por padrão; a
  // criação avulsa ("just the sheet") fica no Manual (todos 10, folha em branco).
  const scoreType = opts.scoreMethod ?? 'manual';
  return {
    id: makeId(),
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    locale: opts.locale ?? 'pt-BR',
    meta: {
      name: opts.name ?? 'New Character',
      portrait: null,
      createdAt: now,
      updatedAt: now,
      tags: [],
      // true enquanto a criação guiada (wizard) está em andamento: a Home
      // retoma o wizard em vez de abrir a ficha, e o Finish do wizard a zera.
      creating: opts.creating ?? false,
      // Guidance POR-PERSONAGEM: `false` desliga o botão ✦ e o overlay de
      // level-up desta ficha. Criar "just the sheet" grava `false`; o guiado
      // (e o legado) fica ativo. Ver components/wizard/guidancePendencies.
      guided: opts.guided ?? true,
    },
    // Campos biográficos. Todos mapeiam 1:1 no `system.details` do Foundry
    // (`trait`/`ideal`/`bond`/`flaw` no singular lá; `backstory` → `biography`).
    identity: {
      alignment: '',
      appearance: '',
      backstory: '', // história do personagem (editada na aba Background)
      personality: '',
      ideals: '',
      bonds: '',
      flaws: '',
      faith: '',
      gender: '',
      skin: '',
      hair: '',
      eyes: '',
      height: '',
      weight: '',
      age: '',
    },
    scores: defaultScores(),
    scoreMethod: { type: scoreType },
    rulesConfig: {
      subclassLevel: opts.subclassLevel ?? 3,
      allowLegacyContent: true,
    },
    species: null,
    origin: {
      abilityBoosts: [],
      originFeat: null,
      choices: {},
      skillProficiencies: [],
      toolProficiencies: [],
      languages: [],
    },
    classes: [createClassEntry(true)],
    hpBonus: 0,
    // 50 GP inicial do background (2024). O ouro inicial da CLASSE original é
    // somado quando ela é escolhida (ver engine/startingGold + Builder), sem
    // sobrescrever uma carteira já mexida.
    currency: { pp: 0, gp: 50, ep: 0, sp: 0, cp: 0 },
    inventory: [],
  };
}

/**
 * Migra um personagem de versões antigas do schema para a atual.
 * Hoje só há a v1; o esqueleto fica pronto para o futuro.
 * @param {any} raw
 * @returns {Character}
 */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return createCharacter();
  // COERÇÃO DEFENSIVA: garante a forma do builder mesmo em dados legados/parciais
  // (ou um objeto de outro formato salvo por engano), para a UI nunca quebrar.
  // Exemplo de uso futuro: if (raw.schemaVersion < 2) raw = migrateV1toV2(raw);
  const base = createCharacter();
  return {
    ...raw,
    id: raw.id ?? base.id,
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    locale: raw.locale ?? base.locale,
    meta: { ...base.meta, ...(raw.meta ?? {}) },
    identity: { ...base.identity, ...(raw.identity ?? {}) },
    scores: { ...base.scores, ...(raw.scores ?? {}) },
    scoreMethod: raw.scoreMethod ?? base.scoreMethod,
    rulesConfig: { ...base.rulesConfig, ...(raw.rulesConfig ?? {}) },
    // Toda mudança de FORMA de uma espécie legada precisa de migração — o nome
    // antigo deixa de existir em catálogo nenhum e a ficha perderia a espécie ao
    // recarregar. Duas até agora, aplicadas em cadeia (cada uma é no-op fora do
    // caso dela):
    //  - DDL-0061: "Tiefling (Zariel)" → Tiefling XPHB + linhagem;
    //  - DDL-0063: "Halfling (Ghostwise)" → Halfling XPHB + linhagem, e um
    //    Halfling XPHB SEM linhagem → Lightfoot (que reproduz a base de então,
    //    com o Naturally Stealthy intacto).
    species: migrateHalflingSpecies(migrateLegacyTiefling(raw.species ?? null)),
    origin: { ...base.origin, ...(raw.origin ?? {}) },
    // v1→v2: cada classe ganha `spells: []` se não tiver (Fase B2).
    classes: Array.isArray(raw.classes)
      ? raw.classes.map((c) => ({ ...c, spells: Array.isArray(c?.spells) ? c.spells : [] }))
      : [],
    hpBonus: typeof raw.hpBonus === 'number' ? raw.hpBonus : 0,
    currency: { ...base.currency, ...(raw.currency ?? {}) },
    inventory: Array.isArray(raw.inventory) ? raw.inventory : [],
  };
}

/** Nível total do personagem (soma das classes). */
export function totalLevel(character) {
  return (character?.classes ?? []).reduce((sum, c) => sum + (c.level || 0), 0);
}

/** Resumo curto da build, ex: "Fighter 1 · Warlock 10". Vazio se sem classes. */
export function classSummary(character) {
  return (character?.classes ?? [])
    .filter((c) => c.classId)
    .map((c) => `${c.classId.charAt(0).toUpperCase()}${c.classId.slice(1)} ${c.level}`)
    .join(' · ');
}

/**
 * Só os NOMES das classes, ex: "Warlock · Cleric". O card do roster já mostra o
 * nível TOTAL; repetir o nível de cada classe ali polui a legenda.
 */
export function classNames(character) {
  return (character?.classes ?? [])
    .filter((c) => c.classId)
    .map((c) => `${c.classId.charAt(0).toUpperCase()}${c.classId.slice(1)}`)
    .join(' · ');
}
