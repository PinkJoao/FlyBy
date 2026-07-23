// =============================================================================
// Entity config: Species (Race)
// =============================================================================
// Models the relevant filters (à la 5etools filter-races.js). Filter VALUES are
// stable, language-independent KEYS (e.g. 'fly', 'spellcasting'); the LABELS are
// kept in separate maps. Also exposes `meta()` - size / speed / creature type,
// highlighting non-standard values (fast speed, non-humanoid type, etc.).
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';
import { resolveCopies } from '../copy';
import { legacyStandaloneSpecies } from '../../engine/speciesData';
import { withLegacyTable } from '../../engine/legacyFiendishLegacies';
import { withLineageUmbrella } from '../../engine/legacyHalflingLineages';

// --- Stable keys → display labels (the only place a translator touches) -------
const SIZE_LABEL = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', V: 'Varies' };

const SPEED_LABEL = { walk: 'Walk', fly: 'Fly', swim: 'Swim', climb: 'Climb' };

const TRAIT_LABEL = {
  darkvision: 'Darkvision',
  'superior-darkvision': 'Superior Darkvision',
  blindsight: 'Blindsight',
  spellcasting: 'Spellcasting',
  'skill-proficiency': 'Skill Proficiency',
  'tool-proficiency': 'Tool Proficiency',
  'damage-resistance': 'Damage Resistance',
  'natural-armor': 'Natural Armor',
  'natural-weapon': 'Natural Weapon',
  'powerful-build': 'Powerful Build',
  'improved-resting': 'Improved Resting',
};

// --- Derivation: 5etools fields → stable keys ---------------------------------
function speedObj(speed) {
  if (speed == null) return { walk: 0 };
  return typeof speed === 'number' ? { walk: speed } : speed;
}

function speedKeys(speed) {
  const s = speedObj(speed);
  const keys = [];
  if (s.walk) keys.push('walk');
  if (s.fly) keys.push('fly');
  if (s.swim) keys.push('swim');
  if (s.climb) keys.push('climb');
  return keys;
}

function creatureTypes(race) {
  const types = race.creatureTypes ?? ['humanoid'];
  return types.map((t) => (typeof t === 'string' ? t : 'humanoid'));
}

function traitKeys(race) {
  const keys = [];
  if (race.darkvision >= 120) keys.push('superior-darkvision');
  else if (race.darkvision) keys.push('darkvision');
  if (race.blindsight) keys.push('blindsight');
  if (race.additionalSpells) keys.push('spellcasting');
  if (race.skillProficiencies) keys.push('skill-proficiency');
  if (race.toolProficiencies) keys.push('tool-proficiency');
  if (race.resist) keys.push('damage-resistance');
  if (Array.isArray(race.traitTags)) {
    if (race.traitTags.includes('Natural Armor')) keys.push('natural-armor');
    if (race.traitTags.includes('Natural Weapon')) keys.push('natural-weapon');
    if (race.traitTags.includes('Powerful Build')) keys.push('powerful-build');
    if (race.traitTags.includes('Improved Resting')) keys.push('improved-resting');
  }
  return keys;
}

// --- Display helpers ----------------------------------------------------------
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function sizeText(size) {
  const arr = (Array.isArray(size) ? size : [size]).filter(Boolean);
  return arr.map((s) => SIZE_LABEL[s] ?? s).join(' or ') || '-';
}

function speedText(speed) {
  const s = speedObj(speed);
  const parts = [`${s.walk ?? 0} ft`];
  for (const mode of ['fly', 'swim', 'climb']) {
    if (s[mode]) parts.push(s[mode] === true ? mode : `${mode} ${s[mode]} ft`);
  }
  return parts.join(', ');
}

/** Builds the {value,label} option list for a fixed-key filter. */
function options(labelMap) {
  return Object.entries(labelMap).map(([value, label]) => ({ value, label }));
}

