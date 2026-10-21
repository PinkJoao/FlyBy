// =============================================================================
// race: a entity de espécie
// =============================================================================
// O QUE FAZ
//   Os filtros no modelo do filter-races do 5etools. Os VALORES são chaves
//   estáveis e independentes de idioma ('fly', 'spellcasting'); os RÓTULOS ficam em
//   mapas à parte (o único lugar que um tradutor toca). O meta mostra tamanho,
//   deslocamento e tipo de criatura, destacando o fora do padrão.
//
// FUNÇÕES
//   speedObj(speed), speedKeys(speed), creatureTypes(race), traitKeys(race): os
//     campos em chaves estáveis.
//   cap(s), sizeText(size), speedText(speed): texto.
//   options(labelMap): a lista de opções de um filtro fixo.
//   fluffList(db): o fluff com `_copy` resolvido, memoizado.
//   imgPath(img), findFluffImage(list, path), withLineageImages(found, race,
//     list, base): a arte certa de cada linhagem.
//   Exporta raceEntity.
//
// DECISÕES E ARMADILHAS
//   - `sorts`: Speed, pela velocidade de caminhada.
//   - A lista: `_copy` resolvido, só versões atuais, só JOGÁVEIS. As linhagens não
//     entram (têm seletor próprio), salvo as legadas curadas `as: 'species'`
//     (DDL-0059). Saem as espécies de cenário vazias ou redundantes e as
//     reimpressões fundidas (DDL-0064, DDL-0066).
//   - As variantes de CENÁRIO ficam fora da visão PADRÃO por um filtro pré-marcado
//     e removível na própria entity (vale nos dois seletores sem fiação). Variant
//     e Source ficam no fim dos filtros (procedência, não mecânica).
//   - O preview lista as MESMAS opções do seletor de linhagem: a tabela de
//     Fiendish Legacies com as legadas (DDL-0061) e o guarda-chuva do Halfling
//     (DDL-0063); numa linhagem resolvida os entries voltam intactos.
//   - Fluff: 79 das 221 entradas são stubs `_copy`; sem resolver, a linhagem vinha
//     sem lore e sem arte. Uma linhagem cai na arte da BASE; uma reimpressão
//     fundida com nome próprio (Faerie) usa o prefixo dela; uma linhagem CURADA cai
//     na EDIÇÃO da base (`_baseSource`, TC-0052, DDL-0071), não na primeira entrada
//     de mesmo nome (a de 2014).
//   - A arte que REPRESENTA a linhagem vai à frente (o DetailView mostra a
//     primeira): a imagem própria que a linhagem acrescenta, a do pacote certo
//     quando o fluff traz várias (o Elf LFL, casando o nome do arquivo), a arte
//     doada por uma espécie redundante (o Aven PSD), e a arte CURADA das fundidas.
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';
import { resolveCopies } from '../copy';
import { legacyStandaloneSpecies } from '../../engine/speciesData';
import { withLegacyTable } from '../../engine/legacyFiendishLegacies';
import { withLineageUmbrella } from '../../engine/legacySwapLineages';
import { isRemovedSpecies, isSettingVariant, imageDonorFor } from '../../engine/settingSpecies';
import { isFoldedSpecies, lineageImagePath } from '../../engine/mergedLineages';
import { lineageLabel } from '../../engine/speciesData';
import { sourceName } from '../../engine/sourceNames';

const SIZE_LABEL = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', V: 'Varies' };

const SPEED_LABEL = { walk: 'Walk', fly: 'Fly', swim: 'Swim', climb: 'Climb' };

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

/** A lista { value, label } de um filtro de chaves fixas. */
function options(labelMap) {
  return Object.entries(labelMap).map(([value, label]) => ({ value, label }));
}

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

const imgPath = (img) => img?.href?.path ?? null;

/** A imagem (com crédito) cujo caminho casa, em qualquer entrada do fluff. */
function findFluffImage(list, path) {
  for (const f of list) {
    const img = f.images?.find((im) => imgPath(im) === path);
    if (img) return img;
  }
  return null;
}

