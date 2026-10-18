// =============================================================================
// speciesData: o parser de espécie, as linhagens e o catálogo de espécies
// =============================================================================
// O QUE FAZ
//   As raças XPHB são limpas e estruturadas; daqui sai o que o engine precisa
//   (tamanho, deslocamento, visão no escuro, perícias, idiomas, traços nomeados).
//   As linhagens chegam de várias fontes, e este módulo as junta numa lista só, a
//   que o seletor, a completude, o import e o sweep usam:
//     `_versions` 2024 (Elf: Drow, High, Wood), nas formas CONCRETA e ABSTRATA;
//     sub-raças fundidas de `db.races.subrace` (Genasi MPMM, Human de Innistrad);
//     sub-raças legadas curadas (DDL-0058), legacies reescritas (DDL-0061), swap
//     (DDL-0063) e reimpressões de cenário fundidas (DDL-0066).
//   E o catálogo: o compêndio com o `_copy` resolvido, mais as espécies legadas.
//
// FUNÇÕES
//   Variantes
//   applyArrMods(arr, ops): os ops de `_mod` sobre um array.
//   substituteVars(value, vars): troca `{{var}}` em toda string, recursivo.
//   buildVariant(race, version): uma variante concreta de uma versão.
//   expandRaceVersions(race): as `_versions` expandidas em variantes.
//   Sub-raças
//   subraceName(raceName, srName): "Dwarf (Hill)", "Human (Innistrad; Stensia)".
//   mergeSubrace(race, subrace): o porte do merge do 5etools.
//   prepareLegacySubrace(subrace): a sub-raça legada sem o `ability` 2014.
//   dropSuperseded(merged, names): tira os traços que a linhagem SUBSTITUI.
//   findSubrace(db, ref): uma sub-raça pela chave de 4 campos.
//   subraceVersions(db, race): as sub-raças fundidas como variantes.
//   Linhagens
//   raceLineages(db, race): TODAS as linhagens de uma raça.
//   requiresLineage(db, race): a raça exige linhagem?
//   replacedTraitName(version), lineageSelectorLabel(race): o nome do seletor.
//   same(a, b), lineageDeferredKinds(db, race), filterLineageDeferred(choices,
//     db, baseRace, lineage): as escolhas que a linhagem vai resolver.
//   speciesChoices(args): TODAS as escolhas de uma espécie, na ordem da UI.
//   Catálogo
//   prepareLegacyBase(race), legacyStandaloneSpecies(db): as espécies legadas.
//   speciesCatalog(db): o catálogo que toda resolução por nome usa.
//   resolvedCatalog(db, list): o compêndio com o `_copy` resolvido.
//   lineageLabel(name), raceOrVersions(race): rótulos e listas.
//   Tamanho e campos
//   sizeCodes(raceObj), speciesSizeChoice(raceObj), sizePick(bag),
//     effectiveSizeCodes(raceObj, opts), sizeLabel(codes): o tamanho.
//   parseProfBlock(arr, mapFn), parseSpeed(speed): blocos normalizados.
//   parseSpecies(raceObj): a espécie normalizada.
//
// DECISÕES E ARMADILHAS
//   Variantes
//   - `_versions` ABSTRATA: um template com `{{var}}` por implementação; é como os
//     Dragonborn (XPHB e FTD) codificam cor e tipo de dano. substituteVars devolve
//     cópia, a base nunca é mutada.
//   - KNOWN_DATA_FIXES (TC-0051, DDL-0070): o Tiefling Abyssal Legacy XPHB traz
//     `darkvision: 120` no JSON cru, mas nem a prosa dele nem o SRD
//     (tiefling-abyssal.yml, 60 pés) dizem isso, e as outras legacies não mexem no
//     campo. É o único lugar para correção de dado upstream.
//   - `_baseSource` (DDL-0071): uma linhagem curada carrega a fonte da sub-raça de
//     origem, que pode não ter fluff; o fallback de lore e arte volta à EDIÇÃO da
//     base 2024, não à primeira entrada de mesmo nome.
//   Sub-raças
//   - O 5etools guarda sub-raças à parte e as FUNDE na base ao carregar; sem o
//     merge, raças atuais ficavam sem as sub-raças (Genasi, Innistrad, Merfolk PSZ,
//     Aven PSA, as variantes SCAG). Reprints: sub-raça com `reprintedAs` própria
//     sai (marcas ERLW); a de uma BASE reprintada (Hill Dwarf PHB) segue fora, salvo
//     as legadas curadas. Sub-raça sem nome sai; a que tem `_versions` expande.
//   - O merge: `ability` posicional, `entries` anexadas (ou o `overwrite` troca o
//     traço homônimo), traitTags e idiomas concatenados, skills por overwrite ou
//     merge do [0], o resto sobrescreve.
//   - As legadas curadas perdem o `ability` 2014 antes do merge (a regra de
//     atributo do legacySubraces) e são marcadas `_legacy`: acréscimo opcional.
//   Linhagens
//   - Uma linhagem de SWAP (Halfling, Dwarf) é construída sobre
//     withLineageUmbrella(db, race): o `replaceArr` das versões mira o traço que só
//     existe depois do guarda-chuva, e sobre a base crua o traço da linhagem sumiria
//     em silêncio.
//   - Linhagens LFL fundidas (DDL-0066): no Elf são mais opções da escolha
//     obrigatória; no Fairy, que não tem `_versions`, são acréscimos `_legacy`.
//   - requiresLineage (DDL-0018): só as linhagens NATIVAS obrigam. Um Halfling ou
//     Human 2024 é completo sem linhagem, mesmo ganhando opções legadas.
//   - O nome do seletor vem do DADO (DDL-0062): o traço que a `_versions`
//     substitui ("Elven Lineage", "Giant Ancestry", "Variable Trait"). Lixo como
//     `replace: ","` (Faerie LFL) é ignorado; sem nome legível, "Lineage". Num
//     guarda-chuva NOSSO o nome vem do módulo que o criou.
//   - Escolhas adiadas até a linhagem, DERIVADAS do dado por duas regras:
//     SOBRESCRITA (toda linhagem traz valor próprio: a resistência do Tiefling, as
//     magias do Elf são só vitrine) e REMOÇÃO (alguma linhagem anula o campo: o
//     benefício é OU-exclusivo, como o Variable Trait do Custom Lineage e o Kobold
//     Legacy). Idiomas e perícias concatenados por merge só participam da remoção
//     (EXCLUSIVE_FIELD_KINDS), senão esconderiam escolhas legítimas.
//   - speciesChoices é a fonte ÚNICA da lista (aba, guia, completude, autoBuild);
//     antes cada um remontava a expressão e divergia. O raceObj vem de
//     resolveRaceObj.
//   Catálogo
//   - Espécie legada que volta como ESPÉCIE à parte é montada sobre a base
//     LEGADA, sem o `ability` e as seções de prosa 2014.
//   - speciesCatalog é o que TODA resolução por nome usa (resolveRaceObj, o
//     import, a entity), senão uma espécie legada some ao recarregar.
//   - resolvedCatalog: sem resolver o `_copy`, uma espécie que herda size e speed
//     (Elf LFL, Centaur MOT e outras 14) derivava deslocamento 0. O seletor já
//     resolvia; a derivação não.
//   Tamanho e campos
//   - Tamanho (regras com o usuário, 2026-07-14): sem `size` é Small ou Medium à
//     escolha; mais de um código é escolha; um só é fixo; 'V' é o Verdan, Small até
//     o 4 e Medium do 5 (o nível vence a escolha salva). A escolha vive no bag como
//     { kind: 'size', picks: ['S'] }.
//   - O pseudo-idioma `other` vira o idioma real (TC-0050); 21 espécies mostravam
//     "Other". O Human 2024 concede um talento de origem.
// -----------------------------------------------------------------------------

