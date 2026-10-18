// =============================================================================
// resolve: a ponte entre o compêndio (db) e o engine
// =============================================================================
// O QUE FAZ
//   Os parsers e o buildContext esperam objetos já localizados. Este módulo, dado
//   o personagem e o db do 5etools, localiza classe, subclasse, espécie e
//   talentos, deriva o que precisa do compêndio e entrega o resultado pronto para
//   a UI. Continua puro: db e character, sem rede, cache ou React. deriveFromDb é
//   a entrada ÚNICA da derivação (§6.3).
//
// FUNÇÕES
//   Localização
//   resolveClassObj(db, classId, source): a classe; prefere a fonte do personagem,
//     senão a mais recente.
//   subclassCopyId(s), resolvedSubclassList(db, classId): as subclasses com o
//     `_copy` resolvido (cache por db).
//   resolveSubclassObj(db, classId, subclassId, subclassSource): uma subclasse.
//   resolveRaceObj(db, id, source, lineage): a espécie, com a linhagem.
//   resolveFeat(db, id): um talento por "Nome|Fonte".
//   buildClassDataById(character, db): o mapa classId para classe.
//
//   Talentos
//   deriveFeatAbilityBoosts(character, db): os aumentos FIXOS de talento.
//   deriveFeatSaveProficiencies(character, db): os saves de talento (Resilient).
//   featChoiceBags(character): o choice-bag de cada talento, por id.
//   featAbilityMax(feat), withAbilityCaps(character, db): o teto dos aumentos.
//
//   Conjuração
//   spellListClassName(classId, info): a classe cuja LISTA a origem usa.
//   resolveSpellRefs(refs, db): refs de magia em objetos.
//   resolveGranted(additionalSpells, level, db, ctx, entity, opts): as magias
//     CONCEDIDAS de um additionalSpells, com usos e escolhas.
//   usesFromGranted(spells): os usos por dia ou descanso de uma origem.
//   grantedOrigin(opts): uma origem racial ou de talento.
//   deriveSpellcasting(character, db, derived): a conjuração inteira, por origem.
//   spellRefName(ref), grantedNamesOf(additionalSpells, level, db, entity, opts):
//     nomes de magias preparadas e concedidas.
//   reconcileClassSpells(oldCls, newCls, db): as preparadas depois de troca de
//     subclasse ou level-down.
//
//   Entradas
//   deriveFromDb(character, db): o estado computado com o compêndio ao vivo.
//   ownedFromDb(character, db): tudo que a ficha já possui, para o dedup.
//
// DECISÕES E ARMADILHAS
//   Localização
//   - Subclasse legada anexada à classe 2024 é STUB `_copy`: traz só as
//     subclassFeatures reapontadas e herda o resto (as domain spells) da
//     original. Sem resolver, o stub ganha do original e as magias somem
//     (TC-0027). O id é shortName|source|classSource, o mesmo do seletor. Entre
//     empates, vence a versão COMPLETA (com subclassFeatures).
//   - resolveRaceObj é o ÚNICO ponto por onde o app pega uma espécie (aba, guia,
//     derivação, sweep, import): o catálogo inclui as legadas curadas (DDL-0059),
//     as regras 2024 das legadas se aplicam aqui (legacySpeciesRules), e a base
//     ganha o guarda-chuva de linhagem (DDL-0063) para não conceder antes da
//     escolha o traço de UMA das opções.
//   Talentos
//   - Aumento FIXO de talento (GWM +1 Str) é grant e precisa do compêndio.
//   - Resilient (TC-0041): o RAW amarra o save ao MESMO atributo do +1, então não
//     há segunda escolha; lê-se o pick de `ability` do sub-bag do talento. Um
//     talento futuro com save independente precisaria de escolha própria.
//   - withAbilityCaps injeta o teto 30 dos Epic Boons nos picks a partir de
//     `feat.ability` (a fonte única, TC-0022), valendo até para fichas salvas
//     antes; devolve um clone, nunca muta o salvo.
//   Conjuração
//   - Uma origem por classe conjuradora (R1), com as magias da subclasse dentro
//     dela (R2), mais uma `race` e uma `feat:<id>` por talento que conceda. O
//     nível de uma concessão de classe é o da CLASSE. Classe não conjuradora que
//     concede magia ganha a aba; sem nada concedido, não.
//   - Concedida que o jogador também preparou aparece UMA vez e não consome
//     slot: a concessão vence (R12).
//   - Mystic Arcanum: círculos acima do teto do pacto, 1 por descanso longo, fora
//     da contagem. O teto de preparação é SEMPRE o do nível individual da classe;
//     os slots compartilhados do multiclasse não o influenciam.
//   - O `expanded` do patrono e os alargamentos em prosa CONTAM como da lista
//     sem serem concedidos (TC-0043); `expandedFrom` guarda a fonte para o badge.
//   - Cantrips: base mais os extras de featureoption (TC-0028), só se a classe
//     já conjura cantrips. Grimório só para quem tem repertório (o Mago).
//     Conhecida e não preparada conta no grimório, não no limite.
//   - resolveGranted: o registro curado funde concessões que só a prosa declara
//     (TC-0026); `entity` deixa o overlay preencher a frequência (DDL-0011); o
//     bag liga as escolhas de magia (TC-0011). grantedOrigin não chuta atributo
//     enquanto a escolha não foi feita: sem ele, sem DC.
//   - reconcileClassSpells (pedido do usuário): (1) trocar ou remover a subclasse
//     remove as sempre-preparadas da ANTIGA, senão a cópia manual que colapsou na
//     concessão ressurgia duplicada (o bug do Paladin/Devotion); (2) no level-down,
//     poda por prioridade: primeiro os círculos que o nível novo não alcança, depois
//     as MAIS RECENTES (fim do array) até caber. Concessões atuais ficam e não
//     contam. Uma não preparada não entra na poda (o grimório não encolhe). Devolve
//     o mesmo array quando nada muda.
//   deriveFromDb
//   - Sem db (ou sem dados de classe) degrada: atributos valem, HP e saves nulos.
//   - Junta: idiomas fixos da espécie e de subclasse (Rune Knight, TC-0012);
//     proficiências automáticas, de efeitos de feature e de grants de subclasse;
//     os grants em prosa de CLASSE; armas individuais escolhidas (Kensei) e as de
//     regra condicional (TC-0078, só para o export); saves da classe original, de
//     subclasse, das escolhas condicionais e de talento; HP extra (hpBonuses); o
//     inventário resolvido, a CA (com armadura natural e AC_BONUS_FEATURES) e os
//     bônus de item; traços de dano; e a conjuração.
//   - ownedFromDb também dedupa contra o que é AUTOMÁTICO (o Artificer não
//     "escolhe" Tinker's Tools) e contra expertise FIXA de subclasse.
//   deriveSpellcasting
//   - A escolha de classe que a MESMA origem também concede (Evocation Savant,
//     magia de domínio) aparece uma vez só, como concessão; a decisão continua em
//     ClassEntry.spells e sai em `shadowedPicks`, para o export marcá-la e o
//     import devolvê-la (TC-0091). Sem isso ela sumia no round-trip.
// -----------------------------------------------------------------------------

