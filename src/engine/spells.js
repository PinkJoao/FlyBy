// =============================================================================
// spells: a resolução e a classificação de magias
// =============================================================================
// O QUE FAZ
//   A contraparte do items.js para magias. Elas vêm fatiadas por livro
//   (db['spells-xphb']) e aqui viram um catálogo único, deduplicado por reprint
//   (latestOnly). O personagem guarda só a DECISÃO (ContentRef); nível, escola,
//   tempo, alcance e save são resolvidos ao vivo. O mapa magia para classe vem de
//   spells/sources.json (db['spell-sources']), não da magia.
//
// FUNÇÕES
//   schoolName(code), allSpells(db): escola e o catálogo deduplicado.
//   escapeRegExp(s), bySrdShortName(list, lc): a busca por nome CURTO do SRD.
//   resolveSpellObj(db, name, source): uma magia por nome (e fonte).
//   byAlternateName(list, lc): pelo outro nome, compêndio completo x SRD
//     (srdNames.js): a ficha feita num modo abre no outro.
//   srdSpellNames(name): os nomes pelos quais procurá-la no dnd5e.
//   ordinalLevel(level), spellLevelLabel(level), castingTimeLabel(spell),
//     castingTimeRank(spell), rangeLabel(spell), rangeRank(spell),
//     componentsText(spell), materialText(spell): rótulos e ranks da aba.
//   saveOrAttack(spell), isRitual(spell), isConcentration(spell): classificação.
//   classSpellList(db, className): os nomes da lista de uma classe.
//   spellClassIndex(db): magia para as classes que a têm (para filtrar por
//     qualquer classe: o mestre pode liberar Warlock para o Bardo).
//   classDisplayName(classId): 'wizard' vira 'Wizard'.
//   spellChoosePredicate(pool, db): o predicado de um `{choose}` de magia.
//
// DECISÕES E ARMADILHAS
//   - Nome CURTO x nome do LIVRO (TC-0079): o SRD tira o nome próprio do mago do
//     título ("Hideous Laughter"), o 5etools mantém ("Tasha's Hideous Laughter").
//     Sem a rede, a magia PREPARADA de um ator do Foundry não resolve e some do
//     export sem aviso. A regra é DERIVADA ("<alguém>'s <nome curto>", só com
//     candidato ÚNICO): 13 dos 16 casos do spells24. Os 3 que o SRD reescreveu
//     inteiro estão em SPELL_SHORT_NAME_EXCEPTIONS (Arcane Hand, Arcane Sword,
//     Arcanist's Magic Aura). srdSpellNames é o sentido inverso.
//   - A comparação de nome é insensível a caixa: as concessões vêm em minúsculas.
//   - classSpellList casa pelo NOME da classe em qualquer fonte (PHB e XPHB).
//   - spellChoosePredicate: sem filtro nem lista, toda magia vale ("level=0" do
//     Pact of the Tome restringe; o "" do Bardo PHB 18 não).
// -----------------------------------------------------------------------------

import { latestOnly } from '../selector/reprints';
import { SPELL_SOURCES } from '../data/config';
import { parseSpellChooseFilter } from './grantedSpells';
import { alternateNames } from './srdNames';

export const SPELL_SCHOOLS = {
  A: 'Abjuration',
  C: 'Conjuration',
  D: 'Divination',
  E: 'Enchantment',
  V: 'Evocation',
  I: 'Illusion',
  N: 'Necromancy',
  T: 'Transmutation',
  P: 'Psionic',
};

export function schoolName(code) {
  return SPELL_SCHOOLS[code] ?? code ?? '';
}

/**
 * O catálogo completo de magias, deduplicado por reprint.
 * @param {object} db
 * @returns {object[]}
 */
export function allSpells(db) {
  if (!db) return [];
  const out = [];
  for (const src of SPELL_SOURCES) {
    const file = db[`spells-${src}`];
    if (Array.isArray(file?.spell)) out.push(...file.spell);
  }
  return latestOnly(out);
}

const SPELL_SHORT_NAME_EXCEPTIONS = {
  'arcane hand': "bigby's hand",
  'arcane sword': "mordenkainen's sword",
  "arcanist's magic aura": "nystul's magic aura",
};

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A magia que corresponde a um nome curto do SRD, ou null.
 * @param {object[]} list
 * @param {string} lc
 */
