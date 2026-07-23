import { describe, it, expect } from 'vitest';
import { normalizeLegacySpecies } from './legacySpeciesRules';

// Recorte do Custom Lineage TCE: `ability` 2014 (+2 à escolha) e talento LIVRE.
const customLineage = {
  name: 'Custom Lineage',
  source: 'TCE',
  size: ['S', 'M'],
  ability: [{ choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], amount: 2 } }],
  feats: [{ any: 1 }],
};

describe('normalizeLegacySpecies', () => {
  it('descarta o `ability` legado da espécie (os boosts vêm da origem)', () => {
    const out = normalizeLegacySpecies(customLineage);
    expect(out.ability).toBeUndefined();
    expect(customLineage.ability).toHaveLength(1); // a fonte não é mutada
  });

  it('vale para QUALQUER espécie legada, não só as curadas (Simic Hybrid)', () => {
    const simic = { name: 'Simic Hybrid', source: 'GGR', ability: [{ choose: { from: ['str'], amount: 1 } }] };
    const out = normalizeLegacySpecies(simic);
    expect(out.ability).toBeUndefined();
    expect(out.feats).toBeUndefined(); // sem entrada curada, o campo nem existe
  });

  it('Custom Lineage: o talento livre vira talento de ORIGEM (categoria O)', () => {
    expect(normalizeLegacySpecies(customLineage).feats).toEqual([
      { anyFromCategory: { category: ['O'], count: 1 } },
    ]);
  });

  it('a chave curada é a da espécie BASE (`_baseName`), então a linhagem herda', () => {
    const variant = { ...customLineage, name: 'Custom Lineage; Darkvision', _baseName: 'Custom Lineage' };
    expect(normalizeLegacySpecies(variant).feats[0].anyFromCategory.category).toEqual(['O']);
  });

  it('espécie 2024 sem nada a normalizar volta pela MESMA referência', () => {
    const human = { name: 'Human', source: 'XPHB', feats: [{ anyFromCategory: { category: ['O'], count: 1 } }] };
    expect(normalizeLegacySpecies(human)).toBe(human);
    expect(normalizeLegacySpecies(null)).toBeNull();
  });

  it('normalizar é idempotente e memoizado (mesma referência de saída)', () => {
    const once = normalizeLegacySpecies(customLineage);
    expect(normalizeLegacySpecies(customLineage)).toBe(once);
    expect(normalizeLegacySpecies(once)).toBe(once);
  });
});
