// =============================================================================
// foundryImport: o ator do Foundry (dnd5e) de volta em decisões do builder
// =============================================================================
// O QUE FAZ
//   O caminho INVERSO do export. O builder guarda decisões, então elas são
//   reconstruídas dos itens e dos valores APLICADOS dos advancements:
//     item de raça: species (id e linhagem);
//     item de background: origin (boosts, perícias, talento de origem);
//     itens de classe: classes (classId, nível, subclasse, HP, choice-bag);
//     abilities.value: os scores BASE (final menos os boosts reconstruídos).
//   É o ÚNICO formato de import (DDL-0005): serve para os nossos exports e para os
//   premades do dnd5e. Os nossos atores trazem `flags.builder5e.*` (os ids exatos)
//   e a flag VENCE; um ator externo é lido pelas MARCAS que deixa, nunca pela forma
//   do nosso export (DDL-0075).
//
// FUNÇÕES
//   Utilitários
//   norm(s), isFoundryActor(raw), htmlToText(html), alignmentCode(text),
//     advList(item), itemSource(item), itemRef(item, db), slug(s).
//   webImage(src): a imagem só se abrir FORA do Foundry (`data:` ou `http(s):`).
//   Magias
//   spellPreparation(item): method e prepared, nas formas atual e depreciada.
//   spellSourceClass(item): a classe dona da magia, ou null.
//   isPlayerChosenSpell(item): é ESCOLHA do jogador ou concessão derivável?
//   importSpellsByClass(items): as escolhas, por classe.
//   spellChoiceBag(owner, spellItems, db, explained): as escolhas de magia de uma
//     entidade, reconstruídas das magias do ator. Por dentro: score, fill,
//     fixedHits.
//   entitySpellBag(entity, spellItems, db, explained), featSpellBag(featObj,
//     spellItems, db, explained): o mesmo para espécie e talento.
//   Inventário
//   customSnapshot(item), resolveInventorySource(db, name): item fora do catálogo
//     e a fonte de um item pelo nome.
//   Talentos
//   featSource(item, db), findFeatObj(db, name, source): o talento resolvido.
//   featTraitBag(featObj, featItem, db), featChoiceBag(featItem, items, db,
//     explained): o sub-bag de um talento.
//   featFixedBoosts(featItem), asiFeatSubBag(assignments, featRef): os aumentos.
//   isRealFeat(item, db): é um talento escolhível de verdade?
//   Espécie
//   toolKeyToName(key, db), languageKeyToName(key, db): as chaves de trait de volta.
//   findBaseRace(db, baseName, source), resolveLineageName(db, baseName, source,
//     rawLineagePart), resolveRaceByExactName(db, name), speciesSourceByName(db,
//     name), parseSpecies(raceItem, db): a espécie e a linhagem.
//   entryNames(entries, out), lineageMarks(db, baseRace), inferLineage(db,
//     baseRace, raceItem, items, byId): a linhagem pelas marcas.
//   Classes
//   subclassShortName(db, classId, subclassItem): o shortName da subclasse.
//   choiceTraitBag(classItem, subclassItem, classObj, subclassObj, db, classId,
//     level): os Traits de escolha de volta no bag.
//   addedItemIds(adv), grantedItems(adv, byId): o `value.added` nas duas formas.
//   weaponKeyToPick(key, db): a chave de maestria como pick.
//   featureOptionChoiceBag(...), subclassFeatChoiceBag(...): as escolhas de
//     sub-feature e o talento de subclasse.
//   parseClassEntry(...): uma classe inteira.
//   foundryToCharacter(rawActor, db, out): o ponto de entrada.
//
// DECISÕES E ARMADILHAS
//   Geral
//   - `out.warnings` é o canal de AVISOS: o que o ator traz e o modelo não guarda.
//     Não é erro, mas o jogador precisa saber (DDL-0080).
//   - As ações básicas saem antes de qualquer leitura, pela MARCA
//     `flags.builder5e.basicAction`, nunca pelo nome; são derivadas.
//   - webImage: o `img` do ator vira retrato só se abrir fora do Foundry. Caminho
//     relativo é do servidor dele e vira imagem quebrada aqui: as 48 premades
//     (`systems/dnd5e/tokens/...`) e as 5 Plutonium (`worlds/...`) trazem só essa
//     forma. O nosso export grava o que o app aceita (upload em data-URL, URL web).
//   Magias
//   - Escolha ou concessão: `prepared: 2` é concessão; `prepared: 0` numa magia de
//     círculo é o grimório e volta com `prepared: false` (TC-0080), mas nunca num
//     cantrip nem num arcanum (o premade encoda o arcanum como `atwill` +
//     `prepared: 0`); `innate` e `ritual` são de traço; `atwill` é ambíguo e é
//     arcanum só com `uses.max`.
//   - `flags.builder5e.classPick` (TC-0091): o item é uma concessão (`prepared:
//     2`) que TAMBÉM é escolha da classe; a ref da marca volta para a classe, e a
//     concessão segue sendo derivada. Vale só para o nosso export; ator sem flag
//     não tem como dizer isso.
//   - Magia sem `sourceItem` vai para a classe original. Magia que nenhuma classe
//     conjura (a Riswynn, Ladina, traz 35) e magia de ITEM (o pergaminho da
//     Quillathe) vão para o balde de CARGA, com aviso: antes sumiam em silêncio.
//   - A dedup de escolhas repetidas (TC-0089) roda DEPOIS do encalhe: antes,
//     colapsaria as duas Magic Missile da Riswynn DENTRO do balde, que opera por
//     índice (DDL-0084). Concessão não mora em ClassEntry.spells, então nenhum pool
//     de usos é colapsado.
//   - spellChoiceBag (TC-0081): num ator sem flag as escolhas de magia de um talento
//     (Magic Initiate) vêm como `prepared: 2`, que o import descarta, e sumiam.
//     Casa contra os MESMOS descritores da UI (parseChoices, spellChoosePredicate),
//     sem saber de talento específico. Uma magia que uma concessão FIXA já explica
//     não é candidata (o Fire Bolt infernal tomava o lugar do Mage Hand do Morthos).
//     Listas alternativas: vence a que explica MAIS magias, somando as concessões
//     fixas do grupo (o Circle of the Land só tem listas fixas). Sem evidência,
//     nada. O `score` distingue talento de classe pelas marcas: a magia de talento
//     traz o próprio `ability`, e frequência vira `uses.max`. Limite aceito: uma
//     magia que serve a duas origens pode trocar de rótulo; o conjunto fica certo.
//   Inventário
//   - `container` é lido: um PACK exportado como contêiner volta para a entrada
//     única do pack (DDL-0013); só de um pack conhecido, senão a bolsa que o
//     jogador organizou perderia os itens. O vínculo pai-filho é uma segunda
//     passada; pai que não sobreviveu deixa o filho solto.
//   - A fonte é re-resolvida pelo NOME com latestOnly (a versão atual). Fora do
//     catálogo, um snapshot (homebrew, componente de magia). Imagem custom é
//     preservada; o ícone `icons/...` do Foundry não. O item concedido pela classe
//     (Unarmed Strike) não volta: a derivação o recria.
//   Talentos
//   - featSource: o item externo vem sem fonte; sem a do db o talento some do
//     re-export (TC-0057). Com latestOnly, senão o Magic Initiate casava a edição
//     PHB, com outras escolhas (TC-0081).
//   - featTraitBag (TC-0061): o Skilled guarda três escolhas numa ÚNICA Trait sem
//     título, misturando perícia e ferramenta. Cada chave é roteada pelo PRÓPRIO
//     prefixo (TC-0056), e o destino pode ser um descritor `mixed`.
//   - Um item de subtipo `race` é TRAÇO, nunca talento, mesmo com nome de talento
//     (o "Tough" do Stensia, o "Lucky" do Kor; TC-0064).
//   Espécie
//   - Casamento EXATO primeiro (raças base com parênteses, como "Human (Ixalan)",
//     e as `_versions`; TC-0008), depois a heurística de separador. As reimpressões
//     FUNDIDAS (Faerie LFL) ficam de fora: a linhagem vive na base mainstream.
//   - O premade escreve "Elf, High"; resolveLineageName casa pela palavra-chave
//     contra as `_versions` reais.
//   - A fonte do documento vence; um ator externo vem sem, e vale a da espécie
//     resolvida (senão o re-export pegava o Dragonborn 2014; TC-0057).
//   - inferLineage (TC-0065): o dnd5e nomeia a espécie INTEIRA ("Dragonborn"), e a
//     ancestralidade vive num Trait `dr:cold` ou num ItemChoice. Dois sinais
//     DERIVADOS: as MARCAS de cada linhagem (os nomes que ela não divide com as
//     irmãs) e a resistência escolhida. Empate é mecanicamente indistinto e vence
//     o primeiro; sem sinal, null.
//   - Os Traits do item de raça são roteados pelo PREFIXO (premades usam títulos de
//     sabor), e só para escolhas que a raça OFERECE (parseChoices), senão
//     proficiências de outro documento viravam escolha da espécie (TC-0010). O ASI
//     no item de raça entra sem esse gate.
//   - Só itens que existem em feats.feat são picks de talento: um ItemGrant de
//     espécie também concede traços estruturais (Resourceful, Skillful).
//   Classes
//   - subclassId é o shortName ("Archfey"); o item traz o nome completo ("Archfey
//     Patron"). Sem traduzir, a subclasse não resolve e tudo que ela concede some.
//   - choiceTraitBag: atores sem flag perdiam essas escolhas (um Rogue 5 premade
//     vinha sem expertise). Casa por (título, nível) contra os descritores do export
//     (choiceTraitTitle), com o `kind` desempatando; sem título que case, um índice
//     por (kind, nível) quando o candidato é ÚNICO: o premade escreve "Tool
//     Proficiencies" onde o descritor diz "Musical Instruments" (TC-0061). Lê
//     também o item de SUBCLASSE. O que o Trait CONCEDE não é escolha.
//   - addedItemIds lê as DUAS formas de `value.added`: plana (ItemGrant) e
//     ANINHADA por nível (ItemChoice); só a plana perdia o Versatile do Humano nas
//     12 fichas com ItemChoice de raça (TC-0061).
//   - Weapon Mastery: um Trait por breakpoint com o delta; ACUMULA todos. O pick é o
//     NOME puro (TC-0003).
//   - ASI cru vira o talento "Ability Score Improvement" só com aumento REAL: o ASI
//     fixo do capstone vem com `assignments` vazio (TC-0077).
//   - As escolhas sem casa nativa voltam da flag do item de classe (DDL-0028), que
//     vence; sem flag, as optional features casam por nome e as sub-features pelo
//     nome "<Feature>: <Opção>" ou pelo identifier.
//   Scores e HP
//   - O score BASE vem da flag (lossless; o teto do TC-0022 torna a subtração
//     ambígua); sem flag, final menos boosts.
//   - hpBonus = `bonuses.overall` menos a parte DERIVÁVEL que o export somou lá;
//     `bonuses.level` é ignorado pelo mesmo motivo.
// -----------------------------------------------------------------------------

