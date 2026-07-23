// =============================================================================
// autoBuild - constrói um personagem completo preenchendo TODAS as escolhas
// =============================================================================
// O pilar do Tier 0 (TESTING-PLAN.md §3.2): monta um personagem como um jogador
// montaria, usando a MESMA maquinaria de escolhas da UI (parseChoices /
// buildClassChoices / entities do seletor / guidancePendencies) - nunca um
// caminho paralelo. Loop: deriva → coleta escolhas por preencher → preenche com
// um pick legal SEMEADO → repete. Convergir a zero pendências prova que toda
// escolha tem seletor e opções; travar é exatamente o bug classe "Problem 1"
// (DDL-0002), detectado mecanicamente.
// -----------------------------------------------------------------------------

import { createCharacter } from '../../src/schema/character';
import {
  deriveFromDb,
  ownedFromDb,
  resolveRaceObj,
  resolveFeat,
} from '../../src/engine/resolve';
import { parseChoices, LEGACY_ABILITY_CHOICE, weaponFilterAllows } from '../../src/engine/choices';
import { skillCode } from '../../src/engine/classData';
import { speciesChoices } from '../../src/engine/speciesData';
import { prereqContext, prereqStatus } from '../../src/engine/prereq';
import { allSpells, classSpellList, spellChoosePredicate } from '../../src/engine/spells';
import { buildClassChoices } from '../../src/components/builder/classChoices';
import { ORIGIN_CHOICES } from '../../src/components/builder/originChoices';
import { guidancePendencies } from '../../src/components/wizard/guidancePendencies';
import { choicesComplete } from '../../src/components/wizard/createGuideContext';
import { makeFeatEntity, hasFreeLegacyBonus } from '../../src/selector/entities/feat';
import { makeOptionalFeatureEntity } from '../../src/selector/entities/optionalfeature';
import skillEntity from '../../src/selector/entities/skill';
import toolEntity from '../../src/selector/entities/tool';
import languageEntity from '../../src/selector/entities/language';
import weaponEntity from '../../src/selector/entities/weapon';
import { mulberry32, pickOne, shuffled } from './rng';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const MAX_ITERATIONS = 20;

// Mesmo mapa do ChoiceList: de onde saem as opções de cada kind "tag".
const ADD_ENTITY = { skill: skillEntity, tool: toolEntity, language: languageEntity, expertise: skillEntity, weapon: weaponEntity };
const OWNED_KEY = { skill: 'skills', tool: 'tools', language: 'languages', expertise: 'expertise' };
const SKILL_LIKE = new Set(['skill', 'expertise']);

const normVal = (kind, v) => (SKILL_LIKE.has(kind) ? v : String(v).toLowerCase());
const isOwned = (owned, kind, value) => owned?.[OWNED_KEY[kind]]?.has(normVal(kind, value)) ?? false;

/** Sub-escolhas de um feat - a mesma lista do ChoiceList/createGuideContext.
 * `level`/`bag` alimentam as escolhas de MAGIA (gate por nível + grupo ativo do
 * additionalSpells - TC-0011). */
function featSubChoices(featData, level = Infinity, bag = null) {
  if (!featData) return [];
  return [...parseChoices(featData, { level, bag }), ...(hasFreeLegacyBonus(featData) ? [LEGACY_ABILITY_CHOICE] : [])];
}

// Kinds em que a MESMA proficiência não pode vir de duas escolhas diferentes
// (você não tem expertise duas vezes na mesma perícia). O `owned` do ctx é um
// retrato do início da passada, então ele não enxerga o que uma escolha IRMÃ
// acabou de escolher - por isso a exclusão explícita por bag (mesma ideia do
// dedup entre spell chooses irmãos, TC-0025). `weapon` fica de fora: a maestria
// deduplica só contra si mesma.
const SIBLING_DEDUP_KINDS = new Set(['skill', 'expertise', 'tool', 'language']);

/** Picks das OUTRAS escolhas do mesmo kind já respondidas neste bag. */
function siblingPicks(ch, bag) {
  if (!SIBLING_DEDUP_KINDS.has(ch.kind)) return [];
  const out = [];
  for (const [id, entry] of Object.entries(bag ?? {})) {
    if (id === ch.id || entry?.kind !== ch.kind) continue;
    out.push(...(entry.picks ?? []));
  }
  return out;
}

