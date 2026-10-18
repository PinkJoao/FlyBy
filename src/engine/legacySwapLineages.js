// =============================================================================
// legacySwapLineages: a linhagem que a edição 2024 não escreveu (swap, DDL-0063)
// =============================================================================
// O QUE FAZ
//   Duas espécies 2014 tinham sub-raças IRMÃS, e o chassi 2024 ABSORVEU o traço de
//   UMA delas: Halfling XPHB = 2014 + Naturally Stealthy (do Lightfoot); Dwarf
//   XPHB = 2014 + Dwarven Toughness (do Hill). Como linhagem crua o Stout ganharia
//   o Naturally Stealthy de graça; como espécie à parte a família se espalha pelo
//   seletor; a reescrita do DDL-0061 precisa de uma tabela que não existe aqui.
//
//   A quarta forma, `swap`: o guarda-chuva que faltou. O traço absorvido SAI da
//   base e vira UMA das opções, e cada linhagem TROCA em vez de somar:
//     Halfling Lineage: Lightfoot (reproduz a base 2024), Stout, Ghostwise,
//       Lotusden.
//     Dwarf Lineage: Hill (reproduz a base 2024), Mountain.
//
// FUNÇÕES
//   specFor(race), split(id), swapVersionName(baseName, lineage): o registro e
//     os nomes.
//   findSubrace(db, legacy, from): a sub-raça de origem.
//   optionEntries(db, race, spec, option), liftedFields(db, spec, option): os
//     traços e os campos estruturados de uma opção.
//   buildOption(db, race, spec, option): a versão e o item do guarda-chuva.
//   build(db, race): tudo, memoizado por db e espécie.
//   swapLineageVersions(db, race): as versões de swap.
//   withLineageUmbrella(db, race): a espécie com o guarda-chuva no lugar.
//   lineageUmbrellaName(race): o nome do guarda-chuva.
//   migrateSwapSpecies(species): a migração das formas antigas.
//
// DECISÕES E ARMADILHAS
//   - Regra obrigatória: TODA opção substitui o traço absorvido, e o conjunto
//     INCLUI a que reproduz a base 2024; sem ela a mudança tiraria algo de quem já
//     tinha. Para achar o traço absorvido, faça o DIFF base 2024 x base 2014; sem
//     traço identificável não é swap.
//   - Fidelidade (DDL-0003): o texto de cada opção são os entries da sub-raça
//     2014, e o da opção ABSORVIDA vem da base 2024 (a redação 2024 diz "take the
//     Hide action"). A única string autoral é UMBRELLA_INTRO, moldura de UI.
//   - A mecânica NÃO é normalizada (decisão do usuário): o Lotusden segue mais
//     pesado e com Sabedoria fixa, como o Pallid no Elf.
//   - O registro: `umbrella`, `absorbed`, `legacy` (a base legada, chave de 4
//     campos) e `options` com `from` (null na absorvida, cujo traço vive na base)
//     e `source` (o livro que deu NOME à sub-raça). O Dwarf entrou em 2026-07-29;
//     Duergar (espécie própria) e Mark of Warding (marca de Eberron) não são
//     irmãs de Hill e Mountain.
//   - LIFTED_FIELDS: o Dwarven Armor Training do Mountain é um campo estruturado
//     (`armorProficiencies`); sem elevá-lo a opção seria só texto.
//   - Menos de duas opções montáveis (compêndio incompleto): nada de
//     guarda-chuva, a espécie segue como está.
//   - As versões NÃO são `_legacy`: substituem um traço da base, então escolher
//     é obrigatório.
//   - withLineageUmbrella é idempotente e devolve a MESMA referência sem nada a
//     mudar; tem de rodar ANTES do buildVariant.
//   - Migração sem perda: a espécie à parte (Halfling (Ghostwise)|SCAG, de
//     2026-07-22 a 23) vira base com linhagem e bag zerado; a base 2024 sem
//     linhagem vira a opção absorvida, com o bag PRESERVADO.
// -----------------------------------------------------------------------------

