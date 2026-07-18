// =============================================================================
// Choices - modelo generalizado de SUB-ESCOLHAS (estilo Pathbuilder)
// =============================================================================
// Muitas features dão escolhas, e escolhas podem dar OUTRAS escolhas (um talento
// escolhido tem as próprias sub-escolhas; uma invocação pode conceder magias ou
// talentos). Este módulo é a base disso, em duas partes PURAS:
//
//  1. parseChoices(entity)  - lê os campos de escolha de uma entidade 5etools
//     (espécie, talento, feature) e devolve descritores `Choice[]` uniformes.
//  2. collectChoicePicks(bag, kind) - caminha RECURSIVAMENTE pelo "choice-bag"
//     salvo no personagem e junta as seleções de um tipo (ex: todas as perícias).
//
// O formato salvo (choice-bag) é recursivo:
//   bag = { [choiceId]: { kind, picks: string[], sub?: { [pickValue]: bag } } }
// onde `sub` guarda as sub-escolhas de cada pick que é, ele mesmo, uma feature
// com escolhas (ex: um talento escolhido dentro de uma escolha de talento).
// -----------------------------------------------------------------------------

import { skillCode } from './classData';
import { additionalSpellChoices } from './grantedSpells';

/**
 * @typedef {Object} Choice
 * @property {string} id        estável dentro da entidade (ex: 'skill-0')
 * @property {'skill'|'tool'|'language'|'feat'} kind
 * @property {number} count     quantos escolher
 * @property {string} label
 * @property {ChoicePool} pool
 *
 * @typedef {(
 *   { type:'list', options: {value:string,label:string}[] } |
 *   { type:'any', of:'skill'|'tool'|'language' } |
 *   { type:'feat', category?: string[] }
 * )} ChoicePool
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

/** Lê um bloco de proficiências (skill/tool/language) e empurra os Choices. */
function parseProfField(field, kind, push) {
  for (const entry of field ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.choose) {
      const count = entry.choose.count ?? 1;
      push({
        kind,
        count,
        label: count > 1 ? `Choose ${count} ${noun(kind, count)}` : `Choose a ${noun(kind, 1)}`,
        pool: { type: 'list', options: (entry.choose.from ?? []).map((v) => toOption(kind, v)) },
      });
    } else if (entry.any != null) {
      push({
        kind,
        count: entry.any,
        label: entry.any > 1 ? `Choose ${entry.any} ${noun(kind, entry.any)}` : `Choose any ${noun(kind, 1)}`,
        pool: { type: 'any', of: kind },
      });
    }
    // entrada fixa { x: true } é um GRANT (não escolha) - ignorada aqui.
  }
}

// Tokens "any*" do 5etools → tipo (ver render.js _SKILL_TOOL_LANGUAGE_KEYS_*).
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

/**
 * Lê `skillToolLanguageProficiencies` (campo COMBINADO; ex: Skilled). O `choose`
 * pode ser objeto OU array, e o `from` traz tokens any* misturados → pool de um
 * tipo, ou MISTO (skill+tool) quando há mais de um tipo.
 */
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
      if (kinds.length === 0) continue; // entradas fixas nomeadas: fora de escopo
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

/**
 * Lê o campo `ability` de um TALENTO (ASI embutido). Cada entrada com `choose` é
 * uma ALTERNATIVA (o feat "Ability Score Improvement" tem duas: +2 em um OU +1
 * em dois); a maioria dos feats General tem uma só (+1 em str/dex, etc.).
 * Vira UM Choice kind 'ability' com pool {type:'ability', alternatives:[...]},
 * onde cada alternativa é {from, count, amount} normalizada.
 */
