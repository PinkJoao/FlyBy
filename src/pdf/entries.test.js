// =============================================================================
// entries.test: testes do conversor de entries para a ficha PDF
// =============================================================================
// O QUE FAZ
//   O texto exibido de cada gramática de tag (com as do 2024 e o dado por
//   círculo), negrito e itálico como runs, o nome de bloco como lead, listas,
//   tabelas, insets, referências e as linhas de DC.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { inlineRuns, toBlocks, runsText, blocksText } from './entries';

describe('inlineRuns', () => {
  it('shows the display text of each tag grammar', () => {
    expect(runsText(inlineRuns('Cast {@spell Fireball|XPHB} or {@spell cure wounds|XPHB|heal}.'))).toBe('Cast Fireball or heal.');
    expect(runsText(inlineRuns('{@dc 15} and {@hit 5} for {@damage 2d6} fire'))).toBe('DC 15 and +5 for 2d6 fire');
    expect(runsText(inlineRuns('{@filter spells|spells|level=1}'))).toBe('spells');
    expect(runsText(inlineRuns('{@condition Prone|XPHB}'))).toBe('Prone');
  });

  it('labels the 2024 attack and save tags', () => {
    expect(runsText(inlineRuns('{@atkr m} {@hit 4}, {@h}5 damage'))).toBe('Melee Attack Roll: +4, Hit:5 damage');
    expect(runsText(inlineRuns('{@actSave wis} {@dc 13}'))).toBe('Wisdom Saving Throw: DC 13');
  });

  it('takes the per-slot die of a scaling tag', () => {
    expect(runsText(inlineRuns('increases by {@scaledamage 8d6|3-9|1d6}'))).toBe('increases by 1d6');
  });

  it('keeps bold and italic as styled runs, nested tags included', () => {
    const runs = inlineRuns('a {@b bold {@spell Light|XPHB}} b {@i it}');
    expect(runs).toEqual([
      { text: 'a ' },
      { text: 'bold Light', b: true },
      { text: ' b ' },
      { text: 'it', i: true },
    ]);
  });
});

describe('toBlocks', () => {
  it('puts a block name as the lead of its first paragraph', () => {
    const blocks = toBlocks([{ type: 'entries', name: 'Darkvision', entries: ['You see in the dark.'] }]);
    expect(blocks).toEqual([{ type: 'p', lead: 'Darkvision', runs: [{ text: 'You see in the dark.' }] }]);
  });

  it('keeps lists, tables and insets', () => {
    const blocks = toBlocks([
      { type: 'list', items: ['one', { type: 'item', name: 'Two', entries: ['second'] }] },
      { type: 'table', colLabels: ['d4', 'Result'], rows: [['1', 'Fire'], [{ type: 'cell', roll: { min: 2, max: 4 } }, 'Cold']] },
      { type: 'inset', name: 'Note', entries: ['boxed'] },
    ]);
    expect(blocks.map((b) => b.type)).toEqual(['list', 'table', 'inset']);
    expect(blocks[0].items[1][0].lead).toBe('Two');
    expect(runsText(blocks[1].rows[1][0])).toBe('2-4');
    expect(blocksText(blocks)).toContain('boxed');
  });

  it('names references and drops images', () => {
    const blocks = toBlocks([
      { type: 'refSubclassFeature', subclassFeature: 'Improved Critical|Fighter|XPHB|Champion|XPHB|3' },
      { type: 'image', href: { path: 'x.webp' } },
    ]);
    expect(blocks).toEqual([{ type: 'p', runs: [{ text: 'Improved Critical', i: true }] }]);
  });

  it('spells out the ability DC lines', () => {
    const [b] = toBlocks([{ type: 'abilityDc', name: 'Spell', attributes: ['wis'] }]);
    expect(b.lead).toBe('Spell save DC');
    expect(runsText(b.runs)).toContain('Wisdom');
  });
});
