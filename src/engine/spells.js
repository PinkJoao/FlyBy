// =============================================================================
// spells - resolução e classificação de magias do 5e.tools (Spellbook, Fase B2)
// =============================================================================
// Puro: sem rede/DOM. Contraparte de engine/items.js para o lado das magias.
// As magias vêm fatiadas por livro (db['spells-xphb'].spell, …); aqui elas são
// concatenadas num catálogo único e deduplicadas por reprint (PHB→XPHB) via
// latestOnly, exatamente como os itens. O personagem guarda só a DECISÃO (quais
// magias preparou, como ContentRef nome+fonte); a mecânica (nível, escola,
// tempo, alcance, save/ataque) é resolvida ao vivo contra o `db`.
//
// O mapa magia→classe NÃO fica na magia - vem de spells/sources.json
// (db['spell-sources']), keyed [FONTE_DA_MAGIA][Nome].class = [{name, source}].
// É daí que sai "a lista de magias do Wizard" (o filtro padrão do seletor, R10).
// -----------------------------------------------------------------------------

import { latestOnly } from '../selector/reprints';
import { SPELL_SOURCES } from '../data/config';
import { parseSpellChooseFilter } from './grantedSpells';

/** Código de escola do 5etools → nome legível. */
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
 * Catálogo completo de magias: concatena todos os arquivos por livro que já
 * chegaram no `db` e deduplica reprints (mantém a versão atual, ex: XPHB sobre
 * PHB) - mesmo padrão de itemEntity.list.
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

/**
 * Resolve uma magia por nome (+fonte, quando dada). Exato por nome+fonte
 * primeiro; senão a versão atual de mesmo nome (após dedup de reprint).
 * A comparação é INSENSÍVEL a caixa: as magias concedidas vêm do 5etools em
 * minúsculas ("faerie fire|xphb"), enquanto o catálogo usa "Faerie Fire".
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
  return list.find((s) => s.name.toLowerCase() === lc) ?? null;
}

// ---------------------------------------------------------------------------
// Rótulos e ranks (para exibição, agrupamento e ordenação na aba)
// ---------------------------------------------------------------------------

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

/** "1st", "2nd"… para o nível (1–9); '' para cantrip (0). */
export function ordinalLevel(level) {
  return ORDINAL[level] ?? `${level}th`;
}

/** Rótulo da CATEGORIA de nível: 0 → "Cantrips", 1 → "1st Level", … (R3). */
export function spellLevelLabel(level) {
  return level === 0 ? 'Cantrips' : `${ordinalLevel(level)} Level`;
}

/** Unidades de tempo de conjuração → rótulo legível. */
const TIME_UNITS = {
  action: 'Action',
  bonus: 'Bonus Action',
  reaction: 'Reaction',
  minute: 'Minute',
  hour: 'Hour',
  round: 'Round',
};

/** "1 Action", "1 Bonus Action", "10 Minutes"… do primeiro `time[]`. */
export function castingTimeLabel(spell) {
  const t = spell?.time?.[0];
  if (!t) return '';
  const unit = TIME_UNITS[t.unit] ?? t.unit ?? '';
  const n = t.number ?? 1;
  const plural = n > 1 && unit && !/Action$/.test(unit) ? 's' : '';
  return `${n} ${unit}${plural}`.trim();
}

// Ordem de tempo de conjuração p/ ordenar (mais rápido → mais lento).
const TIME_RANK = { action: 0, bonus: 1, reaction: 2, round: 3, minute: 4, hour: 5 };

/** Rank de tempo de conjuração para ordenação (menor = mais rápido). */
export function castingTimeRank(spell) {
  const t = spell?.time?.[0];
  if (!t) return 99;
  return (TIME_RANK[t.unit] ?? 90) * 1000 + (t.number ?? 1);
}

/** Rótulo de alcance: "Self", "Touch", "60 feet", "Self (15-foot cone)"… */
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
    // ex: line/cone/cube/sphere/emanation → "Self (30-foot cone)" quando parte de si.
    const size = dist.type === 'feet' ? `${dist.amount}-foot ${shape}` : `${shape}`;
    return `Self (${size})`;
  }
  return amt();
}