import { buildContext } from './context';
import { resolveCopies } from '../selector/copy';
import { deriveCharacter } from './index';
import { parseSpecies, raceLineages, speciesCatalog } from './speciesData';
import { normalizeLegacySpecies } from './legacySpeciesRules';
import { withLineageUmbrella } from './legacySwapLineages';
import { collectOwned, collectFeatIds } from './proficiency';
import { fixedAbilityBoosts, spellAbilityPick } from './choices';
import { deriveGrantedProficiencies } from './autoProficiencies';
import { deriveFeatureGrants, cantripLimitBonus, acFeatureBonuses } from './featureEffects';
import { deriveSubclassGrants } from './subclassGrants';
import { deriveClassFeatureGrants } from './classFeatureGrants';
import { collectChoicePicks } from './choices';
import { deriveInventory, carryingCapacity } from './items';
import { deriveArmorClass, deriveSaveBonusFromItems } from './armorClass';
import { naturalArmorFor } from './naturalArmor';
import { deriveDamageTraits } from './damageTraits';
import { deriveHpBonus } from './hpBonuses';
import { resolveSpellObj, classDisplayName } from './spells';
import { grantedSpells, castTypeLabel, resolveGrantedUses } from './grantedSpells';
import { applyUsesOverlay, curatedAdditionalSpells } from './grantedSpellUses';
import { originExtraSpells } from './spellListWidening';
import {
  casterInfo,
  leveledCasterLevel,
  spellSlots,
  pactSlots,
  maxPrepareCircle,
  spellSaveDc,
  spellAttackBonus,
  cantripLimit,
  prepareLimit,
  knownLimit,
  isPreparedRef,
  arcanumLevels,
} from './spellcasting';
import { ABILITIES } from '../schema/character';