/** O fluff com a arte que representa a linhagem à frente. */
function withLineageImages(found, race, list, base) {
  let images = found?.images ?? [];

  if (race._baseName && images.length) {
    const basePaths = new Set((base?.images ?? []).map(imgPath));
    const own = images.filter((img) => img?.href && !basePaths.has(imgPath(img)));
    if (own.length && own.length < images.length) {
      const inherited = images.filter((img) => !own.includes(img));
      images = [...own, ...inherited];
    }
  }

  if (race._baseName && images.length > 1) {
    const words = lineageLabel(race.name).toLowerCase().split(/\s+/).filter(Boolean);
    const i = images.findIndex((img) => {
      const p = imgPath(img)?.toLowerCase() ?? '';
      return words.some((w) => p.includes(`(${w})`));
    });
    if (i > 0) images = [images[i], ...images.slice(0, i), ...images.slice(i + 1)];
  }

  const donorId = imageDonorFor(race);
  if (donorId) {
    const i = donorId.lastIndexOf('|');
    const donor = list.find((f) => f.name === donorId.slice(0, i) && f.source === donorId.slice(i + 1));
    const donated = donor?.images?.filter((img) => img?.href) ?? [];
    if (donated.length) images = [...donated, ...images];
  }

  if (images === (found?.images ?? [])) return found;
  return { ...(found ?? { name: race.name, source: race.source }), images };
}

const raceEntity = {
  type: 'race',
  title: 'Species',

  list: (db) =>
    [...latestOnly(resolveCopies(db?.races?.race ?? [])), ...legacyStandaloneSpecies(db)]
      .filter((r) => !r.traitTags?.includes('NPC Race') && !isRemovedSpecies(r) && !isFoldedSpecies(r)),

  idOf: (race) => `${race.name}|${race.source}`,

  precompute: (race) => {
    const sizes = (Array.isArray(race.size) ? race.size : [race.size]).filter(Boolean);
    return {
      searchText: `${race.name} ${race.source}`.toLowerCase(),
      filterValues: {
        source: [race.source].filter(Boolean),
        size: sizes,
        speed: speedKeys(race.speed),
        type: creatureTypes(race).map(cap),
        trait: traitKeys(race),
        variant: isSettingVariant(race) ? ['setting'] : [],
      },
    };
  },

  sorts: [
    { value: 'speed', label: 'Speed', defaultDir: 'desc', dirLabels: ['Slowest first', 'Fastest first'], keyOf: (r) => speedObj(r.speed).walk ?? null },
  ],

  filters: [
    { id: 'size', header: 'Size', options: options(SIZE_LABEL) },
    { id: 'speed', header: 'Speed', options: options(SPEED_LABEL) },
    { id: 'type', header: 'Creature Type', derive: true },
    { id: 'trait', header: 'Traits', options: options(TRAIT_LABEL) },
    { id: 'variant', header: 'Variant', options: options(VARIANT_LABEL) },
    { id: 'source', header: 'Source', derive: true },
  ],

  initialFilterState: { variant: { setting: 'exclude' } },

  /** Tamanho, deslocamento e tipo de criatura, destacando o fora do padrão. */
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
    subtitleFull: sourceName(race.source),
    meta: `${sizeText(race.size)} · ${speedText(race.speed)} · ${creatureTypes(race).map(cap).join(', ')}`,
    badges: traitKeys(race).slice(0, 3).map((k) => TRAIT_LABEL[k]),
  }),

  entries: (race, db) => withLegacyTable(db, withLineageUmbrella(db, race)),

  // ATENÇÃO: o resolveCopies é obrigatório aqui; sem ele a linhagem fica sem lore e sem arte.
  fluff: (race, db) => {
    const list = fluffList(db);
    const baseName = race._baseName ?? race.name;
    const prefix = race._baseName ? race.name.split(/[;(]/)[0].trim() : null;
    const baseSource = race._baseSource ?? null;
    const found =
      list.find((f) => f.name === race.name && f.source === race.source) ??
      (prefix && prefix !== baseName ? list.find((f) => f.name === prefix && f.source === race.source) : null) ??
      list.find((f) => f.name === baseName && f.source === race.source) ??
      (baseSource ? list.find((f) => f.name === baseName && f.source === baseSource) : null) ??
      list.find((f) => f.name === baseName) ??
      null;
    const base = race._baseName
      ? (list.find((f) => f.name === baseName && f.source === race.source) ??
        (baseSource ? list.find((f) => f.name === baseName && f.source === baseSource) : null) ??
        list.find((f) => f.name === baseName) ??
        null)
      : null;
    const result = withLineageImages(found, race, list, base);

    const overridePath = lineageImagePath(race);
    if (overridePath) {
      const img = findFluffImage(list, overridePath) ?? { type: 'image', href: { type: 'internal', path: overridePath } };
      return { ...(result ?? { name: race.name, source: race.source }), images: [img] };
    }
    return result;
  },
};

export default raceEntity;