import { LEGACY_PROSE_SECTIONS } from './legacySubraces';

const UMBRELLA_INTRO = 'Choose one of the following options.';

/**
 * @type {Readonly<Record<string, {umbrella: string, absorbed: string,
 *   legacy: {raceName: string, raceSource: string},
 *   options: ReadonlyArray<{lineage: string, from: string|null, source: string}>}>>}
 */
export const SWAP_LINEAGES = Object.freeze({
  'Halfling|XPHB': {
    umbrella: 'Halfling Lineage',
    absorbed: 'Naturally Stealthy',
    legacy: { raceName: 'Halfling', raceSource: 'PHB' },
    options: [
      { lineage: 'Lightfoot', from: null, source: 'PHB' },
      { lineage: 'Stout', from: 'Stout|PHB', source: 'PHB' },
      { lineage: 'Ghostwise', from: 'Ghostwise|SCAG', source: 'SCAG' },
      { lineage: 'Lotusden', from: 'Lotusden|EGW', source: 'EGW' },
    ],
  },
  'Dwarf|XPHB': {
    umbrella: 'Dwarf Lineage',
    absorbed: 'Dwarven Toughness',
    legacy: { raceName: 'Dwarf', raceSource: 'PHB' },
    options: [
      { lineage: 'Hill', from: null, source: 'PHB' },
      { lineage: 'Mountain', from: 'Mountain|PHB', source: 'PHB' },
    ],
  },
});

// ATENÇÃO: só campos que SOBRESCREVEM; um campo concatenativo exige semântica própria.
const LIFTED_FIELDS = Object.freeze([
  'resist', 'immune', 'vulnerable', 'additionalSpells',
  'speed', 'darkvision', 'skillProficiencies', 'toolProficiencies',
  'armorProficiencies', 'weaponProficiencies',
]);

/** A entrada do registro para uma espécie, ou null. */
function specFor(race) {
  return race?.name ? (SWAP_LINEAGES[`${race.name}|${race.source}`] ?? null) : null;
}

/** Quebra "Nome|FONTE" em [nome, fonte]. */
function split(id) {
  const i = id.lastIndexOf('|');
  return i < 0 ? [id, ''] : [id.slice(0, i), id.slice(i + 1)];
}

/** O nome da variante, no padrão das oficiais. */
export function swapVersionName(baseName, lineage) {
  return `${baseName}; ${lineage} Lineage`;
}

/** A sub-raça de origem pela chave de 4 campos. */
function findSubrace(db, legacy, from) {
  const [name, source] = split(from);
  return (
    (db?.races?.subrace ?? []).find(
      (s) =>
        s?.name === name &&
        s.source === source &&
        s.raceName === legacy.raceName &&
        s.raceSource === legacy.raceSource,
    ) ?? null
  );
}

/** Os traços de uma opção, prontos. */
function optionEntries(db, race, spec, option) {
  const source = option.from
    ? findSubrace(db, spec.legacy, option.from)?.entries
    : (race?.entries ?? []).filter((e) => e?.name === spec.absorbed);
  if (!Array.isArray(source) || source.length === 0) return null;
  const kept = source
    .filter((e) => e?.name && !LEGACY_PROSE_SECTIONS.has(e.name))
    .map(({ data, ...rest }) => rest); // eslint-disable-line no-unused-vars
  return kept.length ? kept : null;
}

/** Os campos estruturados que a opção sobrescreve. */
function liftedFields(db, spec, option) {
  if (!option.from) return {};
  const sr = findSubrace(db, spec.legacy, option.from);
  const out = {};
  for (const field of LIFTED_FIELDS) {
    if (sr?.[field] != null) out[field] = sr[field];
  }
  return out;
}

/**
 * A versão e o item do guarda-chuva de uma opção, ou null.
 * @returns {{version: object, item: object}|null}
 */
