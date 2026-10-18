// =============================================================================
// prereq: os pré-requisitos genéricos (talentos, invocações)
// =============================================================================
// O QUE FAZ
//   O `prerequisite` do 5etools é uma lista de ALTERNATIVAS (OU), e dentro de cada
//   uma os critérios são E. Vale para qualquer entidade com o campo. Checáveis:
//   nível (total ou numa classe), atributo, raça (com GRUPOS: eladrin, shadar-kai
//   e drow contam como elfo), talento possuído, spellcasting, proficiência de
//   armadura e arma, optional feature e Pact Boon. O resto (campanha, background)
//   é 'unknown': cor neutra, confirmar com o mestre.
//
// FUNÇÕES
//   raceGroupsOf(speciesId, db): o id, o "sobrenome" de nomes compostos e o pai
//     na tabela de subraces.
//   canCastOf(character, db): consegue conjurar?
//   classProfsOf(character, db): as proficiências de armadura e arma das classes.
//   prereqContext(character, opts): o contexto de checagem.
//   checkLevel, checkAbility, checkRace, checkFeature, checkFeat,
//     checkSpellcasting, checkOptionalfeature, checkPact, checkProficiency(req,
//     ctx): cada critério, 'ok', 'bad' ou 'unknown'.
//   levelText, abilityText, raceText, optionalfeatureText, pactText, spellText,
//     otherText: o texto curto de cada critério.
//   evalEntry(entry, ctx): uma alternativa.
//   evalPrereq(feat, ctx): { status, entries }, ou null sem pré-requisito.
//   prereqStatus(feat, ctx), prereqText(feat, ctx): o status e o texto únicos.
//
// DECISÕES E ARMADILHAS
//   - "half-elf" NÃO vira elf: o hífen impede o match de sufixo, e é assim nas
//     regras (talentos élficos listam half-elf quando vale). "small race" olha o
//     tamanho, não o nome; uma sub-raça pedida exige a linhagem no id.
//   - checkFeature só afirma quando o contexto CONCEDE a feature (o pool de
//     Fighting Style); senão não dá para negar.
//   - Talento com variante (Initiate of High Sorcery (Nuitari)): possuir o talento
//     não diz a variante, então é 'unknown'.
//   - Pré-requisito de MAGIA (TC-0041, só invocações): as duas formas portadas do
//     5etools, a string `nome#c` (cantrip; `#x` é o Hex) e o objeto { choose,
//     entry, entrySummary } das versões XPHB.
//   - Metadados de picker no `prerequisite` não são requisito do jogador.
// -----------------------------------------------------------------------------

import { totalLevel } from '../schema/character';
import { finalScores } from './abilities';
import { titleCase } from './choices';
import { collectFeatIds, collectOptionalFeatureIds } from './proficiency';
import { resolveClassObj, resolveSubclassObj, resolveRaceObj } from './resolve';

const ABILITY_ABBR = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };

const ARMOR_TOKENS = ['light', 'medium', 'heavy', 'shield'];

/** Os grupos raciais do personagem. */
function raceGroupsOf(speciesId, db) {
  if (!speciesId) return new Set();
  const id = speciesId.toLowerCase();
  const groups = new Set([id]);
  for (const s of db?.races?.subrace ?? []) {
    if (s.name && s.raceName && s.name.toLowerCase() === id) groups.add(s.raceName.toLowerCase());
  }
  const parts = id.split(' ');
  if (parts.length > 1) groups.add(parts[parts.length - 1]);
  return groups;
}

/** O personagem consegue conjurar? */
function canCastOf(character, db) {
  if (!db) return null;
  for (const c of character?.classes ?? []) {
    const cls = resolveClassObj(db, c.classId, c.source);
    if (cls?.spellcastingAbility || cls?.casterProgression) return true;
    if (c.subclassId) {
      const sub = resolveSubclassObj(db, c.classId, c.subclassId, c.subclassSource);
      if (sub?.spellcastingAbility || sub?.casterProgression) return true;
    }
  }
  const race = character?.species ? resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage) : null;
  if (race?.additionalSpells) return true;
  return false;
}

/** As proficiências de armadura e arma das classes. */
function classProfsOf(character, db) {
  if (!db) return { armor: null, weapons: null };
  const armor = new Set();
  const weapons = new Set();
  for (const c of character?.classes ?? []) {
    const cls = resolveClassObj(db, c.classId, c.source);
    for (const a of cls?.startingProficiencies?.armor ?? []) {
      const s = String(a).toLowerCase();
      for (const t of ARMOR_TOKENS) if (s.includes(t)) armor.add(t);
    }
    for (const w of cls?.startingProficiencies?.weapons ?? []) {
      const s = String(w).toLowerCase();
      if (s === 'simple' || s === 'martial') weapons.add(s);
    }
  }
  return { armor, weapons };
}

