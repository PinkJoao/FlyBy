// =============================================================================
// suggestedCharacteristics.test: testes das características sugeridas
// =============================================================================
// O QUE FAZ
//   Um db mínimo na forma real (tabelas com colLabels ["dN", categoria]): dedup,
//   remoção das tags de origem (inclusive multi-palavra) e o rng injetado.
//
// FUNÇÕES
//   bgTable(cat, rows): uma tabela de background.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { collectSuggestions, randomSuggestion, FIELD_CATEGORY } from './suggestedCharacteristics';

const bgTable = (cat, rows) => ({ type: 'table', colLabels: ['d6', cat], rows: rows.map((t, i) => [String(i + 1), t]) });

const db = {
  backgrounds: {
    background: [
      {
        name: 'Acolyte',
        source: 'PHB',
        entries: [
          { type: 'section', name: 'Suggested Characteristics', entries: [
            bgTable('Personality Trait', ['I idolize a hero of my faith.', 'I quote sacred texts.']),
            bgTable('Ideal', ['Tradition. Old ways must be upheld. (Lawful)', 'Charity. I help those in need. (Good)']),
            bgTable('Bond', ['I would die to recover a lost relic.']),
            bgTable('Flaw', ['I judge others harshly.']),
          ] },
        ],
      },
      {
        name: 'Guild Artisan',
        source: 'PHB',
        entries: [
          bgTable('Personality Trait', [
            'I quote sacred texts.',
            'I interpret every event as part of a larger pattern. (Puzzle, Star)',
          ]),
          bgTable('Ideal', ['{@b Guild}. My guild is all that matters. (Any)', 'Aspiration. I want to be the best. (Bontu)']),
        ],
      },
    ],
  },
};

describe('collectSuggestions', () => {
  const pools = collectSuggestions(db);

  it('junta e deduplica por campo', () => {
    expect(pools.personality).toHaveLength(3);
    expect(pools.personality.filter((t) => t === 'I quote sacred texts.')).toHaveLength(1);
    expect(pools.bonds).toEqual(['I would die to recover a lost relic.']);
    expect(pools.flaws).toEqual(['I judge others harshly.']);
  });

  it('remove a tag de origem no FIM de qualquer campo (alinhamento, divindade, background)', () => {
    expect(pools.ideals).toContain('Tradition. Old ways must be upheld.');
    expect(pools.ideals).toContain('Charity. I help those in need.');
    expect(pools.ideals).toContain('Aspiration. I want to be the best.');
    expect(pools.personality).toContain('I interpret every event as part of a larger pattern.');
    for (const field of ['personality', 'ideals', 'bonds', 'flaws']) {
      expect(pools[field].some((t) => /\([^)]*\)\s*$/.test(t))).toBe(false);
    }
  });

  it('resolve markup 5etools ({@b Guild} → Guild)', () => {
    expect(pools.ideals).toContain('Guild. My guild is all that matters.');
  });

  it('memoiza por db (mesma referência de pool)', () => {
    expect(collectSuggestions(db)).toBe(pools);
  });

  it('db sem backgrounds → pools vazios', () => {
    expect(collectSuggestions({}).personality).toEqual([]);
    expect(collectSuggestions(null).ideals).toEqual([]);
  });
});

describe('randomSuggestion', () => {
  it('usa o RNG injetado para escolher determinística e ciclicamente', () => {
    const bonds = collectSuggestions(db).bonds;
    expect(randomSuggestion(db, 'bonds', () => 0)).toBe(bonds[0]);
    expect(randomSuggestion(db, 'personality', () => 0.999)).toBe(collectSuggestions(db).personality[2]);
  });

  it('pool vazio → null', () => {
    expect(randomSuggestion({}, 'flaws')).toBe(null);
  });

  it('FIELD_CATEGORY cobre os quatro campos', () => {
    expect(Object.keys(FIELD_CATEGORY)).toEqual(['personality', 'ideals', 'bonds', 'flaws']);
  });
});