import { resolveCopies } from '../selector/copy';
import { skillCode } from './classData';
import { parseChoices } from './choices';
import { legacySubracesFor, legacyStandaloneRefs, LEGACY_PROSE_SECTIONS } from './legacySubraces';
import { legacyLegacyVersions } from './legacyFiendishLegacies';
import { swapLineageVersions, withLineageUmbrella, lineageUmbrellaName } from './legacySwapLineages';
import { mergedLineageVersions } from './mergedLineages';
import { isEmptySubrace } from './settingSpecies';
import { resolveOtherLanguage } from './speciesLanguages';

/** Aplica os ops de `_mod` a um array. */
function applyArrMods(arr, ops) {
  let out = [...(arr ?? [])];
  for (const op of Array.isArray(ops) ? ops : [ops]) {
    if (!op || typeof op !== 'object') continue;
    const items = Array.isArray(op.items) ? op.items : op.items != null ? [op.items] : [];
    if (op.mode === 'replaceArr') {
      const idx = out.findIndex((e) => e && typeof e === 'object' && e.name === op.replace);
      if (idx >= 0) out.splice(idx, 1, ...items);
    } else if (op.mode === 'appendArr') {
      out.push(...items);
    } else if (op.mode === 'insertArr') {
      out.splice(op.index ?? out.length, 0, ...items);
    } else if (op.mode === 'removeArr') {
      const names = new Set([op.names, op.replace].flat().filter(Boolean));
      out = out.filter((e) => !(e && typeof e === 'object' && names.has(e.name)));
    }
  }
  return out;
}