/**
 * O objeto de classe; prefere a fonte do personagem, senão o mais recente.
 * @param {object} db
 * @param {string} classId
 * @param {string} [source]
 * @returns {object|null}
 */
export function resolveClassObj(db, classId, source) {
  if (!db || !classId) return null;
  const file = db[`class-${classId}`];
  const list = file?.class;
  if (!Array.isArray(list) || list.length === 0) return null;
  if (source) {
    const match = list.find((c) => c.source === source);
    if (match) return match;
  }
  return list[list.length - 1];
}

// ATENÇÃO: resolva o _copy das subclasses; sem ele, o stub vence e as magias concedidas somem.
const subclassCopyId = (s) => `${s.shortName ?? s.name}|${s.source}|${s.classSource ?? ''}`;
const subclassListCache = new WeakMap();

function resolvedSubclassList(db, classId) {
  let per = subclassListCache.get(db);
  if (!per) {
    per = new Map();
    subclassListCache.set(db, per);
  }
  if (!per.has(classId)) {
    const raw = db[`class-${classId}`]?.subclass;
    per.set(classId, Array.isArray(raw) ? resolveCopies(raw, subclassCopyId) : null);
  }
  return per.get(classId);
}

/**
 * O objeto de subclasse, com o `_copy` resolvido.
 * @param {object} db
 * @param {string} classId
 * @param {string} subclassId
 * @param {string} [subclassSource]
 * @returns {object|null}
 */
export function resolveSubclassObj(db, classId, subclassId, subclassSource) {
  if (!db || !classId || !subclassId) return null;
  const list = resolvedSubclassList(db, classId);
  if (!Array.isArray(list)) return null;
  let matches = list.filter((s) => s.shortName === subclassId);
  if (matches.length === 0) return null;
  if (subclassSource) {
    const bySource = matches.filter((s) => s.source === subclassSource);
    if (bySource.length) matches = bySource;
  }
  return matches.findLast((s) => Array.isArray(s.subclassFeatures)) ?? matches[matches.length - 1];
}

/**
 * O objeto de espécie, com a variante de linhagem quando dada.
 * @param {object} db
 * @param {string} id
 * @param {string} [source]
 * @param {string} [lineage]
 * @returns {object|null}
 */
export function resolveRaceObj(db, id, source, lineage = null) {
  if (!db || !id) return null;
  const list = speciesCatalog(db);
  if (list.length === 0) return null;
  const lc = id.toLowerCase();
  const matches = list.filter((r) => r.name?.toLowerCase() === lc);
  if (matches.length === 0) return null;
  const base = (source && matches.find((r) => r.source === source)) || matches[matches.length - 1];
  if (lineage) {
    const variant = raceLineages(db, base).find((v) => v.name === lineage);
    if (variant) return normalizeLegacySpecies(variant);
  }
  return normalizeLegacySpecies(withLineageUmbrella(db, base));
}

/**
 * Um talento pelo id "Nome|Fonte".
 * @param {object} db
 * @param {string} id
 * @returns {object|null}
 */
export function resolveFeat(db, id) {
  if (!db || !id) return null;
  const [name, source] = id.split('|');
  const list = db.feats?.feat;
  if (!Array.isArray(list)) return null;
  return list.find((f) => f.name === name && f.source === source) ?? null;
}

/**
 * Os aumentos de atributo FIXOS dos talentos escolhidos.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {import('../schema/character').AbilityBoost[]}
 */
export function deriveFeatAbilityBoosts(character, db) {
  const out = [];
  for (const id of collectFeatIds(character)) {
    const feat = resolveFeat(db, id);
    if (feat) out.push(...fixedAbilityBoosts(feat.ability));
  }
  return out;
}

