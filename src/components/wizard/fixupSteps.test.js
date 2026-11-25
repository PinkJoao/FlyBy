// =============================================================================
// fixupSteps.test: testes dos passos de preencher o que falta
// =============================================================================
// O QUE FAZ
//   TC-0013: um talento escolhido num slot de ASI só sai das pendências quando o
//   sub-bag enche, e o badge conta decisões (dois slots abertos dão 2, e a
//   subclasse em falta soma 1).
//
// FUNÇÕES
//   fighterAt4(choices): um Fighter 4 com a subclasse marcada (para isolar o
//     passo de features).
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { unfilledClassChoices, buildFixupSteps, fixupPendencyCount } from './fixupSteps';
import { createCharacter } from '../../schema/character';

const asiFeat = {
  name: 'Ability Score Improvement',
  source: 'XPHB',
  category: 'G',
  ability: [
    { choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], amount: 2 }, hidden: true },
    { choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], count: 2 }, hidden: true },
  ],
  entries: ['x'],
};
const db = {
  'class-fighter': {
    class: [
      {
        name: 'Fighter',
        source: 'XPHB',
        classFeatures: ['Ability Score Improvement|Fighter|XPHB|4'],
      },
    ],
  },
  feats: { feat: [asiFeat] },
  races: { race: [] },
};
const derived = { spellcasting: { origins: [] } };

function fighterAt4(choices = {}) {
  const c = createCharacter({ name: 'T' });
  c.classes[0] = {
    ...c.classes[0],
    classId: 'fighter',
    source: 'XPHB',
    level: 4,
    subclassId: 'Champion',
    subclassSource: 'XPHB',
    choices,
  };
  return c;
}

describe('unfilledClassChoices - completude profunda (TC-0013)', () => {
  it('slot de feat vazio pende', () => {
    const c = fighterAt4();
    const ids = unfilledClassChoices(db, c, c.classes[0]).map((ch) => ch.id);
    expect(ids).toContain('feat@4');
  });

  it('feat ESCOLHIDO com sub-bag vazio AINDA pende (o bug do TC-0013)', () => {
    const c = fighterAt4({ 'feat@4': { kind: 'feat', picks: ['Ability Score Improvement|XPHB'] } });
    const ids = unfilledClassChoices(db, c, c.classes[0]).map((ch) => ch.id);
    expect(ids).toContain('feat@4');
  });

  it('alternativa escolhida mas picks insuficientes (+1 em dois com um só) pende', () => {
    const c = fighterAt4({
      'feat@4': {
        kind: 'feat',
        picks: ['Ability Score Improvement|XPHB'],
        sub: {
          'Ability Score Improvement|XPHB': {
            'ability-0': { kind: 'ability', alt: 1, picks: [{ ability: 'str', amount: 1 }] },
          },
        },
      },
    });
    const ids = unfilledClassChoices(db, c, c.classes[0]).map((ch) => ch.id);
    expect(ids).toContain('feat@4');
  });

  it('sub-bag completo (+2 em um) fecha a pendência', () => {
    const c = fighterAt4({
      'feat@4': {
        kind: 'feat',
        picks: ['Ability Score Improvement|XPHB'],
        sub: {
          'Ability Score Improvement|XPHB': {
            'ability-0': { kind: 'ability', alt: 0, picks: [{ ability: 'str', amount: 2 }] },
          },
        },
      },
    });
    expect(unfilledClassChoices(db, c, c.classes[0])).toEqual([]);
  });

  it('feat fora do compêndio não cobra sub-escolhas (nada a renderizar)', () => {
    const c = fighterAt4({ 'feat@4': { kind: 'feat', picks: ['Homebrew Feat|X'] } });
    expect(unfilledClassChoices(db, c, c.classes[0])).toEqual([]);
  });
});

describe('buildFixupSteps / fixupPendencyCount refletem o check profundo', () => {
  it('feat semi-preenchido mantém o passo de features e o badge', () => {
    const c = fighterAt4({ 'feat@4': { kind: 'feat', picks: ['Ability Score Improvement|XPHB'] } });
    const steps = buildFixupSteps(db, c, c.classes[0].uid, derived);
    expect(steps.map((s) => s.id)).toContain('fixup-features');
    expect(fixupPendencyCount(db, c, derived)).toBe(1);
    const features = steps.find((s) => s.id === 'fixup-features');
    expect(features.status(c, derived)).toBe('incomplete');
  });

  it('sub-bag completo zera o badge e completa o passo', () => {
    const filled = fighterAt4({
      'feat@4': {
        kind: 'feat',
        picks: ['Ability Score Improvement|XPHB'],
        sub: {
          'Ability Score Improvement|XPHB': {
            'ability-0': { kind: 'ability', alt: 0, picks: [{ ability: 'con', amount: 2 }] },
          },
        },
      },
    });
    expect(fixupPendencyCount(db, filled, derived)).toBe(0);
    const pending = fighterAt4({ 'feat@4': { kind: 'feat', picks: ['Ability Score Improvement|XPHB'] } });
    const features = buildFixupSteps(db, pending, pending.classes[0].uid, derived).find(
      (s) => s.id === 'fixup-features',
    );
    expect(features.status(filled, derived)).toBe('complete');
  });

  it('badge conta ESCOLHAS, não passos do guia (TC-0020)', () => {
    const db2 = {
      ...db,
      'class-fighter': {
        class: [{
          name: 'Fighter', source: 'XPHB',
          classFeatures: ['Ability Score Improvement|Fighter|XPHB|4', 'Ability Score Improvement|Fighter|XPHB|6'],
        }],
      },
    };
    const c = fighterAt4();
    c.classes[0].level = 6;
    expect(fixupPendencyCount(db2, c, derived)).toBe(2);
    const semSubclasse = { ...c, classes: [{ ...c.classes[0], subclassId: null }] };
    expect(fixupPendencyCount(db2, semSubclasse, derived)).toBe(3);
  });
});
