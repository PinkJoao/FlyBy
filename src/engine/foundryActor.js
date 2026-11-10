// =============================================================================
// foundryActor: monta o ator Foundry completo (Fase A4)
// =============================================================================
// O QUE FAZ
//   Junta o que os outros módulos geram num único Actor (type 'character') pronto
//   para serializar e importar: o system (foundryExport), os items (classe,
//   subclasse, espécie, background, features, talentos, ações básicas, inventário,
//   magias) e as referências details.race, background e originalClass por `_id`.
//   É um módulo à parte para evitar o ciclo foundryItems e foundryExport.
//
// FUNÇÕES
//   dropUnarmoredCalc(items): tira o cálculo de CA sem armadura dos effects.
//   greatWeaponMinimum(items): o dado mínimo 3 nas armas de duas mãos.
//   actorSpellcasting(items, originalClassId): o `attributes.spellcasting`.
//   assembleFoundryActor(character, db): o ator completo.
//
// DECISÕES E ARMADILHAS
//   - O crédito do retrato (`meta.portraitCredit`, DDL-0137) vai em
//     `flags.builder5e.portraitCredit`: o Foundry não tem campo para o artista.
//     `flags.builder5e.wildShapeForms`: as formas conhecidas do Wild Shape (DDL-0195),
//     decisão sem campo no dnd5e.
//   - O retrato vai no `img` do ator E no token (`prototypeToken.texture.src`), por
//     `toFoundryImage`: URL sem extensão reprovava o ator inteiro (foundryImage.js).
//   - A ORDEM de montagem importa: os itens de magia e os itens de escolha de
//     feature são montados ANTES das escadas que apontam para eles em
//     `value.added` (TC-0072, TC-0063); entram na lista no fim, para a ordem do
//     arquivo não mudar.
//   - Só os traços de espécie JÁ alcançados são embutidos (TC-0064); os de nível
//     maior ficam como receita de compêndio.
//   - As magias do balde de CARGA voltam ao Foundry, sem origem, para o
//     round-trip não perder conteúdo.
//   - O passo Subclass liga à subclasse embutida SÓ por `document` (id local). O
//     campo `uuid` é um DocumentUUIDField e um uuid relativo falha a validação
//     estrita, o que invalida o item de classe inteiro (ficha nível 0, bug
//     confirmado no console do Foundry).
//   - `flags.builder5e.scores` leva o score BASE: com o teto de atributos
//     (TC-0022) o final pode saturar, e base = final menos boosts deixou de ser
//     reversível. Ator sem a flag cai na subtração.
//   - As ações básicas entram para todo personagem (foundryBasicActions).
//   - Os itens de optional feature são montados ANTES das magias: a magia de uma
//     invocação cujo item já tem activity não sai (TC-0092, foundrySpells).
//   - `attributes.spellcasting` é o atributo da CD e do ataque no cabeçalho da
//     ficha: vazio, o Foundry real mostrava CD 8 + PB (Akra L1: 10 contra 13 do
//     premade, T2d). Vem da classe original, como nos premades.
//   - Com armadura de corpo vestida (`armorClass.hasArmor` da derivação), os effects
//     de Defesa sem Armadura saem do export: o Foundry aplicava `unarmoredBarb` por
//     cima da Breastplate e o Merric L5 ficava com CA 14, não 16 (T3, medido). A
//     CA fica no cálculo padrão, como nos premades; tirando a armadura no Foundry,
//     o jogador troca o cálculo lá.
//   - Great Weapon Fighting: nem o talento do SRD nem o sistema têm mecânica para
//     "trate 1 e 2 como 3"; o premade (Randal L11 e L17) escreve a fórmula da ARMA
//     de duas mãos corpo a corpo (`2d6min3`) e deixa a versátil como está. O
//     export faz o mesmo quando o personagem tem o talento.
//   - Os alvos de consumo são ligados ao `_id` no FIM, com todos os itens no
//     ator (foundryConsumption, TC-0097), e as chaves de effect que o dnd5e moveu
//     são reescritas para as atuais (foundryCompat, DDL-0167).
// -----------------------------------------------------------------------------

