// =============================================================================
// choices: o modelo genérico de sub-escolhas (o choice-bag)
// =============================================================================
// O QUE FAZ
//   Features dão escolhas, e escolhas dão OUTRAS escolhas (um talento escolhido tem
//   as próprias; uma invocação concede magias ou talentos). Duas partes puras:
//     parseChoices(entity): lê os campos de escolha de uma entidade 5etools
//       (espécie, talento, feature) e devolve descritores Choice uniformes.
//     collectChoicePicks(bag, kind): caminha RECURSIVAMENTE pelo choice-bag salvo e
//       junta as seleções de um tipo.
//   O choice-bag é recursivo: { [choiceId]: { kind, picks, sub?: { [pick]: bag } } },
//   onde `sub` guarda as sub-escolhas de um pick que é ele mesmo uma feature com
//   escolhas (um talento escolhido dentro de uma escolha de talento).
//
// FUNÇÕES
//   titleCase(s), noun(kind, count), toOption(kind, raw): rótulos e opções.
//   parseProfField(field, kind, push, mapValue): skill, tool ou language.
//   parseStlField(field, push): o campo combinado skillToolLanguageProficiencies.
//   parseAbilityField(field, push): o ASI embutido de um talento.
//   fixedAbilityBoosts(abilityField): os aumentos FIXOS de um talento.
//   parseSpellAbilityField(field, push): o atributo de conjuração à escolha.
//   parseDamageField(field, kind, push): resist, immune ou vulnerable.
//   weaponFilterAllows(filter, raw): a arma passa no filtro de uma escolha?
//   parseFeatField(field, push): talento à escolha (recursivo).
//   parseChoices(entity, opts): todos os descritores de uma entidade.
//   collectChoicePicks(bag, kind, out): os picks de um tipo, recursivo.
//   spellAbilityPick(bag): o atributo de conjuração escolhido, ou null.
//   collectAbilityPicks(bag, out): os aumentos de atributo, recursivo.
//
// DECISÕES E ARMADILHAS
//   - Entradas múltiplas num mesmo campo de proficiência são ALTERNATIVAS (o
//     5etools as une com "or"): vence a primeira que render escolha (o Human de
//     Ixalan tem duas {anyStandard:1} e escolhe UM idioma). `{ x: true }` é grant,
//     não escolha.
//   - Tokens CONTÁVEIS (anyMusicalInstrument: 3 no Musician, anyStandard no Custom
//     Lineage) viram substantivo e categoria de ferramenta (AT, INS, GS, o mesmo
//     vocabulário do classFeatureChoices). Sem a entrada, o token era descartado
//     (TC-0023).
//   - ASI de talento: cada `choose` é uma alternativa (o ASI XPHB tem duas). O teto
//     (`max`) viaja no boost; o 5etools só codifica o 30 dos Epic Boons, ausente é
//     20 (TC-0022). Talento LEGACY sem campo `ability` ganha um +1 livre sintetizado
//     (LEGACY_ABILITY_CHOICE, padrão de adaptação do DMG 2024), usado pelo
//     ChoiceList e pela completude do guia com a MESMA lista.
//   - parseSpellAbilityField: um atributo por entidade, compartilhado por todos os
//     grupos de `additionalSpells`. Sem `choose`, o atributo é fixo.
//   - Traço de dano: string é grant fixo (damageTraits), `{choose}` vira escolha
//     (TC-0014). Só `resist` tem choose hoje; `immune`/`vulnerable` usam a forma.
//   - weaponFilterAllows: `allow` são exceções por nome (o Longbow, Heavy mas
//     permitido), `kind` restringe melee ou ranged, `noProps` veta propriedades.
//     `martialRequiresAnyProp` é a regra CONDICIONAL do Ladino (simples passam;
//     marciais só com Finesse ou Light, DDL-0050). Só armas mundanas.
//   - parseChoices recebe o nível (o Ritual Caster destrava picks em 1/5/9/13/17) e
//     o bag (o grupo ativo de um `additionalSpells` com várias listas depende do
//     pick `spellSet-0`, TC-0011). O pseudo-idioma `other` vira o idioma REAL da
//     espécie antes de virar opção (TC-0050); só o Simic Hybrid o tem num choose.
//     Os ids são estáveis por tipo (skill-0, tool-0, feat-0); os de magia já vêm
//     com id, que o grantedSpells consome.
//   - Picks são strings (pool de um tipo) ou { kind, value } (pool MISTO).
// -----------------------------------------------------------------------------

