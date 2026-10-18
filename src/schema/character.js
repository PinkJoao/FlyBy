// =============================================================================
// character: o schema do personagem, o contrato central do builder
// =============================================================================
// O QUE FAZ
//   Define o documento salvo no IndexedDB e as fábricas que o criam e migram.
//   Princípio de ouro: guardamos DECISÕES, não estado computado. O personagem
//   registra o que o jogador escolheu (scores base, talentos, perícias); o engine
//   deriva os números finais, e o export os hidrata em documentos Foundry.
//
//   Regras: só 2024, com conteúdo legado adaptado. A origem é custom, montada peça
//   por peça (sem backgrounds prontos). Multiclasse suportada. Os tipos são
//   `@typedef` em JSDoc: o projeto é JS puro com React Compiler, e o JSDoc dá
//   dicas no editor sem build de TypeScript. Os outros arquivos os importam com
//   `import('../schema/character').ClassEntry`.
//
// FUNÇÕES
//   makeId(): id único (crypto.randomUUID quando existe).
//   defaultScores(): scores base padrão, tudo 10.
//   createClassEntry(isOriginalClass): uma classe vazia, nível 1.
//   createInventoryItem(itemId, source): uma entrada de inventário avulsa.
//   createCharacter(opts): um personagem novo com defaults sãos.
//   migrate(raw): coerção e migração de qualquer versão salva para a atual.
//   totalLevel(character): soma dos níveis das classes.
//   classSummary(character): "Fighter 1 · Warlock 10", vazio sem classes.
//   classNames(character): só os nomes ("Warlock · Cleric"), para o card do
//     roster, que já mostra o nível TOTAL.
//
// CAMPOS (as regras que o tipo sozinho não diz)
//   - AbilityScores são os scores BASE, antes de qualquer bônus.
//   - meta.creating: criação guiada em andamento; a Home retoma o wizard em vez
//     de abrir a ficha, e o Finish do wizard o zera. meta.guided: guidance POR
//     personagem; `false` desliga o botão do guia e o overlay de level-up ("just
//     the sheet" grava false).
//   - identity mapeia 1:1 no `system.details` do Foundry (trait, ideal, bond e
//     flaw no singular lá; `backstory` vira `biography`).
//   - ContentRef identifica uma entidade por nome e fonte; o hash é resolvido na
//     hidratação do export.
//   - species.lineage: o nome da versão (`_versions`), ex. "Elf; Drow Lineage";
//     ausente é a raça base.
//   - origin.choices é um choice-bag (2 perícias, 1 ferramenta, 1 idioma); os
//     arrays de proficiência ficam para legado e import.
//   - ClassEntry.isOriginalClass vira `details.originalClass` no export.
//     hitPoints guarda por nível o rolado ou "max"; vazio é o padrão (máximo no
//     1, média mais CON depois). choices é o choice-bag da classe (engine/choices).
//   - ClassEntry.spells: só a DECISÃO (cantrips e magias de círculo escolhidas);
//     slots, limites e DC são derivados. Magia concedida por subclasse, raça ou
//     talento não fica aqui: é derivada e sempre preparada (DDL-0008).
//   - SpellRef.prepared: `false` é "no repertório, não preparada hoje" (o
//     grimório do Mago). Ausente ou true é preparada, porque toda magia salva
//     antes da distinção era. Cantrip nunca é despreparado.
//   - InventoryItem.customImg sobrepõe a arte do 5etools. container é o uid da
//     entrada que guarda o item, na mesma forma do `system.container` do Foundry
//     (engine/containers.js).
//   - hpBonus: ajuste MANUAL do HP máximo, somado ao derivado; exporta como
//     `attributes.hp.bonuses.overall`.
//   - unassignedSpells é CARGA, não decisão: magias de um ator importado que
//     nenhuma classe conjura (a Riswynn, uma Ladina, traz 35). Guardadas para o
//     re-export não perder conteúdo, e NÃO contam em limite nenhum; todo
//     consumidor novo tem de respeitar isso. A Spellbook as mostra numa sub-aba
//     própria, sem contador. Atribuir e descartar vivem em
//     engine/unassignedSpells e operam por ÍNDICE: o balde pode repetir magia.
//   - rulesConfig.subclassLevel padroniza o nível da subclasse;
//     allowLegacyContent liga o conteúdo pré-2024 adaptado.
//
// DECISÕES E ARMADILHAS
//   - CHARACTER_SCHEMA_VERSION: incremente ao mudar a FORMA, com um passo no
//     migrate. v2 (2026-07-09) trouxe `ClassEntry.spells`; uma v1 recebe
//     `spells: []`.
//   - Prefira campo ADITIVO a bump de schema (container, unassignedSpells): uma
//     ficha antiga simplesmente não tem o campo e deriva idêntica.
//   - migrate faz COERÇÃO DEFENSIVA: garante a forma do builder mesmo com dado
//     legado, parcial ou de outro formato, para a UI nunca quebrar.
//   - Mudar a FORMA de uma espécie legada exige migração, senão o nome antigo some
//     do catálogo e a ficha perde a espécie ao recarregar. Há duas, em cadeia, cada
//     uma no-op fora do caso dela: "Tiefling (Zariel)" vira Tiefling XPHB com
//     linhagem (DDL-0061); "Halfling (Ghostwise)" vira Halfling XPHB com linhagem,
//     e um Halfling XPHB sem linhagem vira Lightfoot, que reproduz a base de então
//     com o Naturally Stealthy (DDL-0063).
//   - O método de atributos padrão é Standard Array no guia e Manual (tudo 10) na
//     criação avulsa.
//   - Carteira inicial: 50 GP do background (2024). O ouro da classe original é
//     somado quando ela é escolhida (engine/startingGold e Builder), sem
//     sobrescrever uma carteira já mexida.
// -----------------------------------------------------------------------------

