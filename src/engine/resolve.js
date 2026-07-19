// =============================================================================
// Resolve - ponte entre o compêndio (db) e o engine
// =============================================================================
// Os parsers e o buildContext são puros e esperam OBJETOS já localizados (ex:
// o objeto de classe do Fighter). Este módulo faz a ponte: dado o personagem +
// o `db` carregado do 5etools, localiza os objetos certos (classe, subclasse,
// espécie) e entrega o resultado derivado pronto para a UI.
//
// É aqui que o engine "encosta" nos dados ao vivo pela primeira vez (Fase 5a).
// Continua puro: recebe db + character, não toca em rede/cache/React.
// -----------------------------------------------------------------------------

import { buildContext } from './context';
import { deriveCharacter } from './index';
import { parseSpecies, raceLineages } from './speciesData';
import { collectOwned, collectFeatIds } from './proficiency';
import { fixedAbilityBoosts, spellAbilityPick } from './choices';
import { deriveGrantedProficiencies } from './autoProficiencies';
import { deriveFeatureGrants } from './featureEffects';
import { deriveSubclassGrants } from './subclassGrants';
import { collectChoicePicks } from './choices';
import { deriveInventory, carryingCapacity } from './items';
import { deriveArmorClass, deriveSaveBonusFromItems } from './armorClass';
import { naturalArmorFor } from './naturalArmor';
import { deriveDamageTraits } from './damageTraits';
import { deriveHpBonus } from './hpBonuses';
import { resolveSpellObj, classDisplayName } from './spells';
import { grantedSpells, castTypeLabel, resolveGrantedUses } from './grantedSpells';
import { applyUsesOverlay, curatedAdditionalSpells } from './grantedSpellUses';
import {
  casterInfo,
  leveledCasterLevel,
  spellSlots,
  pactSlots,
  spellSaveDc,
  spellAttackBonus,
  cantripLimit,
  prepareLimit,
  arcanumLevels,
} from './spellcasting';
import { ABILITIES } from '../schema/character';

/**
 * Localiza o objeto de classe do 5etools para um classId.
 * O arquivo `class-X.json` pode trazer várias entradas (reprints); preferimos a
 * que casa com a `source` do personagem e, na falta, a última (mais recente).
 * @param {object} db
 * @param {string} classId  ex: 'fighter'
 * @param {string} [source] ex: 'XPHB'
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

/**
 * Localiza o objeto de subclasse (dentro do mesmo arquivo da classe).
 * @param {object} db
 * @param {string} classId
 * @param {string} subclassId      shortName da subclasse (ex: 'Champion')
 * @param {string} [subclassSource]
 * @returns {object|null}
 */
export function resolveSubclassObj(db, classId, subclassId, subclassSource) {
  if (!db || !classId || !subclassId) return null;
  const file = db[`class-${classId}`];
  const list = file?.subclass;
  if (!Array.isArray(list)) return null;
  let matches = list.filter((s) => s.shortName === subclassId);
  if (matches.length === 0) return null;
  if (subclassSource) {
    const bySource = matches.filter((s) => s.source === subclassSource);
    if (bySource.length) matches = bySource;
  }
  // Entre empates (ex: original TCE × stub "compat" _copy sem features),
  // prefere a versão COMPLETA (com subclassFeatures).
  return matches.findLast((s) => Array.isArray(s.subclassFeatures)) ?? matches[matches.length - 1];
}

/**
 * Localiza o objeto de espécie (raça) do 5etools. Se `lineage` for dado e a raça
 * base tiver `_versions`, resolve a VARIANTE da linhagem (ex: 'Elf; Drow Lineage').
 * @param {object} db
 * @param {string} id      nome em minúsculas (ex: 'elf')
 * @param {string} [source]
 * @param {string} [lineage]  nome da versão de linhagem escolhida
 * @returns {object|null}
 */
export function resolveRaceObj(db, id, source, lineage = null) {
  if (!db || !id) return null;
  const list = db.races?.race;
  if (!Array.isArray(list)) return null;
  const lc = id.toLowerCase();
  const matches = list.filter((r) => r.name?.toLowerCase() === lc);
  if (matches.length === 0) return null;
  const base = (source && matches.find((r) => r.source === source)) || matches[matches.length - 1];
  if (lineage) {
    // Linhagem = variante de `_versions` OU sub-raça fundida (raceLineages).
    const variant = raceLineages(db, base).find((v) => v.name === lineage);
    if (variant) return variant;
  }
  return base;
}