import { skillCode } from './classData';
import { resolveOtherLanguage } from './speciesLanguages';
import { additionalSpellChoices } from './grantedSpells';

/**
 * @typedef {Object} Choice
 * @property {string} id
 * @property {'skill'|'tool'|'language'|'feat'} kind
 * @property {number} count
 * @property {string} label
 * @property {ChoicePool} pool
 * @typedef {(
 *   { type:'list', options: {value:string,label:string}[] } |
 *   { type:'any', of:'skill'|'tool'|'language' } |
 *   { type:'feat', category?: string[] }
 *   )} ChoicePool
 */

const KIND_NOUN = { skill: 'skill', tool: 'tool', language: 'language', feat: 'feat' };

export function titleCase(s) {
  return String(s)
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function noun(kind, count) {
  const n = KIND_NOUN[kind] ?? kind;
  return count > 1 ? `${n}s` : n;
}

function toOption(kind, raw) {
  if (kind === 'skill') return { value: skillCode(raw), label: titleCase(raw) };
  return { value: String(raw), label: titleCase(raw) };
}

const PROF_COUNT_TOKENS = {
  anyArtisansTool: { noun: "Artisan's Tool", category: 'AT' },
  anyMusicalInstrument: { noun: 'Musical Instrument', category: 'INS' },
  anyGamingSet: { noun: 'Gaming Set', category: 'GS' },
  anyTool: { noun: 'tool', category: null },
  anyToolProficiency: { noun: 'tool', category: null },
  anySkill: { noun: 'skill', category: null },
  anyStandard: { noun: 'language', category: null },
  anyStandardLanguage: { noun: 'language', category: null },
  anyExoticLanguage: { noun: 'language', category: null },
  anyRareLanguage: { noun: 'language', category: null },
};

/** Lê um bloco de proficiências e empurra os Choices (entradas são alternativas). */
function parseProfField(field, kind, push, mapValue = (v) => v) {
  let done = false;
  const pushOnce = (c) => { done = true; push(c); };
  for (const entry of field ?? []) {
    if (done) break;
    if (!entry || typeof entry !== 'object') continue;
    if (entry.choose) {
      const count = entry.choose.count ?? 1;
      pushOnce({
        kind,
        count,
        label: count > 1 ? `Choose ${count} ${noun(kind, count)}` : `Choose a ${noun(kind, 1)}`,
        pool: { type: 'list', options: (entry.choose.from ?? []).map((v) => toOption(kind, mapValue(v))) },
      });
    } else if (entry.any != null) {
      pushOnce({
        kind,
        count: entry.any,
        label: entry.any > 1 ? `Choose ${entry.any} ${noun(kind, entry.any)}` : `Choose any ${noun(kind, 1)}`,
        pool: { type: 'any', of: kind },
      });
    } else {
      for (const [key, val] of Object.entries(entry)) {
        const token = PROF_COUNT_TOKENS[key];
        if (!token || typeof val !== 'number' || val < 1) continue;
        const word = val > 1 ? `${token.noun}s` : token.noun;
        pushOnce({
          kind,
          count: val,
          label: val > 1 ? `Choose ${val} ${word}` : `Choose a ${word}`,
          pool: { type: 'any', of: kind, category: token.category },
        });
      }
    }
  }
}

const TOKEN_KIND = {
  anySkill: 'skill',
  anyTool: 'tool',
  anyArtisansTool: 'tool',
  anyMusicalInstrument: 'tool',
  anyToolProficiency: 'tool',
  anyLanguage: 'language',
  anyStandardLanguage: 'language',
  anyExoticLanguage: 'language',
  anyRareLanguage: 'language',
};

/** Lê o campo combinado `skillToolLanguageProficiencies`. */
function parseStlField(field, push) {
  for (const entry of field ?? []) {
    if (!entry || typeof entry !== 'object' || !entry.choose) continue;
    const specs = Array.isArray(entry.choose) ? entry.choose : [entry.choose];
    for (const spec of specs) {
      const count = spec.count ?? 1;
      const kinds = [];
      for (const f of spec.from ?? []) {
        const k = TOKEN_KIND[f];
        if (k && !kinds.includes(k)) kinds.push(k);
      }
      if (kinds.length === 0) continue;
      const mixed = kinds.length > 1;
      const word = mixed ? kinds.join(' or ') : noun(kinds[0], count);
      push({
        kind: mixed ? 'mixed' : kinds[0],
        count,
        label: count > 1 ? `Choose ${count} ${word}` : `Choose a ${word}`,
        pool: { type: 'any', of: mixed ? kinds : kinds[0] },
      });
    }
  }
}

/** Lê o ASI embutido de um talento como um Choice kind 'ability'. */
function parseAbilityField(field, push) {
  const alternatives = [];
  for (const entry of field ?? []) {
    if (!entry || typeof entry !== 'object' || !entry.choose) continue;
    const c = entry.choose;
    alternatives.push({
      from: c.from ?? [],
      count: c.count ?? 1,
      amount: c.amount ?? 1,
      max: entry.max,
    });
  }
  if (alternatives.length === 0) return;
  push({
    kind: 'ability',
    count: 1,
    label: 'Ability Score Increase',
    pool: { type: 'ability', alternatives },
  });
}

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const LEGACY_ABILITY_CHOICE = {
  id: 'ability-legacy',
  kind: 'ability',
  count: 1,
  label: 'Ability Score Increase',
  pool: { type: 'ability', alternatives: [{ from: [...ABILITY_KEYS], count: 1, amount: 1 }] },
};

/**
 * Os aumentos de atributo FIXOS de um talento (grants, não escolhas).
 * @param {any[]} abilityField
 * @returns {import('../schema/character').AbilityBoost[]}
 */
export function fixedAbilityBoosts(abilityField) {
  const out = [];
  for (const entry of abilityField ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    for (const ab of ABILITY_KEYS) {
      if (typeof entry[ab] === 'number' && entry[ab] !== 0) out.push({ ability: ab, amount: entry[ab], max: entry.max });
    }
  }
  return out;
}

const ABILITY_FULL_NAME = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

/** O atributo de conjuração à escolha de um `additionalSpells`. */
function parseSpellAbilityField(field, push) {
  for (const group of field ?? []) {
    const from = group?.ability?.choose;
    if (!Array.isArray(from) || from.length === 0) continue;
    push({
      kind: 'spellAbility',
      count: 1,
      label: 'Spellcasting Ability',
      pool: {
        type: 'spellAbility',
        options: from.map((a) => ({ value: a, label: ABILITY_FULL_NAME[a] ?? a })),
      },
    });
    return;
  }
}

const DAMAGE_KIND_LABEL = {
  resist: 'Damage Resistance',
  immune: 'Damage Immunity',
  vulnerable: 'Damage Vulnerability',
};

/** Um campo de traço de dano: strings são grants, `{choose}` é escolha. */
function parseDamageField(field, kind, push) {
  for (const entry of field ?? []) {
    if (!entry || typeof entry !== 'object' || !entry.choose) continue;
    const count = entry.choose.count ?? 1;
    push({
      kind,
      count,
      label: DAMAGE_KIND_LABEL[kind],
      pool: {
        type: 'list',
        options: (entry.choose.from ?? []).map((v) => ({ value: String(v), label: titleCase(v) })),
      },
    });
  }
}

/**
 * A arma crua passa no filtro de uma escolha de arma ou de Weapon Mastery?
 * @param {{ kind?: 'melee'|'ranged', noProps?: string[], allow?: string[], martialRequiresAnyProp?: string[] }|null} filter
 * @param {object} raw
 * @returns {boolean}
 */
export function weaponFilterAllows(filter, raw) {
  if (!filter) return true;
  const name = String(raw?.name ?? '').toLowerCase();
  if (filter.allow?.some((n) => n.toLowerCase() === name)) return true;
  if (!raw?.weaponCategory) return false;
  const type = String(raw?.type ?? '').split('|')[0];
  if (filter.kind === 'melee' && type !== 'M') return false;
  if (filter.kind === 'ranged' && type !== 'R') return false;
  const props = (raw.property ?? []).map((p) => String(p?.uid ?? p).split('|')[0]);
  if (filter.noProps?.some((c) => props.includes(c))) return false;
  if (filter.martialRequiresAnyProp
    && String(raw.weaponCategory).toLowerCase() === 'martial'
    && !filter.martialRequiresAnyProp.some((c) => props.includes(c))) return false;
  return true;
}

/** O campo `feats` (talento à escolha, recursivo). */
function parseFeatField(field, push) {
  for (const entry of field ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.anyFromCategory) {
      const count = entry.anyFromCategory.count ?? 1;
      push({
        kind: 'feat',
        count,
        label: count > 1 ? `Choose ${count} feats` : 'Choose a feat',
        pool: { type: 'feat', category: entry.anyFromCategory.category },
      });
    } else if (entry.any != null) {
      push({ kind: 'feat', count: entry.any, label: 'Choose a feat', pool: { type: 'feat' } });
    }
  }
}

