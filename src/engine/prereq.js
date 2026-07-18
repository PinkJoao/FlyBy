// =============================================================================
// prereq - pré-requisitos GENÉRICOS (feats, e futuramente invocations etc.)
// =============================================================================
// O campo `prerequisite` do 5etools é uma lista de ALTERNATIVAS (OR): a entrada
// é elegível se QUALQUER alternativa for satisfeita. Dentro de uma alternativa,
// os critérios são AND. Funciona para QUALQUER entidade com `prerequisite`
// (feats hoje; eldritch invocations e outras optional features depois).
//
// Checáveis: nível (total ou por classe), atributo, raça (com GRUPOS - eladrin/
// shadar-kai/drow contam como elfo), feat já possuído, spellcasting e
// proficiência de armadura/arma. O resto (campanha, background, magia
// específica…) é "unknown" - cor neutra, confirmar com o mestre.
//
//   prereqStatus(entity, ctx) → 'ok' | 'bad' | 'unknown' | null (sem pré-req)
//   evalPrereq(entity, ctx)   → { status, entries: [{text, status}] }
//   prereqContext(character, {db, grantedFeatures}) → ctx
// -----------------------------------------------------------------------------

import { totalLevel } from '../schema/character';
import { finalScores } from './abilities';
import { titleCase } from './choices';
import { collectFeatIds, collectOptionalFeatureIds } from './proficiency';
import { resolveClassObj, resolveSubclassObj, resolveRaceObj } from './resolve';

const ABILITY_ABBR = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };

const ARMOR_TOKENS = ['light', 'medium', 'heavy', 'shield'];

/**
 * Grupos raciais do personagem: o próprio id, o "sobrenome" de nomes compostos
 * ("Sea Elf"/"Astral Elf" → elf) e o pai na tabela de subraces do 5etools
 * (Eladrin/Shadar-kai/Drow são subraces de Elf). "half-elf" NÃO vira elf (o
 * hífen impede o match de sufixo - e é assim nas regras: feats élficos listam
 * half-elf explicitamente quando vale).
 */
function raceGroupsOf(speciesId, db) {
  if (!speciesId) return new Set();
  const id = speciesId.toLowerCase();
  const groups = new Set([id]);
  for (const s of db?.races?.subrace ?? []) {
    if (s.name && s.raceName && s.name.toLowerCase() === id) groups.add(s.raceName.toLowerCase());
  }
  // Sufixo com espaço: "sea elf" → elf; "mountain dwarf" → dwarf.
  const parts = id.split(' ');
  if (parts.length > 1) groups.add(parts[parts.length - 1]);
  return groups;
}

/** O personagem consegue conjurar? Classe/subclasse caster ou magia racial. */
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

/** Proficiências de armadura/arma vindas das classes (união; tokens genéricos). */
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
 * Monta o contexto de checagem a partir do personagem.
 * @param {import('../schema/character').Character} character
 * @param {object} [opts]
 * @param {object} [opts.db]  compêndio - habilita checagens de raça-grupo,
 *   spellcasting e proficiências; sem ele, esses critérios viram 'unknown'.
 * @param {string[]} [opts.grantedFeatures]  features garantidas pelo contexto
 *   da escolha (ex: pool de Fighting Style concede a feature "Fighting Style").
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
    // Optional features já escolhidas (nome minúsculo) - p/ prereqs de invocation
    // que exigem outra invocation, e de `pact` (que é uma Pact Boon).
    optionalFeatures: new Set(
      collectOptionalFeatureIds(character ?? {}).map((id) => id.split('|')[0].toLowerCase())
    ),
    canCast: canCastOf(character, db),
    armorProfs: armor,
    weaponProfs: weapons,
  };
}

// --- Critérios individuais: 'ok' | 'bad' | 'unknown' --------------------------

function checkLevel(req, ctx) {
  if (typeof req === 'number') return ctx.level >= req ? 'ok' : 'bad';
  // Formato objeto: { level, class: { name } } - nível NUMA classe específica.
  const need = req?.level ?? 0;
  const clsName = req?.class?.name?.toLowerCase();
  if (clsName) return (ctx.classLevels[clsName] ?? 0) >= need ? 'ok' : 'bad';
  return ctx.level >= need ? 'ok' : 'bad';
}