function buildOption(db, race, spec, option) {
  const entries = optionEntries(db, race, spec, option);
  if (!entries) return null;
  return {
    version: {
      name: swapVersionName(race.name, option.lineage),
      source: option.source,
      ...liftedFields(db, spec, option),
      _mod: {
        entries: {
          mode: 'replaceArr',
          replace: spec.umbrella,
          items: { type: 'entries', name: `${spec.umbrella} (${option.lineage})`, entries },
        },
      },
    },
    item: { type: 'item', name: option.lineage, entries },
  };
}

const cache = new WeakMap();

const MIN_OPTIONS = 2;

const EMPTY = Object.freeze({ versions: [], umbrella: null });

/** Versões e guarda-chuva, memoizados por db e espécie. */
function build(db, race) {
  const spec = specFor(race);
  if (!db || !spec) return EMPTY;
  const byRace = cache.get(db) ?? new Map();
  cache.set(db, byRace);
  const key = `${race.name}|${race.source}`;
  const cached = byRace.get(key);
  if (cached) return cached;
  const built = spec.options.map((option) => buildOption(db, race, spec, option)).filter(Boolean);
  const out = built.length >= MIN_OPTIONS
    ? {
        versions: built.map((b) => b.version),
        umbrella: {
          type: 'entries',
          name: spec.umbrella,
          entries: [UMBRELLA_INTRO, { type: 'list', style: 'list-hang-notitle', items: built.map((b) => b.item) }],
        },
      }
    : EMPTY;
  byRace.set(key, out);
  return out;
}

/**
 * As versões das linhagens de swap de uma espécie.
 * @param {object|null} db
 * @param {object|null} race
 * @returns {object[]}
 */
export function swapLineageVersions(db, race) {
  return build(db, race).versions;
}

/**
 * A espécie com o traço absorvido trocado pelo guarda-chuva.
 * @param {object|null} db
 * @param {object|null} race
 * @returns {object|null}
 */
export function withLineageUmbrella(db, race) {
  const spec = specFor(race);
  const { umbrella } = build(db, race);
  if (!umbrella || !spec || !Array.isArray(race.entries)) return race;
  const i = race.entries.findIndex((e) => e?.name === spec.absorbed);
  if (i < 0) return race;
  const entries = [...race.entries];
  entries[i] = umbrella;
  return { ...race, entries };
}

/**
 * O nome do guarda-chuva da espécie, ou null.
 * @param {object|null} race
 * @returns {string|null}
 */
export function lineageUmbrellaName(race) {
  return specFor(race)?.umbrella ?? null;
}

const STANDALONE_MIGRATION = new Map(
  Object.entries(SWAP_LINEAGES).flatMap(([key, spec]) => {
    const [baseName, baseSource] = split(key);
    return spec.options
      .filter((o) => o.from)
      .map((o) => {
        const [name, source] = split(o.from);
        return [
          `${baseName.toLowerCase()} (${name.toLowerCase()})|${source}`,
          { id: baseName.toLowerCase(), source: baseSource, lineage: swapVersionName(baseName, o.lineage) },
        ];
      });
  }),
);

const ABSORBED_LINEAGE = new Map(
  Object.entries(SWAP_LINEAGES).map(([key, spec]) => {
    const [baseName] = split(key);
    const absorbed = spec.options.find((o) => !o.from) ?? spec.options[0];
    return [key.toLowerCase(), swapVersionName(baseName, absorbed.lineage)];
  }),
);

/**
 * Converte uma espécie salva numa forma antiga para a nova.
 * @param {object|null} species
 * @returns {object|null}
 */
export function migrateSwapSpecies(species) {
  if (!species?.id) return species;
  const id = String(species.id).toLowerCase();
  const moved = STANDALONE_MIGRATION.get(`${id}|${species.source}`);
  if (moved) return { ...species, ...moved, choices: {} };
  const lineage = ABSORBED_LINEAGE.get(`${id}|${String(species.source ?? '').toLowerCase()}`);
  if (lineage && !species.lineage) return { ...species, lineage };
  return species;
}