/**
 * Localiza o objeto de um talento pelo id "Nome|Fonte".
 * @param {object} db
 * @param {string} id  ex: 'Alert|XPHB'
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
 * Aumentos de atributo FIXOS embutidos nos TALENTOS escolhidos (ex: Great Weapon
 * Master XPHB → +1 Str). São grants automáticos, não escolhas, então precisam do
 * compêndio (resolvem o feat p/ ler seu campo `ability`) e não podem sair só do
 * choice-bag. Cobre origin feat + feats escolhidos em slots de ASI/espécie.
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
 * Monta o mapa classId → objeto de classe 5etools, que o buildContext consome.
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

/** Nome da classe cuja LISTA de magias esta origem usa como filtro padrão (R10).
 * Normalmente a própria classe; subclasses conjuradoras (Eldritch Knight /
 * Arcane Trickster) puxam de outra lista, declarada em `additionalSpells`
 * ("...|class=Wizard"). */
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

/** Resolve uma lista de ContentRef de magia em objetos crus (dropando nulos). */
function resolveSpellRefs(refs, db) {
  const out = [];
  for (const ref of refs ?? []) {
    const raw = resolveSpellObj(db, ref.id ?? ref.name, ref.source);
    out.push({ ...ref, raw });
  }
  return out;
}

/** Resolve as magias CONCEDIDAS por um `additionalSpells` (R12: sempre preparadas,
 * fora da contagem). Devolve as entradas resolvidas + o atributo de conjuração.
 * `ctx` (prof + modificadores) resolve usos escalados: "pb"/dia, "cha"/dia…
 * `entity` ({name, source}) permite ao overlay curado (DDL-0011) preencher a
 * frequência das concessões inatas que o 5etools deixa sem tipo de recarga.
 * `opts` ({bag, idPrefix}) liga as ESCOLHAS de magia (TC-0011): os picks do
 * choice-bag do dono entram como concedidas, com o modo/frequência da folha. */
function resolveGranted(additionalSpells, level, db, ctx, entity, opts = {}) {
  // Concessões que a prosa declara mas o dado omite (TC-0026): o registro
  // curado funde a magia faltante no primeiro grupo antes da leitura.
  const withCurated = curatedAdditionalSpells({ name: entity?.name, source: entity?.source, additionalSpells });
  const { spells, ability, abilityChoices, pendingChoices } = grantedSpells(withCurated, level, opts);
  const resolved = applyUsesOverlay(spells, entity)
    .map((s) => ({ ...s, ...resolveGrantedUses(s, ctx), id: s.name, granted: true, raw: resolveSpellObj(db, s.name, s.source) }))
    .filter((s) => s.raw);
  return { spells: resolved, ability, abilityChoices, pendingChoices };
}