/** Substitui `{{var}}` em toda string de um valor (recursivo). */
function substituteVars(value, vars) {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }
  if (Array.isArray(value)) return value.map((v) => substituteVars(v, vars));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = substituteVars(v, vars);
    return out;
  }
  return value;
}

const KNOWN_DATA_FIXES = {
  'Tiefling|XPHB/Tiefling; Abyssal Legacy': { darkvision: 60 },
};

/** Uma variante concreta a partir de uma versão. */
function buildVariant(race, version) {
  const { _mod, ...overrides } = version;
  const variant = { ...race, ...overrides };
  delete variant._versions;
  for (const [field, ops] of Object.entries(_mod ?? {})) {
    variant[field] = applyArrMods(variant[field], ops);
  }
  variant._baseName = race.name;
  variant._baseSource = race.source;
  const fix = KNOWN_DATA_FIXES[`${race.name}|${race.source}/${version.name}`];
  if (fix) Object.assign(variant, fix);
  return variant;
}

/**
 * As `_versions` de uma raça (concretas ou abstratas) em variantes.
 * @param {object} race
 * @returns {object[]}
 */
export function expandRaceVersions(race) {
  const versions = race?._versions;
  if (!Array.isArray(versions) || versions.length === 0) return [];
  const out = [];
  for (const v of versions) {
    if (!v) continue;
    if (v._abstract && Array.isArray(v._implementations)) {
      for (const impl of v._implementations) {
        const { _variables = {}, ...implOverrides } = impl;
        const variant = buildVariant(race, { ...v._abstract, ...implOverrides });
        out.push(substituteVars(variant, _variables));
      }
      continue;
    }
    if (v._abstract || v._implementations) continue;
    out.push(buildVariant(race, v));
  }
  return out;
}

/** O nome fundido de uma sub-raça. */
function subraceName(raceName, srName) {
  if (!srName) return raceName;
  const m = /^(.*?)\((.*?)\)\s*$/.exec(raceName ?? '');
  if (!m) return `${raceName} (${srName})`;
  return `${m[1]}(${[m[2], srName].join('; ')})`;
}