/**
 * Os saves concedidos por talentos (Resilient, TC-0041).
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {string[]}
 */
export function deriveFeatSaveProficiencies(character, db) {
  const bags = featChoiceBags(character);
  const out = [];
  for (const [id, bag] of bags) {
    const feat = resolveFeat(db, id);
    const entries = feat?.savingThrowProficiencies;
    if (!Array.isArray(entries) || entries.length === 0) continue;
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const from = entry.choose?.from;
      if (Array.isArray(from)) {
        for (const choice of Object.values(bag ?? {})) {
          if (choice?.kind !== 'ability') continue;
          for (const pick of choice.picks ?? []) {
            if (pick?.ability && from.includes(pick.ability)) out.push(pick.ability);
          }
        }
      } else {
        for (const [ability, on] of Object.entries(entry)) if (on === true) out.push(ability);
      }
    }
  }
  return out;
}

/**
 * O mapa classId para classe que o buildContext consome.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {Record<string, object>}
 */
export function buildClassDataById(character, db) {
  /** @type {Record<string, object>} */
  const out = {};
  for (const cls of character.classes ?? []) {
    if (!cls.classId) continue;
    const obj = resolveClassObj(db, cls.classId, cls.source);
    if (obj) out[cls.classId] = obj;
  }
  return out;
}

/** A classe cuja lista de magias a origem usa como filtro padrão. */
function spellListClassName(classId, info) {
  if (info?.source === 'subclass') {
    const add = info.spellcaster?.additionalSpells ?? [];
    for (const grp of add) {
      for (const byLevel of Object.values(grp?.expanded ?? {})) {
        for (const entry of byLevel ?? []) {
          const spec = entry?.all ?? entry;
          const m = typeof spec === 'string' ? spec.match(/class=([^|]+)/i) : null;
          if (m) return m[1];
        }
      }
    }
  }
  return classDisplayName(classId);
}

/** Refs de magia em objetos crus, sem os nulos. */
function resolveSpellRefs(refs, db) {
  const out = [];
  for (const ref of refs ?? []) {
    const raw = resolveSpellObj(db, ref.id ?? ref.name, ref.source);
    out.push({ ...ref, raw });
  }
  return out;
}

/** As magias concedidas por um `additionalSpells`, com o atributo de conjuração. */
function resolveGranted(additionalSpells, level, db, ctx, entity, opts = {}) {
  const withCurated = curatedAdditionalSpells({ name: entity?.name, source: entity?.source, additionalSpells });
  const { spells, ability, abilityChoices, pendingChoices } = grantedSpells(withCurated, level, opts);
  const resolved = applyUsesOverlay(spells, entity, level)
    .map((s) => ({ ...s, ...resolveGrantedUses(s, ctx), id: s.name, granted: true, raw: resolveSpellObj(db, s.name, s.source) }))
    .filter((s) => s.raw);
  return { spells: resolved, ability, abilityChoices, pendingChoices };
}

/**
 * Os usos por descanso ou dia das magias concedidas.
 * @returns {Array<{ name: string, label: string }>}
 */
function usesFromGranted(spells) {
  const out = [];
  for (const s of spells) {
    const label = castTypeLabel(s);
    if (label) out.push({ name: s.raw.name, label, note: s.usesNote ?? null });
  }
  return out;
}

/** Uma origem racial ou de talento, ou null sem concessão no nível. */
function grantedOrigin({ key, kind, label, entity, additionalSpells, level, db, profBonus, modifiers, chosenAbility, bag }) {
  const { spells, ability: fixedAbility, abilityChoices, pendingChoices } = resolveGranted(
    additionalSpells,
    level,
    db,
    { profBonus, modifiers },
    entity,
    { bag },
  );
  if (spells.length === 0) return null;
  const ability = fixedAbility ?? chosenAbility ?? null;
  const abilityMod = ability ? (modifiers?.[ability] ?? 0) : null;
  return {
    key,
    kind,
    label,
    ability,
    abilityChoices,
    abilityMod,
    saveDc: ability ? spellSaveDc(profBonus, abilityMod) : null,
    attackBonus: ability ? spellAttackBonus(profBonus, abilityMod) : null,
    isPact: false,
    slots: {},
    pactSlots: null,
    cantripLimit: 0,
    prepareLimit: 0,
    cantrips: [],
    prepared: [],
    alwaysPrepared: spells,
    arcanumLevels: [],
    arcana: [],
    arcanumSpells: [],
    uses: usesFromGranted(spells),
    pendingChoices,
  };
}

