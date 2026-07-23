// =============================================================================
// Parser de dados de espécie (formato 5etools, edição 2024/XPHB)
// =============================================================================
// As raças XPHB são limpas (sem _copy) e têm campos estruturados. Extraímos o
// que o engine/expander precisa: tamanho, deslocamento, visão no escuro,
// perícias (fixas ou à escolha), idiomas, tags e os traços nomeados (que viram
// grants de "species-trait").
//
// Sub-raças/linhagens 2024 vivem em `_versions` (ex: Elf → Drow/High/Wood);
// `expandRaceVersions` as expande em variantes concretas (ver abaixo).
// -----------------------------------------------------------------------------

import { skillCode } from './classData';
import { legacySubracesFor, legacyStandaloneRefs, LEGACY_PROSE_SECTIONS } from './legacySubraces';

/** Aplica ops de `_mod` a um array (replaceArr/appendArr/insertArr/removeArr). */
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

/** Substitui `{{var}}` por `vars[var]` em TODA string de um valor (recursivo). */
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

/** Constrói uma variante concreta a partir de uma versão { name, source, _mod, ...overrides }. */
function buildVariant(race, version) {
  const { _mod, ...overrides } = version;
  const variant = { ...race, ...overrides };
  delete variant._versions;
  for (const [field, ops] of Object.entries(_mod ?? {})) {
    variant[field] = applyArrMods(variant[field], ops);
  }
  variant._baseName = race.name;
  return variant;
}

/**
 * Expande as sub-raças/linhagens (`_versions`) de uma raça em variantes concretas.
 * Duas formas de `_versions`:
 *  - CONCRETA - lista de versões `{ name, source, _mod, ...overrides }` (ex: Elf →
 *    "Elf; Drow Lineage"/High/Wood).
 *  - ABSTRATA - `[{ _abstract, _implementations }]`: um template (`_abstract`, com
 *    placeholders `{{var}}`) instanciado por implementação (`_variables` + overrides).
 *    É como os Dragonborn (XPHB e FTD Chromatic/Gem/Metallic) codificam as
 *    ancestralidades de dragão (cor + tipo de dano), ex: "Dragonborn (Black)".
 * @param {object} race
 * @returns {object[]} variantes (vazio se a raça não tem `_versions`)
 */
export function expandRaceVersions(race) {
  const versions = race?._versions;
  if (!Array.isArray(versions) || versions.length === 0) return [];
  const out = [];
  for (const v of versions) {
    if (!v) continue;
    if (v._abstract && Array.isArray(v._implementations)) {
      // Forma abstrata: instancia o template para cada implementação. Constrói a
      // variante (base + overrides + _mod) e então substitui as variáveis
      // (`{{color}}`, `{{damageType}}`…) no objeto inteiro - `substituteVars`
      // retorna uma cópia nova, então a base nunca é mutada.
      for (const impl of v._implementations) {
        const { _variables = {}, ...implOverrides } = impl;
        const variant = buildVariant(race, { ...v._abstract, ...implOverrides });
        out.push(substituteVars(variant, _variables));
      }
      continue;
    }
    if (v._abstract || v._implementations) continue; // forma abstrata malformada
    out.push(buildVariant(race, v));
  }
  return out;
}

// --- Subraces (legado/Planeshift): entradas separadas em db.races.subrace -----
// O 5etools guarda sub-raças à parte, chaveadas por raceName/raceSource, e as
// FUNDE na raça base ao carregar (Renderer.race._getMergedSubrace). Sem essa
// fusão, raças ATUAIS ficavam sem suas sub-raças (Genasi MPMM Air/Earth/Fire/
// Water, Human (Innistrad) Gavony/Kessig/Nephalia/Stensia, Merfolk/Goblin/
// Vampire PSZ, Aven PSA, Half-Elf/Half-Orc PHB variantes SCAG…). Aqui portamos
// o merge e expomos as sub-raças como LINHAGENS da raça base (mesma UX/storage
// de `_versions` - `raceLineages` junta as duas fontes).
//
// Política de reprints (mesma do latestOnly): sub-raças com `reprintedAs`
// próprio caem fora (marcas ERLW); sub-raças de uma BASE reprintada (Hill
// Dwarf do Dwarf PHB) continuam inalcançáveis porque a base não é listada.

