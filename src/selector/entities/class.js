// =============================================================================
// Entity config: Class
// =============================================================================
// Uma entrada por classe (a versão mais recente via resolveClassObj). Filtros:
// Primary Ability, Caster (Full/Half/Pact/Martial), Saving Throws, Armor,
// Weapons e Hit Die. O card mostra o atributo principal e o TIPO de conjurador
// (half-casters apontados corretamente); o dado de vida fica só no preview
// (novato não entende "d10" solto no card).
// -----------------------------------------------------------------------------

import { CLASS_NAMES } from '../../data/config';
import { resolveClassObj } from '../../engine/resolve';

const ABILITY_LABEL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const ABILITY_ABBR = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };
const ARMOR_TOKENS = ['light', 'medium', 'heavy', 'shield'];

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** 'full'|'pact' → Caster; '1/2'|'artificer' → Half Caster; nada → Martial. */
function casterLabel(c) {
  const p = c.casterProgression;
  if (p === 'full' || p === 'pact') return 'Caster';
  if (p === '1/2' || p === 'artificer') return 'Half Caster';
  return 'Martial';
}

/** Esquema de cores dos 3 tipos: caster azul, half roxo (accent), martial vermelho. */
const CASTER_TONE = { Caster: 'blue', 'Half Caster': 'accent', Martial: 'red' };

/** primaryAbility [{str:true},{dex:true}] → ['str','dex']. */
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

/** Remove tags {@filter X|...} → X (p/ valores de meta legíveis). */
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

  /** Preview: tags de atributo primário + tipo (colorido), depois proficiências. */
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

  // Texto "Info" da classe (fluff-class-*.json) → conteúdo principal do preview.
  entries: (c, db) => classFluff(c, db)?.entries ?? [],

  // Só a arte (as entries vêm de `entries()`, p/ não duplicar).
  fluff: (c, db) => {
    const images = classFluff(c, db)?.images;
    return images?.length ? { images } : null;
  },
};

/** Casa a classe com sua entrada de fluff (preferindo a mesma fonte). */
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