/** Valores candidatos para um kind "tag" (skill/tool/language/expertise/weapon). */
function tagCandidates(ch, picks, ctx, bag) {
  const kind = ch.kind;
  let values;
  if (ch.pool.type === 'list') {
    values = ch.pool.options.map((o) => o.value);
  } else if (kind === 'weaponProf') {
    // Proficiência de arma individual (Kensei): mesmo filtro do ChoiceList.
    values = weaponEntity
      .list(ctx.db)
      .filter((r) => weaponFilterAllows(ch.pool.weaponFilter, r))
      .map((r) => r.name);
  } else if (ch.pool.type === 'weapon' || kind === 'weapon') {
    // Weapon Mastery: respeita a restrição de classe do pool (Barbarian =
    // melee-only, TC-0021), como o ChoiceList.
    values = weaponEntity
      .list(ctx.db)
      .filter((r) => weaponFilterAllows(ch.pool.weaponFilter ?? null, r))
      .map((r) => r.name);
  } else if (ch.pool.type === 'any' && !Array.isArray(ch.pool.of)) {
    const entity = ADD_ENTITY[kind];
    if (!entity) return null;
    let raws = entity.list(ctx.db);
    // Restrição de categoria de ferramenta (anyArtisansTool → AT etc.), como no
    // ChoiceList. Pode ser ARRAY (Monk: artesão OU instrumento).
    if (kind === 'tool' && ch.pool.category && ch.pool.category.length) {
      const cats = Array.isArray(ch.pool.category) ? ch.pool.category : [ch.pool.category];
      raws = raws.filter((r) => cats.includes(String(r.type ?? '').split('|')[0]));
    }
    values = raws.map((r) => (SKILL_LIKE.has(kind) ? skillCode(r.name) : r.name));
    // Alguns grants curados restringem por lista de códigos (ch.from).
    if (ch.from) values = values.filter((v) => ch.from.includes(v));
  } else {
    return null; // pool não-tag (tratado pelos fillers específicos)
  }
  // Dedup: nunca repetir um pick, nem escolher o que a ficha já tem (weapon
  // mastery e featureoption não deduplicam contra a ficha - só contra si).
  const siblings = siblingPicks(ch, bag);
  return values.filter((v) => {
    if (picks.includes(v) || siblings.includes(v)) return false;
    if (kind === 'weapon' || kind === 'weaponProf') return true;
    return !isOwned(ctx.owned, kind, v);
  });
}