import { createCharacter, makeId, ABILITIES } from '../schema/character';
import { toolId, languageCode } from './foundryExport';
import { raceLineages, speciesCatalog } from './speciesData';
import { isFoldedSpecies } from './mergedLineages';
import { latestOnly } from '../selector/reprints';
import { specificVariants } from './magicVariants';
import { resolveItemObj } from './items';
import { resolveClassObj, resolveSubclassObj, resolveRaceObj } from './resolve';
import { featureOptionChoices, subclassFeatureOptionChoices } from './featureOptions';
import { optionalFeatureChoices, classLevelChoices, classToolChoices, subclassFeatureChoices } from './classFeatureChoices';
import { parseClass } from './classData';
import { TRAIT_CHOICE_KINDS, choiceTraitTitle } from './foundryItems';
import { parseChoices, collectAbilityPicks } from './choices';
import { resolveSpellObj, spellChoosePredicate } from './spells';
import { dedupeSpellPicks } from './dedupeSpellPicks';
import { grantedSpells, additionalSpellChoices } from './grantedSpells';
import { casterInfo } from './spellcasting';
import { deriveHpBonus } from './hpBonuses';
import { classWeaponGrants } from './foundryActivities';
import { classGrantChoices } from './classFeatureGrants';
import { isBasicActionItem } from './foundryBasicActions';

const norm = (s) => (s ?? '').toString().trim().toLowerCase();

/** É um ator do Foundry (e não um personagem do builder)? */
export function isFoundryActor(raw) {
  return !!raw && typeof raw === 'object' && raw.type === 'character' && !!raw.system && Array.isArray(raw.items);
}

/**
 * A preparação de um item spell, nas formas atual e depreciada.
 * @returns {{ method: string, prepared: number }}
 */
export function spellPreparation(item) {
  const sys = item?.system ?? {};
  if (typeof sys.method === 'string' && sys.method) {
    return { method: sys.method, prepared: Number(sys.prepared ?? 0) };
  }
  const mode = sys.preparation?.mode ?? '';
  if (mode === 'always') return { method: 'spell', prepared: 2 };
  if (mode === 'prepared') return { method: 'spell', prepared: sys.preparation?.prepared ? 1 : 0 };
  return { method: mode, prepared: sys.preparation?.prepared ? 1 : 0 };
}

export const SPELL_OWNED_BY_ITEM = '__owned-by-item__';

export function spellSourceClass(item) {
  const src = item?.system?.sourceItem ?? item?.system?.sourceClass ?? '';
  if (typeof src !== 'string' || !src) return null;
  if (src.startsWith('class:')) return norm(src.slice('class:'.length));
  if (/^[a-z]+:/.test(src)) return SPELL_OWNED_BY_ITEM;
  return norm(src);
}