function parseAbilityField(field, push) {
  const alternatives = [];
  for (const entry of field ?? []) {
    if (!entry || typeof entry !== 'object' || !entry.choose) continue;
    const c = entry.choose;
    alternatives.push({
      from: c.from ?? [],
      count: c.count ?? 1,
      amount: c.amount ?? 1,
      // Teto do atributo p/ ESTE aumento (RAW: talentos comuns 20, Epic Boons 30).
      // O 5etools codifica só o 30 (`max` no nível da entrada); ausente = 20
      // (default aplicado na derivação). Ver engine/abilities.finalScores (TC-0022).
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

/** Habilidades canônicas (evita depender de import p/ manter este módulo puro). */
const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Bônus livre (+1 em qualquer atributo) sintetizado p/ feats LEGACY sem campo
 * `ability` - padrão de adaptação DMG 2024 (Plutonium faz o mesmo). Usado pelo
 * ChoiceList (renderiza) e pelo guia (mede a completude com a MESMA lista). */
export const LEGACY_ABILITY_CHOICE = {
  id: 'ability-legacy',
  kind: 'ability',
  count: 1,
  label: 'Ability Score Increase',
  pool: { type: 'ability', alternatives: [{ from: [...ABILITY_KEYS], count: 1, amount: 1 }] },
};

/**
 * Aumentos de atributo FIXOS de um campo `ability` de talento (ex: Great Weapon
 * Master XPHB → `[{str:1}]`). São GRANTS automáticos (não escolhas), então não
 * geram um Choice - a derivação os aplica direto (ver resolve.deriveFeatAbilityBoosts).
 * As entradas com `choose` são tratadas à parte por parseAbilityField.
 * @param {any[]} abilityField
 * @returns {import('../schema/character').AbilityBoost[]}
 */
export function fixedAbilityBoosts(abilityField) {
  const out = [];
  for (const entry of abilityField ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    for (const ab of ABILITY_KEYS) {
      // `max` (só o 30 dos Epic Boons é codificado; ausente = 20) viaja no boost
      // p/ o cap em finalScores (TC-0022) - ex: Boon of Irresistible Offense +1 Str max 30.
      if (typeof entry[ab] === 'number' && entry[ab] !== 0) out.push({ ability: ab, amount: entry[ab], max: entry.max });
    }
  }
  return out;
}

const ABILITY_FULL_NAME = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

/**
 * Lê o `ability` de `additionalSpells` (Spellbook, B2.4). Quando a entidade
 * concede magias mas deixa o ATRIBUTO de conjuração à escolha (linhagens élficas:
 * int/wis/cha; várias origens e talentos fazem o mesmo), vira um Choice
 * kind 'spellAbility'. Genérico: vale p/ raça, talento, background - qualquer
 * entidade com `additionalSpells`. Sem `choose`, nada é empurrado (o atributo é
 * fixo e a derivação o lê direto).
 */
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
    return; // um atributo por entidade (todos os grupos compartilham a escolha)
  }
}

// Rótulo dos campos estruturados de traço de dano (feats/raças). Só o `resist`
// tem `choose` no dataset atual (Boon of Energy Resistance, Dragonscarred,
// Reborn…), mas `immune`/`vulnerable` compartilham a forma - suportados juntos.
const DAMAGE_KIND_LABEL = {
  resist: 'Damage Resistance',
  immune: 'Damage Immunity',
  vulnerable: 'Damage Vulnerability',
};

/**
 * Lê um campo de traço de dano (`resist`/`immune`/`vulnerable`). Entradas
 * string são GRANTS fixos (a derivação as aplica - ver engine/damageTraits);
 * entradas `{choose:{from,count}}` viram um Choice de lista (TC-0014).
 */
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
 * Filtro de armas de uma escolha `weaponProf` (Kensei): a arma crua passa?
 * `allow` são exceções por nome (Longbow, que é Heavy mas o texto permite);
 * `kind` restringe a melee/ranged; `noProps` veta códigos de propriedade
 * (H = Heavy, S = Special). Só armas mundanas simples/marciais entram
 * (weaponCategory presente).
 * @param {{ kind?: 'melee'|'ranged', noProps?: string[], allow?: string[] }|null} filter
 * @param {object} raw  item cru do 5etools (items-base)
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
  return true;
}

/** Lê o campo `feats` (concede talento à escolha - recursivo). */
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
 * Extrai os descritores de escolha de uma entidade 5etools (espécie/talento).
 * @param {object} entity
 * @param {{ level?: number, bag?: object|null }} [opts]
 *   level: nível do personagem (gate das escolhas de magia por nível do
 *   `additionalSpells`, ex: Ritual Caster XPHB destrava picks em 1/5/9/13/17;
 *   sem ele, tudo aparece). bag: choice-bag salvo da entidade - necessário para
 *   as escolhas de MAGIA (o grupo ativo de um `additionalSpells` com várias
 *   listas depende do pick `spellSet-0`; ver grantedSpells, TC-0011).
 * @returns {Choice[]}
 */
export function parseChoices(entity, { level = Infinity, bag = null } = {}) {
  const raw = [];
  const push = (c) => raw.push(c);
  parseAbilityField(entity?.ability, push);
  parseProfField(entity?.skillProficiencies, 'skill', push);
  parseProfField(entity?.toolProficiencies, 'tool', push);
  parseProfField(entity?.languageProficiencies, 'language', push);
  parseStlField(entity?.skillToolLanguageProficiencies, push);
  parseDamageField(entity?.resist, 'resist', push);
  parseDamageField(entity?.immune, 'immune', push);
  parseDamageField(entity?.vulnerable, 'vulnerable', push);
  parseFeatField(entity?.feats, push);
  parseSpellAbilityField(entity?.additionalSpells, push);
  // Escolhas de magia (folhas {choose} + seletor de lista) - já vêm com id.
  for (const c of additionalSpellChoices(entity?.additionalSpells, level, bag)) push(c);

  // ids estáveis por tipo: skill-0, skill-1, tool-0, feat-0… (descritores que
  // já trazem id - os de magia - ficam com ele; grantedSpells consome o mesmo).
  const counters = {};
  return raw.map((c) => {
    if (c.id) return c;
    const n = counters[c.kind] ?? 0;
    counters[c.kind] = n + 1;
    return { ...c, id: `${c.kind}-${n}` };
  });
}

/**
 * Caminha recursivamente por um choice-bag salvo e junta os picks de um tipo.
 * @param {object} bag
 * @param {'skill'|'tool'|'language'|'feat'} kind
 * @param {string[]} [out]
 * @returns {string[]}
 */
export function collectChoicePicks(bag, kind, out = []) {
  for (const choice of Object.values(bag ?? {})) {
    if (!choice || typeof choice !== 'object') continue;
    // Picks podem ser strings (pool de um tipo) ou {kind,value} (pool MISTO).
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
 * O atributo de conjuração escolhido num choice-bag (kind 'spellAbility'), ou
 * null. Usado pela derivação das origens de magia raciais/de talento (B2.4).
 * @param {object} bag
 * @returns {string|null}
 */
export function spellAbilityPick(bag) {
  // NÃO recursa nas sub-bags: o atributo escolhido dentro de um TALENTO que a
  // espécie concede pertence à origem daquele talento, não à origem racial.
  for (const choice of Object.values(bag ?? {})) {
    if (choice?.kind === 'spellAbility' && choice.picks?.[0]) return choice.picks[0];
  }
  return null;
}

/**
 * Caminha recursivamente por um choice-bag e junta os aumentos de atributo
 * (choices kind 'ability', com picks {ability, amount}) - inclusive os embutidos
 * em talentos escolhidos (sub-bags, ex: ASI dentro de um slot de feat de classe).
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
