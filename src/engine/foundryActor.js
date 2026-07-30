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

  // Os itens de MAGIA são montados ANTES dos documentos de progressão: as escadas
  // de concessão (raça/subclasse) precisam apontar, no nível JÁ alcançado, para o
  // item de magia embutido que saiu dali (`value.added`, TC-0072). Eles entram na
  // lista no fim, junto do inventário, para a ordem do arquivo não mudar.
  // Junto do balde de CARGA: as magias que um ator importado trazia e nenhuma
  // classe da ficha sabe conjurar. Sem origem, mas devolvidas ao Foundry para o
  // round-trip não perder conteúdo (schema `unassignedSpells`).
  const spellItems = [...buildSpellItems(derived), ...buildUnassignedSpellItems(character, db)];
  const spellIds = new Map(spellItems.map((s) => [(s.name ?? '').trim().toLowerCase(), s._id]));

  // Espécie (com a linhagem já resolvida), background e talento de origem. O item
  // do talento de origem é ligado ao background por um ItemGrant; o(s) talento(s)
  // de sub-escolha da ESPÉCIE (ex: Human "Versatile") são ligados ao item de espécie.
  const speciesFeatItems = buildSpeciesFeatItems(character, db);
  // Um item por traço de espécie, como nos atores oficiais (TC-0064). Só os
  // traços JÁ alcançados são embutidos - os de nível maior viram a receita de
  // compêndio no advancement do item de raça.
  const totalLevel = (character?.classes ?? []).reduce((sum, c) => sum + (c.level || 0), 0) || 1;
  const speciesTraitItems = raceObj ? buildSpeciesTraitItems(raceObj, db, totalLevel) : [];
  const speciesItem = raceObj ? buildSpeciesItem(character, raceObj, db, speciesFeatItems, speciesTraitItems, spellIds) : null;
  if (speciesItem) items.push(speciesItem, ...speciesFeatItems, ...speciesTraitItems);
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
    // Itens das ESCOLHAS de feature ("Divine Order: Thaumaturge") e das optional
    // features (invocações, metamagias). Gerados ANTES dos itens de classe/
    // subclasse porque as escadas de ItemChoice apontam para eles no `value.added`
    // (TC-0063) - sem isso o Foundry perguntaria de novo o que já foi escolhido.
    const optionItems = [...buildFeatureOptionItems(cls, classObj, subObj, db), ...buildOptionalFeatureItems(cls, db)];
    // Itens de inventário da classe (Unarmed Strike): entram como Items de verdade
    // e o advancement da classe os referencia.
    const weaponItems = buildClassWeaponItems(cls, classObj);
    const classItem = buildClassItem(cls, classObj, featureItems, asiByLevel, {
      weaponItems,
      description: classFluffHtml(db, cls.classId, cls.source),
      traitValues: buildClassTraitValues(cls, db),
      fightingStyles,
      db,
      futureGrants: buildClassFutureGrants(cls, classObj, db),
      // Traits/ASI dos grants em prosa da classe (Slippery Mind, Disciplined
      // Survivor, os capstones de +4) entram junto dos Traits de escolha - são
      // advancements do mesmo tipo (TC-0059/0075/0077).
      choiceTraits: [...buildClassChoiceTraits(cls, classObj, db), ...buildClassGrantAdvancements(cls, db)],
      itemChoices: buildItemChoiceAdvancements(cls, classObj, subObj, db, optionItems),
    });
    // Escolhas da classe SEM casa nativa (tool@start/expertise/grants curados/
    // optional features/grants de subclasse) viajam na flag do item de classe
    // (DDL-0028; TC-0004/0005/0006) - o Foundry as ignora, nosso import as lê.
    const residual = residualClassChoices(cls.choices);
    if (Object.keys(residual).length) {
      classItem.flags = { ...classItem.flags, builder5e: { ...(classItem.flags?.builder5e ?? {}), choices: residual } };
    }
    // Sub-features escolhidas ("Divine Order: Thaumaturge") e optional features
    // (invocations, metamagic…) - itens próprios, como nos premades reais.
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
          // O ItemChoice de TALENTO da subclasse (o Fighting Style extra do
          // Champion) liga ao item de talento embutido, não a um item de opção.
          featItems: chosenFeatItems,
        }),
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
  items.push(...spellItems);

  // As ações que qualquer personagem pode tomar (Dash, Hide, Study…). Não
  // dependem de nada da build - divergência deliberada do SRD, ver o cabeçalho
  // de foundryBasicActions.
  items.push(...buildBasicActionItems(db));
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