/**
 * O choice-bag de cada talento do personagem, por id.
 * @returns {Map<string, object>}
 */
function featChoiceBags(character) {
  const out = new Map();
  const of = character.origin?.originFeat;
  if (of?.id) out.set(`${of.id}|${of.source}`, of.choices ?? {});

  const walk = (bag) => {
    for (const choice of Object.values(bag ?? {})) {
      if (!choice || typeof choice !== 'object') continue;
      if (choice.kind === 'feat') {
        for (const id of choice.picks ?? []) out.set(id, choice.sub?.[id] ?? {});
      }
      for (const sub of Object.values(choice.sub ?? {})) walk(sub);
    }
  };
  walk(character.species?.choices);
  walk(character.origin?.originFeat?.choices);
  for (const cls of character.classes ?? []) walk(cls.choices);
  return out;
}

/**
 * O teto dos aumentos de atributo de um talento, ou null (20).
 * @param {object|null} feat
 * @returns {number|null}
 */
function featAbilityMax(feat) {
  for (const entry of feat?.ability ?? []) {
    if (typeof entry?.max === 'number') return entry.max;
  }
  return null;
}

/**
 * Injeta o teto dos aumentos escolhidos em talentos nos picks.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {import('../schema/character').Character}
 */
export function withAbilityCaps(character, db) {
  const bags = featChoiceBags(character);
  const patches = [];
  for (const [featId, subBag] of bags) {
    const max = featAbilityMax(resolveFeat(db, featId));
    if (max == null) continue;
    for (const [cid, choice] of Object.entries(subBag ?? {})) {
      if (choice?.kind !== 'ability') continue;
      const needs = (choice.picks ?? []).some((p) => p && typeof p === 'object' && p.max !== max);
      if (needs) patches.push({ featId, cid, max });
    }
  }
  if (!patches.length) return character;
  const clone = structuredClone(character);
  const cloneBags = featChoiceBags(clone);
  for (const { featId, cid, max } of patches) {
    for (const pick of cloneBags.get(featId)?.[cid]?.picks ?? []) {
      if (pick && typeof pick === 'object') pick.max = max;
    }
  }
  return clone;
}

/**
 * A conjuração do personagem: nível de conjurador, slots e origens.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @param {{ profBonus: number, modifiers: Record<string, number>, level: number }} derived
 */
