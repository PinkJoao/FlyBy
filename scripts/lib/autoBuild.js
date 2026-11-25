// =============================================================================
// autoBuild: um personagem completo, com TODAS as escolhas preenchidas
// =============================================================================
// O QUE FAZ
//   O pilar do Tier 0 (TESTING-PLAN.md §3.2): monta um personagem como um jogador
//   montaria, com a MESMA maquinaria de escolhas da UI (parseChoices,
//   buildClassChoices, entities do seletor, guidancePendencies), nunca um caminho
//   paralelo. Loop: deriva -> coleta escolhas por preencher -> preenche com um pick
//   legal SEMEADO -> repete. Convergir a zero pendências prova que toda escolha tem
//   seletor e opções; travar é o bug classe "Problem 1" (DDL-0002), detectado
//   mecanicamente.
//
// FUNÇÕES
//   normVal(kind, v), isOwned(owned, kind, value): o que a ficha já tem.
//   featSubChoices(featData, level, bag): as sub-escolhas de um feat, a mesma lista
//     do ChoiceList/createGuideContext (level e bag alimentam as de MAGIA, TC-0011).
//   siblingPicks(ch, bag): os picks das OUTRAS escolhas do mesmo kind no bag.
//   tagCandidates(ch, picks, ctx, bag): os candidatos de um kind "tag" (skill, tool,
//     language, expertise, weapon), com os filtros do ChoiceList; sem nenhum que o personagem
//     ainda não tenha, os que ele tem (o Boon of Skill dá todas as perícias e as escolhas de
//     perícia ficavam sem candidato; o jogador real já as escolheu antes, DDL-0237).
//   fillChoice(ch, entry, bag, ctx): preenche UMA escolha (entry nova ou null). Um
//     caso por kind: feat (entity da categoria + recursão nas sub-escolhas, profundo
//     como choicesComplete cobra), optional feature (com as sub-escolhas de cada pick, como
//     o OptionalFeatureChoice do builder: os cantrips do Pact of the Tome, DDL-0237),
//     sub-feature option, ability,
//     select único, MAGIA de additionalSpells, pool misto (`fromByKind` restringe um
//     dos tipos) e tags.
//   fillBag(choices, bag, ctx): todas as escolhas INCOMPLETAS de uma lista, pela
//     régua de completude do guia (choicesComplete).
//   fillSpells(db, character, derived, rng, problems, allow): cantrips, preparadas
//     (círculos até maxPrepareLevel) e um Mystic Arcanum por círculo destravado,
//     até o limite de cada origem de classe.
//   multiclassOrder(db, classIds): os atributos que os requisitos de multiclasse pedem, na ordem.
//   boostsFor(db, scores, order, classIds): os aumentos da origem que fazem todo requisito passar.
//   autoBuild(db, spec): o personagem completo de uma linha da matriz.
//
// DECISÕES E ARMADILHAS
//   - ADD_ENTITY é o mesmo mapa do ChoiceList: de onde saem as opções de cada kind.
//   - Em skill/tool/language/expertise a mesma proficiência não pode vir de duas
//     escolhas. O `owned` do ctx é um retrato do início da passada e não vê o que a
//     escolha IRMÃ acabou de escolher; por isso a exclusão explícita por bag (como o
//     dedup de spell chooses irmãos, TC-0025). `weapon` fica de fora: a maestria
//     deduplica só contra si mesma, como a featureoption.
//   - `pool.excludeFrom` de uma featureoption (o Animal Enhancement do nível 5, TC-0128) tira
//     o que a escolha irmã já pegou: a tela gera as opções com o bag, a passada não.
//   - O talento não repetível escolhido entra no `owned.feats` na hora: duas escolhas de
//     talento na mesma passada sorteavam o mesmo (o paladino modelo tinha Grappler no 4 e no
//     8, passe ao vivo, DDL-0221).
//   - tagCandidates segue o ChoiceList: os planos do Artificer pela entity de item com
//     `planAllows` (DDL-0212); proficiência de arma individual (Kensei),
//     restrição de classe da Weapon Mastery (Barbarian só corpo a corpo, TC-0021),
//     categoria de ferramenta (pode ser ARRAY: o Monk aceita artesão OU
//     instrumento) e lista de códigos dos grants curados (`ch.from`).
//   - Expertise pode legitimamente esperar as perícias serem escolhidas antes; só
//     vira problema se o loop externo travar.
//   - `spec.allow(raw)` (DDL-0218) restringe o que a passada SORTEIA (talento, opção de
//     classe, magia): os personagens modelo do SRD passam "só o que tem a marca srd52 ou
//     srd". O que o preset põe à mão não passa por ele.
//   - Opção de classe: prefere a de pré-requisito cumprido; sem nenhuma, a sem pré-requisito, e só por último a que
//     reprova. Um guerreiro com Eldritch Adept pegava o Eldritch Smite (bruxo 5) e o Foundry não avaliava a fórmula
//     do espaço de pacto (DDL-0264).
//   - `spec.preset(character)` (T3, TESTING-PLAN §5b) roda ANTES do laço: põe a
//     unidade sob teste no lugar real (o talento no `feat@4`, a magia no grimório, o
//     item no inventário) e o laço preenche o resto e as sub-escolhas dela.
//   - autoBuild: standard array numa ordem semeada (a variedade exercita
//     pré-requisitos), ou na ordem de `spec.abilityOrder` (os personagens modelo: o mago
//     com INT 12 não mostrava a CD de um mago de verdade, DDL-0219), que leva os aumentos
//     da origem para os dois primeiros; talento de origem FIXO por padrão (Alert XPHB, sem
//     sub-escolhas) para isolar a unidade, com os feats de classe semeados. Cada
//     iteração preenche espécie (tamanho e sub-escolhas da linhagem resolvida),
//     talento de origem, proficiências da origem custom (2 perícias, 1 ferramenta,
//     1 idioma), escolhas de classe (o mesmo builder da ClassTab) e magias (limites
//     do derived DESTA iteração; a próxima revalida). Sem nada preenchível e com
//     pendências, travou.
//   - Multiclasse (`spec.classes`, a régua do multiclasse): a primeira é a classe inicial, as
//     outras entram com `isOriginalClass: false` como o "+" da ClassTab. O nível das escolhas
//     é o TOTAL, como o guia (`totalLevel` no createGuideContext). Os atributos põem primeiro
//     os que os requisitos de 13 pedem (o primeiro de cada `or`), e os aumentos da origem vão
//     onde fazem todo requisito passar (com quatro atributos exigidos, o +1 vai no quarto).
// -----------------------------------------------------------------------------