// Rank de alcance para ordenação (self/touch primeiro, depois por pés/milhas).
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

/** "V, S, M" a partir de `components`. */
export function componentsText(spell) {
  const c = spell?.components;
  if (!c) return '';
  const parts = [];
  if (c.v) parts.push('V');
  if (c.s) parts.push('S');
  if (c.m) parts.push('M');
  return parts.join(', ');
}

/** Materiais (texto), quando houver. `m` pode ser string ou { text }. */
export function materialText(spell) {
  const m = spell?.components?.m;
  if (!m) return null;
  return typeof m === 'string' ? m : (m.text ?? null);
}

/**
 * Classifica a magia como ataque, save ou nenhum (p/ o group-by "Save/Attack",
 * R5). `spellAttack` é ["R"]/["M"]; `savingThrow` é ["dexterity"], etc.
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

/** É ritual? (5etools guarda em `meta.ritual`). */
export function isRitual(spell) {
  return !!spell?.meta?.ritual;
}

/** Exige concentração? (algum `duration[].concentration`). */
export function isConcentration(spell) {
  return (spell?.duration ?? []).some((d) => d.concentration);
}

// ---------------------------------------------------------------------------
// Lista de magias por classe (o filtro padrão do seletor, R10)
// ---------------------------------------------------------------------------

/**
 * Conjunto de NOMES de magia (minúsculos) disponíveis para uma classe, lido do
 * mapa reverso spells/sources.json (db['spell-sources']). Casa pelo NOME da
 * classe ("Wizard") em qualquer fonte, já que a mesma classe aparece como
 * {name:'Wizard', source:'PHB'} e {source:'XPHB'} - a dedup por reprint no
 * catálogo cuida de não duplicar a magia em si.
 * @param {object} db
 * @param {string} className  ex: "Wizard" (nome capitalizado como no 5etools)
 * @returns {Set<string>}  nomes de magia em minúsculo
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
 * Índice INVERSO completo: nome da magia (minúsculo) → nomes de classe que a
 * têm na lista. Uma varredura só do `spell-sources`, para o seletor poder
 * filtrar por QUALQUER classe (não só a da origem) - o mestre pode liberar uma
 * magia de Warlock para o Bardo.
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
  // Set → array ordenado (opções de filtro estáveis).
  return new Map([...out].map(([k, v]) => [k, [...v].sort()]));
}

/** classId interno ('wizard') → nome de classe do 5etools ('Wizard'). */
export function classDisplayName(classId) {
  if (!classId) return '';
  return classId.charAt(0).toUpperCase() + classId.slice(1);
}

// ---------------------------------------------------------------------------
// Predicado de um `{choose}` de magia (TC-0011)
// ---------------------------------------------------------------------------

/**
 * Predicado de elegibilidade para o pool de uma escolha de magia
 * (`{ type:'spell', filter, from }` - ver grantedSpells). Filtro em string
 * ("level=0|class=Cleric") vira condições; `from` é uma lista fechada de
 * nomes. Sem filtro nem lista, toda magia vale ("level=0" do Pact of the Tome
 * restringe; `""` do Bard PHB nível 18 não).
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
  // Cada classe do filtro vira o conjunto de nomes da sua lista (sources.json).
  const classLists = (f.classes ?? []).map((c) => classSpellList(db, c));
  return (spell) => {
    if (f.levels && !f.levels.includes(spell.level)) return false;
    if (classLists.length && !classLists.some((set) => set.has(spell.name.toLowerCase()))) return false;
    if (f.schools && !f.schools.includes(String(spell.school ?? '').toUpperCase())) return false;
    if (f.ritual && !isRitual(spell)) return false;
    if (f.attack && !(spell.spellAttack ?? []).some((a) => f.attack.includes(String(a).toUpperCase()))) return false;
    return true;
  };
}