/** Preenche UMA escolha; devolve a entry nova ou null (sem mudança). */
function fillChoice(ch, entry, bag, ctx) {
  const picks = [...(entry?.picks ?? [])];

  // --- feat: escolher via entity da categoria + recursão nas sub-escolhas ----
  if (ch.pool.type === 'feat') {
    const cats = ch.pool.category ?? ['O'];
    const granted = cats.some((c) => c.startsWith('FS')) ? ['Fighting Style'] : [];
    const pctx = prereqContext(ctx.character, { db: ctx.db, grantedFeatures: granted });
    const entity = makeFeatEntity(cats, 'Feat', pctx, ch.pool.only ?? null);
    const sub = { ...(entry?.sub ?? {}) };
    let changed = false;
    while (picks.length < (ch.count ?? 1)) {
      const cands = entity.list(ctx.db).filter((f) => {
        const id = `${f.name}|${f.source}`;
        if (picks.includes(id)) return false;
        if (!f.repeatable && ctx.owned.feats?.has(id)) return false;
        return true;
      });
      const ok = cands.filter((f) => prereqStatus(f, pctx) === 'ok');
      const f = pickOne(ctx.rng, ok.length ? ok : cands);
      if (!f) {
        ctx.problems.push(`${ctx.where}: feat choice "${ch.label}" (${ch.id}) has no candidates`);
        break;
      }
      picks.push(`${f.name}|${f.source}`);
      changed = true;
    }
    // Sub-escolhas de cada feat escolhido (profundo, como choicesComplete cobra).
    for (const id of picks) {
      const fd = resolveFeat(ctx.db, id);
      const subChoices = featSubChoices(fd, ctx.level, sub[id] ?? null);
      if (!subChoices.length) continue;
      const r = fillBag(subChoices, sub[id] ?? {}, { ...ctx, where: `${ctx.where} > ${id}` });
      if (r.changed) {
        sub[id] = r.bag;
        changed = true;
      }
    }
    return changed ? { kind: 'feat', picks, sub } : null;
  }

  // --- optional feature (invocation, metamagic, maneuver…) -------------------
  if (ch.pool.type === 'optionalfeature') {
    const pctx = prereqContext(ctx.character, { db: ctx.db });
    const entity = makeOptionalFeatureEntity(ch.pool.featureType, ch.label, pctx);
    let changed = false;
    while (picks.length < (ch.count ?? 1)) {
      const cands = entity.list(ctx.db).filter((f) => !picks.includes(`${f.name}|${f.source}`));
      const ok = cands.filter((f) => prereqStatus(f, pctx) === 'ok');
      const f = pickOne(ctx.rng, ok.length ? ok : cands);
      if (!f) {
        ctx.problems.push(`${ctx.where}: optional-feature choice "${ch.label}" (${ch.id}) has no candidates`);
        break;
      }
      picks.push(`${f.name}|${f.source}`);
      changed = true;
    }
    return changed ? { kind: 'optionalfeature', picks } : null;
  }

  // --- sub-feature option (Divine Order, Hunter's Prey…) --------------------
  if (ch.pool.type === 'featureoption') {
    let changed = false;
    while (picks.length < (ch.count ?? 1)) {
      const v = pickOne(ctx.rng, ch.pool.options.map((o) => o.value).filter((v) => !picks.includes(v)));
      if (!v) {
        ctx.problems.push(`${ctx.where}: feature-option "${ch.label}" (${ch.id}) has no candidates`);
        break;
      }
      picks.push(v);
      changed = true;
    }
    return changed ? { kind: 'featureoption', picks } : null;
  }

  // --- ability (ASI embutido em feat / raça legada) --------------------------
  if (ch.pool.type === 'ability') {
    const alts = ch.pool.alternatives ?? [];
    if (!alts.length) return null;
    const alt = entry?.alt ?? (alts.length === 1 ? 0 : Math.floor(ctx.rng() * alts.length));
    const spec = alts[alt];
    if (picks.length >= spec.count) return null;
    const used = new Set(picks.map((p) => p.ability));
    const from = (spec.from ?? []).filter((a) => !used.has(a));
    const next = [...picks];
    while (next.length < spec.count && from.length) {
      const a = pickOne(ctx.rng, from);
      from.splice(from.indexOf(a), 1);
      next.push({ ability: a, amount: spec.amount });
    }
    if (next.length < spec.count) {
      ctx.problems.push(`${ctx.where}: ability choice "${ch.label}" (${ch.id}) lacks abilities to pick`);
    }
    return next.length > picks.length ? { kind: 'ability', alt, picks: next } : null;
  }

  // --- select único (spellAbility / size / lista de magias) ------------------
  if (ch.pool.type === 'spellAbility' || ch.pool.type === 'size' || ch.pool.type === 'spellSet') {
    if (picks.length >= 1) return null;
    const opt = pickOne(ctx.rng, ch.pool.options ?? []);
    if (!opt) {
      ctx.problems.push(`${ctx.where}: select "${ch.label}" (${ch.id}) has no options`);
      return null;
    }
    return { kind: ch.kind, picks: [opt.value] };
  }

  // --- escolha de MAGIA de um additionalSpells (TC-0011) ----------------------
  if (ch.pool.type === 'spell') {
    const eligible = spellChoosePredicate(ch.pool, ctx.db);
    const cands = allSpells(ctx.db)
      .filter(eligible)
      .map((s) => `${s.name}|${s.source}`)
      .filter((v) => !picks.includes(v));
    const next = [...picks];
    let changed = false;
    while (next.length < (ch.count ?? 1)) {
      const v = pickOne(ctx.rng, cands.filter((c) => !next.includes(c)));
      if (!v) {
        ctx.problems.push(`${ctx.where}: spell choice "${ch.label}" (${ch.id}) has no candidates`);
        break;
      }
      next.push(v);
      changed = true;
    }
    return changed ? { kind: 'spell', picks: next } : null;
  }

  // --- pool MISTO (Skilled: "3 skills or tools") ------------------------------
  if (ch.pool.type === 'any' && Array.isArray(ch.pool.of)) {
    const next = [...picks];
    let changed = false;
    while (next.length < (ch.count ?? 1)) {
      const kind = pickOne(ctx.rng, ch.pool.of);
      const entity = ADD_ENTITY[kind];
      const values = entity
        .list(ctx.db)
        .map((r) => (kind === 'skill' ? skillCode(r.name) : r.name))
        // `fromByKind` restringe as opções de um dos tipos (Cavalier/Samurai).
        .filter((v) => !ch.fromByKind?.[kind] || ch.fromByKind[kind].includes(v))
        .filter((v) => !next.some((p) => p.value === v) && !isOwned(ctx.owned, kind, v));
      const v = pickOne(ctx.rng, values);
      if (!v) {
        ctx.problems.push(`${ctx.where}: mixed choice "${ch.label}" (${ch.id}) has no candidates`);
        break;
      }
      next.push({ kind, value: v });
      changed = true;
    }
    return changed ? { kind: ch.kind, picks: next } : null;
  }

  // --- tags (skill/tool/language/expertise/weapon; pools 'list'/'any') --------
  const cands = tagCandidates(ch, picks, ctx, bag);
  if (cands === null) {
    ctx.problems.push(`${ctx.where}: unsupported pool "${ch.pool.type}" on "${ch.label}" (${ch.id})`);
    return null;
  }
  const next = [...picks];
  let changed = false;
  while (next.length < (ch.count ?? 1)) {
    const remaining = cands.filter((v) => !next.includes(v));
    const v = pickOne(ctx.rng, remaining);
    if (!v) {
      // Expertise pode legitimamente esperar as perícias serem escolhidas antes
      // (opções = proficientes) - vira problema só se o loop externo travar.
      if (ch.kind !== 'expertise') {
        ctx.problems.push(`${ctx.where}: choice "${ch.label}" (${ch.id}) has no candidates`);
      }
      break;
    }
    next.push(v);
    changed = true;
  }
  return changed ? { kind: ch.kind, picks: next } : null;
}