/** O merge de sub-raça do 5etools, recortado ao que o dado usa. */
function mergeSubrace(race, subrace) {
  const cpy = structuredClone(race);
  const sr = structuredClone(subrace);
  cpy._baseName = cpy.name;
  cpy._baseSource = cpy.source;
  for (const k of ['subraces', 'srd', 'srd52', 'basicRules', 'basicRules2024', '_versions', 'hasFluff', 'hasFluffImages', 'reprintedAs']) {
    delete cpy[k];
  }
  for (const k of ['__prop', 'raceName', 'raceSource']) delete sr[k];

  if (sr.name) {
    cpy._subraceName = sr.name;
    cpy.name = subraceName(cpy.name, sr.name);
    delete sr.name;
  }
  if (sr.ability) {
    if (sr.overwrite?.ability || !cpy.ability) cpy.ability = sr.ability.map(() => ({}));
    sr.ability.forEach((obj, i) => Object.assign((cpy.ability[i] ??= {}), obj));
    delete sr.ability;
  }
  if (sr.entries) {
    cpy.entries = cpy.entries ?? [];
    for (const ent of sr.entries) {
      const ow = ent?.data?.overwrite;
      if (!ow) {
        cpy.entries.push(ent);
        continue;
      }
      const i = cpy.entries.findIndex((it) => String(it?.name ?? '').toLowerCase().trim() === String(ow).toLowerCase().trim());
      if (i >= 0) cpy.entries[i] = ent;
      else cpy.entries.push(ent);
    }
    delete sr.entries;
  }
  for (const key of ['traitTags', 'languageProficiencies']) {
    if (!sr[key]) continue;
    cpy[key] = sr.overwrite?.[key] ? sr[key] : [...(cpy[key] ?? []), ...sr[key]];
    delete sr[key];
  }
  if (sr.skillProficiencies) {
    if (!cpy.skillProficiencies || sr.overwrite?.skillProficiencies) {
      cpy.skillProficiencies = sr.skillProficiencies;
    } else {
      Object.assign(cpy.skillProficiencies[0], sr.skillProficiencies[0]);
    }
    delete sr.skillProficiencies;
  }
  Object.assign(cpy, sr);
  for (const [k, v] of Object.entries(cpy)) {
    if (v == null) delete cpy[k];
  }
  return cpy;
}

/** A sub-raça legada sem o `ability` 2014. */
function prepareLegacySubrace(subrace) {
  const out = { ...subrace };
  delete out.ability;
  if (out.overwrite && typeof out.overwrite === 'object') {
    const overwrite = { ...out.overwrite };
    delete overwrite.ability;
    if (Object.keys(overwrite).length) out.overwrite = overwrite;
    else delete out.overwrite;
  }
  if (Array.isArray(out.entries)) {
    out.entries = out.entries.filter((e) => !LEGACY_PROSE_SECTIONS.has(e?.name));
  }
  return out;
}

/** Remove da linhagem os traços da base que ela substitui. */
function dropSuperseded(merged, names) {
  if (!names?.length || !Array.isArray(merged.entries)) return merged;
  const drop = new Set(names);
  merged.entries = merged.entries.filter((e) => !drop.has(e?.name));
  return merged;
}

/** Uma entrada de `db.races.subrace` pela chave de 4 campos. */
function findSubrace(db, ref) {
  return (
    (db.races?.subrace ?? []).find(
      (s) =>
        s?.name === ref.name &&
        s.source === ref.source &&
        s.raceName === ref.raceName &&
        s.raceSource === ref.raceSource,
    ) ?? null
  );
}

const subraceCache = new WeakMap();

/**
 * As sub-raças de uma raça base, fundidas como variantes.
 * @param {object} db
 * @param {object|null} race
 * @returns {object[]}
 */