/**
 * Usos por descanso/dia das magias concedidas de uma origem - o que uma origem
 * SEM slots (raça, talento) tem no lugar da tabela de slots. Genérico: qualquer
 * magia concedida com `castType` (daily/rest/will/ritual/resource) entra aqui,
 * inclusive as de uma classe.
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

/** Monta uma origem NÃO-de-classe (raça / talento): só magias concedidas, sem
 * slots nem limites. Retorna null quando nada é concedido no nível atual.
 * `chosenAbility` vem do choice-bag da entidade quando o dado manda escolher. */
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
  // Atributo fixo no dado, senão o escolhido pelo jogador. Enquanto a escolha não
  // é feita não há DC/ataque - não se chuta uma decisão que não existe.
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
 * Choice-bag de cada TALENTO do personagem, por id ("Nome|Fonte"). O talento de
 * origem guarda o seu em `origin.originFeat.choices`; talentos escolhidos dentro
 * de um choice-bag (espécie, ASI de classe) guardam em `sub[featId]`.
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
 * Teto (`max`) dos aumentos de atributo de um talento (só os Epic Boons trazem,
 * =30; ausente = 20 RAW). Lido do campo `ability` do feat - a FONTE do teto.
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
 * Injeta o teto (`max`) dos aumentos de atributo ESCOLHIDOS dentro de talentos
 * (Epic Boons → 30) nos picks do choice-bag, lendo-o de `feat.ability` - a fonte
 * única do teto (TC-0022). Assim o cap em finalScores vale para QUALQUER
 * personagem, inclusive os salvos antes desta lógica (o pick guardado é só
 * {ability, amount}). Devolve o mesmo personagem quando não há nada a corrigir,
 * senão um clone com os picks corrigidos (nunca muta o estado salvo). Boosts de
 * teto 20 (ASI de classe, background, espécie) já usam o default, sem patch.
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
 * Deriva a conjuração do personagem: nível de conjurador combinado, slots
 * (leveled + pacto) e, por ORIGEM, habilidade/DC/ataque, limites de cantrip/
 * preparadas, as magias preparadas pelo jogador e as CONCEDIDAS (sempre
 * preparadas). Uma origem por classe conjuradora (R1), com as magias dadas pela
 * subclasse dobradas para dentro dela (R2); mais uma origem `race` e uma
 * `feat:<id>` por talento que conceda magias.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @param {{ profBonus: number, modifiers: Record<string, number>, level: number }} derived
 */
