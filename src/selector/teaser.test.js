// =============================================================================
// teaser.test: as peças do resumo do cartão do carrossel
// =============================================================================
// O QUE FAZ
//   Cobre firstParagraph (pula citação, quadro e tabela), featureRefLevels (refs em
//   texto e em objeto), levelLines (ordem, limite de nível, nomes repetidos) e
//   trimEntries (o parágrafo já lido e o nome repetido saem).
//
// FUNÇÕES
//   (nenhuma: suíte Vitest).
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { featureRefLevels, firstParagraph, levelLines, trimEntries } from './teaser';

describe('teaser', () => {
  it('firstParagraph pula citação e quadro e desce nos entries', () => {
    const entries = [
      { type: 'quote', entries: ['A line someone said.'] },
      { type: 'inset', entries: ['Sidebar.'] },
      { type: 'entries', name: 'Fighters', entries: ['', 'Fighters rule many battlefields.'] },
    ];
    expect(firstParagraph(entries)).toBe('Fighters rule many battlefields.');
    expect(firstParagraph([])).toBeNull();
    expect(firstParagraph(undefined)).toBeNull();
  });

  it('featureRefLevels lê as refs em texto e em objeto', () => {
    const map = featureRefLevels([
      'Rage|Barbarian|XPHB|1',
      'Unarmored Defense|Barbarian|XPHB|1',
      { classFeature: 'Primal Path|Barbarian|XPHB|3', gainSubclassFeature: true },
      'broken',
    ]);
    expect(map.get(1)).toEqual(['Rage', 'Unarmored Defense']);
    expect(map.get(3)).toEqual(['Primal Path']);
    expect(map.size).toBe(2);
  });

  it('levelLines ordena, corta no nível e não repete nomes', () => {
    const map = new Map([[3, ['B']], [1, ['A', 'A']], [5, ['C']]]);
    expect(levelLines(map, 3)).toEqual(['{@b Level 1:} A', '{@b Level 3:} B']);
    expect(levelLines(map)).toHaveLength(3);
  });
});

describe('trimEntries', () => {
  const tree = [{ type: 'section', name: 'Fighter', entries: ['First.', 'Second.', { type: 'entries', name: 'More', entries: ['First.'] }] }];

  it('tira só a 1a ocorrência do parágrafo já lido e o nome da seção igual ao da entrada', () => {
    const { entries, removed } = trimEntries(tree, { skip: 'First.', dropName: 'fighter' });
    expect(removed).toBe(true);
    expect(entries[0].name).toBeUndefined();
    expect(entries[0].entries[0]).toBe('Second.');
    expect(entries[0].entries[1].entries).toEqual(['First.']);
    expect(entries[0].entries[1].name).toBe('More');
  });

  it('sem opções devolve a mesma árvore', () => {
    const { entries, removed } = trimEntries(tree);
    expect(removed).toBe(false);
    expect(entries).toEqual(tree);
  });
});