/**
 * Os descritores de escolha de uma entidade 5etools.
 * @param {object} entity
 * @param {{ level?: number, bag?: object|null }} [opts]
 * @returns {Choice[]}
 */
export function parseChoices(entity, { level = Infinity, bag = null } = {}) {
  const raw = [];
  const push = (c) => raw.push(c);
  parseAbilityField(entity?.ability, push);
  parseProfField(entity?.skillProficiencies, 'skill', push);
  parseProfField(entity?.toolProficiencies, 'tool', push);
  parseProfField(entity?.languageProficiencies, 'language', push, (v) => resolveOtherLanguage(entity, v));
  parseStlField(entity?.skillToolLanguageProficiencies, push);
  parseDamageField(entity?.resist, 'resist', push);
  parseDamageField(entity?.immune, 'immune', push);
  parseDamageField(entity?.vulnerable, 'vulnerable', push);
  parseFeatField(entity?.feats, push);
  parseSpellAbilityField(entity?.additionalSpells, push);
  for (const c of additionalSpellChoices(entity?.additionalSpells, level, bag)) push(c);

  const counters = {};
  return raw.map((c) => {
    if (c.id) return c;
    const n = counters[c.kind] ?? 0;
    counters[c.kind] = n + 1;
    return { ...c, id: `${c.kind}-${n}` };
  });
}