/**
 * Preenche todas as escolhas INCOMPLETAS de uma lista de descritores num bag.
 * Usa a MESMA régua de completude do guia (choicesComplete, profunda).
 * @returns {{ bag: object, changed: boolean }}
 */
function fillBag(choices, bag, ctx) {
  let next = { ...(bag ?? {}) };
  let changed = false;
  for (const ch of choices ?? []) {
    if (choicesComplete([ch], next, ctx.db, ctx.level)) continue;
    const entry = fillChoice(ch, next[ch.id], next, ctx);
    if (entry) {
      next = { ...next, [ch.id]: entry };
      changed = true;
    }
  }
  return { bag: next, changed };
}

/** Preenche cantrips/preparadas/arcanum de cada origem de classe até o limite. */
function fillSpells(db, character, derived, rng, problems) {
  let changed = false;
  const catalog = allSpells(db);
  for (const origin of derived.spellcasting?.origins ?? []) {
    if (origin.kind !== 'class') continue;
    const cls = character.classes.find((x) => x.uid === origin.uid);
    if (!cls) continue;
    const listNames = classSpellList(db, origin.spellListClass);
    const chosen = new Set(cls.spells.map((s) => String(s.id).toLowerCase()));
    const grantedNames = new Set((origin.alwaysPrepared ?? []).map((s) => s.raw?.name?.toLowerCase()).filter(Boolean));
    const candidates = (level) =>
      catalog.filter(
        (s) =>
          s.level === level &&
          listNames.has(s.name.toLowerCase()) &&
          !chosen.has(s.name.toLowerCase()) &&
          !grantedNames.has(s.name.toLowerCase()),
      );
    const add = (spell) => {
      cls.spells.push({ id: spell.name, source: spell.source });
      chosen.add(spell.name.toLowerCase());
      changed = true;
    };
    // Cantrips até o limite.
    for (let i = (origin.cantrips?.length ?? 0); i < (origin.cantripLimit ?? 0); i++) {
      const s = pickOne(rng, candidates(0));
      if (!s) {
        problems.push(`${origin.key}: no cantrip candidates left (limit ${origin.cantripLimit})`);
        break;
      }
      add(s);
    }
    // Preparadas (círculos 1..maxPrepareLevel) até o limite.
    const maxLvl = origin.maxPrepareLevel ?? 0;
    for (let i = (origin.prepared?.length ?? 0); i < (origin.prepareLimit ?? 0); i++) {
      const lvl = 1 + Math.floor(rng() * Math.max(1, maxLvl));
      const s = pickOne(rng, candidates(lvl)) ?? pickOne(rng, candidates(1));
      if (!s) {
        problems.push(`${origin.key}: no prepared-spell candidates left (limit ${origin.prepareLimit})`);
        break;
      }
      add(s);
    }
    // Mystic Arcanum: um pick por círculo destravado ainda vazio.
    for (const a of origin.arcana ?? []) {
      if (a.spell) continue;
      const s = pickOne(rng, candidates(a.level));
      if (!s) {
        problems.push(`${origin.key}: no arcanum candidate for circle ${a.level}`);
        continue;
      }
      add(s);
    }
  }
  return changed;
}

/**
 * Constrói um personagem completo para uma linha da matriz.
 * @param {object} db
 * @param {{ classId, classSource, subclassId, subclassSource, level,
 *           speciesId, speciesSource, lineage, seed, originFeat }} spec
 * @returns {{ character, derived, pendencies, problems: string[], ok: boolean,
 *             iterations: number }}
 */