/** A magia é escolha do jogador (e não uma concessão derivável)? */
export function isPlayerChosenSpell(item) {
  const { method, prepared } = spellPreparation(item);
  if (prepared === 2) return false;
  if (method === 'innate' || method === 'ritual') return false;
  if (method === 'atwill') return !!item?.system?.uses?.max;
  if (method !== 'spell' && method !== 'pact' && method !== '') return false;
  return true;
}

/**
 * As magias escolhidas, agrupadas por classe (null sem dona).
 * @param {object[]} items
 * @returns {Map<string|null, Array<{id: string, source: string}>>}
 */
export function importSpellsByClass(items) {
  const out = new Map();
  for (const item of items) {
    const classPick = item.type === 'spell' ? item.flags?.builder5e?.classPick : null;
    if (classPick?.id) {
      const key = spellSourceClass(item);
      const ref = { id: classPick.id, source: classPick.source ?? itemSource(item) };
      if (classPick.prepared === false) ref.prepared = false;
      out.set(key, [...(out.get(key) ?? []), ref]);
      continue;
    }
    if (item.type !== 'spell' || !isPlayerChosenSpell(item)) continue;
    const key = spellSourceClass(item);
    const list = out.get(key) ?? [];
    const { method, prepared } = spellPreparation(item);
    const leveled = Number(item?.system?.level ?? 0) > 0;
    const slotted = method === 'spell' || method === 'pact' || method === '';
    const ref = { id: item.name, source: itemSource(item) };
    if (leveled && slotted && prepared === 0) ref.prepared = false;
    list.push(ref);
    out.set(key, list);
  }
  return out;
}

/**
 * O shortName do 5etools para o item de subclasse.
 * @returns {string}
 */
function subclassShortName(db, classId, subclassItem) {
  const name = subclassItem?.name;
  if (!name) return name;
  const list = db?.[`class-${classId}`]?.subclass;
  if (!Array.isArray(list)) return name;
  const hit =
    list.find((s) => norm(s.name) === norm(name)) ??
    list.find((s) => norm(s.shortName) === norm(name));
  return hit?.shortName ?? name;
}