/**
 * O contexto de checagem; sem db, raça-grupo, spellcasting e proficiência viram unknown.
 * @param {import('../schema/character').Character} character
 * @param {object} [opts]
 * @param {object} [opts.db]
 * @param {string[]} [opts.grantedFeatures]
 */
export function prereqContext(character, { db = null, grantedFeatures = [] } = {}) {
  const classLevels = {};
  for (const c of character?.classes ?? []) {
    if (c.classId) classLevels[c.classId.toLowerCase()] = c.level ?? 0;
  }
  const speciesId = character?.species?.id?.toLowerCase() ?? null;
  const raceObj =
    db && character?.species ? resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage) : null;
  const { armor, weapons } = classProfsOf(character, db);
  return {
    scores: finalScores(character ?? { scores: {} }),
    level: totalLevel(character ?? {}),
    raceId: speciesId,
    raceGroups: raceGroupsOf(speciesId, db),
    raceSizes: (Array.isArray(raceObj?.size) ? raceObj.size : [raceObj?.size]).filter(Boolean),
    classLevels,
    grantedFeatures: grantedFeatures.map((f) => f.toLowerCase()),
    ownedFeats: new Set(collectFeatIds(character ?? {}).map((id) => id.toLowerCase())),
    optionalFeatures: new Set(
      collectOptionalFeatureIds(character ?? {}).map((id) => id.split('|')[0].toLowerCase())
    ),
    canCast: canCastOf(character, db),
    armorProfs: armor,
    weaponProfs: weapons,
  };
}

function checkLevel(req, ctx) {
  if (typeof req === 'number') return ctx.level >= req ? 'ok' : 'bad';
  const need = req?.level ?? 0;
  const clsName = req?.class?.name?.toLowerCase();
  if (clsName) return (ctx.classLevels[clsName] ?? 0) >= need ? 'ok' : 'bad';
  return ctx.level >= need ? 'ok' : 'bad';
}

function checkAbility(req, ctx) {
  const ok = (req ?? []).some((obj) =>
    Object.entries(obj).every(([abil, min]) => (ctx.scores[abil] ?? 0) >= min)
  );
  return ok ? 'ok' : 'bad';
}

function checkRace(req, ctx) {
  if (!ctx.raceId) return 'bad';
  return (req ?? []).some((r) => {
    const name = String(r.name).toLowerCase();
    if (name === 'small race') return ctx.raceSizes?.includes('S') ?? false;
    if (!ctx.raceGroups?.has(name)) return false;
    if (r.subrace) return ctx.raceId.includes(String(r.subrace).toLowerCase());
    return true;
  })
    ? 'ok'
    : 'bad';
}

function checkFeature(req, ctx) {
  const all = (req ?? []).every((f) => ctx.grantedFeatures.includes(String(f).toLowerCase()));
  return all ? 'ok' : 'unknown';
}

function checkFeat(req, ctx) {
  let anyUnknown = false;
  for (const v of req ?? []) {
    const [name, source, variant] = String(v).toLowerCase().split('|');
    const owned = [...(ctx.ownedFeats ?? [])].some((id) => {
      const [n, src] = id.split('|');
      return n === name && (!source || src === source);
    });
    if (owned) {
      if (!variant || variant === name) return 'ok';
      anyUnknown = true;
    }
  }
  return anyUnknown ? 'unknown' : 'bad';
}

function checkSpellcasting(_req, ctx) {
  if (ctx.canCast == null) return 'unknown';
  return ctx.canCast ? 'ok' : 'bad';
}

function checkOptionalfeature(req, ctx) {
  const has = (ctx.optionalFeatures?.size ?? 0) > 0;
  const all = (req ?? []).every((v) => ctx.optionalFeatures?.has(String(v).split('|')[0].toLowerCase()));
  if (all) return 'ok';
  return has ? 'bad' : 'unknown';
}

function checkPact(req, ctx) {
  return ctx.optionalFeatures?.has(`pact of the ${String(req).toLowerCase()}`) ? 'ok' : 'bad';
}

function checkProficiency(req, ctx) {
  if (!ctx.armorProfs || !ctx.weaponProfs) return 'unknown';
  let anyUnknown = false;
  for (const obj of req ?? []) {
    let ok = true;
    let unknown = false;
    for (const [k, v] of Object.entries(obj)) {
      const val = String(v).toLowerCase();
      if (k === 'armor') ok = ok && ctx.armorProfs.has(val);
      else if (k === 'weapon' || k === 'weaponGroup') ok = ok && ctx.weaponProfs.has(val);
      else unknown = true;
    }
    if (ok && !unknown) return 'ok';
    if (ok && unknown) anyUnknown = true;
  }
  return anyUnknown ? 'unknown' : 'bad';
}