import { createCharacter, createClassEntry } from '../../src/schema/character';
import {
  deriveFromDb,
  ownedFromDb,
  resolveRaceObj,
  resolveFeat,
  resolveOptionalFeature,
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
import itemEntity from '../../src/selector/entities/item';
import { planAllows } from '../../src/engine/classFeatureChoices';
import { mulberry32, pickOne, shuffled } from './rng';
import { subKeyOf, withTargetOptions } from '../../src/engine/optionTargets';
import { multiclassRequirements, meetsRequirement } from '../../src/engine/multiclass';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const MAX_ITERATIONS = 20;

const ADD_ENTITY = { skill: skillEntity, tool: toolEntity, language: languageEntity, expertise: skillEntity, weapon: weaponEntity };
const OWNED_KEY = { skill: 'skills', tool: 'tools', language: 'languages', expertise: 'expertise' };
const SKILL_LIKE = new Set(['skill', 'expertise']);

const normVal = (kind, v) => (SKILL_LIKE.has(kind) ? v : String(v).toLowerCase());
const isOwned = (owned, kind, value) => owned?.[OWNED_KEY[kind]]?.has(normVal(kind, value)) ?? false;

/** As sub-escolhas de um feat. */
function featSubChoices(featData, level = Infinity, bag = null) {
  if (!featData) return [];
  return [...parseChoices(featData, { level, bag }), ...(hasFreeLegacyBonus(featData) ? [LEGACY_ABILITY_CHOICE] : [])];
}

const SIBLING_DEDUP_KINDS = new Set(['skill', 'expertise', 'tool', 'language']);

/** Os picks das OUTRAS escolhas do mesmo kind neste bag. */
function siblingPicks(ch, bag) {
  if (!SIBLING_DEDUP_KINDS.has(ch.kind)) return [];
  const out = [];
  for (const [id, entry] of Object.entries(bag ?? {})) {
    if (id === ch.id || entry?.kind !== ch.kind) continue;
    out.push(...(entry.picks ?? []));
  }
  return out;
}

/** Os valores candidatos de um kind "tag". */
function tagCandidates(ch, picks, ctx, bag) {
  const kind = ch.kind;
  let values;
  if (ch.pool.type === 'list') {
    values = ch.pool.options.map((o) => o.value);
  } else if (ch.pool.type === 'plan') {
    values = itemEntity.list(ctx.db).filter((r) => planAllows(ch.pool, r)).map((r) => itemEntity.idOf(r));
  } else if (kind === 'weaponProf') {
    values = weaponEntity
      .list(ctx.db)
      .filter((r) => weaponFilterAllows(ch.pool.weaponFilter, r))
      .map((r) => r.name);
  } else if (ch.pool.type === 'weapon' || kind === 'weapon') {
    values = weaponEntity
      .list(ctx.db)
      .filter((r) => weaponFilterAllows(ch.pool.weaponFilter ?? null, r))
      .map((r) => r.name);
  } else if (ch.pool.type === 'any' && !Array.isArray(ch.pool.of)) {
    const entity = ADD_ENTITY[kind];
    if (!entity) return null;
    let raws = entity.list(ctx.db);
    if (kind === 'tool' && ch.pool.category && ch.pool.category.length) {
      const cats = Array.isArray(ch.pool.category) ? ch.pool.category : [ch.pool.category];
      raws = raws.filter((r) => cats.includes(String(r.type ?? '').split('|')[0]));
    }
    values = raws.map((r) => (SKILL_LIKE.has(kind) ? skillCode(r.name) : r.name));
    if (ch.from) values = values.filter((v) => ch.from.includes(v));
  } else {
    return null;
  }
  const siblings = siblingPicks(ch, bag);
  const fresh = values.filter((v) => !picks.includes(v) && !siblings.includes(v));
  const unowned = fresh.filter((v) => kind === 'weapon' || kind === 'weaponProf' || !isOwned(ctx.owned, kind, v));
  return unowned.length || kind === 'expertise' ? unowned : fresh;
}

/** Preenche UMA escolha; devolve a entry nova ou null. */
function fillChoice(ch, entry, bag, ctx) {
  const picks = [...(entry?.picks ?? [])];

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
        if (picks.includes(id) || !ctx.allow(f)) return false;
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
      if (!f.repeatable) ctx.owned.feats?.add?.(`${f.name}|${f.source}`);
      changed = true;
    }
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

  if (ch.pool.type === 'optionalfeature') {
    const pctx = prereqContext(ctx.character, { db: ctx.db });
    const entity = makeOptionalFeatureEntity(ch.pool.featureType, ch.label, pctx);
    let changed = false;
    while (picks.length < (ch.count ?? 1)) {
      const cands = entity.list(ctx.db).filter((f) => ctx.allow(f) && !picks.includes(`${f.name}|${f.source}`));
      const ok = cands.filter((f) => prereqStatus(f, pctx) === 'ok');
      const fine = ok.length ? ok : cands.filter((f) => prereqStatus(f, pctx) !== 'bad');
      const f = pickOne(ctx.rng, fine.length ? fine : cands);
      if (!f) {
        ctx.problems.push(`${ctx.where}: optional-feature choice "${ch.label}" (${ch.id}) has no candidates`);
        break;
      }
      picks.push(`${f.name}|${f.source}`);
      changed = true;
    }
    const sub = { ...(entry?.sub ?? {}) };
    picks.forEach((id, i) => {
      const key = subKeyOf(picks, i);
      const raw = resolveOptionalFeature(ctx.db, id);
      const taken = picks.map((p, j) => (j !== i && p === id ? sub[subKeyOf(picks, j)]?.cantripTarget?.picks ?? [] : [])).flat();
      const subChoices = raw ? withTargetOptions(parseChoices(raw, { level: ctx.level, bag: sub[key] ?? null }), { character: ctx.character, db: ctx.db, taken }) : [];
      if (!subChoices.length) return;
      const r = fillBag(subChoices, sub[key] ?? {}, { ...ctx, where: `${ctx.where} > ${key}` });
      if (r.changed) {
        sub[key] = r.bag;
        changed = true;
      }
    });
    return changed ? { kind: 'optionalfeature', picks, ...(Object.keys(sub).length ? { sub } : {}) } : null;
  }

  if (ch.pool.type === 'featureoption') {
    let changed = false;
    while (picks.length < (ch.count ?? 1)) {
      const taken = (ch.pool.excludeFrom ?? []).flatMap((id) => bag?.[id]?.picks ?? []);
      const v = pickOne(ctx.rng, ch.pool.options.map((o) => o.value).filter((v) => !picks.includes(v) && !taken.includes(v)));
      if (!v) {
        ctx.problems.push(`${ctx.where}: feature-option "${ch.label}" (${ch.id}) has no candidates`);
        break;
      }
      picks.push(v);
      changed = true;
    }
    return changed ? { kind: 'featureoption', picks } : null;
  }

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

  if (ch.pool.type === 'spellAbility' || ch.pool.type === 'size' || ch.pool.type === 'spellSet') {
    if (picks.length >= 1) return null;
    const opt = pickOne(ctx.rng, ch.pool.options ?? []);
    if (!opt) {
      ctx.problems.push(`${ctx.where}: select "${ch.label}" (${ch.id}) has no options`);
      return null;
    }
    return { kind: ch.kind, picks: [opt.value] };
  }

  if (ch.pool.type === 'spell') {
    const eligible = spellChoosePredicate(ch.pool, ctx.db);
    const cands = allSpells(ctx.db)
      .filter(eligible)
      .filter(ctx.allow)
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

  if (ch.pool.type === 'any' && Array.isArray(ch.pool.of)) {
    const next = [...picks];
    let changed = false;
    while (next.length < (ch.count ?? 1)) {
      const first = pickOne(ctx.rng, ch.pool.of);
      const fresh = (k) => ADD_ENTITY[k]
        .list(ctx.db)
        .map((r) => (k === 'skill' ? skillCode(r.name) : r.name))
        .filter((v) => !ch.fromByKind?.[k] || ch.fromByKind[k].includes(v))
        .filter((v) => !next.some((p) => p.value === v));
      const order = [first, ...ch.pool.of.filter((k) => k !== first)];
      const kind = order.find((k) => fresh(k).some((v) => !isOwned(ctx.owned, k, v))) ?? first;
      const unowned = fresh(kind).filter((v) => !isOwned(ctx.owned, kind, v));
      const v = pickOne(ctx.rng, unowned.length ? unowned : fresh(kind));
      if (!v) {
        ctx.problems.push(`${ctx.where}: mixed choice "${ch.label}" (${ch.id}) has no candidates`);
        break;
      }
      next.push({ kind, value: v });
      changed = true;
    }
    return changed ? { kind: ch.kind, picks: next } : null;
  }

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
 * Preenche as escolhas INCOMPLETAS de uma lista num bag.
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

/** Preenche cantrips, preparadas e arcanum de cada origem de classe. */
function fillSpells(db, character, derived, rng, problems, allow = () => true) {
  let changed = false;
  const catalog = allSpells(db).filter(allow);
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
    for (let i = (origin.cantrips?.length ?? 0); i < (origin.cantripLimit ?? 0); i++) {
      const s = pickOne(rng, candidates(0));
      if (!s) {
        problems.push(`${origin.key}: no cantrip candidates left (limit ${origin.cantripLimit})`);
        break;
      }
      add(s);
    }
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

/** Os atributos que os requisitos de multiclasse pedem, na ordem das classes. */
export function multiclassOrder(db, classIds) {
  const out = [];
  for (const id of classIds) {
    const req = multiclassRequirements(db, id) ?? {};
    for (const [k, v] of Object.entries(req)) {
      const keys = k === 'or' ? [Object.keys(v?.[0] ?? {})[0]] : [k];
      for (const a of keys) if (a && !out.includes(a)) out.push(a);
    }
  }
  return out;
}

/** Os aumentos da origem (+2 e +1) que fazem todo requisito de multiclasse passar, ou null. */
export function boostsFor(db, scores, order, classIds) {
  const reqs = classIds.map((id) => multiclassRequirements(db, id));
  for (const a of order) {
    for (const b of order) {
      if (a === b) continue;
      const s = { ...scores, [a]: scores[a] + 2, [b]: scores[b] + 1 };
      if (reqs.every((r) => meetsRequirement(r, s))) return [a, b];
    }
  }
  return null;
}

/**
 * O personagem completo de uma linha da matriz.
 * @param {object} db
 * @param {{ classId, classSource, subclassId, subclassSource, level,
 *   speciesId, speciesSource, lineage, seed, originFeat }} spec
 * @returns {{ character, derived, pendencies, problems: string[], ok: boolean,
 *   iterations: number }}
 */
export function autoBuild(db, spec) {
  const rng = mulberry32(spec.seed ?? 1);
  const c = createCharacter({ name: spec.name ?? 'Sweep Build', scoreMethod: 'standard-array' });

  const classSpecs = spec.classes?.length
    ? spec.classes
    : [{ classId: spec.classId, classSource: spec.classSource, subclassId: spec.subclassId, subclassSource: spec.subclassSource, level: spec.level }];
  const multi = classSpecs.length > 1;
  const seeded = shuffled(rng, ABILITIES);
  const required = multi ? multiclassOrder(db, classSpecs.map((x) => x.classId)) : [];
  const first = [...required, ...(spec.abilityOrder ?? []).filter((a) => ABILITIES.includes(a) && !required.includes(a))];
  const order = [...first, ...seeded.filter((a) => !first.includes(a))];
  order.forEach((a, i) => {
    c.scores[a] = STANDARD_ARRAY[i];
  });
  const boostSeeded = shuffled(rng, ABILITIES);
  const boostOrder = (multi && boostsFor(db, c.scores, order, classSpecs.map((x) => x.classId))) || (first.length ? order : boostSeeded);
  c.origin.abilityBoosts = [
    { ability: boostOrder[0], amount: 2 },
    { ability: boostOrder[1], amount: 1 },
  ];
  const of = spec.originFeat ?? { id: 'Alert', source: 'XPHB' };
  c.origin.originFeat = { id: of.id, source: of.source, subtype: 'origin', choices: {} };

  classSpecs.forEach((cs, i) => {
    if (i > 0) c.classes.push(createClassEntry(false));
    const cls = c.classes[i];
    cls.classId = cs.classId;
    cls.source = cs.classSource ?? 'XPHB';
    cls.level = cs.level ?? 1;
    if (cs.subclassId && cls.level >= (c.rulesConfig.subclassLevel ?? 3)) {
      cls.subclassId = cs.subclassId;
      cls.subclassSource = cs.subclassSource ?? null;
    }
  });
  const total = c.classes.reduce((n, x) => n + (x.level ?? 0), 0);
  c.species = {
    id: spec.speciesId,
    source: spec.speciesSource,
    lineage: spec.lineage ?? null,
    choices: {},
  };

  if (spec.preset) spec.preset(c);

  const problems = [];
  let iterations = 0;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    iterations = iter + 1;
    const derived = deriveFromDb(c, db);
    const pend = guidancePendencies(db, c, derived);
    if (pend.total === 0) break;

    const owned = ownedFromDb(c, db);
    const ctx = { db, character: c, rng, owned, problems, level: total, where: spec.id ?? 'row', allow: spec.allow ?? (() => true) };
    let changed = false;

    const raceObj = resolveRaceObj(db, c.species.id, c.species.source, c.species.lineage);
    if (raceObj) {
      const baseRace = resolveRaceObj(db, c.species.id, c.species.source);
      const spChoices = speciesChoices({
        db,
        baseRace,
        raceObj,
        lineage: c.species.lineage,
        level: total,
        bag: c.species.choices,
      });
      const r = fillBag(spChoices, c.species.choices, { ...ctx, where: `${ctx.where} species` });
      if (r.changed) {
        c.species = { ...c.species, choices: r.bag };
        changed = true;
      }
    }

    const featData = resolveFeat(db, `${c.origin.originFeat.id}|${c.origin.originFeat.source}`);
    if (featData) {
      const r = fillBag(featSubChoices(featData, total, c.origin.originFeat.choices), c.origin.originFeat.choices, { ...ctx, where: `${ctx.where} origin-feat` });
      if (r.changed) {
        c.origin = { ...c.origin, originFeat: { ...c.origin.originFeat, choices: r.bag } };
        changed = true;
      }
    }

    {
      const r = fillBag(ORIGIN_CHOICES, c.origin.choices, { ...ctx, where: `${ctx.where} origin` });
      if (r.changed) {
        c.origin = { ...c.origin, choices: r.bag };
        changed = true;
      }
    }

    for (const cls of c.classes) {
      const r = fillBag(buildClassChoices(db, cls, c), cls.choices, { ...ctx, where: `${ctx.where} class${multi ? ` ${cls.classId}` : ''}` });
      if (r.changed) {
        cls.choices = r.bag;
        changed = true;
      }
    }

    if (fillSpells(db, c, derived, rng, problems, spec.allow)) changed = true;

    if (!changed) break;
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
