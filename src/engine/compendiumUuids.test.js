// =============================================================================
// compendiumUuids.test: testes da consulta de uuids de compêndio
// =============================================================================
// O QUE FAZ
//   O gabarito são os premades oficiais de nível 1 e 5: se um id mudar numa
//   regeração, estes testes acusam. Cobre os pacotes de cada tipo, o identificador
//   de subclasse (TC-0074) e o que o SRD não publica (Artificer, variantes).
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { classFeatureUuid, subclassUuid, subclassFeatureUuid, spellUuid, classUuid, originUuid, featUuid, equipmentUuid, subclassIdentifier } from './compendiumUuids';

describe('compendiumUuids', () => {
  it('feature de classe: as duas que o premade do Barbarian concede no nível 2', () => {
    expect(classFeatureUuid('barbarian', 'Danger Sense')).toBe('Compendium.dnd5e.classes24.Item.phbbrbDangerSens');
    expect(classFeatureUuid('barbarian', 'Reckless Attack')).toBe('Compendium.dnd5e.classes24.Item.phbbrbRecklessAt');
  });

  it('consulta é case-insensitive e tolera espaços', () => {
    expect(classFeatureUuid('BARBARIAN', '  reckless attack ')).toBe('Compendium.dnd5e.classes24.Item.phbbrbRecklessAt');
  });

  it('subclasse: casa pelo nome completo E pelo shortName do 5etools', () => {
    const expected = 'Compendium.dnd5e.classes24.Item.phbbrbBerserker0';
    expect(subclassUuid('barbarian', { name: 'Path of the Berserker', shortName: 'Berserker' })).toBe(expected);
    expect(subclassUuid('barbarian', { shortName: 'Berserker' })).toBe(null);
  });

  it('feature de subclasse: resolvida pelo nome completo da subclasse', () => {
    const sub = { name: 'Oath of Devotion', shortName: 'Devotion' };
    expect(subclassFeatureUuid('paladin', sub, 'Aura of Devotion')).toBe('Compendium.dnd5e.classes24.Item.phbpdnDevotionAu');
  });

  it('magia: as do ItemGrant "Oath of Devotion Spells" do premade', () => {
    expect(spellUuid('Aid')).toBe('Compendium.dnd5e.spells24.Item.phbsplAid0000000');
    expect(spellUuid('zone of truth')).toBe('Compendium.dnd5e.spells24.Item.phbsplZoneofTrut');
  });

  it('procedência (_stats.compendiumSource): cada tipo no seu pacote', () => {
    expect(classUuid('rogue')).toBe('Compendium.dnd5e.classes24.Item.phbrgeRogue00000');
    expect(originUuid('Dwarf')).toBe('Compendium.dnd5e.origins24.Item.phbspDwarf000000');
    expect(featUuid('Alert')).toBe('Compendium.dnd5e.feats24.Item.phbftAlert000000');
    expect(equipmentUuid('Longsword')).toBe('Compendium.dnd5e.equipment24.Item.phbwepLongsword0');
  });

  it('apóstrofo tipográfico casa com o reto do pack', () => {
    expect(equipmentUuid('Explorer’s Pack')).toBe(equipmentUuid("Explorer's Pack"));
    expect(equipmentUuid('Explorer’s Pack')).toBeTruthy();
  });

  it('identificador canônico da subclasse; fora do SRD, null (o slug segue valendo)', () => {
    expect(subclassIdentifier('monk', { name: 'Warrior of the Open Hand', shortName: 'Open Hand' })).toBe('hand');
    expect(subclassIdentifier('barbarian', { name: 'Path of the Berserker', shortName: 'Berserker' })).toBe('berserker');
    expect(subclassIdentifier('barbarian', { name: 'Path of the Giant' })).toBe(null);
  });

  it('conteúdo que o dnd5e não publica devolve null (não inventa uuid)', () => {
    expect(classFeatureUuid('artificer', 'Magical Tinkering')).toBe(null);
    expect(subclassFeatureUuid('barbarian', { name: 'Path of the Giant' }, 'Giants Havoc')).toBe(null);
    expect(spellUuid('Nao Existe')).toBe(null);
    expect(classFeatureUuid('barbarian', undefined)).toBe(null);
    expect(equipmentUuid('+1 Longsword')).toBe(null);
    expect(originUuid('Custom Background')).toBe(null);
  });
});