export function subraceVersions(db, race) {
  if (!db || !race?.name) return [];
  let byRace = subraceCache.get(db);
  if (!byRace) {
    byRace = new Map();
    subraceCache.set(db, byRace);
  }
  const key = `${race.name}|${race.source}`;
  if (byRace.has(key)) return byRace.get(key);
  const out = [];
  const push = (merged) => {
    if (Array.isArray(merged._versions) && merged._versions.length) out.push(...expandRaceVersions(merged));
    else out.push(merged);
  };
  for (const s of db.races?.subrace ?? []) {
    if (!s?.name || s.raceName !== race.name || s.raceSource !== race.source) continue;
    if (s.reprintedAs?.length) continue;
    if (isEmptySubrace(s)) continue;
    push(mergeSubrace(race, s));
  }
  for (const ref of legacySubracesFor(race)) {
    const s = findSubrace(db, ref);
    if (!s) continue;
    const merged = dropSuperseded(mergeSubrace(race, prepareLegacySubrace(s)), ref.supersedes);
    merged._legacy = true;
    push(merged);
  }
  byRace.set(key, out);
  return out;
}

/**
 * Todas as linhagens de uma raça.
 * @param {object} db
 * @param {object|null} race
 * @returns {object[]}
 */
export function raceLineages(db, race) {
  const legacy = legacyLegacyVersions(db, race).map((v) => buildVariant(race, v));
  // ATENÇÃO: o guarda-chuva entra ANTES do buildVariant, senão o replaceArr não acha o alvo.
  const swapBase = withLineageUmbrella(db, race);
  const swap = swapLineageVersions(db, race).map((v) => buildVariant(swapBase, v));
  const optional = !Array.isArray(race?._versions) || race._versions.length === 0;
  const merged = mergedLineageVersions(db, race).map((v) => {
    const built = buildVariant(race, v);
    if (optional) built._legacy = true;
    return built;
  });
  return [...expandRaceVersions(race), ...legacy, ...swap, ...merged, ...subraceVersions(db, race)];
}

/**
 * A raça exige que uma linhagem seja escolhida?
 * @param {object} db
 * @param {object|null} race
 * @returns {boolean}
 */
export function requiresLineage(db, race) {
  return raceLineages(db, race).some((v) => !v._legacy);
}

/** O traço que a primeira op de `_mod.entries` substitui, ou null. */
function replacedTraitName(version) {
  const ops = version?._mod?.entries;
  for (const op of Array.isArray(ops) ? ops : [ops]) {
    const name = op?.replace;
    if (typeof name === 'string' && /\p{L}/u.test(name)) return name.trim();
  }
  return null;
}

/**
 * O rótulo do seletor de linhagem, tirado do dado.
 * @param {object|null} race
 * @returns {string}
 */
export function lineageSelectorLabel(race) {
  for (const v of race?._versions ?? []) {
    const name = replacedTraitName(v) ?? replacedTraitName(v?._abstract);
    if (name) return name;
  }
  return lineageUmbrellaName(race) ?? 'Lineage';
}

const LINEAGE_FIELD_KINDS = Object.freeze({
  resist: ['resist'],
  immune: ['immune'],
  vulnerable: ['vulnerable'],
  additionalSpells: ['spellSet', 'spell', 'spellAbility'],
});

const EXCLUSIVE_FIELD_KINDS = Object.freeze({
  skillProficiencies: ['skill'],
  toolProficiencies: ['tool'],
  languageProficiencies: ['language'],
});

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Os kinds de escolha adiados até a linhagem ser escolhida.
 * @param {object} db
 * @param {object|null} race
 * @returns {Set<string>}
 */
export function lineageDeferredKinds(db, race) {
  const lineages = raceLineages(db, race);
  if (!lineages.some((v) => !v._legacy)) return new Set();
  const kinds = new Set();
  const fields = { ...LINEAGE_FIELD_KINDS, ...EXCLUSIVE_FIELD_KINDS };
  for (const [field, list] of Object.entries(fields)) {
    if (race?.[field] == null) continue;
    const overridesAll = field in LINEAGE_FIELD_KINDS && lineages.every((v) => !same(v[field], race[field]));
    const someRemoves = lineages.some((v) => v[field] == null);
    if (overridesAll || someRemoves) for (const k of list) kinds.add(k);
  }
  return kinds;
}