import { migrateLegacyTiefling } from '../engine/legacyFiendishLegacies';
import { migrateSwapSpecies } from '../engine/legacySwapLineages';

export const CHARACTER_SCHEMA_VERSION = 2;

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** @typedef {'str'|'dex'|'con'|'int'|'wis'|'cha'} Ability */

/**
 * Scores BASE, antes de qualquer bônus.
 * @typedef {Object} AbilityScores
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
 *   )} ScoreMethod
 */

/**
 * @typedef {Object} CharacterMeta
 * @property {string} name
 * @property {string|null} portrait
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string[]} tags
 * @property {boolean} [creating]
 * @property {boolean} [guided]
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
 * Regras da casa.
 * @typedef {Object} RulesConfig
 * @property {number} subclassLevel
 * @property {boolean} allowLegacyContent
 */

/**
 * Uma entidade do compêndio, por nome e fonte.
 * @typedef {Object} ContentRef
 * @property {string} id
 * @property {string} source
 */

/**
 * Um bônus de atributo escolhido (origem ou ASI).
 * @typedef {Object} AbilityBoost
 * @property {Ability} ability
 * @property {number} amount
 */

/**
 * Um talento escolhido, com as sub-escolhas dele.
 * @typedef {Object} FeatChoice
 * @property {string} id
 * @property {string} source
 * @property {'origin'|'general'|'fightingStyle'|'eldritchInvocation'|'epicBoon'} subtype
 * @property {Record<string, unknown>} choices
 */

/**
 * Espécie, linhagem e sub-escolhas.
 * @typedef {Object} SpeciesChoice
 * @property {string} id
 * @property {string} source
 * @property {string|null} [lineage]
 * @property {Record<string, unknown>} choices
 */

/**
 * A origem custom, no lugar do background pronto.
 * @typedef {Object} CustomOrigin
 * @property {AbilityBoost[]} abilityBoosts
 * @property {FeatChoice|null} originFeat
 * @property {Object} choices
 * @property {string[]} skillProficiencies
 * @property {string[]} toolProficiencies
 * @property {string[]} languages
 */

/**
 * Uma escolha feita num nível de uma classe.
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
 *   )} LevelChoice
 */

