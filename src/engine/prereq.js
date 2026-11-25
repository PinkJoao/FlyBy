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
//     checkFeatCategory, checkExclusiveFeatCategory, checkSpellcasting, checkOptionalfeature, checkPact, checkProficiency,
//     checkSpell, checkOtherSummary(req, ctx): cada critério, 'ok', 'bad' ou 'unknown'.
//   knownClassSpells(character, db), reachedClassFeatures(character, db): as magias de classe conhecidas e
//     as features de classe e subclasse alcançadas, para o `spell` e o `feature` (DDL-0240).
//   spellPasses(known, choose, entry): a magia conhecida passa no filtro do pré-requisito?
//   levelText, abilityText, raceText, optionalfeatureText, pactText, spellText,
//     categoryLabel, featCategoryText, exclusiveFeatCategoryText, otherText: o texto curto de cada critério.
//   evalEntry(entry, ctx): uma alternativa.
//   evalPrereq(feat, ctx): { status, entries }, ou null sem pré-requisito.
//   prereqStatus(feat, ctx), prereqText(feat, ctx): o status e o texto únicos.
//
// DECISÕES E ARMADILHAS
//   - "half-elf" NÃO vira elf: o hífen impede o match de sufixo, e é assim nas
//     regras (talentos élficos listam half-elf quando vale). "small race" olha o
//     tamanho, não o nome; uma sub-raça pedida exige a linhagem no id OU no nome da
//     linhagem: o elfo de 2024 é `elf` com a linhagem "Elf; Wood Elf Lineage", e o
//     Wood Elf Magic e o Drow High Magic acusavam um elfo da linhagem certa (T3,
//     TC-0113). A linhagem também é um grupo ("Vampire (Ixalan)" é a linhagem do
//     Vampire).
//   - checkFeature afirma quando o contexto CONCEDE a feature (o pool de Fighting Style) ou quando o
//     personagem já ALCANÇOU uma feature de classe com o nome (qualquer uma da lista: "Spellcasting" ou
//     "Pact Magic"); com o compêndio, nega o resto (DDL-0240).
//   - Pré-requisito que só a mesa sabe (`campaign`, o renome de casa do EFA, o `item` das infusões, o
//     `background`: a origem do app é por peças) segue 'unknown'. O "When Gaining the Level 2 Paladin
//     'Fighting Style' Feature" do `otherSummary` é o nível na classe (DDL-0240).
//   - Talento com variante (Initiate of High Sorcery (Nuitari)): possuir o talento
//     não diz a variante, então é 'unknown'.
//   - Pré-requisito de MAGIA (TC-0041, só invocações): as duas formas portadas do
//     5etools, a string `nome#c` (cantrip; `#x` é o Hex) e o objeto { choose,
//     entry, entrySummary } das versões XPHB. Checado nas magias de classe conhecidas (DDL-0240): o
//     filtro "level=0|class=Warlock|spell attack=m;r;o" e "That Deals Damage" do texto; o `#x` sem o
//     Hex fica 'unknown' (a alternativa é uma feature de maldição).
//   - Metadados de picker no `prerequisite` não são requisito do jogador.
//   - Categoria de talento (DDL-0172, dragonmarks do EFA): `featCategory` pede um
//     talento da categoria (Potent Dragonmark: um Dragonmark); `exclusiveFeatCategory`
//     proíbe OUTRO da mesma (só um Dragonmark). O talento avaliado não conta para si
//     (`self`, posto por evalPrereq): senão o já escolhido se reprovaria. Sem db, as
//     categorias não se resolvem e o status é 'unknown'.
// -----------------------------------------------------------------------------