/** Nome fundido: "Dwarf"+"Hill" → "Dwarf (Hill)"; base já parentetizada junta
 * com "; " ("Human (Innistrad)"+"Stensia" → "Human (Innistrad; Stensia)"). */
function subraceName(raceName, srName) {
  if (!srName) return raceName;
  const m = /^(.*?)\((.*?)\)\s*$/.exec(raceName ?? '');
  if (!m) return `${raceName} (${srName})`;
  return `${m[1]}(${[m[2], srName].join('; ')})`;
}

/** Porte do merge do 5etools (recortado ao que o dataset usa). */
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
  // ability: merge posicional (a base sem ability vira registros vazios).
  if (sr.ability) {
    if (sr.overwrite?.ability || !cpy.ability) cpy.ability = sr.ability.map(() => ({}));
    sr.ability.forEach((obj, i) => Object.assign((cpy.ability[i] ??= {}), obj));
    delete sr.ability;
  }
  // entries: anexa; `data.overwrite` substitui o traço homônimo da base.
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
  // traitTags/languageProficiencies: concat (ou overwrite, se pedido).
  for (const key of ['traitTags', 'languageProficiencies']) {
    if (!sr[key]) continue;
    cpy[key] = sr.overwrite?.[key] ? sr[key] : [...(cpy[key] ?? []), ...sr[key]];
    delete sr[key];
  }
  // skillProficiencies: overwrite quando pedido/ausente; senão merge do [0].
  if (sr.skillProficiencies) {
    if (!cpy.skillProficiencies || sr.overwrite?.skillProficiencies) {
      cpy.skillProficiencies = sr.skillProficiencies;
    } else {
      Object.assign(cpy.skillProficiencies[0], sr.skillProficiencies[0]);
    }
    delete sr.skillProficiencies;
  }
  // O resto sobrescreve (source, speed, darkvision, resist, additionalSpells,
  // weapon/tool/armorProficiencies, skillToolLanguageProficiencies, _versions…).
  Object.assign(cpy, sr);
  for (const [k, v] of Object.entries(cpy)) {
    if (v == null) delete cpy[k];
  }
  return cpy;
}

// --- Sub-raças LEGADAS curadas (DDL-0058) ------------------------------------
// Uma sub-raça de uma base REPRINTADA some por colateral (a base não é listada,
// então `raceLineages` nunca roda sobre ela). O registro `legacySubraces.js` diz
// quais voltam, ANEXADAS à base ATUAL — entram por aqui, como mais uma linhagem,
// reusando o mesmo merge das sub-raças normais. Assim nada muda no `latestOnly`
// nem nos seletores: tabs, guia, completude, import, sweep e export já trabalham
// sobre linhagens.

/**
 * Cópia da sub-raça SEM o `ability` legado (+2/+1 fixos). O FlyBy segue as
 * regras 2024, onde os aumentos de atributo vêm sempre da origem — ver a "regra
 * de atributo" no cabeçalho de legacySubraces.js. Sem isso, o merge posicional
 * de `mergeSubrace` reintroduziria o campo numa base 2024 que não o tem.
 */
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

/** Remove da linhagem fundida os traços da BASE que ela SUBSTITUI (`supersedes`). */
function dropSuperseded(merged, names) {
  if (!names?.length || !Array.isArray(merged.entries)) return merged;
  const drop = new Set(names);
  merged.entries = merged.entries.filter((e) => !drop.has(e?.name));
  return merged;
}

/** Localiza uma entrada de `db.races.subrace` pela chave de 4 campos. */
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

const subraceCache = new WeakMap(); // db → Map('Nome|FONTE' → variantes)