/**
 * Tira as escolhas que a linhagem vai resolver, enquanto não há linhagem.
 * @param {Array} choices
 * @param {object} db
 * @param {object|null} baseRace
 * @param {string|null} lineage
 * @returns {Array}
 */
export function filterLineageDeferred(choices, db, baseRace, lineage) {
  if (lineage || !choices?.length) return choices ?? [];
  const deferred = lineageDeferredKinds(db, baseRace);
  return deferred.size ? choices.filter((c) => !deferred.has(c.kind)) : choices;
}

/**
 * Todas as escolhas de uma espécie, na ordem da UI.
 * @param {{ db: object, baseRace: object|null, raceObj: object|null,
 *   lineage?: string|null, level?: number, bag?: object|null }} args
 * @returns {Array}
 */
export function speciesChoices({ db, baseRace, raceObj, lineage = null, level = 1, bag = null }) {
  if (!raceObj) return [];
  const size = speciesSizeChoice(raceObj);
  const choices = [...(size ? [size] : []), ...parseChoices(raceObj, { level, bag })];
  return filterLineageDeferred(choices, db, baseRace, lineage);
}

const standaloneCache = new WeakMap();

/** A base legada pronta para receber a sub-raça. */
function prepareLegacyBase(race) {
  const out = { ...race };
  delete out.ability;
  if (Array.isArray(out.entries)) {
    out.entries = out.entries.filter((e) => !LEGACY_PROSE_SECTIONS.has(e?.name));
  }
  return out;
}

/**
 * As espécies legadas curadas (memoizado por db).
 * @param {object|null} db
 * @returns {object[]}
 */
export function legacyStandaloneSpecies(db) {
  if (!db) return [];
  const cached = standaloneCache.get(db);
  if (cached) return cached;
  const out = [];
  for (const ref of legacyStandaloneRefs()) {
    const base = (db.races?.race ?? []).find((r) => r?.name === ref.raceName && r.source === ref.raceSource);
    const sr = findSubrace(db, ref);
    if (!base || !sr) continue;
    const merged = dropSuperseded(mergeSubrace(prepareLegacyBase(base), prepareLegacySubrace(sr)), ref.supersedes);
    merged._legacy = true;
    out.push(merged);
  }
  standaloneCache.set(db, out);
  return out;
}

/**
 * O catálogo de espécies: o compêndio mais as legadas curadas.
 * @param {object|null} db
 * @returns {object[]}
 */
export function speciesCatalog(db) {
  const list = db?.races?.race;
  if (!Array.isArray(list)) return legacyStandaloneSpecies(db);
  return [...resolvedCatalog(db, list), ...legacyStandaloneSpecies(db)];
}

const catalogCache = new WeakMap();

/** O compêndio de espécies com o `_copy` resolvido. */
function resolvedCatalog(db, list) {
  let resolved = catalogCache.get(db);
  if (!resolved) {
    resolved = resolveCopies(list);
    catalogCache.set(db, resolved);
  }
  return resolved;
}

/**
 * Rótulo curto de uma linhagem ("Drow Lineage", "Black").
 * @param {string} name
 * @returns {string}
 */
export function lineageLabel(name) {
  if (!name) return '';
  let s = name;
  const paren = s.match(/\(([^)]*)\)/);
  if (paren) s = paren[1];
  if (s.includes('; ')) s = s.split('; ').slice(-1)[0];
  return s.trim();
}

/** A raça base ou as variantes dela. */
export function raceOrVersions(race) {
  return Array.isArray(race?._versions) && race._versions.length ? expandRaceVersions(race) : [race];
}

export const SIZE_NAME = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };

const VARIES_MEDIUM_LEVEL = 5;