export function deriveSpellcasting(character, db, { profBonus, modifiers, level }) {
  const origins = [];
  const usesCtx = { profBonus, modifiers };
  const leveledCasters = [];
  let warlockLevel = 0;

  for (const cls of character.classes ?? []) {
    if (!cls.classId) continue;
    const classObj = resolveClassObj(db, cls.classId, cls.source);
    const subclassObj = cls.subclassId
      ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource)
      : null;
    const info = casterInfo(classObj, subclassObj);

    const granted = [
      ...resolveGranted(classObj?.additionalSpells, cls.level, db, usesCtx, classObj, { bag: cls.choices, idPrefix: 'class:' }).spells,
      ...resolveGranted(subclassObj?.additionalSpells, cls.level, db, usesCtx, subclassObj, { bag: cls.choices, idPrefix: 'sub:' }).spells,
    ];

    if (!info && granted.length === 0) continue;

    const isPact = info?.code === 'pact';
    if (info) {
      if (isPact) warlockLevel += cls.level;
      else leveledCasters.push({ code: info.code, level: cls.level });
    }

    const ability = info?.ability ?? null;
    const abilityMod = ability ? (modifiers?.[ability] ?? 0) : null;
    const grantedNames = new Set(granted.map((s) => s.raw.name.toLowerCase()));
    const picks = resolveSpellRefs(cls.spells, db);
    const shadowed = (s) => !!s.raw && grantedNames.has(s.raw.name.toLowerCase());
    const resolved = picks.filter((s) => !shadowed(s));

    const arcanaLevels = arcanumLevels(info?.code, cls.level);
    const isArcanum = (s) => arcanaLevels.includes(s.raw?.level);
    const leveled = resolved.filter((s) => s.raw && s.raw.level > 0);

    origins.push({
      key: `class:${cls.classId}`,
      kind: 'class',
      classId: cls.classId,
      label: classDisplayName(cls.classId),
      uid: cls.uid,
      ability,
      abilityMod,
      saveDc: ability ? spellSaveDc(profBonus, abilityMod) : null,
      attackBonus: ability ? spellAttackBonus(profBonus, abilityMod) : null,
      casterCode: info?.code ?? null,
      isPact,
      maxPrepareLevel: isPact
        ? (pactSlots(cls.level)?.level ?? 0)
        : maxPrepareCircle(info?.code ?? null, cls.level),
      spellListClass: info ? spellListClassName(cls.classId, info) : classDisplayName(cls.classId),
      ...(() => {
        const extra = originExtraSpells({
          db,
          classObj,
          subclassObj,
          classLevel: cls.level,
          maxSlotLevel: isPact
            ? (pactSlots(cls.level)?.level ?? 0)
            : maxPrepareCircle(info?.code ?? null, cls.level),
          activeGroup: cls.choices?.['sub:spellSet-0']?.picks?.[0] ?? null,
        });
        return { expandedSpells: extra.names, expandedFrom: extra.sources };
      })(),
      cantripLimit: cantripLimit(info, cls.level) + (cantripLimit(info, cls.level) > 0 ? cantripLimitBonus(cls) : 0),
      prepareLimit: prepareLimit(info, cls.level),
      knownLimit: knownLimit(info, cls.level),
      cantrips: resolved.filter((s) => s.raw?.level === 0),
      prepared: leveled.filter((s) => !isArcanum(s) && isPreparedRef(s)),
      unprepared: leveled.filter((s) => !isArcanum(s) && !isPreparedRef(s)),
      alwaysPrepared: granted,
      shadowedPicks: picks.filter(shadowed),
      arcanumLevels: arcanaLevels,
      arcana: arcanaLevels.map((level) => ({
        level,
        spell: leveled.find((s) => s.raw.level === level) ?? null,
      })),
      arcanumSpells: leveled.filter(isArcanum),
      uses: usesFromGranted(granted),
    });
  }

  const featBags = featChoiceBags(character);

  if (character.species) {
    const raceObj = resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage);
    const origin = grantedOrigin({
      key: 'race',
      kind: 'race',
      label: raceObj?.name?.split(';').pop().trim() || character.species.id,
      entity: raceObj,
      additionalSpells: raceObj?.additionalSpells,
      level,
      db,
      profBonus,
      modifiers,
      chosenAbility: spellAbilityPick(character.species.choices),
      bag: character.species.choices,
    });
    if (origin) origins.push(origin);
  }

  for (const id of collectFeatIds(character)) {
    const featObj = resolveFeat(db, id);
    if (!featObj?.additionalSpells) continue;
    const origin = grantedOrigin({
      key: `feat:${id}`,
      kind: 'feat',
      label: featObj.name,
      entity: featObj,
      additionalSpells: featObj.additionalSpells,
      level,
      db,
      profBonus,
      modifiers,
      chosenAbility: spellAbilityPick(featBags.get(id)),
      bag: featBags.get(id),
    });
    if (origin) origins.push(origin);
  }

  const casterLevel = leveledCasterLevel(leveledCasters);
  const slots = spellSlots(casterLevel);
  const pact = pactSlots(warlockLevel);

  for (const o of origins) {
    if (o.kind !== 'class') continue;
    o.slots = o.isPact ? {} : slots;
    o.pactSlots = o.isPact ? pact : null;
  }

  return { origins, casterLevel, slots, pactSlots: pact, warlockLevel };
}

/** O nome (minúsculo) de uma magia preparada. */
function spellRefName(ref) {
  return String(ref?.id ?? ref?.name ?? '').toLowerCase();
}

