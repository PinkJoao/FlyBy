// =============================================================================
// playFeatures.test: a lista de features da aba Features do jogo
// =============================================================================
// O QUE FAZ
//   Confere o tipo e a seção de cada feature, o texto de reserva e a ordem da
//   montagem do ator, de que a lista depende (cada classe antes das features dela).
//
// FUNÇÕES
//   feat(name, value, subtype, extra): um item de feature como o ator traz.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { featureList, htmlToEntries, namedEntries } from './playFeatures';

const feat = (name, value, subtype = '', extra = {}) => ({ type: 'feat', name, system: { type: { value, subtype }, description: { value: `<p>${name} text.</p>` } }, flags: { builder5e: { level: 1 } }, ...extra });

describe('playFeatures', () => {
  it('htmlToEntries tira as tags e separa os parágrafos', () => {
    expect(htmlToEntries('<p><strong>Rage.</strong></p><p>You rage &nbsp;hard.</p>')).toEqual(['Rage.', 'You rage  hard.']);
    expect(htmlToEntries('')).toEqual([]);
  });

  it('namedEntries acha o traço aninhado', () => {
    const list = namedEntries([{ type: 'entries', name: 'A', entries: [{ type: 'entries', name: 'B', entries: ['x'] }] }]);
    expect(list.map((e) => e.name)).toEqual(['A', 'B']);
  });

  it('tipo e seção pelo item, e a opção sem resolvedor fica com a classe que vem antes', () => {
    const actor = {
      items: [
        { type: 'race', name: 'Dwarf' },
        feat('Stonecunning', 'race'),
        feat('Alert', 'feat', 'origin'),
        { type: 'class', name: 'Cleric' },
        feat('Divine Order: Thaumaturge', 'class'),
        feat('Agonizing Blast', 'class', 'eldritchInvocation'),
        { type: 'subclass', name: 'Life Domain' },
        feat('Custom Thing', 'class'),
        feat('Grappler', 'feat', 'general'),
        { type: 'feat', name: 'Dash', system: { type: { value: '' } }, flags: { builder5e: { basicAction: true } } },
      ],
    };
    const list = featureList(actor, { classes: [] }, null);
    const by = Object.fromEntries(list.map((f) => [f.name, `${f.kind}|${f.section}`]));
    expect(by).toEqual({
      'Divine Order: Thaumaturge': 'class|Cleric',
      'Agonizing Blast': 'class|Eldritch Invocations',
      'Custom Thing': 'subclass|Life Domain',
      Stonecunning: 'species|Dwarf',
      Alert: 'feat|Origin feat',
      Grappler: 'feat|Feats',
    });
    expect(list.map((f) => f.kind)).toEqual(['class', 'class', 'subclass', 'species', 'feat', 'feat']);
    expect(list.find((f) => f.name === 'Alert').entries).toEqual(['Alert text.']);
  });
});
