// Testes de fixupSteps: a completude das escolhas de classe é PROFUNDA
// (TC-0013). Um feat ESCOLHIDO num slot de ASI/boon só sai da lista de
// pendências (passo de features do overlay + badge ✦) quando o sub-bag dele
// (+2 em um / +1 em dois, magias…) também estiver preenchido - o mesmo
// critério (`choiceComplete`) que o guia de criação já usava.
import { describe, it, expect } from 'vitest';
import { unfilledClassChoices, buildFixupSteps, fixupPendencyCount } from './fixupSteps';
import { createCharacter } from '../../schema/character';

// db mínimo: Fighter com só o ASI de nível 4, e o feat ASI real do XPHB
// (duas alternativas: +2 em um atributo OU +1 em dois).
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
  // subclassId marcado para isolar o passo de FEATURES (senão o fixup também
  // cobraria a subclasse no nível 4, que não é o alvo destes testes).
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
    // status ao vivo: continua incomplete até o sub-bag encher
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
    // o passo montado sobre o personagem pendente reporta 'complete' ao vivo
    const pending = fighterAt4({ 'feat@4': { kind: 'feat', picks: ['Ability Score Improvement|XPHB'] } });
    const features = buildFixupSteps(db, pending, pending.classes[0].uid, derived).find(
      (s) => s.id === 'fixup-features',
    );
    expect(features.status(filled, derived)).toBe('complete');
  });

  it('badge conta ESCOLHAS, não passos do guia (TC-0020)', () => {
    // Dois slots de feat abertos (ASI@4 e ASI@6) cabem num único passo de
    // features, mas o badge deve dizer 2 - e +1 quando a subclasse falta.
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