function bySrdShortName(list, lc) {
  const exception = SPELL_SHORT_NAME_EXCEPTIONS[lc];
  if (exception) return list.find((s) => s.name.toLowerCase() === exception) ?? null;
  const re = new RegExp(`^\\S+['’]s ${escapeRegExp(lc)}$`, 'i');
  const hits = list.filter((s) => re.test(s.name));
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Uma magia por nome e fonte, com a rede de nome curto.
 * @param {object} db
 * @param {string} name
 * @param {string} [source]
 * @returns {object|null}
 */
export function resolveSpellObj(db, name, source) {
  if (!db || !name) return null;
  const list = allSpells(db);
  const lc = name.toLowerCase();
  if (source) {
    const src = source.toLowerCase();
    const exact = list.find((s) => s.name.toLowerCase() === lc && s.source?.toLowerCase() === src);
    if (exact) return exact;
  }
  return list.find((s) => s.name.toLowerCase() === lc) ?? bySrdShortName(list, lc) ?? byAlternateName(list, lc);
}

/** A magia pelo outro nome (compêndio completo x SRD), ou null. */
function byAlternateName(list, lc) {
  for (const alt of alternateNames(lc)) {
    const hit = list.find((s) => s.name.toLowerCase() === alt);
    if (hit) return hit;
  }
  return null;
}

/**
 * Os nomes pelos quais procurar a magia no dnd5e (TC-0079).
 * @param {string} name
 * @returns {string[]}
 */
export function srdSpellNames(name) {
  const lc = (name ?? '').trim().toLowerCase();
  if (!lc) return [];
  const out = [lc];
  const stripped = lc.replace(/^\S+['’]s /, '');
  if (stripped !== lc) out.push(stripped);
  for (const [short, ours] of Object.entries(SPELL_SHORT_NAME_EXCEPTIONS)) {
    if (ours === lc) out.push(short);
  }
  return out;
}

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

/** "1st", "2nd"...; vazio para cantrip. */
export function ordinalLevel(level) {
  return ORDINAL[level] ?? `${level}th`;
}

/** O rótulo da categoria de nível. */
export function spellLevelLabel(level) {
  return level === 0 ? 'Cantrips' : `${ordinalLevel(level)} Level`;
}

const TIME_UNITS = {
  action: 'Action',
  bonus: 'Bonus Action',
  reaction: 'Reaction',
  minute: 'Minute',
  hour: 'Hour',
  round: 'Round',
};

/** O tempo de conjuração legível. */
export function castingTimeLabel(spell) {
  const t = spell?.time?.[0];
  if (!t) return '';
  const unit = TIME_UNITS[t.unit] ?? t.unit ?? '';
  const n = t.number ?? 1;
  const plural = n > 1 && unit && !/Action$/.test(unit) ? 's' : '';
  return `${n} ${unit}${plural}`.trim();
}

const TIME_RANK = { action: 0, bonus: 1, reaction: 2, round: 3, minute: 4, hour: 5 };

/** Rank de tempo de conjuração (menor é mais rápido). */
export function castingTimeRank(spell) {
  const t = spell?.time?.[0];
  if (!t) return 99;
  return (TIME_RANK[t.unit] ?? 90) * 1000 + (t.number ?? 1);
}

/** O alcance legível. */
export function rangeLabel(spell) {
  const r = spell?.range;
  if (!r) return '';
  const dist = r.distance ?? {};
  const shape = r.type && r.type !== 'point' ? r.type : null;
  const amt = () => {
    if (dist.type === 'feet') return `${dist.amount} feet`;
    if (dist.type === 'miles') return `${dist.amount} ${dist.amount === 1 ? 'mile' : 'miles'}`;
    if (dist.type === 'touch') return 'Touch';
    if (dist.type === 'self') return 'Self';
    if (dist.type === 'sight') return 'Sight';
    if (dist.type === 'unlimited') return 'Unlimited';
    return dist.type ?? '';
  };
  if (shape) {
    const size = dist.type === 'feet' ? `${dist.amount}-foot ${shape}` : `${shape}`;
    return `Self (${size})`;
  }
  return amt();
}

export function rangeRank(spell) {
  const dist = spell?.range?.distance ?? {};
  if (dist.type === 'self') return 0;
  if (dist.type === 'touch') return 1;
  if (dist.type === 'feet') return 10 + (dist.amount ?? 0);
  if (dist.type === 'miles') return 100000 + (dist.amount ?? 0) * 5280;
  if (dist.type === 'sight') return 1e9;
  if (dist.type === 'unlimited') return 1e9 + 1;
  return 1e8;
}

/** "V, S, M". */
export function componentsText(spell) {
  const c = spell?.components;
  if (!c) return '';
  const parts = [];
  if (c.v) parts.push('V');
  if (c.s) parts.push('S');
  if (c.m) parts.push('M');
  return parts.join(', ');
}

/** Os materiais, quando houver. */
export function materialText(spell) {
  const m = spell?.components?.m;
  if (!m) return null;
  return typeof m === 'string' ? m : (m.text ?? null);
}

/**
 * A magia é ataque, save ou nenhum?
 * @returns {{ kind: 'attack'|'save'|'none', detail: string|null }}
 */
export function saveOrAttack(spell) {
  if (spell?.spellAttack?.length) {
    const t = spell.spellAttack[0];
    return { kind: 'attack', detail: t === 'R' ? 'Ranged' : t === 'M' ? 'Melee' : 'Attack' };
  }
  if (spell?.savingThrow?.length) {
    const ab = spell.savingThrow[0];
    return { kind: 'save', detail: ab ? `${ab.charAt(0).toUpperCase()}${ab.slice(1)}` : 'Save' };
  }
  return { kind: 'none', detail: null };
}

/** É ritual? */
export function isRitual(spell) {
  return !!spell?.meta?.ritual;
}

/** Exige concentração? */
export function isConcentration(spell) {
  return (spell?.duration ?? []).some((d) => d.concentration);
}

/**
 * Os nomes (minúsculos) da lista de magias de uma classe.
 * @param {object} db
 * @param {string} className
 * @returns {Set<string>}
 */
export function classSpellList(db, className) {
  const out = new Set();
  const map = db?.['spell-sources'];
  if (!map || !className) return out;
  const want = className.toLowerCase();
  for (const bySource of Object.values(map)) {
    for (const [spellName, info] of Object.entries(bySource)) {
      const classes = info?.class ?? [];
      if (classes.some((c) => c?.name?.toLowerCase() === want)) {
        out.add(spellName.toLowerCase());
      }
    }
  }
  return out;
}

/**
 * O índice inverso: magia para as classes que a têm.
 * @param {object} db
 * @returns {Map<string, string[]>}
 */
export function spellClassIndex(db) {
  const out = new Map();
  const map = db?.['spell-sources'];
  if (!map) return out;
  for (const bySource of Object.values(map)) {
    for (const [spellName, info] of Object.entries(bySource)) {
      const key = spellName.toLowerCase();
      const set = out.get(key) ?? new Set();
      for (const c of info?.class ?? []) if (c?.name) set.add(c.name);
      if (set.size) out.set(key, set);
    }
  }
  return new Map([...out].map(([k, v]) => [k, [...v].sort()]));
}

/** O classId interno como nome de classe do 5etools. */
export function classDisplayName(classId) {
  if (!classId) return '';
  return classId.charAt(0).toUpperCase() + classId.slice(1);
}

/**
 * O predicado de elegibilidade de uma escolha de magia.
 * @param {{filter?: string|null, from?: string[]|null}} pool
 * @param {object} db
 * @returns {(spell: object) => boolean}
 */
export function spellChoosePredicate(pool, db) {
  if (Array.isArray(pool?.from) && pool.from.length) {
    const names = new Set(pool.from.map((n) => String(n).toLowerCase()));
    return (spell) => names.has(spell.name.toLowerCase());
  }
  const f = parseSpellChooseFilter(pool?.filter ?? '');
  const classLists = (f.classes ?? []).map((c) => classSpellList(db, c));
  return (spell) => {
    if (f.levels && !f.levels.includes(spell.level)) return false;
    if (classLists.length && !classLists.some((set) => set.has(spell.name.toLowerCase()))) return false;
    if (f.schools && !f.schools.includes(String(spell.school ?? '').toUpperCase())) return false;
    if (f.sources && !f.sources.includes(String(spell.source ?? '').toUpperCase())) return false;
    if (f.ritual && !isRitual(spell)) return false;
    if (f.attack && !(spell.spellAttack ?? []).some((a) => f.attack.includes(String(a).toUpperCase()))) return false;
    return true;
  };
}