import { totalLevel } from '../schema/character';
import { finalScores } from './abilities';
import { titleCase } from './choices';
import { collectFeatIds, collectOptionalFeatureIds } from './proficiency';
import { resolveClassObj, resolveSubclassObj, resolveRaceObj, resolveFeat } from './resolve';
import { allSpells } from './spells';
import { classProficiencies, isOriginalEntry } from './classData';
import { resolveClassFeatures, resolveSubclassFeatures } from './foundryItems';

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
    const sp = classProficiencies(resolveClassObj(db, c.classId, c.source), isOriginalEntry(character, c));
    for (const a of sp?.armor ?? []) {
      const s = String(a).toLowerCase();
      for (const t of ARMOR_TOKENS) if (s.includes(t)) armor.add(t);
    }
    for (const w of sp?.weapons ?? []) {
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
  const lineage = character?.species?.lineage ? String(character.species.lineage).toLowerCase() : null;
  const raceObj =
    db && character?.species ? resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage) : null;
  const { armor, weapons } = classProfsOf(character, db);
  return {
    scores: finalScores(character ?? { scores: {} }),
    level: totalLevel(character ?? {}),
    raceId: speciesId,
    raceLineage: lineage,
    raceGroups: lineage ? new Set([...raceGroupsOf(speciesId, db), lineage]) : raceGroupsOf(speciesId, db),
    raceSizes: (Array.isArray(raceObj?.size) ? raceObj.size : [raceObj?.size]).filter(Boolean),
    classLevels,
    grantedFeatures: grantedFeatures.map((f) => f.toLowerCase()),
    ownedFeats: new Set(collectFeatIds(character ?? {}).map((id) => id.toLowerCase())),
    ownedFeatCategories: db
      ? collectFeatIds(character ?? {}).map((id) => ({ id: id.toLowerCase(), category: resolveFeat(db, id)?.category ?? null }))
      : null,
    optionalFeatures: new Set(
      collectOptionalFeatureIds(character ?? {}).map((id) => id.split('|')[0].toLowerCase())
    ),
    canCast: canCastOf(character, db),
    knownSpells: db ? knownClassSpells(character, db) : null,
    classFeatures: db ? reachedClassFeatures(character, db) : null,
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
    if (r.subrace) {
      const sub = String(r.subrace).toLowerCase();
      return ctx.raceId.includes(sub) || !!ctx.raceLineage?.includes(sub);
    }
    return true;
  })
    ? 'ok'
    : 'bad';
}

function checkFeature(req, ctx) {
  const names = (req ?? []).map((f) => String(f).toLowerCase());
  if (names.some((n) => ctx.grantedFeatures.includes(n) || ctx.classFeatures?.has(n))) return 'ok';
  return ctx.classFeatures ? 'bad' : 'unknown';
}

/** As magias das classes que o personagem conhece, resolvidas no compêndio ({ classId, raw }). */
function knownClassSpells(character, db) {
  const all = allSpells(db);
  return (character?.classes ?? []).flatMap((c) => (c.spells ?? []).map((s) => ({
    classId: String(c.classId ?? '').toLowerCase(),
    raw: all.find((x) => x.name === s.id && x.source === s.source) ?? all.find((x) => x.name === s.id) ?? null,
  }))).filter((x) => x.raw);
}

/** Os nomes das features de classe e subclasse já alcançadas (minúsculas). */
function reachedClassFeatures(character, db) {
  const out = new Set();
  for (const c of character?.classes ?? []) {
    const classObj = c.classId ? resolveClassObj(db, c.classId, c.source) : null;
    if (!classObj) continue;
    for (const f of resolveClassFeatures(db, c.classId, classObj, c.level || 1)) out.add(String(f.name).toLowerCase());
    const sub = c.subclassId ? resolveSubclassObj(db, c.classId, c.subclassId, c.subclassSource) : null;
    if (sub) for (const f of resolveSubclassFeatures(sub, c.classId, db, { max: c.level || 1 })) out.add(String(f.name).toLowerCase());
  }
  return out;
}

/** Uma magia conhecida passa no filtro "level=0|class=Warlock|spell attack=m;r;o" e no texto ("That Deals Damage")? */
function spellPasses(known, choose, entry) {
  const f = Object.fromEntries(String(choose ?? '').split('|').map((kv) => kv.split('=').map((x) => x.trim().toLowerCase())));
  if (f.level != null && String(known.raw.level) !== f.level) return false;
  if (f.class && known.classId !== f.class) return false;
  if (f['spell attack'] && !(known.raw.spellAttack ?? []).length) return false;
  if (/deals damage/i.test(entry ?? '') && !(known.raw.damageInflict ?? []).length) return false;
  return true;
}