export function autoBuild(db, spec) {
  const rng = mulberry32(spec.seed ?? 1);
  const c = createCharacter({ name: spec.name ?? 'Sweep Build', scoreMethod: 'standard-array' });

  // Standard array numa ordem semeada (a variedade exercita pré-requisitos).
  const order = shuffled(rng, ABILITIES);
  order.forEach((a, i) => {
    c.scores[a] = STANDARD_ARRAY[i];
  });
  const boostOrder = shuffled(rng, ABILITIES);
  c.origin.abilityBoosts = [
    { ability: boostOrder[0], amount: 2 },
    { ability: boostOrder[1], amount: 1 },
  ];
  // Talento de origem FIXO por padrão (Alert XPHB, sem sub-escolhas): isola a
  // unidade sob teste; os feats de classe (ASI/estilo) continuam semeados.
  const of = spec.originFeat ?? { id: 'Alert', source: 'XPHB' };
  c.origin.originFeat = { id: of.id, source: of.source, subtype: 'origin', choices: {} };

  const cls = c.classes[0];
  cls.classId = spec.classId;
  cls.source = spec.classSource ?? 'XPHB';
  cls.level = spec.level ?? 1;
  if (spec.subclassId && cls.level >= (c.rulesConfig.subclassLevel ?? 3)) {
    cls.subclassId = spec.subclassId;
    cls.subclassSource = spec.subclassSource ?? null;
  }
  c.species = {
    id: spec.speciesId,
    source: spec.speciesSource,
    lineage: spec.lineage ?? null,
    choices: {},
  };

  const problems = [];
  let iterations = 0;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    iterations = iter + 1;
    // Derivação/pendências DESTA iteração (o estado final recomputa após o loop).
    const derived = deriveFromDb(c, db);
    const pend = guidancePendencies(db, c, derived);
    if (pend.total === 0) break;

    const owned = ownedFromDb(c, db);
    const ctx = { db, character: c, rng, owned, problems, level: cls.level, where: spec.id ?? 'row' };
    let changed = false;

    // Espécie: tamanho + sub-escolhas da raça/linhagem resolvida (nível + bag
    // p/ as escolhas de magia, TC-0011).
    const raceObj = resolveRaceObj(db, c.species.id, c.species.source, c.species.lineage);
    if (raceObj) {
      const baseRace = resolveRaceObj(db, c.species.id, c.species.source);
      const spChoices = speciesChoices({
        db,
        baseRace,
        raceObj,
        lineage: c.species.lineage,
        level: cls.level,
        bag: c.species.choices,
      });
      const r = fillBag(spChoices, c.species.choices, { ...ctx, where: `${ctx.where} species` });
      if (r.changed) {
        c.species = { ...c.species, choices: r.bag };
        changed = true;
      }
    }

    // Talento de origem: sub-escolhas dele.
    const featData = resolveFeat(db, `${c.origin.originFeat.id}|${c.origin.originFeat.source}`);
    if (featData) {
      const r = fillBag(featSubChoices(featData, cls.level, c.origin.originFeat.choices), c.origin.originFeat.choices, { ...ctx, where: `${ctx.where} origin-feat` });
      if (r.changed) {
        c.origin = { ...c.origin, originFeat: { ...c.origin.originFeat, choices: r.bag } };
        changed = true;
      }
    }

    // Proficiências da origem custom (2 perícias + 1 ferramenta + 1 idioma).
    {
      const r = fillBag(ORIGIN_CHOICES, c.origin.choices, { ...ctx, where: `${ctx.where} origin` });
      if (r.changed) {
        c.origin = { ...c.origin, choices: r.bag };
        changed = true;
      }
    }

    // Escolhas de classe (o mesmo builder da ClassTab/wizard).
    {
      const r = fillBag(buildClassChoices(db, cls, c), cls.choices, { ...ctx, where: `${ctx.where} class` });
      if (r.changed) {
        cls.choices = r.bag;
        changed = true;
      }
    }

    // Magias (limites vêm do derived DESTA iteração; a próxima revalida).
    if (fillSpells(db, c, derived, rng, problems)) changed = true;

    if (!changed) break; // travou: nada mais preenchível e ainda há pendências
  }

  const derived = deriveFromDb(c, db);
  const pend = guidancePendencies(db, c, derived);
  return {
    character: c,
    derived,
    pendencies: pend,
    problems,
    iterations,
    ok: pend.total === 0,
  };
}