/** HTML do Foundry em texto simples. */
export function htmlToText(html) {
  if (typeof html !== 'string' || !html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/** O alinhamento do Foundry como código do builder. */
export function alignmentCode(text) {
  const n = (text ?? '').trim().toLowerCase();
  if (!n) return '';
  const hit = Object.entries({
    LG: 'lawful good', NG: 'neutral good', CG: 'chaotic good',
    LN: 'lawful neutral', N: 'true neutral', CN: 'chaotic neutral',
    LE: 'lawful evil', NE: 'neutral evil', CE: 'chaotic evil',
  }).find(([, label]) => label === n);
  if (hit) return hit[0];
  return n === 'neutral' ? 'N' : '';
}

/** Os advancements de um item como lista. */
function advList(item) {
  const adv = item?.system?.advancement;
  return adv ? Object.values(adv) : [];
}

/** A fonte de um item. */
function itemSource(item) {
  return item?.system?.source?.book ?? '';
}

const PHYSICAL_ITEM_TYPES = new Set(['weapon', 'equipment', 'tool', 'consumable', 'loot', 'container']);

/** O essencial de um item fora do catálogo, para exibir e reexportar. */
function customSnapshot(item) {
  const sys = item?.system ?? {};
  return {
    fType: item?.type ?? 'loot',
    typeValue: sys.type?.value ?? '',
    typeSubtype: sys.type?.subtype ?? '',
    weight: sys.weight?.value ?? 0,
    price: sys.price ?? { value: 0, denomination: 'gp' },
    rarity: sys.rarity ?? '',
    attunement: sys.attunement ?? '',
    description: sys.description?.value ?? '',
    img: item?.img ?? null,
  };
}

/** A fonte de um item de inventário pelo nome (versão atual). */
function resolveInventorySource(db, name) {
  const n = norm(name);
  const base = latestOnly(db?.['items-base']?.baseitem ?? []).find((i) => norm(i.name) === n);
  if (base) return base.source;
  const it = latestOnly(db?.items?.item ?? []).find((i) => norm(i.name) === n);
  if (it) return it.source;
  const sv = specificVariants(db).find((i) => norm(i.name) === n);
  return sv?.source ?? null;
}

/** A fonte de um talento: a do documento ou a do db (versão atual). */
function featSource(item, db) {
  const own = itemSource(item);
  if (own || !db) return own;
  const feat = latestOnly(db?.feats?.feat ?? []).find((f) => norm(f.name) === norm(item?.name));
  return feat?.source ?? '';
}

/** O talento resolvido por nome e fonte. */
function findFeatObj(db, name, source) {
  return (db?.feats?.feat ?? []).find((f) => norm(f.name) === norm(name) && norm(f.source) === norm(source)) ?? null;
}

/** "Nome|Fonte" de um item. */
function itemRef(item, db) {
  return `${item.name}|${featSource(item, db)}`;
}

const TRAIT_KEY_KIND = { skills: 'skill', tool: 'tool', languages: 'language' };

/**
 * As escolhas de proficiência de um talento, pelos Traits do item.
 * @param {object} featObj
 * @param {object} featItem
 * @param {object} db
 * @returns {object}
 */
function featTraitBag(featObj, featItem, db) {
  const traits = advList(featItem).filter((a) => a.type === 'Trait' && (a.value?.chosen ?? []).length);
  if (!traits.length || !featObj) return {};
  const descriptors = parseChoices(featObj, { level: 20, bag: {} });
  if (!descriptors.length) return {};

  const out = {};
  for (const t of traits) {
    const granted = new Set(t.configuration?.grants ?? []);
    for (const c of t.value.chosen) {
      if (granted.has(c)) continue;
      const kind = TRAIT_KEY_KIND[String(c).split(':')[0]];
      if (!kind) continue;
      const desc = descriptors.find((d) => d.kind === kind)
        ?? descriptors.find((d) => d.kind === 'mixed' && [d.pool?.of].flat().includes(kind));
      if (!desc) continue;
      const value = kind === 'tool' ? toolKeyToName(c, db)
        : kind === 'language' ? languageKeyToName(c, db)
          : String(c).slice('skills:'.length);
      if (!value) continue;
      const entry = (out[desc.id] ??= { kind: desc.kind, picks: [] });
      if (entry.picks.length >= (desc.count ?? 1)) continue;
      entry.picks.push(desc.kind === 'mixed' ? { kind, value } : value);
    }
  }
  return out;
}

/**
 * O sub-bag completo de um talento (a flag vence).
 * @param {object} featItem
 * @param {object[]} items
 * @param {object} db
 * @param {Set<string>} [explained]
 * @returns {object}
 */
function featChoiceBag(featItem, items, db, explained) {
  const flag = featItem?.flags?.builder5e?.choices;
  if (flag) return flag;
  const featObj = findFeatObj(db, featItem?.name, featSource(featItem, db));
  if (!featObj) return {};
  return {
    ...featTraitBag(featObj, featItem, db),
    ...featSpellBag(featObj, items, db, explained),
  };
}

/**
 * As escolhas de magia de uma entidade, reconstruídas das magias do ator.
 * @param {object} owner
 * @param {(bag: object) => object[]} owner.descriptorsFor
 * @param {(bag: object) => string[]} [owner.grantedFor]
 * @param {(item: object) => boolean} [owner.accepts]
 * @param {object[]} spellItems
 * @param {object} db
 * @param {Set<string>} [explained]
 * @returns {object}
 */
export function spellChoiceBag({ descriptorsFor, grantedFor, accepts }, spellItems, db, explained) {
  if (!db) return {};
  const granted = [];
  for (const it of spellItems ?? []) {
    if (spellPreparation(it).prepared !== 2) continue;
    if (explained?.has(norm(it.name))) continue;
    if (accepts && !accepts(it)) continue;
    const raw = resolveSpellObj(db, it.name, itemSource(it));
    if (raw) granted.push({ raw, item: it });
  }
  if (!granted.length) return {};

  /** O quanto a magia parece a concessão do descritor. */
  const score = (g, pool) => {
    let n = g.item.system?.ability ? 2 : 0;
    const expectsUses = !!pool?.castType && pool.castType !== 'will';
    if (expectsUses === !!g.item.system?.uses?.max) n += 1;
    return n;
  };

  /** Preenche os descritores de magia com as candidatas livres. */
  const fill = (seed) => {
    const bag = { ...seed };
    const used = new Set();
    for (const d of descriptorsFor(bag)) {
      if (d.kind !== 'spell') continue;
      const eligible = spellChoosePredicate(d.pool, db);
      const picks = granted
        .filter((g) => !used.has(g.raw.name) && eligible(g.raw))
        .sort((a, b) => score(b, d.pool) - score(a, d.pool))
        .slice(0, d.count ?? 1)
        .map((g) => {
          used.add(g.raw.name);
          return `${g.raw.name}|${g.raw.source}`;
        });
      if (picks.length) bag[d.id] = { kind: 'spell', picks };
    }
    return { bag, matched: used };
  };

  const onSheet = new Set((spellItems ?? []).filter((it) => spellPreparation(it).prepared === 2).map((it) => norm(it.name)));

  /** Quantas concessões fixas daquele grupo o ator tem. */
  const fixedHits = (seed) => (grantedFor?.(seed) ?? []).filter((n) => onSheet.has(norm(n))).length;

  const setChoice = descriptorsFor({}).find((c) => c.kind === 'spellSet');
  let best = setChoice ? null : fill({});
  let bestScore = best ? best.matched.size : -1;
  for (const opt of setChoice?.pool?.options ?? []) {
    const seed = { [setChoice.id]: { kind: 'spellSet', picks: [opt.value] } };
    const attempt = fill(seed);
    const score2 = attempt.matched.size + fixedHits(seed);
    if (score2 > bestScore) {
      best = attempt;
      bestScore = score2;
    }
  }
  if (!best || bestScore <= 0) return {};

  const abilityChoice = descriptorsFor(best.bag).find((c) => c.kind === 'spellAbility');
  if (abilityChoice && !best.bag[abilityChoice.id]) {
    const ability = granted.find((g) => best.matched.has(g.raw.name) && g.item.system?.ability)?.item.system.ability;
    if (ability) best.bag[abilityChoice.id] = { kind: 'spellAbility', picks: [ability] };
  }
  for (const n of best.matched) explained?.add(norm(n));
  return best.bag;
}

/** O spellChoiceBag de um talento ou espécie. */
function entitySpellBag(entity, spellItems, db, explained) {
  if (!entity?.additionalSpells?.length) return {};
  return spellChoiceBag({
    descriptorsFor: (bag) => parseChoices(entity, { level: 20, bag }),
    grantedFor: (bag) => grantedSpells(entity.additionalSpells, 20, { bag }).spells.map((s) => s.name),
  }, spellItems, db, explained);
}

/** O spellChoiceBag de um talento. */
export function featSpellBag(featObj, spellItems, db, explained) {
  return entitySpellBag(featObj, spellItems, db, explained);
}

/** Uma chave de trait de ferramenta como o nome do 5etools. */
function toolKeyToName(key, db) {
  const id = String(key).split(':').pop();
  const item =
    (db?.['items-base']?.baseitem ?? []).find((b) => toolId(b.name) === id) ??
    (db?.items?.item ?? []).find((b) => toolId(b.name) === id);
  return item?.name ?? null;
}

/** Uma chave de trait de idioma como o nome do 5etools. */
function languageKeyToName(key, db) {
  const code = String(key).split(':').pop();
  const entry = (db?.languages?.language ?? []).find((l) => languageCode(l.name) === code);
  return entry?.name ?? null;
}

/** A raça base pelo nome, preferindo a fonte dada. */
function findBaseRace(db, baseName, source) {
  const list = speciesCatalog(db);
  if (!list.length) return null;
  const matches = list.filter((r) => norm(r.name) === norm(baseName));
  if (!matches.length) return null;
  return (source && matches.find((r) => r.source === source)) || matches[matches.length - 1];
}

/** O nome canônico da linhagem a partir do nome do item. */
function resolveLineageName(db, baseName, source, rawLineagePart) {
  const full = `${baseName}; ${rawLineagePart}`.trim();
  const base = findBaseRace(db, baseName, source);
  if (!base) return full;
  const versions = raceLineages(db, base);
  if (!versions.length) return full;
  if (versions.some((v) => v.name === full)) return full;
  const key = norm(rawLineagePart);
  const match = versions.find((v) => norm(v.name).includes(key));
  return match ? match.name : full;
}

/** Todos os nomes de entry de um bloco, recursivamente. */
function entryNames(entries, out = new Set()) {
  for (const e of entries ?? []) {
    if (!e || typeof e !== 'object') continue;
    if (e.name) out.add(norm(e.name));
    entryNames(e.entries, out);
    entryNames(e.items, out);
  }
  return out;
}

/**
 * Os nomes que cada linhagem não divide com as irmãs.
 * @returns {Array<{lineage: object, marks: Set<string>}>}
 */
function lineageMarks(db, baseRace) {
  const lineages = raceLineages(db, baseRace);
  const nameSets = lineages.map((v) => entryNames(v.entries));
  return lineages.map((lineage, i) => ({
    lineage,
    marks: new Set([...nameSets[i]].filter((n) => !nameSets.every((s) => s.has(n)))),
  }));
}

/** A linhagem de um ator externo, pelas marcas que ele deixa, ou null. */
function inferLineage(db, baseRace, raceItem, items, byId) {
  const candidates = lineageMarks(db, baseRace);
  if (candidates.length < 2) return null;

  const actorNames = new Set(
    items.filter((i) => i.type === 'feat' && norm(i.system?.type?.value) === 'race').map((i) => norm(i.name)),
  );
  const resists = new Set();
  for (const adv of advList(raceItem)) {
    if (adv.type === 'ItemGrant' || adv.type === 'ItemChoice') {
      for (const it of grantedItems(adv, byId)) actorNames.add(norm(it.name));
    } else if (adv.type === 'Trait') {
      for (const key of adv.value?.chosen ?? []) if (key.startsWith('dr:')) resists.add(key.slice(3));
    }
  }
  if (!actorNames.size && !resists.size) return null;

  const scored = candidates
    .filter(({ lineage }) => [...resists].every((d) => (lineage.resist ?? []).includes(d)))
    .map((c) => ({ ...c, score: [...c.marks].filter((m) => actorNames.has(m)).length }));
  if (!scored.length) return null;
  const best = Math.max(...scored.map((c) => c.score));
  if (best === 0 && !resists.size) return null;
  return scored.find((c) => c.score === best).lineage.name;
}

/** O nome de um item de raça por casamento exato. */
function resolveRaceByExactName(db, name) {
  const list = speciesCatalog(db).filter((r) => !isFoldedSpecies(r));
  if (!list.length) return null;
  const n = norm(name);
  const bases = list.filter((r) => norm(r.name) === n);
  if (bases.length) {
    const race = bases[bases.length - 1];
    return { id: race.name.toLowerCase(), source: race.source, lineage: null };
  }
  for (const r of list) {
    const v = raceLineages(db, r).find((v) => norm(v.name) === n);
    if (v) return { id: r.name.toLowerCase(), source: r.source, lineage: v.name };
  }
  return null;
}

/** A fonte da espécie de mesmo nome (a mais recente). */
function speciesSourceByName(db, name) {
  const matches = speciesCatalog(db).filter((r) => norm(r.name) === norm(name));
  return matches.length ? matches[matches.length - 1].source : '';
}

/**
 * A species reconstruída do item de raça.
 * @param {object} raceItem
 * @param {object} [db]
 */
function parseSpecies(raceItem, db) {
  if (!raceItem) return null;
  const name = raceItem.name ?? '';
  const exact = resolveRaceByExactName(db, name);
  if (exact) {
    return { id: exact.id, source: itemSource(raceItem) || exact.source || '', lineage: exact.lineage, choices: {} };
  }
  const m = name.match(/^([^;,(]+)[;,(]/);
  const hasLineage = !!m;
  const baseName = (hasLineage ? m[1] : name).trim();
  let lineage = null;
  if (hasLineage) {
    let rest = name.slice(m[0].length).trim();
    if (rest.endsWith(')')) rest = rest.slice(0, -1).trim();
    lineage = resolveLineageName(db, baseName, itemSource(raceItem), rest);
  }
  return {
    id: baseName.toLowerCase(),
    source: itemSource(raceItem) || speciesSourceByName(db, baseName),
    lineage,
    choices: {},
  };
}

/** Os aumentos fixos embutidos num item de talento. */
function featFixedBoosts(featItem) {
  const out = [];
  for (const adv of advList(featItem)) {
    if (adv.type !== 'AbilityScoreImprovement') continue;
    const fixed = adv.configuration?.fixed ?? {};
    for (const ab of ABILITIES) if (fixed[ab]) out.push({ ability: ab, amount: fixed[ab] });
  }
  return out;
}

/**
 * Os Traits de escolha da classe e da subclasse de volta no bag.
 * @returns {object}
 */
function choiceTraitBag(classItem, subclassItem, classObj, subclassObj, db, classId, level) {
  const traits = [...advList(classItem), ...advList(subclassItem)]
    .filter((a) => a.type === 'Trait' && (a.value?.chosen ?? []).length);
  if (!traits.length || !classObj) return {};
  const parsed = parseClass(classObj);
  const descriptors = [
    ...classLevelChoices(parsed, classObj, level),
    ...classToolChoices(classObj),
    ...subclassFeatureChoices(db, classId, subclassObj, level, parsed?.skillChoice?.from ?? []),
    ...classGrantChoices(classId, level),
  ].filter((d) => TRAIT_CHOICE_KINDS.has(d.kind));
  if (!descriptors.length) return {};

  const key = (title, lvl, kind) => `${norm(title)}|${lvl ?? 1}|${kind}`;
  const byKey = new Map(descriptors.map((d) => [key(choiceTraitTitle(d), d.level, d.kind), d]));
  const byKindLevel = new Map();
  for (const d of descriptors) {
    const k = `${d.level ?? 1}|${d.kind}`;
    byKindLevel.set(k, byKindLevel.has(k) ? null : d);
  }

  const out = {};
  for (const t of traits) {
    const chosen = t.value.chosen;
    const head = String(chosen[0]).split(':')[0];
    const kind = head === 'skills'
      ? (t.configuration?.mode === 'expertise' ? 'expertise' : 'skill')
      : ({ tool: 'tool', languages: 'language', dr: 'resist' })[head];
    if (!kind) continue;
    const desc = byKey.get(key(t.title, t.level, kind)) ?? byKindLevel.get(`${t.level ?? 1}|${kind}`);
    if (!desc || out[desc.id]) continue;
    const granted = new Set(t.configuration?.grants ?? []);
    const picks = chosen
      .filter((c) => !granted.has(c))
      .map((c) => {
        if (kind === 'tool') return toolKeyToName(c, db);
        if (kind === 'language') return languageKeyToName(c, db);
        if (kind === 'resist') return String(c).slice('dr:'.length);
        return String(c).slice('skills:'.length);
      })
      .filter(Boolean);
    if (picks.length) out[desc.id] = { kind, picks };
  }
  return out;
}

/** Os ids de `value.added`, nas formas plana e aninhada por nível. */
function addedItemIds(adv) {
  const out = [];
  for (const [k, v] of Object.entries(adv?.value?.added ?? {})) {
    if (v && typeof v === 'object') out.push(...Object.keys(v));
    else out.push(k);
  }
  return out;
}

/** Os itens concedidos por um ItemGrant ou ItemChoice. */
function grantedItems(adv, byId) {
  return addedItemIds(adv).map((id) => byId.get(id)).filter(Boolean);
}

/** É um talento escolhível de verdade? */
function isRealFeat(item, db) {
  if (norm(item?.system?.type?.value) === 'race') return false;
  return (db?.feats?.feat ?? []).some((f) => norm(f.name) === norm(item?.name));
}

/** Uma chave de Weapon Mastery como o pick (o nome puro). */
function weaponKeyToPick(key, db) {
  const slug = String(key).split(':').pop();
  const base = (db?.['items-base']?.baseitem ?? []).find(
    (b) => norm(b.name).replace(/[^a-z0-9]+/g, '') === slug,
  );
  return base ? base.name : null;
}

/** O sub-bag de um ASI cru. */
function asiFeatSubBag(assignments, featRef) {
  const picks = [];
  for (const [ability, amount] of Object.entries(assignments ?? {})) {
    for (let i = 0; i < amount; i += 1) picks.push({ ability, amount: 1 });
  }
  const plusTwo = Object.values(assignments ?? {}).some((v) => v >= 2);
  const merged = plusTwo
    ? Object.entries(assignments ?? {}).map(([ability, amount]) => ({ ability, amount }))
    : picks;
  return {
    [featRef]: { 'ability-0': { kind: 'ability', alt: plusTwo ? 0 : 1, picks: merged } },
  };
}

/** O slug de um rótulo, para casar com o identifier. */
function slug(s) {
  return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * A imagem, se ela abrir fora do Foundry (`data:` ou `http(s):`); senão null.
 * @param {unknown} src
 * @returns {string|null}
 */
function webImage(src) {
  return typeof src === 'string' && /^(data:|https?:)/i.test(src) ? src : null;
}

/**
 * As escolhas de sub-feature, pelos itens "<Feature>: <Opção>".
 * @returns {Record<string, {kind:'featureoption', picks:string[]}>}
 */
function featureOptionChoiceBag(db, classId, classObj, subclassObj, level, featItems) {
  const names = new Set(featItems.map((i) => norm(i.name)));
  const idents = new Set(featItems.map((i) => norm(i.system?.identifier ?? '')).filter(Boolean));
  const bag = {};
  const all = [
    ...featureOptionChoices(db, classId, classObj, level),
    ...subclassFeatureOptionChoices(db, classId, subclassObj, level),
  ];
  for (const ch of all) {
    const picks = [];
    for (const opt of ch.pool?.options ?? []) {
      if (names.has(norm(`${ch.label}: ${opt.label}`)) || idents.has(slug(`${ch.label} ${opt.label}`))) {
        picks.push(opt.value);
      }
    }
    if (picks.length) bag[ch.id] = { kind: 'featureoption', picks: picks.slice(0, ch.count ?? 1) };
  }
  return bag;
}

/** A escolha de talento de uma feature de subclasse. */
function subclassFeatChoiceBag(subclassItem, db, classId, classObj, subclassObj, level, byId) {
  if (!subclassItem || !subclassObj || !classObj) return {};
  const descriptors = subclassFeatureChoices(db, classId, subclassObj, level, parseClass(classObj)?.skillChoice?.from ?? [])
    .filter((d) => d.kind === 'feat');
  if (!descriptors.length) return {};
  const bag = {};
  for (const adv of advList(subclassItem)) {
    if (adv.type !== 'ItemChoice' || adv.configuration?.type !== 'feat') continue;
    for (const id of addedItemIds(adv)) {
      const featItem = byId.get(id);
      if (!featItem) continue;
      const levels = Object.keys(adv.configuration?.choices ?? {}).map(Number);
      const desc = descriptors.find((d) => levels.includes(d.level ?? 1))
        ?? descriptors.find((d) => norm(d.feature?.name ?? d.label) === norm(adv.title));
      if (!desc || bag[desc.id]) continue;
      const featBag = featItem.flags?.builder5e?.choices;
      const ref = itemRef(featItem, db);
      bag[desc.id] = { kind: 'feat', picks: [ref], sub: featBag ? { [ref]: featBag } : {} };
    }
  }
  return bag;
}

/** Uma classe reconstruída do item de classe. */
function parseClassEntry(classItem, subclassItem, actor, byId, db, boostAcc, fixedGrantNames) {
  const classId = classItem.system?.identifier ?? norm(classItem.name);
  const level = classItem.system?.levels ?? 1;
  const choices = {};
  const hitPoints = {};
  const masteryByLevel = [];

  for (const adv of advList(classItem)) {
    switch (adv.type) {
      case 'HitPoints':
        for (const [lvl, v] of Object.entries(adv.value ?? {})) {
          if (typeof v === 'number') hitPoints[lvl] = v;
        }
        break;
      case 'Trait': {
        const chosen = adv.value?.chosen ?? [];
        if (/skill/i.test(adv.title ?? '') && !/saving/i.test(adv.title ?? '')) {
          const picks = chosen.filter((c) => c.startsWith('skills:')).map((c) => c.slice('skills:'.length));
          if (picks.length) choices.skill = { kind: 'skill', picks };
        } else if (/weapon mastery/i.test(adv.title ?? '')) {
          const picks = chosen.map((k) => weaponKeyToPick(k, db)).filter(Boolean);
          if (picks.length) masteryByLevel.push({ level: adv.level ?? 1, picks });
        }
        break;
      }
      case 'AbilityScoreImprovement': {
        const val = adv.value ?? {};
        const key = `feat@${adv.level}`;
        if (val.type === 'feat') {
          const featItem = byId.get(Object.keys(val.feat ?? {})[0]);
          if (featItem) {
            const bag = featItem.flags?.builder5e?.choices;
            const ref = itemRef(featItem, db);
            choices[key] = { kind: 'feat', picks: [ref], sub: bag ? { [ref]: bag } : {} };
            for (const b of featFixedBoosts(featItem)) boostAcc[b.ability] += b.amount;
            for (const b of collectAbilityPicks(bag ?? {})) boostAcc[b.ability] += b.amount;
          }
        } else if (val.type === 'asi' && Object.values(val.assignments ?? {}).some((n) => n > 0)) {
          const featRef = 'Ability Score Improvement|XPHB';
          choices[key] = { kind: 'feat', picks: [featRef], sub: asiFeatSubBag(val.assignments, featRef) };
          for (const [ab, amt] of Object.entries(val.assignments)) boostAcc[ab] += amt;
        }
        break;
      }
      case 'ItemChoice': {
        if (/fighting style/i.test(adv.title ?? '')) {
          for (const [lvl, m] of Object.entries(adv.value?.added ?? {})) {
            const featItem = byId.get(Object.keys(m ?? {})[0]);
            if (featItem) {
              const bag = featItem.flags?.builder5e?.choices;
              const ref = itemRef(featItem, db);
              choices[`feat@${lvl}`] = { kind: 'feat', picks: [ref], sub: bag ? { [ref]: bag } : {} };
              for (const b of collectAbilityPicks(bag ?? {})) boostAcc[b.ability] += b.amount;
            }
          }
        }
        break;
      }
      default:
        break;
    }
  }

  if (masteryByLevel.length) {
    const picks = masteryByLevel.sort((a, b) => a.level - b.level).flatMap((m) => m.picks);
    choices.weaponMastery = { kind: 'weapon', picks };
  }

  const subShort = subclassItem ? subclassShortName(db, classId, subclassItem) : null;
  const classObj = resolveClassObj(db, classId, itemSource(classItem));
  const subclassObj = subShort ? resolveSubclassObj(db, classId, subShort, itemSource(subclassItem)) : null;
  const featItems = (actor.items ?? []).filter((i) => i.type === 'feat');
  Object.assign(choices, featureOptionChoiceBag(db, classId, classObj, subclassObj, level, featItems));
  Object.assign(choices, subclassFeatChoiceBag(subclassItem, db, classId, classObj, subclassObj, level, byId));

  Object.assign(choices, choiceTraitBag(classItem, subclassItem, classObj, subclassObj, db, classId, level));

  const classFlag = classItem.flags?.builder5e?.choices;
  if (!classFlag) {
    const mine = (it) => {
      const owner = spellSourceClass(it);
      return !owner || owner === norm(classId);
    };
    const spellItems = (actor.items ?? []).filter((i) => i.type === 'spell');
    for (const [obj, prefix] of [[classObj, 'class:'], [subclassObj, 'sub:']]) {
      if (!obj?.additionalSpells?.length) continue;
      Object.assign(choices, spellChoiceBag({
        descriptorsFor: (bag) => additionalSpellChoices(obj.additionalSpells, level, bag, prefix),
        grantedFor: (bag) => grantedSpells(obj.additionalSpells, level, { bag, idPrefix: prefix }).spells.map((s) => s.name),
        accepts: mine,
      }, spellItems, db, fixedGrantNames));
    }
  }

  if (classFlag) {
    Object.assign(choices, classFlag);
    for (const b of collectAbilityPicks(classFlag)) boostAcc[b.ability] += b.amount;
  }

  const featNames = new Set(featItems.map((i) => norm(i.name)));
  for (const ch of optionalFeatureChoices(classObj, subclassObj, level)) {
    if (choices[ch.id] || ch.kind !== 'optionalfeature') continue;
    const picks = latestOnly(db?.optionalfeatures?.optionalfeature ?? [])
      .filter((f) => (f.featureType ?? []).some((t) => (ch.pool.featureType ?? []).includes(t)))
      .filter((f) => featNames.has(norm(f.name)))
      .map((f) => `${f.name}|${f.source}`);
    if (picks.length) choices[ch.id] = { kind: 'optionalfeature', picks: picks.slice(0, ch.count ?? picks.length) };
  }

  return {
    uid: makeId(),
    classId,
    source: itemSource(classItem),
    level,
    isOriginalClass: actor.system?.details?.originalClass === classItem._id,
    subclassId: subShort,
    subclassSource: subclassItem ? itemSource(subclassItem) : null,
    hitPoints,
    choices,
    spells: [],
  };
}

/**
 * Converte um ator do Foundry no Character do builder.
 * @param {object} actor
 * @param {object} [db]
 * @param {{warnings?: string[]}} [out]
 * @returns {import('../schema/character').Character}
 */
export function foundryToCharacter(rawActor, db, out = null) {
  const actor = (rawActor?.items ?? []).some(isBasicActionItem)
    ? { ...rawActor, items: rawActor.items.filter((i) => !isBasicActionItem(i)) }
    : rawActor;
  const char = createCharacter({ name: actor?.name || 'Imported Character' });
  const portrait = webImage(actor?.img);
  if (portrait) char.meta.portrait = portrait;

  const det = actor?.system?.details ?? {};
  char.identity = {
    ...char.identity,
    alignment: alignmentCode(det.alignment),
    backstory: htmlToText(det.biography?.value),
    personality: det.trait ?? '',
    ideals: det.ideal ?? '',
    bonds: det.bond ?? '',
    flaws: det.flaw ?? '',
    appearance: det.appearance ?? '',
    age: det.age ?? '',
    height: det.height ?? '',
    weight: det.weight ?? '',
    eyes: det.eyes ?? '',
    hair: det.hair ?? '',
    skin: det.skin ?? '',
    gender: det.gender ?? '',
    faith: det.faith ?? '',
  };

  const items = actor?.items ?? [];
  const byId = new Map(items.map((i) => [i._id, i]));

  const boostAcc = Object.fromEntries(ABILITIES.map((a) => [a, 0]));
  const fixedGrantNames = new Set();

  const raceItem = items.find((i) => i.type === 'race');
  char.species = parseSpecies(raceItem, db);
  if (raceItem && char.species && !char.species.lineage) {
    const base = findBaseRace(db, char.species.id, char.species.source);
    const flagged = raceItem.flags?.builder5e?.lineage;
    if (base) {
      char.species.lineage = (flagged && raceLineages(db, base).some((v) => v.name === flagged) ? flagged : null)
        ?? inferLineage(db, base, raceItem, items, byId);
    }
  }
  if (raceItem && char.species) {
    const raceObj = resolveRaceObj(db, char.species.id, char.species.source, char.species.lineage);
    const offered = new Set(raceObj ? parseChoices(raceObj).map((c) => c.kind) : []);
    // ATENÇÃO: computadas ANTES dos talentos; senão uma concessão da espécie vira escolha de talento.
    for (const s of grantedSpells(raceObj?.additionalSpells, 20, {}).spells ?? []) {
      fixedGrantNames.add(norm(s.name));
    }
    const featSub = (featItems) => {
      const sub = {};
      for (const f of featItems) {
        const bag = featChoiceBag(f, items, db, fixedGrantNames);
        if (!Object.keys(bag).length) continue;
        sub[itemRef(f, db)] = bag;
        for (const b of collectAbilityPicks(bag)) boostAcc[b.ability] += b.amount;
      }
      return sub;
    };
    for (const adv of advList(raceItem)) {
      if (adv.type === 'AbilityScoreImprovement') {
        const assignments = adv.value?.assignments ?? {};
        const picks = Object.entries(assignments).map(([ability, amount]) => ({ ability, amount }));
        if (picks.length) {
          char.species.choices['ability-0'] = { kind: 'ability', picks };
          for (const [ab, amt] of Object.entries(assignments)) boostAcc[ab] += amt;
        }
      } else if (adv.type === 'Trait') {
        const chosen = adv.value?.chosen ?? [];
        if (chosen.some((c) => c.startsWith('skills:')) && (offered.has('skill') || !raceObj)) {
          const picks = chosen.filter((c) => c.startsWith('skills:')).map((c) => c.slice('skills:'.length));
          if (picks.length) char.species.choices['skill-0'] = { kind: 'skill', picks };
        } else if (chosen.some((c) => c.startsWith('tool:')) && (offered.has('tool') || !raceObj)) {
          const picks = chosen.map((c) => toolKeyToName(c, db)).filter(Boolean);
          if (picks.length) char.species.choices['tool-0'] = { kind: 'tool', picks };
        } else if (chosen.some((c) => c.startsWith('languages:')) && (offered.has('language') || !raceObj)) {
          const picks = chosen.map((c) => languageKeyToName(c, db)).filter(Boolean);
          if (picks.length) char.species.choices['language-0'] = { kind: 'language', picks };
        }
      } else if (adv.type === 'ItemGrant') {
        const feats = grantedItems(adv, byId).filter((f) => isRealFeat(f, db));
        if (feats.length) {
          char.species.choices['feat-0'] = { kind: 'feat', picks: feats.map((f) => itemRef(f, db)), sub: featSub(feats) };
          for (const f of feats) for (const b of featFixedBoosts(f)) boostAcc[b.ability] += b.amount;
        }
      } else if (adv.type === 'ItemChoice') {
        const featItem = grantedItems(adv, byId)[0] ?? null;
        if (featItem && isRealFeat(featItem, db)) {
          char.species.choices['feat-0'] = { kind: 'feat', picks: [itemRef(featItem, db)], sub: featSub([featItem]) };
          for (const b of featFixedBoosts(featItem)) boostAcc[b.ability] += b.amount;
        }
      }
    }
    const raceFlag = raceItem.flags?.builder5e?.choices;
    if (raceObj && !raceFlag) {
      Object.assign(char.species.choices, entitySpellBag(raceObj, items, db, fixedGrantNames));
    }
    if (raceFlag) Object.assign(char.species.choices, raceFlag);
  }

  const bgItem = items.find((i) => i.type === 'background');
  if (bgItem) {
    for (const adv of advList(bgItem)) {
      if (adv.type === 'AbilityScoreImprovement') {
        for (const [ab, amt] of Object.entries(adv.value?.assignments ?? {})) {
          char.origin.abilityBoosts.push({ ability: ab, amount: amt });
          boostAcc[ab] += amt;
        }
      } else if (adv.type === 'Trait') {
        for (const key of adv.value?.chosen ?? []) {
          if (key.startsWith('skills:')) {
            const skill = key.slice('skills:'.length);
            if (!char.origin.skillProficiencies.includes(skill)) char.origin.skillProficiencies.push(skill);
          } else if (key.startsWith('tool')) {
            const tool = toolKeyToName(key, db);
            if (tool && !char.origin.toolProficiencies.includes(tool)) char.origin.toolProficiencies.push(tool);
          } else if (key.startsWith('languages:')) {
            const lang = languageKeyToName(key, db);
            if (lang && !char.origin.languages.includes(lang)) char.origin.languages.push(lang);
          }
        }
      } else if (adv.type === 'ItemGrant') {
        const feat = grantedItems(adv, byId)[0];
        if (feat) {
          const featChoices = featChoiceBag(feat, items, db, fixedGrantNames);
          char.origin.originFeat = { id: feat.name, source: featSource(feat, db), subtype: 'origin', choices: featChoices };
          for (const b of featFixedBoosts(feat)) boostAcc[b.ability] += b.amount;
          for (const b of collectAbilityPicks(featChoices)) boostAcc[b.ability] += b.amount;
        }
      }
    }
  }

  const classItems = items.filter((i) => i.type === 'class');
  const subclassItems = items.filter((i) => i.type === 'subclass');
  char.classes = classItems.map((ci) => {
    const cid = ci.system?.identifier ?? norm(ci.name);
    const sub = subclassItems.find((s) => norm(s.system?.classIdentifier) === norm(cid));
    return parseClassEntry(ci, sub, actor, byId, db, boostAcc, fixedGrantNames);
  });
  if (char.classes.length === 0) char.classes = createCharacter().classes;
  else if (!char.classes.some((c) => c.isOriginalClass)) char.classes[0].isOriginalClass = true;

  const spellsByClass = importSpellsByClass(items);
  for (const cls of char.classes) {
    cls.spells = spellsByClass.get(norm(cls.classId)) ?? [];
  }
  const orphans = spellsByClass.get(null);
  if (orphans?.length) {
    const target = char.classes.find((c) => c.isOriginalClass) ?? char.classes[0];
    target.spells = [...target.spells, ...orphans];
  }
  const canCast = (c) =>
    !!casterInfo(
      c.classId ? resolveClassObj(db, c.classId, c.source) : null,
      c.subclassId ? resolveSubclassObj(db, c.classId, c.subclassId, c.subclassSource) : null,
    );
  const stranded = [];
  for (const cls of char.classes) {
    if (canCast(cls) || !(cls.spells?.length > 0)) continue;
    stranded.push(...cls.spells);
    cls.spells = [];
  }
  stranded.push(...(spellsByClass.get(SPELL_OWNED_BY_ITEM) ?? []));
  // ATENÇÃO: a dedup roda DEPOIS do encalhe; antes, colapsaria as cópias dentro do balde de carga.
  for (const cls of char.classes) cls.spells = dedupeSpellPicks(cls.spells);

  char.unassignedSpells = stranded;
  if (stranded.length && out) {
    const n = stranded.length;
    out.warnings = [
      ...(out.warnings ?? []),
      `${n} ${n === 1 ? 'spell' : 'spells'} on this actor ${n === 1 ? 'has' : 'have'} no spellcasting origin on `
      + `the sheet (no class here can cast ${n === 1 ? 'it' : 'them'}). ${n === 1 ? 'It is' : 'They are'} kept `
      + `with the character and will be exported back, and ${n === 1 ? 'appears' : 'appear'} under `
      + `"Unassigned" in the Spellbook, where you can give ${n === 1 ? 'it' : 'them'} an origin. Until then `
      + `${n === 1 ? 'it counts' : 'they count'} against no limit.`,
    ];
  }

  const flagScores = actor.flags?.builder5e?.scores;
  for (const a of ABILITIES) {
    if (flagScores && typeof flagScores[a] === 'number') {
      char.scores[a] = flagScores[a];
      continue;
    }
    const final = actor.system?.abilities?.[a]?.value;
    if (typeof final === 'number') char.scores[a] = final - (boostAcc[a] ?? 0);
  }

  const overall = Number(actor.system?.attributes?.hp?.bonuses?.overall);
  char.hpBonus = (Number.isFinite(overall) ? overall : 0) - deriveHpBonus(char, db).flat;

  const classGranted = new Set(
    (char.classes ?? []).flatMap((c) => classWeaponGrants(c.classId).map((g) => norm(g.name))),
  );
  const packIds = new Set(
    items
      .filter(
        (it) =>
          it.type === 'container'
          && !!resolveItemObj(db, it.name, resolveInventorySource(db, it.name))?.packContents,
      )
      .map((it) => it._id),
  );
  const kept = items.filter(
    (it) =>
      PHYSICAL_ITEM_TYPES.has(it.type)
      && !classGranted.has(norm(it.name))
      && !packIds.has(it.system?.container),
  );
  const uidByItemId = new Map();
  char.inventory = kept.map((it) => {
    const source = resolveInventorySource(db, it.name);
    const entry = {
      uid: makeId(),
      itemId: it.name,
      source: source ?? itemSource(it),
      quantity: it.system?.quantity ?? 1,
      equipped: !!it.system?.equipped,
      attuned: !!it.system?.attuned,
    };
    const customImg = webImage(it.img);
    if (customImg) entry.customImg = customImg;
    if (!source) entry.custom = customSnapshot(it);
    uidByItemId.set(it._id, entry.uid);
    return entry;
  });
  kept.forEach((it, i) => {
    const parentUid = it.system?.container ? uidByItemId.get(it.system.container) : null;
    if (parentUid) char.inventory[i].container = parentUid;
  });

  const cur = actor.system?.currency ?? {};
  char.currency = {
    pp: cur.pp || 0, gp: cur.gp || 0, ep: cur.ep || 0, sp: cur.sp || 0, cp: cur.cp || 0,
  };

  return char;
}
