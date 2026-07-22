// Valida a consulta ao registro de UUIDs do compêndio dnd5e. Os valores esperados
// são o gabarito dos premades OFICIAIS de nível 1/5 (Standard Premade Characters):
// se um id mudar numa regeração, estes testes acusam.
import { describe, it, expect } from 'vitest';
import { classFeatureUuid, subclassUuid, subclassFeatureUuid, spellUuid } from './compendiumUuids';

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

  it('conteúdo que o dnd5e não publica devolve null (não inventa uuid)', () => {
    // Artificer não existe no SRD 2024; subclasses fora da SRD idem.
    expect(classFeatureUuid('artificer', 'Magical Tinkering')).toBe(null);
    expect(subclassFeatureUuid('barbarian', { name: 'Path of the Giant' }, 'Giants Havoc')).toBe(null);
    expect(spellUuid('Nao Existe')).toBe(null);
    expect(classFeatureUuid('barbarian', undefined)).toBe(null);
  });
});
