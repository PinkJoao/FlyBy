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
//   assembleFoundryActor(character, db): o ator completo.
//
// DECISÕES E ARMADILHAS
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
  const spellItems = [...buildSpellItems(derived, { castByFeature }), ...buildUnassignedSpellItems(character, db)];
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

  const actor = {
    name: character.meta?.name ?? 'Unnamed',
    type: 'character',
    system,
    items,
    effects: [],
    flags: { builder5e: { schemaVersion: character.schemaVersion ?? 1, scores: { ...character.scores } } },
    prototypeToken: { name: character.meta?.name ?? 'Unnamed', actorLink: true },
  };
  if (character.meta?.portrait) actor.img = character.meta.portrait;
  return actor;
}