import { deriveFromDb, resolveRaceObj, resolveClassObj, resolveSubclassObj } from './resolve';
import { deriveHpBonus } from './hpBonuses';
import { buildClassGrantAdvancements } from './classFeatureGrants';
import { buildActorSystem, foundrySize } from './foundryExport';
import { effectiveSizeCodes, sizePick } from './speciesData';
import {
  buildClassItem,
  buildClassFeatureItems,
  buildClassWeaponItems,
  buildClassFutureGrants,
  buildSubclassFutureGrants,
  buildClassChoiceTraits,
  buildSubclassChoiceTraits,
  buildClassChosenFeats,
  buildClassTraitValues,
  buildFeatureOptionItems,
  buildOptionalFeatureItems,
  buildSubclassItem,
  buildItemChoiceAdvancements,
  buildSubclassFeatureItems,
  buildSpeciesItem,
  buildSpeciesFeatItems,
  buildSpeciesTraitItems,
  buildBackgroundItem,
  buildOriginFeatItem,
  buildInventoryItems,
  residualClassChoices,
  classFluffHtml,
  subclassFluffHtml,
} from './foundryItems';
import { buildSpellItems, buildSpellSlots, buildUnassignedSpellItems } from './foundrySpells';
import { buildBasicActionItems } from './foundryBasicActions';
import { linkConsumptionTargets } from './foundryConsumption';
import { modernizeEffectKeys } from './foundryCompat';
import { toFoundryImage } from './foundryImage';

/** Tira os effects que forçam a CA sem armadura (cópia só do que muda); com armadura vestida eles não valem. */
function dropUnarmoredCalc(items) {
  const calc = (c) => c?.key === 'system.attributes.ac.calc' || c?.key === 'system.attributes.ac.formula';
  for (const item of items) {
    if (!(item.effects ?? []).some((e) => (e.changes ?? []).some(calc))) continue;
    item.effects = item.effects.map((e) => ((e.changes ?? []).some(calc) ? { ...e, changes: e.changes.filter((c) => !calc(c)) } : e));
  }
}

/** O dado mínimo 3 do Great Weapon Fighting nas armas corpo a corpo de duas mãos (cópia do `system`). */
export function greatWeaponMinimum(items) {
  for (const item of items) {
    const sys = item.system;
    const base = sys?.damage?.base;
    if (item.type !== 'weapon' || !(sys.properties ?? []).includes('two') || !String(sys.type?.value ?? '').endsWith('M')) continue;
    if (!base?.number || !base?.denomination || base.custom?.enabled) continue;
    const custom = { enabled: true, formula: `${base.number}d${base.denomination}min3` };
    item.system = { ...sys, damage: { ...sys.damage, base: { ...base, custom } } };
  }
}

/** O atributo de conjuração do ator: o da classe original, senão o da primeira que conjura. */
function actorSpellcasting(items, originalClassId) {
  const classes = items.filter((i) => i.type === 'class' && i.system?.spellcasting?.ability);
  const pick = classes.find((i) => i._id === originalClassId) ?? classes[0];
  return pick?.system.spellcasting.ability ?? '';
}

/**
 * O ator Foundry completo a partir do personagem e do compêndio.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {object}
 */