function levelText(req) {
  if (typeof req === 'number') return `Level ${req}+`;
  const cls = req?.class?.name;
  return cls ? `${cls} level ${req.level}+` : `Level ${req?.level ?? '?'}+`;
}

function abilityText(req) {
  return (req ?? [])
    .map((obj) =>
      Object.entries(obj)
        .map(([a, n]) => `${ABILITY_ABBR[a] ?? a} ${n}+`)
        .join(' & ')
    )
    .join(' or ');
}

function raceText(req) {
  return (req ?? []).map((r) => titleCase(String(r.displayEntry ?? r.name))).join(' or ');
}

function optionalfeatureText(req) {
  return (req ?? []).map((v) => titleCase(String(v).split('|')[0])).join(' & ');
}

function pactText(req) {
  return `Pact of the ${titleCase(String(req))}`;
}

/** O texto de um pré-requisito de magia (TC-0041). */
function spellText(req) {
  return (req ?? [])
    .map((sp) => {
      if (sp && typeof sp === 'object') return String(sp.entrySummary ?? sp.entry ?? 'Spell');
      const [name, suffix] = String(sp).split('#');
      const label = titleCase(name.split('|')[0]);
      if (suffix === 'c') return `${label} cantrip`;
      if (suffix === 'x') return 'Hex spell or a warlock feature that curses';
      return label;
    })
    .join(' or ');
}

/** O texto de um critério sem renderer próprio. */
function otherText(key, value) {
  switch (key) {
    case 'feat': {
      const names = (value ?? []).map((v) => {
        const parts = String(v).split('|');
        return titleCase(parts[2] ?? parts[0]);
      });
      return `Feat: ${names.join(' or ')}`;
    }
    case 'feature':
      return (value ?? []).map(titleCase).join(' or ');
    case 'campaign':
      return `Campaign: ${(value ?? []).join(' or ')}`;
    case 'background':
      return `Background: ${(value ?? []).map((b) => titleCase(String(b.name ?? b))).join(' or ')}`;
    case 'proficiency': {
      const parts = (value ?? []).flatMap((obj) =>
        Object.entries(obj).map(([k, v]) => `${titleCase(String(v))} ${k} proficiency`)
      );
      return parts.join(' or ');
    }
    case 'spellcasting':
    case 'spellcasting2020':
    case 'spellcastingFeature':
      return 'Spellcasting';
    case 'otherSummary':
      return String(value?.entrySummary ?? value?.entry ?? 'Special');
    case 'other':
      return String(value);
    default:
      return titleCase(key);
  }
}

const CHECKERS = {
  level: checkLevel,
  ability: checkAbility,
  race: checkRace,
  feature: checkFeature,
  feat: checkFeat,
  spellcasting: checkSpellcasting,
  spellcasting2020: checkSpellcasting,
  spellcastingFeature: checkSpellcasting,
  proficiency: checkProficiency,
  optionalfeature: checkOptionalfeature,
  pact: checkPact,
};
const TEXTS = {
  level: levelText,
  ability: abilityText,
  race: raceText,
  optionalfeature: optionalfeatureText,
  pact: pactText,
  spell: spellText,
};
const IGNORED_KEYS = new Set(['exclusiveFeatCategory', 'featCategory']);

function evalEntry(entry, ctx) {
  let status = 'ok';
  const texts = [];
  for (const [key, value] of Object.entries(entry ?? {})) {
    if (IGNORED_KEYS.has(key)) continue;
    const checker = CHECKERS[key];
    const s = checker ? checker(value, ctx) : 'unknown';
    texts.push(TEXTS[key] ? TEXTS[key](value) : otherText(key, value));
    if (s === 'bad') status = 'bad';
    else if (s === 'unknown' && status !== 'bad') status = 'unknown';
  }
  return { status, text: texts.join(', ') };
}

/**
 * Avalia as alternativas do pré-requisito.
 * @returns {{status: 'ok'|'bad'|'unknown', entries: {text:string, status:string}[]}|null}
 */
export function evalPrereq(feat, ctx) {
  const list = feat?.prerequisite;
  if (!Array.isArray(list) || list.length === 0) return null;
  const entries = list.map((e) => evalEntry(e, ctx)).filter((e) => e.text);
  if (entries.length === 0) return null;
  let status = 'bad';
  if (entries.some((e) => e.status === 'ok')) status = 'ok';
  else if (entries.some((e) => e.status === 'unknown')) status = 'unknown';
  return { status, entries };
}

/** O status agregado, ou null sem pré-requisito. */
export function prereqStatus(feat, ctx) {
  return evalPrereq(feat, ctx)?.status ?? null;
}

/** O texto único, com as alternativas unidas por " or ". */
export function prereqText(feat, ctx) {
  const r = evalPrereq(feat, ctx);
  if (!r) return null;
  return r.entries.map((e) => e.text).join(' or ');
}
