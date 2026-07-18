// =============================================================================
// foundryActor - monta o ATOR completo do Foundry (Fase A4)
// =============================================================================
// Junta tudo o que as fatias anteriores geram num único documento de Actor
// (type 'character') pronto para serializar em `.json` e importar no Foundry:
//   system (bloco de stats) + items[] (classe/subclasse/espécie/background +
//   features) + as referências details.race/background/originalClass (por _id).
//
// Módulo separado p/ evitar ciclo de import (foundryItems ↔ foundryExport).
// -----------------------------------------------------------------------------

import { deriveFromDb, resolveRaceObj, resolveClassObj, resolveSubclassObj } from './resolve';
import { deriveHpBonus } from './hpBonuses';
import { buildActorSystem, foundrySize } from './foundryExport';
import { effectiveSizeCodes, sizePick } from './speciesData';
import {
  buildClassItem,
  buildClassFeatureItems,
  buildClassChosenFeats,
  buildClassTraitValues,
  buildFeatureOptionItems,
  buildOptionalFeatureItems,
  buildSubclassItem,
  buildSubclassFeatureItems,
  buildSpeciesItem,
  buildSpeciesFeatItems,
  buildBackgroundItem,
  buildOriginFeatItem,
  buildInventoryItems,
  residualClassChoices,
  classFluffHtml,
  subclassFluffHtml,
} from './foundryItems';
import { buildSpellItems, buildSpellSlots } from './foundrySpells';

/**
 * Monta o ator Foundry completo a partir do personagem + compêndio.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {object} documento de Actor (type 'character')
 */
export function assembleFoundryActor(character, db) {
  const derived = deriveFromDb(character, db);
  const sp = character.species;
  const raceObj = sp ? resolveRaceObj(db, sp.id, sp.source, sp.lineage) : null;
  // Tamanho EFETIVO: escolha do jogador (raças Small/Medium) e nível (Verdan).
  const size = raceObj
    ? foundrySize(effectiveSizeCodes(raceObj, { chosen: sizePick(sp.choices), level: derived.level }))
    : 'med';
  // Aumentos de HP máximo derivados (Tough, Boon of Fortitude, Dwarven
  // Toughness, Draconic Resilience) → hp.bonuses.level/overall no ator.
  const system = buildActorSystem(character, derived, { size, hpExtra: deriveHpBonus(character, db) });

  const items = [];

  // Espécie (com a linhagem já resolvida), background e talento de origem. O item
  // do talento de origem é ligado ao background por um ItemGrant; o(s) talento(s)
  // de sub-escolha da ESPÉCIE (ex: Human "Versatile") são ligados ao item de espécie.
  const speciesFeatItems = buildSpeciesFeatItems(character, db);
  const speciesItem = raceObj ? buildSpeciesItem(character, raceObj, db, speciesFeatItems) : null;
  if (speciesItem) items.push(speciesItem, ...speciesFeatItems);
  const originFeatItem = buildOriginFeatItem(character, db);
  const bgItem = buildBackgroundItem(character, originFeatItem, db);
  if (bgItem) items.push(bgItem);
  if (originFeatItem) items.push(originFeatItem);

  // Classes (multiclasse): item de classe + features; talentos escolhidos (ASI/
  // Fighting Style) ligados ao advancement ASI da classe; subclasse + features.
  let originalClassId = '';
  for (const cls of character.classes ?? []) {
    const classObj = cls.classId ? resolveClassObj(db, cls.classId, cls.source) : null;
    if (!classObj) continue;
    const subObj = cls.subclassId ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource) : null;
    const featureItems = buildClassFeatureItems(cls, classObj, db);
    const { items: chosenFeatItems, asiByLevel, fightingStyles } = buildClassChosenFeats(cls, db);
    const classItem = buildClassItem(cls, classObj, featureItems, asiByLevel, {
      description: classFluffHtml(db, cls.classId, cls.source),
      traitValues: buildClassTraitValues(cls, db),
      fightingStyles,
    });
    // Escolhas da classe SEM casa nativa (tool@start/expertise/grants curados/
    // optional features/grants de subclasse) viajam na flag do item de classe
    // (DDL-0028; TC-0004/0005/0006) - o Foundry as ignora, nosso import as lê.
    const residual = residualClassChoices(cls.choices);
    if (Object.keys(residual).length) {
      classItem.flags = { ...classItem.flags, builder5e: { ...(classItem.flags?.builder5e ?? {}), choices: residual } };
    }
    items.push(classItem, ...featureItems, ...chosenFeatItems);
    // Sub-features escolhidas ("Divine Order: Thaumaturge") e optional features
    // (invocations, metamagic…) - itens próprios, como nos premades reais.
    items.push(...buildFeatureOptionItems(cls, classObj, subObj, db));
    items.push(...buildOptionalFeatureItems(cls, db));
    if (cls.isOriginalClass || !originalClassId) originalClassId = classItem._id;

    if (subObj) {
      const subFeatureItems = buildSubclassFeatureItems(subObj, cls.classId, db, cls.level);
      const subItem = buildSubclassItem(subObj, cls.classId, subFeatureItems, {
        description: subclassFluffHtml(db, cls.classId, subObj),
      });
      items.push(subItem, ...subFeatureItems);
      // Liga o passo `Subclass` do advancement da classe à subclasse EMBUTIDA.
      // SÓ `document` (id local): o campo `uuid` é um DocumentUUIDField({type:'Item'})
      // e um uuid RELATIVO (`.id`) falha a validação estrita ("Invalid document type
      // ''"), o que invalida o item de CLASSE inteiro no Foundry → ficha nível 0 sem
      // classe (bug confirmado pelo console do Foundry). `uuid` omitido = null válido;
      // `document` é um LocalDocumentField e resolve o item embutido pelo id.
      const subAdv = Object.values(classItem.system.advancement ?? {}).find((a) => a.type === 'Subclass');
      if (subAdv) subAdv.value = { document: subItem._id };
    }
  }

  // Inventário: armas/armaduras/ferramentas/consumíveis/tesouro → Items físicos
  // (com dano/CA/quantidade/equipado/atunado). Foundry deriva AC e ataques deles.
  items.push(...buildInventoryItems(character, db));

  // Magias: um Item `spell` por magia POR ORIGEM (preparadas, concedidas,
  // arcanum) + os espaços de magia do ator (o Foundry deriva os máximos).
  items.push(...buildSpellItems(derived));
  system.spells = buildSpellSlots(derived);

  // Referências do ator aos itens (por _id) - como no export real.
  system.details.race = speciesItem?._id ?? '';
  system.details.background = bgItem?._id ?? '';
  system.details.originalClass = originalClassId;

  const actor = {
    name: character.meta?.name ?? 'Unnamed',
    type: 'character',
    system,
    items,
    effects: [],
    // `scores` (base) viaja explícito: com o cap de atributos (TC-0022) o valor
    // final exportado pode saturar (ex: 19+GWM+Sentinel = 20, não 21), então
    // `base = final - Σboosts` deixou de ser reversível sem ambiguidade. A flag
    // dá o round-trip lossless; atores SEM ela (premades/Plutonium) caem na
    // subtração (foundryImport). O Foundry ignora a flag namespaced.
    flags: { builder5e: { schemaVersion: character.schemaVersion ?? 1, scores: { ...character.scores } } },
    prototypeToken: { name: character.meta?.name ?? 'Unnamed', actorLink: true },
  };
  if (character.meta?.portrait) actor.img = character.meta.portrait;
  return actor;
}