export function deriveSpellcasting(character, db, { profBonus, modifiers, level }) {
  const origins = [];
  const usesCtx = { profBonus, modifiers };
  const leveledCasters = []; // { code, level } das origens leveled (p/ o nível combinado)
  let warlockLevel = 0;

  for (const cls of character.classes ?? []) {
    if (!cls.classId) continue;
    const classObj = resolveClassObj(db, cls.classId, cls.source);
    const subclassObj = cls.subclassId
      ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource)
      : null;
    const info = casterInfo(classObj, subclassObj);

    // Magias concedidas pela classe/subclasse (R2: ficam NA aba da classe).
    // O nível relevante aqui é o da CLASSE, não o do personagem. Os picks das
    // escolhas de magia (TC-0011) vivem no choice-bag da classe, com ids
    // prefixados 'class:'/'sub:' (os MESMOS que buildClassChoices gera).
    const granted = [
      ...resolveGranted(classObj?.additionalSpells, cls.level, db, usesCtx, classObj, { bag: cls.choices, idPrefix: 'class:' }).spells,
      ...resolveGranted(subclassObj?.additionalSpells, cls.level, db, usesCtx, subclassObj, { bag: cls.choices, idPrefix: 'sub:' }).spells,
    ];

    // Classe não-conjuradora que ainda assim concede magias (via subclasse sem
    // `casterProgression`) merece a aba; sem nada concedido, é ignorada.
    if (!info && granted.length === 0) continue;

    const isPact = info?.code === 'pact';
    if (info) {
      if (isPact) warlockLevel += cls.level;
      else leveledCasters.push({ code: info.code, level: cls.level });
    }

    const ability = info?.ability ?? null;
    const abilityMod = ability ? (modifiers?.[ability] ?? 0) : null;
    // Uma magia CONCEDIDA que o jogador também preparou não pode aparecer duas
    // vezes nem consumir um slot da contagem (R12) - a concessão vence.
    const grantedNames = new Set(granted.map((s) => s.raw.name.toLowerCase()));
    const resolved = resolveSpellRefs(cls.spells, db).filter(
      (s) => !s.raw || !grantedNames.has(s.raw.name.toLowerCase()),
    );

    // Mystic Arcanum: círculos que o pacto destravou acima do seu teto de slot.
    // As magias do jogador nesses círculos são arcanum - 1×/descanso longo,
    // fora da contagem de preparadas.
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
      spellListClass: info ? spellListClassName(cls.classId, info) : classDisplayName(cls.classId),
      cantripLimit: cantripLimit(info, cls.level),
      prepareLimit: prepareLimit(info, cls.level),
      // Preparadas pelo jogador, separadas por cantrip (nv 0) vs. círculo.
      cantrips: resolved.filter((s) => s.raw?.level === 0),
      // As de arcanum saem das preparadas (não consomem o limite).
      prepared: leveled.filter((s) => !isArcanum(s)),
      alwaysPrepared: granted,
      // Círculos de arcanum destravados + a magia escolhida em cada um (ou null).
      arcanumLevels: arcanaLevels,
      arcana: arcanaLevels.map((level) => ({
        level,
        spell: leveled.find((s) => s.raw.level === level) ?? null,
      })),
      // As magias de arcanum em si - fora das preparadas, mas a aba as LISTA.
      arcanumSpells: leveled.filter(isArcanum),
      // Usos por dia/descanso das magias inatas que a classe/subclasse conceda.
      uses: usesFromGranted(granted),
    });
  }

  const featBags = featChoiceBags(character);

  // Origem RACIAL (linhagem inclusa: Elf Drow → Dancing Lights / Faerie Fire…).
  if (character.species) {
    const raceObj = resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage);
    const origin = grantedOrigin({
      key: 'race',
      kind: 'race',
      // Variantes de linhagem se chamam "Elf; Drow Lineage" - na aba basta a
      // parte da linhagem (o ícone já diz que é a espécie).
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

  // Uma origem por TALENTO que conceda magias (Magic Initiate, Aberrant Dragonmark…).
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

  // Slots compartilhados vão em cada origem leveled; o pacto na origem do Warlock.
  for (const o of origins) {
    if (o.kind !== 'class') continue;
    o.slots = o.isPact ? {} : slots;
    o.pactSlots = o.isPact ? pact : null;
    // Círculo máximo que esta origem prepara NORMALMENTE (acima disso só arcanum):
    // o teto do slot de pacto, ou o maior círculo de slot leveled disponível.
    const levels = Object.keys(o.slots).map(Number);
    o.maxPrepareLevel = o.isPact ? (o.pactSlots?.level ?? 0) : (levels.length ? Math.max(...levels) : 0);
  }

  return { origins, casterLevel, slots, pactSlots: pact, warlockLevel };
}

/**
 * Deriva o estado computado do personagem usando o compêndio ao vivo.
 * Quando o `db` ainda não chegou (ou faltam dados de classe), o engine degrada
 * com elegância: stats de atributo continuam valendo, HP/saves ficam nulos.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {ReturnType<typeof deriveCharacter>}
 */
export function deriveFromDb(character, db) {
  // Injeta o teto (30) dos aumentos de Epic Boon nos picks antes de derivar, para
  // o cap de atributos (TC-0022) valer inclusive em personagens salvos sem o max.
  character = withAbilityCaps(character, db);
  const classDataById = buildClassDataById(character, db);
  const ctx = buildContext(character, classDataById);

  // Idiomas FIXOS da espécie (ex: Goblin → Goblin). 2024 core (Elf/Orc XPHB) não
  // concede idiomas; aí fica só o Common garantido em collectLanguages. Grants
  // fixos de subclasse também concedem (Rune Knight → Giant, TC-0012).
  const raceObj = character.species
    ? resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage)
    : null;

  // Proficiências automáticas (classe/espécie) + as concedidas por EFEITOS de
  // features escolhidas (ex: Protector → armas marciais + armadura pesada) +
  // grants FIXOS de subclasse (Armorer → Heavy Armor + Smith's Tools, TC-0012).
  const auto = deriveGrantedProficiencies(character, db);
  const feat = deriveFeatureGrants(character);
  const sub = deriveSubclassGrants(character, db);
  const grantedLanguages = [
    ...(raceObj ? (parseSpecies(raceObj)?.languages?.fixed ?? []) : []),
    ...sub.languages,
  ];
  // Proficiências de ARMA INDIVIDUAL escolhidas (kind 'weaponProf' - Kensei):
  // os picks (nomes de arma) derivam como armas proficientes.
  const weaponProfPicks = (character.classes ?? []).flatMap((c) => collectChoicePicks(c.choices, 'weaponProf'));

  const granted = {
    armor: [...auto.armor, ...feat.armor, ...sub.armor],
    weapons: [...auto.weapons, ...feat.weapons, ...sub.weapons, ...weaponProfPicks],
    grantedSkills: [...auto.grantedSkills, ...feat.grantedSkills, ...sub.grantedSkills],
    grantedTools: [...auto.grantedTools, ...feat.grantedTools, ...sub.grantedTools],
    expertiseSkills: sub.expertiseSkills,
  };

  // Saves proficientes: classe original (buildContext) + grants fixos de
  // subclasse (Gloom Stalker → Wis) + picks das escolhas condicionais ("if you
  // already have…" → outro save à escolha, kind 'save').
  const savePicks = (character.classes ?? []).flatMap((c) => collectChoicePicks(c.choices, 'save'));
  ctx.proficientSaves = [...new Set([...(ctx.proficientSaves ?? []), ...sub.saves, ...savePicks])];

  // Boosts de atributo FIXOS de talentos escolhidos (ex: GWM +1 Str) - derivados
  // do compêndio e injetados na derivação de scores/mods/saves/skills/HP.
  const extraAbilityBoosts = deriveFeatAbilityBoosts(character, db);

  // Aumentos de HP MÁXIMO de feats/raça/subclasse (Tough +2/nível, Boon of
  // Fortitude +40, Dwarven Toughness, Draconic Resilience - engine/hpBonuses).
  const hpBonusExtra = deriveHpBonus(character, db);

  const derived = deriveCharacter(character, {
    ...ctx,
    grantedLanguages,
    ...granted,
    extraAbilityBoosts,
    extraMaxHp: hpBonusExtra.total,
  });

  // Inventário: resolvido contra o db (peso/tipo/raridade) só aqui, onde o db
  // está disponível - deriveCharacter continua puro (character + ctx só).
  const inv = deriveInventory(character, db);
  const capacity = carryingCapacity(derived.scores.str);

  // Efeitos básicos que dependem do inventário resolvido: Classe de Armadura +
  // bônus planos de saves de itens ativos (Ring/Cloak of Protection…). A CA leva
  // em conta a armadura natural da espécie (Tortle/Autognome/Warforged).
  const armorClass = deriveArmorClass(character, inv.entries, derived.modifiers, naturalArmorFor(raceObj));
  const itemSaveBonus = deriveSaveBonusFromItems(inv.entries);
  const saves = { ...derived.saves };
  if (itemSaveBonus.bonus) {
    for (const a of ABILITIES) saves[a] = (derived.saves[a] ?? 0) + itemSaveBonus.bonus;
  }

  // Traços de dano: resistências/imunidades/vulnerabilidades da raça (linhagem),
  // dos talentos (fixos + escolhidos, TC-0014) e dos itens equipados/sintonizados.
  const damageTraits = deriveDamageTraits(character, db, inv.entries);

  // Conjuração: slots + limites + DC por origem de classe (resolvido só aqui,
  // onde o db está disponível; deriveCharacter continua puro).
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
 * Tudo que a ficha já possui (p/ dedup no ChoiceList), resolvendo os idiomas
 * fixos da raça pelo db. Ver collectOwned.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 */
export function ownedFromDb(character, db) {
  const raceObj = character.species
    ? resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage)
    : null;
  const grantedLanguages = raceObj ? (parseSpecies(raceObj)?.languages?.fixed ?? []) : [];
  const owned = collectOwned(character, grantedLanguages);
  // Também dedupa contra proficiências AUTOMÁTICAS (não escolhidas): grants fixos
  // de classe/espécie + efeitos de features + grants fixos de subclasse (TC-0012).
  // Evita escolher uma perícia/ferramenta que a ficha já ganhou de graça (ex:
  // Artificer não pode "escolher" Tinker's Tools; Monk Mercy não re-escolhe Insight).
  const auto = deriveGrantedProficiencies(character, db);
  const feat = deriveFeatureGrants(character);
  const sub = deriveSubclassGrants(character, db);
  for (const s of [...auto.grantedSkills, ...feat.grantedSkills, ...sub.grantedSkills]) owned.skills.add(s);
  // Expertise FIXA de subclasse (Rogue Scout, PDK): já é proficiente E já tem
  // expertise - o seletor de Expertise não deve reoferecê-la.
  for (const s of sub.expertiseSkills) {
    owned.skills.add(s);
    owned.expertise.add(s);
  }
  for (const t of [...auto.grantedTools, ...feat.grantedTools, ...sub.grantedTools]) owned.tools.add(String(t).toLowerCase());
  for (const l of sub.languages) owned.languages.add(String(l).toLowerCase());
  return owned;
}
