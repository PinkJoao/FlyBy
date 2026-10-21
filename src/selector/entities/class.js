// =============================================================================
// class: a entity de classe
// =============================================================================
// O QUE FAZ
//   Uma entrada por classe (a versão atual, via resolveClassObj). Filtros: Primary
//   Ability, Caster (Full, Half, Pact, Martial), Saving Throws, Armor, Weapons e Hit
//   Die. O card mostra o atributo principal e o TIPO de conjurador, com cor (caster
//   azul, half roxo, martial vermelho); o dado de vida fica só no preview (um
//   novato não entende "d10" solto). O texto "Info" e a arte vêm do fluff.
//
// FUNÇÕES
//   cap(s), stripTags(s): texto.
//   casterLabel(c): 'full'/'pact' é Caster, '1/2'/'artificer' é Half, nada é
//     Martial.
//   primaryAbilities(c), armorTokens(c), weaponTokens(c), skillsText(c): os
//     campos do card e dos filtros.
//   classFluff(c, db): a entrada de fluff da classe.
//   Exporta classEntity.
//
// DECISÕES E ARMADILHAS
//   - `sorts`: Hit Die, pelo tamanho do dado de vida.
// -----------------------------------------------------------------------------

import { CLASS_NAMES } from '../../data/config';
import { resolveClassObj } from '../../engine/resolve';

const ABILITY_LABEL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const ABILITY_ABBR = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };
const ARMOR_TOKENS = ['light', 'medium', 'heavy', 'shield'];

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** O tipo de conjurador de uma classe. */
function casterLabel(c) {
  const p = c.casterProgression;
  if (p === 'full' || p === 'pact') return 'Caster';
  if (p === '1/2' || p === 'artificer') return 'Half Caster';
  return 'Martial';
}

const CASTER_TONE = { Caster: 'blue', 'Half Caster': 'accent', Martial: 'red' };

/** Os atributos primários ([{str:true},{dex:true}] vira [str, dex]). */
function primaryAbilities(c) {
  const out = [];
  for (const entry of c.primaryAbility ?? []) {
    for (const [k, v] of Object.entries(entry)) if (v) out.push(k);
  }
  return out;
}

function armorTokens(c) {
  const out = [];
  for (const a of c.startingProficiencies?.armor ?? []) {
    const s = String(a).toLowerCase();
    for (const t of ARMOR_TOKENS) if (s.includes(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

function weaponTokens(c) {
  const out = [];
  for (const w of c.startingProficiencies?.weapons ?? []) {
    const s = String(w).toLowerCase();
    if (s === 'simple' || s === 'martial') out.push(s);
  }
  return out;
}

/** Remove as tags {@filter X|...}. */
function stripTags(s) {
  return String(s).replace(/\{@\w+ ([^|}]+)[^}]*\}/g, '$1');
}

function skillsText(c) {
  const block = c.startingProficiencies?.skills?.[0];
  if (!block) return null;
  if (block.any) return `Any ${block.any}`;
  const ch = block.choose;
  if (!ch) return null;
  const list = (ch.from ?? []).map((s) => cap(String(s))).join(', ');
  return `Choose ${ch.count ?? 1}: ${list}`;
}

const classEntity = {
  type: 'class',
  title: 'Class',

  list: (db) => CLASS_NAMES.map((n) => resolveClassObj(db, n)).filter(Boolean),

  idOf: (c) => `${c.name}|${c.source}`,

  precompute: (c) => ({
    searchText: `${c.name} ${c.source}`.toLowerCase(),
    filterValues: {
      primary: primaryAbilities(c),
      caster: [casterLabel(c)],
      saves: c.proficiency ?? [],
      armor: armorTokens(c).map(cap),
      weapons: weaponTokens(c).map(cap),
      die: [`d${c.hd?.faces ?? '?'}`],
    },
  }),

  sorts: [
    { value: 'hitDie', label: 'Hit Die', defaultDir: 'desc', dirLabels: ['Smallest first', 'Largest first'], keyOf: (c) => c.hd?.faces ?? null },
  ],

  filters: [
    {
      id: 'primary',
      header: 'Primary Ability',
      options: Object.entries(ABILITY_LABEL).map(([value, label]) => ({ value, label })),
    },
    {
      id: 'caster',
      header: 'Caster',
      options: ['Caster', 'Half Caster', 'Martial'],
    },
    {
      id: 'saves',
      header: 'Saving Throws',
      options: Object.entries(ABILITY_LABEL).map(([value, label]) => ({ value, label })),
    },
    { id: 'armor', header: 'Armor', options: ['Light', 'Medium', 'Heavy', 'Shield'] },
    { id: 'weapons', header: 'Weapons', options: ['Simple', 'Martial'] },
    { id: 'die', header: 'Hit Die', derive: true },
  ],

  /** Atributo primário e tipo de conjurador, depois as proficiências. */
  meta: (c) => {
    const saves = (c.proficiency ?? []).map((a) => ABILITY_ABBR[a] ?? a).join(', ');
    const armor = armorTokens(c).map(cap).join(', ');
    const weapons = (c.startingProficiencies?.weapons ?? []).map((w) => cap(stripTags(w))).join(', ');
    const skills = skillsText(c);
    const caster = casterLabel(c);
    return [
      { value: caster, tone: CASTER_TONE[caster] },
      ...primaryAbilities(c).map((a) => ({ value: ABILITY_LABEL[a] ?? a, tone: 'neutral' })),
      { label: 'Hit Die', value: `d${c.hd?.faces ?? '?'}` },
      { label: 'Saves', value: saves || '-' },
      { label: 'Armor', value: armor || 'None' },
      { label: 'Weapons', value: weapons || '-' },
      ...(skills ? [{ label: 'Skills', value: skills }] : []),
    ];
  },

  card: (c) => {
    const caster = casterLabel(c);
    return {
      title: c.name,
      subtitle: c.source,
      badges: [
        ...primaryAbilities(c).map((a) => ({ text: ABILITY_LABEL[a] ?? a, tone: 'neutral' })),
        { text: caster, tone: CASTER_TONE[caster] },
      ],
    };
  },

  entries: (c, db) => classFluff(c, db)?.entries ?? [],

  fluff: (c, db) => {
    const images = classFluff(c, db)?.images;
    return images?.length ? { images } : null;
  },
};

/** A entrada de fluff da classe, preferindo a mesma fonte. */
function classFluff(c, db) {
  const list = db?.[`fluff-class-${c.name.toLowerCase()}`]?.classFluff ?? [];
  return (
    list.find((f) => f.name === c.name && f.source === c.source) ??
    list.find((f) => f.name === c.name) ??
    list[0] ??
    null
  );
}

export default classEntity;
