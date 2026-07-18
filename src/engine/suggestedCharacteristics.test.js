import { describe, it, expect } from 'vitest';
import { collectSuggestions, randomSuggestion, FIELD_CATEGORY } from './suggestedCharacteristics';

// db mínimo espelhando a forma real: cada background tem tabelas d8/d6 com
// colLabels ["dN", "<Categoria>"] e rows ["1", "texto"].
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
            'I quote sacred texts.', // dup trait
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
    // 3 traços únicos (o "I quote sacred texts." repetido colapsa).
    expect(pools.personality).toHaveLength(3);
    expect(pools.personality.filter((t) => t === 'I quote sacred texts.')).toHaveLength(1);
    expect(pools.bonds).toEqual(['I would die to recover a lost relic.']);
    expect(pools.flaws).toEqual(['I judge others harshly.']);
  });

  it('remove a tag de origem no FIM de qualquer campo (alinhamento, divindade, background)', () => {
    // Ideais: sem "(Lawful)"/"(Good)"/"(Any)"/"(Bontu)".
    expect(pools.ideals).toContain('Tradition. Old ways must be upheld.');
    expect(pools.ideals).toContain('Charity. I help those in need.');
    expect(pools.ideals).toContain('Aspiration. I want to be the best.');
    // Traço com tag de background multi-palavra.
    expect(pools.personality).toContain('I interpret every event as part of a larger pattern.');
    // Nenhuma sugestão termina com um parêntese.
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
    // rng≈1 mapeia p/ o último índice.
    expect(randomSuggestion(db, 'personality', () => 0.999)).toBe(collectSuggestions(db).personality[2]);
  });

  it('pool vazio → null', () => {
    expect(randomSuggestion({}, 'flaws')).toBe(null);
  });

  it('FIELD_CATEGORY cobre os quatro campos', () => {
    expect(Object.keys(FIELD_CATEGORY)).toEqual(['personality', 'ideals', 'bonds', 'flaws']);
  });
});