/**
 * Os picks de um tipo, caminhando o choice-bag recursivamente.
 * @param {object} bag
 * @param {'skill'|'tool'|'language'|'feat'} kind
 * @param {string[]} [out]
 * @returns {string[]}
 */
export function collectChoicePicks(bag, kind, out = []) {
  for (const choice of Object.values(bag ?? {})) {
    if (!choice || typeof choice !== 'object') continue;
    for (const pick of choice.picks ?? []) {
      const pk = pick && typeof pick === 'object' ? pick.kind : choice.kind;
      const pv = pick && typeof pick === 'object' ? pick.value : pick;
      if (pk === kind) out.push(pv);
    }
    if (choice.sub) {
      for (const sub of Object.values(choice.sub)) collectChoicePicks(sub, kind, out);
    }
  }
  return out;
}

/**
 * O atributo de conjuração escolhido num bag, ou null.
 * @param {object} bag
 * @returns {string|null}
 */
export function spellAbilityPick(bag) {
  // ATENÇÃO: sem recursão de propósito; o atributo escolhido dentro de um talento é da origem dele.
  for (const choice of Object.values(bag ?? {})) {
    if (choice?.kind === 'spellAbility' && choice.picks?.[0]) return choice.picks[0];
  }
  return null;
}

/**
 * Os aumentos de atributo de um bag, inclusive os de talentos escolhidos.
 * @param {object} bag
 * @param {{ability:string, amount:number}[]} [out]
 * @returns {{ability:string, amount:number}[]}
 */
export function collectAbilityPicks(bag, out = []) {
  for (const choice of Object.values(bag ?? {})) {
    if (!choice || typeof choice !== 'object') continue;
    if (choice.kind === 'ability') {
      for (const pick of choice.picks ?? []) {
        if (pick && typeof pick === 'object' && pick.ability && pick.amount) out.push(pick);
      }
    }
    if (choice.sub) {
      for (const sub of Object.values(choice.sub)) collectAbilityPicks(sub, out);
    }
  }
  return out;
}
