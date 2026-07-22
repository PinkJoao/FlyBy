// Valida a consulta ao registro de UUIDs do compêndio dnd5e. Os valores esperados
// são o gabarito dos premades OFICIAIS de nível 1/5 (Standard Premade Characters):
// se um id mudar numa regeração, estes testes acusam.
import { describe, it, expect } from 'vitest';
import { classFeatureUuid, subclassUuid, subclassFeatureUuid, spellUuid, classUuid, originUuid, featUuid, equipmentUuid } from './compendiumUuids';

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
    expect(subclassUuid('barbarian', { shortName: 'Berserker' })).toBe(null); // shortName não é chave do pack
  });

  it('feature de subclasse: resolvida pelo nome completo da subclasse', () => {
    const sub = { name: 'Oath of Devotion', shortName: 'Devotion' };
    // = o uuid do ItemGrant de nível 7 do premade Krusk (Paladin).
    expect(subclassFeatureUuid('paladin', sub, 'Aura of Devotion')).toBe('Compendium.dnd5e.classes24.Item.phbpdnDevotionAu');
  });

  it('magia: as do ItemGrant "Oath of Devotion Spells" do premade', () => {
    expect(spellUuid('Aid')).toBe('Compendium.dnd5e.spells24.Item.phbsplAid0000000');
    expect(spellUuid('zone of truth')).toBe('Compendium.dnd5e.spells24.Item.phbsplZoneofTrut');
  });

  it('procedência (_stats.compendiumSource): cada tipo no seu pacote', () => {
    // Gabarito dos premades: raça e traços em origins24, classe/features em
    // classes24, talentos em feats24, inventário em equipment24.
    expect(classUuid('rogue')).toBe('Compendium.dnd5e.classes24.Item.phbrgeRogue00000');
    expect(originUuid('Dwarf')).toBe('Compendium.dnd5e.origins24.Item.phbspDwarf000000');
    expect(featUuid('Alert')).toBe('Compendium.dnd5e.feats24.Item.phbftAlert000000');
    expect(equipmentUuid('Longsword')).toBe('Compendium.dnd5e.equipment24.Item.phbwepLongsword0');
  });

  it('apóstrofo tipográfico casa com o reto do pack', () => {
    expect(equipmentUuid('Explorer’s Pack')).toBe(equipmentUuid("Explorer's Pack"));
    expect(equipmentUuid('Explorer’s Pack')).toBeTruthy();
  });

  it('conteúdo que o dnd5e não publica devolve null (não inventa uuid)', () => {
    // Artificer não existe no SRD 2024; subclasses fora da SRD idem.
    expect(classFeatureUuid('artificer', 'Magical Tinkering')).toBe(null);
    expect(subclassFeatureUuid('barbarian', { name: 'Path of the Giant' }, 'Giants Havoc')).toBe(null);
    expect(spellUuid('Nao Existe')).toBe(null);
    expect(classFeatureUuid('barbarian', undefined)).toBe(null);
    expect(equipmentUuid('+1 Longsword')).toBe(null); // variante gerada
    expect(originUuid('Custom Background')).toBe(null);
  });
});