const raceEntity = {
  type: 'race',
  title: 'Species',

  // Resolve herança `_copy` (size/speed/traits vêm do pai) → só versões atuais
  // (latestOnly) → e só JOGÁVEIS (fora as "NPC Species"). As sub-raças/linhagens
  // (`_versions`) NÃO entram aqui - são escolhidas num seletor separado (SpeciesTab),
  // preservando a arte da raça base. A exceção são as sub-raças legadas curadas
  // marcadas `as: 'species'` (DDL-0059): elas VÊM como espécie própria, porque a
  // base 2024 não é o mesmo chassi que a base 2014 delas.
  list: (db) =>
    [...latestOnly(resolveCopies(db?.races?.race ?? [])), ...legacyStandaloneSpecies(db)]
      .filter((r) => !r.traitTags?.includes('NPC Race')),

  idOf: (race) => `${race.name}|${race.source}`,

  precompute: (race) => {
    const sizes = (Array.isArray(race.size) ? race.size : [race.size]).filter(Boolean);
    return {
      searchText: `${race.name} ${race.source}`.toLowerCase(),
      filterValues: {
        source: [race.source].filter(Boolean),
        size: sizes, // keys: T/S/M/L/V
        speed: speedKeys(race.speed),
        type: creatureTypes(race).map(cap), // Humanoid / Fey / …
        trait: traitKeys(race),
      },
    };
  },

  // Source por ÚLTIMO: é a lista mais longa (ocupa muito espaço) e a menos usada.
  filters: [
    { id: 'size', header: 'Size', options: options(SIZE_LABEL) },
    { id: 'speed', header: 'Speed', options: options(SPEED_LABEL) },
    { id: 'type', header: 'Creature Type', derive: true },
    { id: 'trait', header: 'Traits', options: options(TRAIT_LABEL) },
    { id: 'source', header: 'Source', derive: true },
  ],

  /** Size / Speed / Creature Type, com destaque para valores não-padrão. */
  meta: (race) => {
    const s = speedObj(race.speed);
    const types = creatureTypes(race);
    const extraMove = s.fly || s.swim || s.climb;
    return [
      { label: 'Size', value: sizeText(race.size) },
      { label: 'Speed', value: speedText(race.speed), highlight: (s.walk ?? 0) !== 30 || !!extraMove },
      { label: 'Type', value: types.map(cap).join(', '), highlight: !(types.length === 1 && types[0] === 'humanoid') },
    ];
  },

  card: (race) => ({
    title: race.name,
    subtitle: race.source,
    meta: `${sizeText(race.size)} · ${speedText(race.speed)} · ${creatureTypes(race).map(cap).join(', ')}`,
    badges: traitKeys(race).slice(0, 3).map((k) => TRAIT_LABEL[k]),
  }),

  // Traços mecânicos. Idênticos aos do dado, com duas exceções, ambas para o
  // preview listar as MESMAS opções que o seletor de linhagem oferece:
  //  - Tiefling XPHB: a tabela "Fiendish Legacies" ganha as linhas das legacies
  //    legadas (DDL-0061);
  //  - Halfling XPHB: o "Naturally Stealthy" dá lugar ao guarda-chuva "Halfling
  //    Lineage", com as quatro opções (DDL-0063).
  // Numa linhagem já resolvida nenhuma das duas se aplica (o traço já foi
  // substituído) e os entries originais voltam intactos.
  entries: (race, db) => withLegacyTable(db, withLineageUmbrella(db, race)),

  // Lore + imagens (fluff-races.json) p/ o DetailView. Para uma linhagem resolvida
  // (`_baseName`), cai na arte/lore da RAÇA BASE (ex: Elf; Drow Lineage → Elf).
  fluff: (race, db) => {
    const list = db?.['fluff-races']?.raceFluff ?? [];
    const base = race._baseName ?? race.name;
    return (
      list.find((f) => f.name === race.name && f.source === race.source) ??
      list.find((f) => f.name === base && f.source === race.source) ??
      list.find((f) => f.name === base) ??
      null
    );
  },
};

export default raceEntity;