/**
 * Os códigos de tamanho possíveis de uma raça.
 * @param {object|null} raceObj
 * @returns {string[]}
 */
export function sizeCodes(raceObj) {
  const raw = raceObj?.size;
  const arr = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  return arr.length ? arr : ['S', 'M'];
}

/**
 * O descritor de escolha de tamanho, ou null.
 * @param {object|null} raceObj
 * @returns {object|null}
 */
export function speciesSizeChoice(raceObj) {
  if (!raceObj) return null;
  const codes = sizeCodes(raceObj);
  if (codes.includes('V') || codes.length < 2) return null;
  return {
    id: 'size-0',
    kind: 'size',
    count: 1,
    label: 'Size',
    pool: { type: 'size', options: codes.map((c) => ({ value: c, label: SIZE_NAME[c] ?? c })) },
  };
}

/** O tamanho escolhido num bag de espécie, ou null. */
export function sizePick(bag) {
  for (const choice of Object.values(bag ?? {})) {
    if (choice?.kind === 'size' && choice.picks?.[0]) return choice.picks[0];
  }
  return null;
}

/**
 * Os códigos de tamanho efetivos (nível e escolha aplicados).
 * @param {object|null} raceObj
 * @param {{ chosen?: string|null, level?: number }} [opts]
 * @returns {string[]}
 */
export function effectiveSizeCodes(raceObj, { chosen = null, level = 1 } = {}) {
  const codes = sizeCodes(raceObj);
  if (codes.includes('V')) return [(level ?? 1) >= VARIES_MEDIUM_LEVEL ? 'M' : 'S'];
  if (chosen && codes.includes(chosen)) return [chosen];
  return codes;
}

/** Rótulo legível dos códigos ("Small/Medium"). */
export function sizeLabel(codes) {
  return (codes ?? []).map((c) => SIZE_NAME[c] ?? c).join('/');
}

/**
 * Um bloco de proficiências normalizado em fixas e escolha.
 * @param {Array} arr
 * @param {(s: string) => string} mapFn
 * @returns {{ fixed: string[], choose: { from?: string[], count?: number, any?: number } | null }}
 */
function parseProfBlock(arr, mapFn) {
  const fixed = [];
  let choose = null;
  for (const entry of arr ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.choose) {
      choose = {
        from: (entry.choose.from ?? []).map(mapFn),
        count: entry.choose.count ?? 1,
      };
    } else if (entry.any != null) {
      choose = { any: entry.any };
    } else {
      for (const [k, v] of Object.entries(entry)) {
        if (v === true) fixed.push(mapFn(k));
      }
    }
  }
  return { fixed, choose };
}

/** O deslocamento normalizado em { walk, ... }. */
function parseSpeed(speed) {
  if (speed == null) return { walk: 0 };
  if (typeof speed === 'number') return { walk: speed };
  return speed;
}

/**
 * Normaliza um objeto de espécie do 5etools.
 * @param {object} raceObj
 */
export function parseSpecies(raceObj) {
  if (!raceObj) return null;

  const traits = (raceObj.entries ?? [])
    .filter((e) => e && e.type === 'entries' && e.name)
    .map((e) => ({ name: e.name }));

  return {
    name: raceObj.name ?? '',
    source: raceObj.source ?? '',
    size: Array.isArray(raceObj.size) ? raceObj.size[0] : (raceObj.size ?? 'M'),
    speed: parseSpeed(raceObj.speed),
    darkvision: raceObj.darkvision ?? null,
    skills: parseProfBlock(raceObj.skillProficiencies, skillCode),
    languages: parseProfBlock(raceObj.languageProficiencies, (s) => resolveOtherLanguage(raceObj, s)),
    resist: raceObj.resist ?? [],
    traitTags: raceObj.traitTags ?? [],
    creatureTypes: raceObj.creatureTypes ?? [],
    feats: raceObj.feats ?? null,
    traits,
  };
}