/** Os nomes que um `additionalSpells` concede como sempre preparadas no nível. */
function grantedNamesOf(additionalSpells, level, db, entity, opts) {
  if (!additionalSpells) return new Set();
  const { spells } = resolveGranted(additionalSpells, level, db, {}, entity, opts);
  return new Set(spells.map((s) => s.raw.name.toLowerCase()));
}

/**
 * Reconcilia as preparadas depois de troca de subclasse ou level-down.
 * @param {object} oldCls
 * @param {object} newCls
 * @param {object} db
 * @returns {import('../schema/character').ContentRef[]}
 */
export function reconcileClassSpells(oldCls, newCls, db) {
  const original = newCls.spells ?? [];
  if (!newCls.classId || original.length === 0) return original;
  let spells = original;

  const classObj = resolveClassObj(db, newCls.classId, newCls.source);

  const subChanged =
    oldCls.subclassId !== newCls.subclassId || oldCls.subclassSource !== newCls.subclassSource;
  if (subChanged && oldCls.subclassId) {
    const oldSub = resolveSubclassObj(db, oldCls.classId, oldCls.subclassId, oldCls.subclassSource);
    const removed = grantedNamesOf(oldSub?.additionalSpells, oldCls.level, db, oldSub, {
      bag: oldCls.choices,
      idPrefix: 'sub:',
    });
    if (removed.size) spells = spells.filter((s) => !removed.has(spellRefName(s)));
  }

  if (newCls.level < oldCls.level) {
    const subObj = newCls.subclassId
      ? resolveSubclassObj(db, newCls.classId, newCls.subclassId, newCls.subclassSource)
      : null;
    const info = casterInfo(classObj, subObj);
    const level = newCls.level;
    const isPact = info?.code === 'pact';
    const maxCircle = isPact ? (pactSlots(level)?.level ?? 0) : maxPrepareCircle(info?.code ?? null, level);
    const arcana = arcanumLevels(info?.code, level);
    const baseCantrip = cantripLimit(info, level);
    const cantripMax = baseCantrip + (baseCantrip > 0 ? cantripLimitBonus(newCls) : 0);
    const prepMax = prepareLimit(info, level);

    const grantedNow = new Set([
      ...grantedNamesOf(classObj?.additionalSpells, level, db, classObj, { bag: newCls.choices, idPrefix: 'class:' }),
      ...grantedNamesOf(subObj?.additionalSpells, level, db, subObj, { bag: newCls.choices, idPrefix: 'sub:' }),
    ]);

    const resolved = spells.map((ref) => {
      const raw = resolveSpellObj(db, ref.id ?? ref.name, ref.source);
      return { ref, level: raw?.level ?? 0, granted: grantedNow.has(spellRefName(ref)) };
    });
    const drop = new Set();

    resolved.forEach((r, i) => {
      if (r.granted || r.level === 0) return;
      if (r.level > maxCircle && !arcana.includes(r.level)) drop.add(i);
    });

    const isCantrip = (r) => !r.granted && r.level === 0;
    const isPrepared = (r) =>
      !r.granted && r.level > 0 && !arcana.includes(r.level) && isPreparedRef(r.ref);
    const dropRecent = (pred, max) => {
      let count = resolved.reduce((n, r, i) => n + (pred(r) && !drop.has(i) ? 1 : 0), 0);
      for (let i = resolved.length - 1; i >= 0 && count > max; i--) {
        if (pred(resolved[i]) && !drop.has(i)) {
          drop.add(i);
          count--;
        }
      }
    };
    dropRecent(isCantrip, cantripMax);
    dropRecent(isPrepared, prepMax);

    if (drop.size) spells = resolved.filter((_, i) => !drop.has(i)).map((r) => r.ref);
  }

  return spells;
}

/**
 * O estado computado do personagem com o compêndio ao vivo.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {ReturnType<typeof deriveCharacter>}
 */