export function assembleFoundryActor(character, db) {
  const derived = deriveFromDb(character, db);
  const sp = character.species;
  const raceObj = sp ? resolveRaceObj(db, sp.id, sp.source, sp.lineage) : null;
  const size = raceObj
    ? foundrySize(effectiveSizeCodes(raceObj, { chosen: sizePick(sp.choices), level: derived.level }))
    : 'med';
  const system = buildActorSystem(character, derived, { size, hpExtra: deriveHpBonus(character, db) });

  const items = [];

  const optionalItems = new Map((character.classes ?? []).map((cls) => [cls, buildOptionalFeatureItems(cls, db)]));
  const castByFeature = (name) => [...optionalItems.values()].flat()
    .some((it) => it.name === name && Object.keys(it.system.activities ?? {}).length > 0);
  // ATENÇÃO: as magias saem ANTES das escadas: o value.added das escadas aponta para elas.
  const spellItems = [...buildSpellItems(derived, { castByFeature, db }), ...buildUnassignedSpellItems(character, db)];
  const spellIds = new Map(spellItems.map((s) => [(s.name ?? '').trim().toLowerCase(), s._id]));

  const speciesFeatItems = buildSpeciesFeatItems(character, db);
  const totalLevel = (character?.classes ?? []).reduce((sum, c) => sum + (c.level || 0), 0) || 1;
  const speciesTraitItems = raceObj ? buildSpeciesTraitItems(raceObj, db, totalLevel) : [];
  const speciesItem = raceObj ? buildSpeciesItem(character, raceObj, db, speciesFeatItems, speciesTraitItems, spellIds) : null;
  if (speciesItem) items.push(speciesItem, ...speciesFeatItems, ...speciesTraitItems);
  const originFeatItem = buildOriginFeatItem(character, db);
  const bgItem = buildBackgroundItem(character, originFeatItem, db);
  if (bgItem) items.push(bgItem);
  if (originFeatItem) items.push(originFeatItem);

  let originalClassId = '';
  for (const cls of character.classes ?? []) {
    const classObj = cls.classId ? resolveClassObj(db, cls.classId, cls.source) : null;
    if (!classObj) continue;
    const subObj = cls.subclassId ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource) : null;
    const featureItems = buildClassFeatureItems(cls, classObj, db);
    const { items: chosenFeatItems, asiByLevel, fightingStyles } = buildClassChosenFeats(cls, db);
    // ATENÇÃO: os itens de escolha saem ANTES dos de classe: o ItemChoice aponta para eles.
    const optionItems = [...buildFeatureOptionItems(cls, classObj, subObj, db), ...(optionalItems.get(cls) ?? [])];
    const weaponItems = buildClassWeaponItems(cls, classObj);
    const classItem = buildClassItem(cls, classObj, featureItems, asiByLevel, {
      weaponItems,
      description: classFluffHtml(db, cls.classId, cls.source),
      traitValues: buildClassTraitValues(cls, db),
      fightingStyles,
      db,
      futureGrants: buildClassFutureGrants(cls, classObj, db),
      choiceTraits: [...buildClassChoiceTraits(cls, classObj, db), ...buildClassGrantAdvancements(cls, db)],
      itemChoices: buildItemChoiceAdvancements(cls, classObj, subObj, db, optionItems),
    });
    const residual = residualClassChoices(cls.choices);
    if (Object.keys(residual).length) {
      classItem.flags = { ...classItem.flags, builder5e: { ...(classItem.flags?.builder5e ?? {}), choices: residual } };
    }
    items.push(classItem, ...featureItems, ...chosenFeatItems, ...optionItems, ...weaponItems);
    if (cls.isOriginalClass || !originalClassId) originalClassId = classItem._id;

    if (subObj) {
      const subFeatureItems = buildSubclassFeatureItems(subObj, cls.classId, db, cls.level);
      const subItem = buildSubclassItem(subObj, cls.classId, subFeatureItems, {
        description: subclassFluffHtml(db, cls.classId, subObj),
        db,
        futureGrants: buildSubclassFutureGrants(subObj, cls.classId, db, cls.level, spellIds),
        choiceTraits: buildSubclassChoiceTraits(subObj, cls.classId, cls, classObj, db),
        itemChoices: buildItemChoiceAdvancements(cls, classObj, subObj, db, optionItems, {
          scope: 'subclass',
          featItems: chosenFeatItems,
        }),
      });
      items.push(subItem, ...subFeatureItems);
      // ATENÇÃO: só document; um uuid relativo aqui invalida o item de classe inteiro no Foundry.
      const subAdv = Object.values(classItem.system.advancement ?? {}).find((a) => a.type === 'Subclass');
      if (subAdv) subAdv.value = { document: subItem._id };
    }
  }

  items.push(...buildInventoryItems(character, db));

  items.push(...spellItems);

  items.push(...buildBasicActionItems(db));
  system.spells = buildSpellSlots(derived);

  system.details.race = speciesItem?._id ?? '';
  system.details.background = bgItem?._id ?? '';
  system.details.originalClass = originalClassId;
  system.attributes.spellcasting = actorSpellcasting(items, originalClassId);
  linkConsumptionTargets(items);
  modernizeEffectKeys(items);
  if (derived.armorClass?.hasArmor) dropUnarmoredCalc(items);
  if (items.some((i) => i.type === 'feat' && i.name === 'Great Weapon Fighting')) greatWeaponMinimum(items);

  const actor = {
    name: character.meta?.name ?? 'Unnamed',
    type: 'character',
    system,
    items,
    effects: [],
    flags: { builder5e: { schemaVersion: character.schemaVersion ?? 1, scores: { ...character.scores } } },
    prototypeToken: { name: character.meta?.name ?? 'Unnamed', actorLink: true },
  };
  const portrait = toFoundryImage(character.meta?.portrait);
  if (portrait) {
    actor.img = portrait;
    actor.prototypeToken.texture = { src: portrait };
  }
  if (portrait && character.meta.portraitCredit) {
    actor.flags.builder5e.portraitCredit = { ...character.meta.portraitCredit };
  }
  if (character.wildShapeForms?.length) {
    actor.flags.builder5e.wildShapeForms = character.wildShapeForms.map((f) => ({ name: f.name, source: f.source }));
  }
  return actor;
}