/**
 * Sub-raças de uma raça base, FUNDIDAS como variantes concretas (mesma forma
 * das variantes de `_versions`). Sem nome (Half-Elf/Half-Orc PHB "base") ou com
 * `reprintedAs` próprio (marcas ERLW) ficam fora. Sub-raças que ainda carregam
 * `_versions` (variantes SCAG do Half-Elf) expandem até as folhas.
 *
 * Inclui as sub-raças LEGADAS curadas (DDL-0058), cuja base no dado é a versão
 * reprintada: elas são fundidas na base ATUAL e, por isso, aparecem como
 * linhagens dela (o Tiefling XPHB recebe as legacies do Tiefling PHB).
 * @param {object} db
 * @param {object|null} race  raça BASE (objeto cru)
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
  // Sub-raça que ainda carrega `_versions` (variantes SCAG do Half-Elf) expande
  // até as folhas; as demais entram como uma variante só.
  const push = (merged) => {
    if (Array.isArray(merged._versions) && merged._versions.length) out.push(...expandRaceVersions(merged));
    else out.push(merged);
  };
  for (const s of db.races?.subrace ?? []) {
    if (!s?.name || s.raceName !== race.name || s.raceSource !== race.source) continue;
    if (s.reprintedAs?.length) continue;
    push(mergeSubrace(race, s));
  }
  // …e as legadas curadas, cuja base no dado é a raça REPRINTADA (DDL-0058).
  for (const ref of legacySubracesFor(race)) {
    const s = findSubrace(db, ref);
    if (!s) continue;
    const merged = dropSuperseded(mergeSubrace(race, prepareLegacySubrace(s)), ref.supersedes);
    merged._legacy = true; // marca: é um ACRÉSCIMO opcional, não uma linhagem nativa
    push(merged);
  }
  byRace.set(key, out);
  return out;
}

/**
 * TODAS as linhagens de uma raça: as variantes de `_versions` + as sub-raças
 * fundidas. É a lista que o seletor de linhagem, a completude e o import usam.
 * @param {object} db
 * @param {object|null} race
 * @returns {object[]}
 */
export function raceLineages(db, race) {
  return [...expandRaceVersions(race), ...subraceVersions(db, race)];
}

/**
 * A raça EXIGE que uma linhagem seja escolhida? (DDL-0018: uma raça com
 * linhagens só está completa com uma delas.) Só as linhagens NATIVAS obrigam -
 * um Elfo precisa ser Drow/High/Wood, um Genasi precisa de um elemento. As
 * sub-raças LEGADAS curadas (DDL-0058) são acréscimos OPCIONAIS: um Halfling ou
 * um Human 2024 é completo sem linhagem nenhuma, e ganhar Ghostwise/Keldon como
 * opção não pode passar a obrigá-lo a escolher.
 * @param {object} db
 * @param {object|null} race
 * @returns {boolean}
 */
export function requiresLineage(db, race) {
  return raceLineages(db, race).some((v) => !v._legacy);
}

// --- Sub-raças legadas que voltam como ESPÉCIE À PARTE -----------------------
// Quando a base 2024 ABSORVEU os traços de uma das sub-raças 2014 (o Halfling
// XPHB é o de 2014 + o Naturally Stealthy do Lightfoot), pendurar uma irmã nela
// daria de graça um traço que ela nunca teve. Essas voltam fundidas na base
// LEGADA, como espécie própria no seletor - do jeito que o `Eladrin|MPMM` já é.
// Ver a nota sobre `as` no cabeçalho de legacySubraces.js.

const standaloneCache = new WeakMap(); // db → espécies legadas montadas

/**
 * Cópia da base LEGADA pronta para receber a sub-raça: sem o `ability` 2014 e
 * sem as seções de prosa que o chassi 2024 expressa em campos estruturados
 * (mesmas regras aplicadas à sub-raça). `mergeSubrace` já limpa `reprintedAs`,
 * então o resultado não é escondido pelo `latestOnly`.
 */
function prepareLegacyBase(race) {
  const out = { ...race };
  delete out.ability;
  if (Array.isArray(out.entries)) {
    out.entries = out.entries.filter((e) => !LEGACY_PROSE_SECTIONS.has(e?.name));
  }
  return out;
}

/**
 * As espécies legadas curadas, montadas sobre a base LEGADA (memoizado por db).
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
 * O catálogo de espécies que o app reconhece: as do compêndio MAIS as espécies
 * legadas curadas. É a lista que TODA resolução de espécie por nome deve usar
 * (`resolveRaceObj`, o import do Foundry, a entity do seletor) - senão uma
 * espécie legada some ao recarregar a ficha ou ao reimportar.
 * @param {object|null} db
 * @returns {object[]}
 */
export function speciesCatalog(db) {
  const list = db?.races?.race;
  if (!Array.isArray(list)) return legacyStandaloneSpecies(db);
  return [...list, ...legacyStandaloneSpecies(db)];
}