function checkAbility(req, ctx) {
  // Array de objetos (OR); chaves de um objeto são AND: [{str:13},{dex:13}].
  const ok = (req ?? []).some((obj) =>
    Object.entries(obj).every(([abil, min]) => (ctx.scores[abil] ?? 0) >= min)
  );
  return ok ? 'ok' : 'bad';
}

function checkRace(req, ctx) {
  if (!ctx.raceId) return 'bad';
  return (req ?? []).some((r) => {
    const name = String(r.name).toLowerCase();
    // "small race" (ex: Squat Nimbleness) → tamanho da espécie, não o nome.
    if (name === 'small race') return ctx.raceSizes?.includes('S') ?? false;
    // Grupo racial: eladrin/shadar-kai/drow contam como elf, etc.
    if (!ctx.raceGroups?.has(name)) return false;
    // Sub-raça pedida (ex: elf (high)): o id da espécie precisa citar a linhagem.
    if (r.subrace) return ctx.raceId.includes(String(r.subrace).toLowerCase());
    return true;
  })
    ? 'ok'
    : 'bad';
}

function checkFeature(req, ctx) {
  // Só sabemos afirmar quando o contexto CONCEDE a feature (ex: pool de FS);
  // caso contrário não temos como negar → unknown.
  const all = (req ?? []).every((f) => ctx.grantedFeatures.includes(String(f).toLowerCase()));
  return all ? 'ok' : 'unknown';
}

function checkFeat(req, ctx) {
  // Valores "name|source|variante". Sem a variante: possuir o feat basta.
  // Com variante (feats repetíveis, ex: Initiate of High Sorcery (Nuitari)),
  // sabemos o feat mas não a variante escolhida → unknown se possuído.
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
  if (ctx.canCast == null) return 'unknown'; // sem compêndio no contexto
  return ctx.canCast ? 'ok' : 'bad';
}

function checkOptionalfeature(req, ctx) {
  // Ex: uma invocation que exige outra ("thirsting blade|xphb"). Casa por NOME.
  const has = (ctx.optionalFeatures?.size ?? 0) > 0;
  const all = (req ?? []).every((v) => ctx.optionalFeatures?.has(String(v).split('|')[0].toLowerCase()));
  if (all) return 'ok';
  return has ? 'bad' : 'unknown'; // sem nenhuma escolhida ainda → não dá p/ afirmar
}

function checkPact(req, ctx) {
  // `pact:"Tome"` → precisa da Pact Boon "Pact of the Tome" (uma optional feature).
  return ctx.optionalFeatures?.has(`pact of the ${String(req).toLowerCase()}`) ? 'ok' : 'bad';
}

function checkProficiency(req, ctx) {
  // Array de objetos (OR); chaves de um objeto são AND. Checáveis: armor
  // (light/medium/heavy/shield) e weapon/weaponGroup (simple/martial).
  if (!ctx.armorProfs || !ctx.weaponProfs) return 'unknown';
  let anyUnknown = false;
  for (const obj of req ?? []) {
    let ok = true;
    let unknown = false;
    for (const [k, v] of Object.entries(obj)) {
      const val = String(v).toLowerCase();
      if (k === 'armor') ok = ok && ctx.armorProfs.has(val);
      else if (k === 'weapon' || k === 'weaponGroup') ok = ok && ctx.weaponProfs.has(val);
      else unknown = true; // outro tipo (ferramenta etc.) - não checável
    }
    if (ok && !unknown) return 'ok';
    if (ok && unknown) anyUnknown = true;
  }
  return anyUnknown ? 'unknown' : 'bad';
}

// --- Texto curto por critério --------------------------------------------------

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

/** Texto de um critério sem renderer dedicado (campanha, feat, proficiência…). */
function otherText(key, value) {
  switch (key) {
    case 'feat': {
      // Mostra a variante quando existir (3º segmento), senão o nome do feat.
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

// --- Avaliação por alternativa e agregado --------------------------------------

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
};
const IGNORED_KEYS = new Set(['exclusiveFeatCategory', 'featCategory']); // metadados de picker, não requisito do jogador

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

/** Status agregado: 'ok' | 'bad' | 'unknown' | null (sem pré-requisitos). */
export function prereqStatus(feat, ctx) {
  return evalPrereq(feat, ctx)?.status ?? null;
}

/** Texto único (alternativas unidas por " or "). */
export function prereqText(feat, ctx) {
  const r = evalPrereq(feat, ctx);
  if (!r) return null;
  return r.entries.map((e) => e.text).join(' or ');
}