export function deriveFromDb(character, db) {
  character = withAbilityCaps(character, db);
  const classDataById = buildClassDataById(character, db);
  const ctx = buildContext(character, classDataById);

  const raceObj = character.species
    ? resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage)
    : null;

  const auto = deriveGrantedProficiencies(character, db);
  const feat = deriveFeatureGrants(character);
  const sub = deriveSubclassGrants(character, db);
  const clsGrants = deriveClassFeatureGrants(character);
  const langPicks = (character.classes ?? []).flatMap((c) => collectChoicePicks(c.choices, 'language'));
  const grantedLanguages = [
    ...(raceObj ? (parseSpecies(raceObj)?.languages?.fixed ?? []) : []),
    ...sub.languages,
    ...clsGrants.languages,
    ...langPicks,
  ];
  const weaponProfPicks = (character.classes ?? []).flatMap((c) => collectChoicePicks(c.choices, 'weaponProf'));

  const granted = {
    armor: [...auto.armor, ...feat.armor, ...sub.armor],
    weapons: [...auto.weapons, ...feat.weapons, ...sub.weapons, ...weaponProfPicks],
    weaponNames: auto.weaponNames ?? [],
    grantedSkills: [...auto.grantedSkills, ...feat.grantedSkills, ...sub.grantedSkills],
    grantedTools: [...auto.grantedTools, ...feat.grantedTools, ...sub.grantedTools],
    expertiseSkills: sub.expertiseSkills,
  };

  const savePicks = (character.classes ?? []).flatMap((c) => collectChoicePicks(c.choices, 'save'));
  const featSaves = deriveFeatSaveProficiencies(character, db);
  ctx.proficientSaves = [
    ...new Set([...(ctx.proficientSaves ?? []), ...sub.saves, ...savePicks, ...featSaves, ...clsGrants.saves]),
  ];

  const extraAbilityBoosts = [...deriveFeatAbilityBoosts(character, db), ...clsGrants.abilityBoosts];

  const hpBonusExtra = deriveHpBonus(character, db);

  const derived = deriveCharacter(character, {
    ...ctx,
    grantedLanguages,
    ...granted,
    extraAbilityBoosts,
    extraMaxHp: hpBonusExtra.total,
  });

  const inv = deriveInventory(character, db);
  const capacity = carryingCapacity(derived.scores.str);

  const armorClass = deriveArmorClass(character, inv.entries, derived.modifiers, naturalArmorFor(raceObj));
  for (const b of acFeatureBonuses(character)) {
    if (b.requiresArmor && !armorClass.hasArmor) continue;
    armorClass.total += b.value;
    armorClass.breakdown.push({ label: b.label, value: b.value, note: 'feature' });
  }
  const itemSaveBonus = deriveSaveBonusFromItems(inv.entries);
  const saves = { ...derived.saves };
  if (itemSaveBonus.bonus) {
    for (const a of ABILITIES) saves[a] = (derived.saves[a] ?? 0) + itemSaveBonus.bonus;
  }

  const damageTraits = deriveDamageTraits(character, db, inv.entries);

  const spellcasting = deriveSpellcasting(character, db, {
    profBonus: derived.proficiencyBonus,
    modifiers: derived.modifiers,
    level: derived.level,
  });

  return {
    ...derived,
    saves,
    inventory: inv.entries,
    attunedCount: inv.attunedCount,
    encumbrance: { totalWeight: inv.totalWeight, capacity, encumbered: inv.totalWeight > capacity },
    armorClass,
    itemSaveBonus,
    damageTraits,
    spellcasting,
  };
}

/**
 * Tudo que a ficha já possui, com os idiomas fixos da raça.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 */
export function ownedFromDb(character, db) {
  const raceObj = character.species
    ? resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage)
    : null;
  const grantedLanguages = raceObj ? (parseSpecies(raceObj)?.languages?.fixed ?? []) : [];
  const owned = collectOwned(character, grantedLanguages);
  const auto = deriveGrantedProficiencies(character, db);
  const feat = deriveFeatureGrants(character);
  const sub = deriveSubclassGrants(character, db);
  for (const s of [...auto.grantedSkills, ...feat.grantedSkills, ...sub.grantedSkills]) owned.skills.add(s);
  for (const s of sub.expertiseSkills) {
    owned.skills.add(s);
    owned.expertise.add(s);
  }
  for (const t of [...auto.grantedTools, ...feat.grantedTools, ...sub.grantedTools]) owned.tools.add(String(t).toLowerCase());
  for (const l of sub.languages) owned.languages.add(String(l).toLowerCase());
  return owned;
}
