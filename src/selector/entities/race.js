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
import { isRemovedSpecies, isSettingVariant, imageDonorFor } from '../../engine/settingSpecies';

// --- Stable keys → display labels (the only place a translator touches) -------
const SIZE_LABEL = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', V: 'Varies' };

const SPEED_LABEL = { walk: 'Walk', fly: 'Fly', swim: 'Swim', climb: 'Climb' };

// Variantes de CENÁRIO (os seis "Plane Shift"). Ver engine/settingSpecies.js.
const VARIANT_LABEL = { setting: 'Setting Variant' };

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

// --- Fluff: lista com `_copy` resolvido, memoizada por db --------------------
const fluffCache = new WeakMap();

function fluffList(db) {
  const raw = db?.['fluff-races']?.raceFluff;
  if (!Array.isArray(raw)) return [];
  let out = fluffCache.get(raw);
  if (!out) {
    out = resolveCopies(raw);
    fluffCache.set(raw, out);
  }
  return out;
}

/**
 * Arte herdada de uma espécie removida por redundância (engine/settingSpecies).
 * A imagem do doador entra na FRENTE, porque o DetailView mostra a primeira:
 * é ela que passa a representar a linhagem. Hoje só o Aven (Hawk-Headed), que
 * é a única das duas linhagens do Aven sem imagem própria no dado.
 */
function withDonatedImages(found, race, list) {
  const donorId = imageDonorFor(race);
  if (!donorId) return found;
  const i = donorId.lastIndexOf('|');
  const donor = list.find((f) => f.name === donorId.slice(0, i) && f.source === donorId.slice(i + 1));
  const donated = donor?.images?.filter((img) => img?.href) ?? [];
  if (!donated.length) return found;
  return { ...(found ?? { name: race.name, source: race.source }), images: [...donated, ...(found?.images ?? [])] };
}

const raceEntity = {
  type: 'race',
  title: 'Species',

  // Resolve herança `_copy` (size/speed/traits vêm do pai) → só versões atuais
  // (latestOnly) → e só JOGÁVEIS (fora as "NPC Species"). As sub-raças/linhagens
  // (`_versions`) NÃO entram aqui - são escolhidas num seletor separado (SpeciesTab),
  // preservando a arte da raça base. A exceção são as sub-raças legadas curadas
  // marcadas `as: 'species'` (DDL-0059): elas VÊM como espécie própria, porque a
  // base 2024 não é o mesmo chassi que a base 2014 delas. Fora, também, as
  // espécies de cenário removidas por não entregarem mecânica nenhuma ou por
  // serem redundantes (`isRemovedSpecies`, engine/settingSpecies).
  list: (db) =>
    [...latestOnly(resolveCopies(db?.races?.race ?? [])), ...legacyStandaloneSpecies(db)]
      .filter((r) => !r.traitTags?.includes('NPC Race') && !isRemovedSpecies(r)),

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
        variant: isSettingVariant(race) ? ['setting'] : [],
      },
    };
  },

  // Source por ÚLTIMO: é a lista mais longa (ocupa muito espaço) e a menos usada.
  // Variant fica logo ACIMA de Source: os dois falam de procedência, não de
  // mecânica, então ficam juntos no fim.
  filters: [
    { id: 'size', header: 'Size', options: options(SIZE_LABEL) },
    { id: 'speed', header: 'Speed', options: options(SPEED_LABEL) },
    { id: 'type', header: 'Creature Type', derive: true },
    { id: 'trait', header: 'Traits', options: options(TRAIT_LABEL) },
    { id: 'variant', header: 'Variant', options: options(VARIANT_LABEL) },
    { id: 'source', header: 'Source', derive: true },
  ],

  // As variantes de CENÁRIO saem da visão PADRÃO do seletor: elas repetiam o
  // nome de espécies que o app já tem e enchiam a busca ("Elf" dava seis
  // linhas). É um recorte de conveniência no padrão do DDL-0026/0040: filtro
  // PRÉ-MARCADO e removível, nunca regra dura. Um toque no chip "Setting
  // Variant" (ou em Clear) traz todas de volta. Fica na ENTITY, e não em cada
  // chamador, para valer nos dois seletores de espécie (aba e guia) sem fiação.
  initialFilterState: { variant: { setting: 'exclude' } },

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

  // Lore + imagens (fluff-races.json) p/ o DetailView. Para uma linhagem
  // resolvida (`_baseName`), cai na arte/lore da RAÇA BASE (ex: Elf; Drow
  // Lineage -> Elf).
  //
  // `resolveCopies` é OBRIGATÓRIO aqui: 79 das 221 entradas de fluff são stubs
  // `_copy` que herdam o corpo da raça base e só acrescentam um parágrafo ou uma
  // imagem própria (toda linhagem com lore própria: Genasi (Air), Elf (Pallid),
  // Aven (Ibis-Headed)...). Sem resolver, o `find` casava o stub, que não tem
  // `entries` nem `images`, e a linhagem aparecia SEM lore e SEM arte.
  fluff: (race, db) => {
    const list = fluffList(db);
    const base = race._baseName ?? race.name;
    const found =
      list.find((f) => f.name === race.name && f.source === race.source) ??
      list.find((f) => f.name === base && f.source === race.source) ??
      list.find((f) => f.name === base) ??
      null;
    return withDonatedImages(found, race, list);
  },
};

export default raceEntity;