function checkSpell(req, ctx) {
  if (!ctx.knownSpells) return 'unknown';
  let status = 'ok';
  for (const v of req ?? []) {
    let s;
    if (v && typeof v === 'object') s = ctx.knownSpells.some((k) => spellPasses(k, v.choose, v.entry)) ? 'ok' : 'bad';
    else {
      const [names, suffix] = String(v).toLowerCase().split('#');
      const first = names.split('/')[0].split('|')[0];
      const has = ctx.knownSpells.some((k) => k.raw.name.toLowerCase() === first);
      s = has ? 'ok' : suffix === 'x' ? 'unknown' : 'bad';
    }
    if (s === 'bad') return 'bad';
    if (s === 'unknown') status = 'unknown';
  }
  return status;
}

/** "When Gaining the Level 2 Paladin "Fighting Style" Feature": o nível na classe; outro texto, a mesa decide. */
function checkOtherSummary(req, ctx) {
  const m = String(req?.entry ?? '').match(/When Gaining the Level (\d+) (\w+(?: \w+)?) "/i);
  if (!m) return 'unknown';
  const cls = m[2].toLowerCase().replace(/ /g, '-');
  const lvl = ctx.classLevels?.[cls] ?? ctx.classLevels?.[m[2].toLowerCase()] ?? 0;
  return lvl >= Number(m[1]) ? 'ok' : 'bad';
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

/** Tem outro talento de uma das categorias pedidas. */
function checkFeatCategory(req, ctx) {
  if (!ctx.ownedFeatCategories) return 'unknown';
  const want = new Set((req ?? []).map(String));
  return ctx.ownedFeatCategories.some((f) => f.id !== ctx.self && want.has(f.category)) ? 'ok' : 'bad';
}

/** NÃO tem outro talento da categoria (só um Dragonmark). */
function checkExclusiveFeatCategory(req, ctx) {
  const s = checkFeatCategory(req, ctx);
  return s === 'unknown' ? s : s === 'ok' ? 'bad' : 'ok';
}

const CATEGORY_LABEL = { D: 'Dragonmark', DG: 'Dark Gift', O: 'Origin', G: 'General', FS: 'Fighting Style', EB: 'Epic Boon' };

/** O nome de uma categoria de talento. */
function categoryLabel(c) {
  return CATEGORY_LABEL[c] ?? String(c);
}

/** "Dragonmark feat". */
function featCategoryText(value) {
  return `${(value ?? []).map(categoryLabel).join(' or ')} feat`;
}

/** "No other Dragonmark feat". */
function exclusiveFeatCategoryText(value) {
  return `No other ${(value ?? []).map(categoryLabel).join(' or ')} feat`;
}

const CHECKERS = {
  level: checkLevel,
  ability: checkAbility,
  race: checkRace,
  feature: checkFeature,
  feat: checkFeat,
  featCategory: checkFeatCategory,
  exclusiveFeatCategory: checkExclusiveFeatCategory,
  spellcasting: checkSpellcasting,
  spellcasting2020: checkSpellcasting,
  spellcastingFeature: checkSpellcasting,
  proficiency: checkProficiency,
  optionalfeature: checkOptionalfeature,
  pact: checkPact,
  spell: checkSpell,
  otherSummary: checkOtherSummary,
};
const TEXTS = {
  level: levelText,
  ability: abilityText,
  race: raceText,
  optionalfeature: optionalfeatureText,
  pact: pactText,
  spell: spellText,
  featCategory: featCategoryText,
  exclusiveFeatCategory: exclusiveFeatCategoryText,
};

function evalEntry(entry, ctx) {
  let status = 'ok';
  const texts = [];
  for (const [key, value] of Object.entries(entry ?? {})) {
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
  const own = { ...ctx, self: feat?.name ? `${feat.name}|${feat.source}`.toLowerCase() : null };
  const entries = list.map((e) => evalEntry(e, own)).filter((e) => e.text);
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