/**
 * Uma classe do personagem (multiclasse tem várias).
 * @typedef {Object} ClassEntry
 * @property {string} uid
 * @property {string} classId
 * @property {string} source
 * @property {number} level
 * @property {boolean} isOriginalClass
 * @property {string|null} subclassId
 * @property {string|null} subclassSource
 * @property {Record<number, number|'max'>} hitPoints
 * @property {Object} choices
 * @property {SpellRef[]} spells
 */

/**
 * Uma magia escolhida, com o estado de preparação.
 * @typedef {Object} SpellRef
 * @property {string} id
 * @property {string} source
 * @property {boolean} [prepared]
 */

/**
 * @typedef {Object} Currency
 * @property {number} pp
 * @property {number} gp
 * @property {number} ep
 * @property {number} sp
 * @property {number} cp
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
 * @property {string|null} [customImg]
 * @property {string|null} [container]
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
 * @property {number} hpBonus
 * @property {Currency} currency
 * @property {SpellRef[]} unassignedSpells
 * @property {InventoryItem[]} inventory
 */

/** Id único (usa crypto.randomUUID quando disponível). */
export function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Scores base padrão (tudo 10). */
function defaultScores() {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
}

/**
 * Uma classe vazia, nível 1, sem escolhas.
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
    hitPoints: {},
    choices: {},
    spells: [],
  };
}

/**
 * Uma entrada de inventário avulsa (quantidade 1).
 * @param {string} itemId
 * @param {string} source
 * @returns {InventoryItem}
 */
export function createInventoryItem(itemId, source) {
  return { uid: makeId(), itemId, source, quantity: 1, equipped: false, attuned: false };
}

/**
 * Um personagem novo com defaults sãos.
 * @param {Partial<{ name: string, locale: 'pt-BR'|'en', subclassLevel: number,
 *   creating: boolean, guided: boolean, scoreMethod: string }>} [opts]
 * @returns {Character}
 */
export function createCharacter(opts = {}) {
  const now = new Date().toISOString();
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
      creating: opts.creating ?? false,
      guided: opts.guided ?? true,
    },
    identity: {
      alignment: '',
      appearance: '',
      backstory: '',
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
    currency: { pp: 0, gp: 50, ep: 0, sp: 0, cp: 0 },
    unassignedSpells: [],
    inventory: [],
  };
}

/**
 * Migra e coage um personagem salvo para a forma atual.
 * @param {any} raw
 * @returns {Character}
 */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return createCharacter();
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
    species: migrateSwapSpecies(migrateLegacyTiefling(raw.species ?? null)),
    origin: { ...base.origin, ...(raw.origin ?? {}) },
    classes: Array.isArray(raw.classes)
      ? raw.classes.map((c) => ({ ...c, spells: Array.isArray(c?.spells) ? c.spells : [] }))
      : [],
    hpBonus: typeof raw.hpBonus === 'number' ? raw.hpBonus : 0,
    currency: { ...base.currency, ...(raw.currency ?? {}) },
    unassignedSpells: Array.isArray(raw.unassignedSpells) ? raw.unassignedSpells : [],
    inventory: Array.isArray(raw.inventory) ? raw.inventory : [],
  };
}

/** Nível total do personagem. */
export function totalLevel(character) {
  return (character?.classes ?? []).reduce((sum, c) => sum + (c.level || 0), 0);
}

/** Resumo da build, ex. "Fighter 1 · Warlock 10". */
export function classSummary(character) {
  return (character?.classes ?? [])
    .filter((c) => c.classId)
    .map((c) => `${c.classId.charAt(0).toUpperCase()}${c.classId.slice(1)} ${c.level}`)
    .join(' · ');
}

/** Só os nomes das classes, ex. "Warlock · Cleric". */
export function classNames(character) {
  return (character?.classes ?? [])
    .filter((c) => c.classId)
    .map((c) => `${c.classId.charAt(0).toUpperCase()}${c.classId.slice(1)}`)
    .join(' · ');
}