/**
 * Rótulo curto de uma linhagem para exibição (o nome da versão sem redundância da
 * raça base). Cobre as três formas de nome:
 *  - "Elf; Drow Lineage"        → "Drow Lineage"
 *  - "Dragonborn (Black)"       → "Black"
 *  - "Dragonborn (Gem; Amethyst)" → "Amethyst"
 * @param {string} name
 * @returns {string}
 */
export function lineageLabel(name) {
  if (!name) return '';
  let s = name;
  const paren = s.match(/\(([^)]*)\)/); // interior dos parênteses, se houver
  if (paren) s = paren[1];
  if (s.includes('; ')) s = s.split('; ').slice(-1)[0]; // depois do último "; "
  return s.trim();
}

/** Raça base OU suas variantes de sub-raça (p/ listas: variantes SUBSTITUEM a base). */
export function raceOrVersions(race) {
  return Array.isArray(race?._versions) && race._versions.length ? expandRaceVersions(race) : [race];
}

// --- Tamanho (size) ----------------------------------------------------------
// O campo `size` do 5etools é um array de códigos. Regras fixadas com o usuário
// (2026-07-14): raça SEM campo `size` = escolha Small/Medium; array com mais de
// um código = escolha do jogador; um código só = fixo; 'V' ("varies") é só o
// Verdan (AI) - Small até o nível 4, Medium do 5 em diante (prosa do traço Size).

export const SIZE_NAME = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };

/** Nível em que o Verdan ('V') passa de Small para Medium. */
const VARIES_MEDIUM_LEVEL = 5;

/**
 * Códigos de tamanho POSSÍVEIS de uma raça (antes de escolha/nível).
 * Sem campo `size` → ['S','M'] (o padrão "small/medium" combinado).
 * @param {object|null} raceObj
 * @returns {string[]}
 */
export function sizeCodes(raceObj) {
  const raw = raceObj?.size;
  const arr = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  return arr.length ? arr : ['S', 'M'];
}

/**
 * Descritor de ESCOLHA de tamanho (formato `Choice` de engine/choices), quando a
 * raça deixa o tamanho ao jogador (mais de um código). 'V' não é escolha - o
 * nível decide. Renderizado pelo ChoiceList (pool 'size') e salvo no choice-bag
 * da espécie como { kind: 'size', picks: ['S'] }.
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

/** O código de tamanho escolhido num choice-bag de espécie (kind 'size'), ou null. */
export function sizePick(bag) {
  for (const choice of Object.values(bag ?? {})) {
    if (choice?.kind === 'size' && choice.picks?.[0]) return choice.picks[0];
  }
  return null;
}

/**
 * Códigos de tamanho EFETIVOS: aplica o nível (Verdan 'V') e a escolha do
 * jogador; sem escolha, devolve todos os possíveis (a ficha mostra "Small/Medium").
 * @param {object|null} raceObj
 * @param {{ chosen?: string|null, level?: number }} [opts]  chosen = sizePick(bag)
 * @returns {string[]}
 */
export function effectiveSizeCodes(raceObj, { chosen = null, level = 1 } = {}) {
  const codes = sizeCodes(raceObj);
  if (codes.includes('V')) return [(level ?? 1) >= VARIES_MEDIUM_LEVEL ? 'M' : 'S'];
  if (chosen && codes.includes(chosen)) return [chosen];
  return codes;
}

/** Rótulo legível dos códigos efetivos: ['S','M'] → "Small/Medium". */
export function sizeLabel(codes) {
  return (codes ?? []).map((c) => SIZE_NAME[c] ?? c).join('/');
}

/**
 * Normaliza um bloco de proficiências do 5etools (skills/languages):
 * cada item é { choose: {...} }, { any: N } ou { <nome>: true }.
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

/** Normaliza o deslocamento (número simples ou objeto) para { walk, ... }. */
function parseSpeed(speed) {
  if (speed == null) return { walk: 0 };
  if (typeof speed === 'number') return { walk: speed };
  return speed;
}

/**
 * Normaliza um objeto de espécie do 5etools.
 * @param {object} raceObj  ex: db.races.race.find(r => r.name==='Elf' && r.source==='XPHB')
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
    languages: parseProfBlock(raceObj.languageProficiencies, (s) => s),
    resist: raceObj.resist ?? [],
    traitTags: raceObj.traitTags ?? [],
    creatureTypes: raceObj.creatureTypes ?? [],
    feats: raceObj.feats ?? null, // Humano 2024 concede um talento de origem
    traits, // traços nomeados → viram grants
  };
}
