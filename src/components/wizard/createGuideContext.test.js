// Testes da completude PROFUNDA do guia de criação (DDL-0018): espécie com
// linhagem + TODAS as sub-escolhas (tamanho incluso), talento de origem com o
// sub-bag dele, e recursão nos feats escolhidos.
import { describe, it, expect } from 'vitest';
import {
  choicesComplete,
  speciesStepComplete,
  originFeatStepComplete,
} from './createGuideContext';

// Compêndio mínimo: raças com escolha de tamanho / linhagem, feats com e sem
// sub-escolhas (mesma forma dos objetos 5etools).
const db = {
  races: {
    race: [
      {
        name: 'Human', source: 'XPHB', size: ['S', 'M'],
        skillProficiencies: [{ any: 1 }],
        feats: [{ any: 1 }],
      },
      {
        name: 'Elf', source: 'XPHB', size: ['M'],
        skillProficiencies: [{ choose: { from: ['insight', 'perception', 'survival'] } }],
        _versions: [
          { name: 'Elf; Drow Lineage', source: 'XPHB' },
          { name: 'Elf; Wood Elf Lineage', source: 'XPHB' },
        ],
      },
    ],
  },
  feats: {
    feat: [
      { name: 'Alert', source: 'XPHB', category: 'O' }, // sem sub-escolhas
      {
        name: 'Musician', source: 'XPHB', category: 'O',
        toolProficiencies: [{ choose: { from: ['bagpipes', 'drum', 'lute'], count: 3 } }],
      },
      {
        name: 'Athlete', source: 'XPHB', category: 'G',
        ability: [{ choose: { from: ['str', 'dex'], amount: 1 } }],
      },
    ],
  },
};

const human = (choices = {}) => ({
  species: { id: 'human', source: 'XPHB', lineage: null, choices },
});

describe('speciesStepComplete (espécie + linhagem + sub-escolhas, tamanho incluso)', () => {
  it('sem espécie → incompleto', () => {
    expect(speciesStepComplete(db, {})).toBe(false);
    expect(speciesStepComplete(db, { species: null })).toBe(false);
  });

  it('Human: pende até TAMANHO + perícia + feat estarem escolhidos', () => {
    expect(speciesStepComplete(db, human())).toBe(false);
    // só o tamanho → ainda pendem a perícia e o feat
    expect(speciesStepComplete(db, human({ 'size-0': { kind: 'size', picks: ['M'] } }))).toBe(false);
    // tudo preenchido (feat sem sub-escolhas)
    expect(
      speciesStepComplete(db, human({
        'size-0': { kind: 'size', picks: ['M'] },
        'skill-0': { kind: 'skill', picks: ['ath'] },
        'feat-0': { kind: 'feat', picks: ['Alert|XPHB'] },
      })),
    ).toBe(true);
  });

  it('recursa no feat escolhido: Musician pende até as 3 ferramentas do sub-bag', () => {
    const withMusician = (sub) => human({
      'size-0': { kind: 'size', picks: ['S'] },
      'skill-0': { kind: 'skill', picks: ['ath'] },
      'feat-0': { kind: 'feat', picks: ['Musician|XPHB'], sub },
    });
    expect(speciesStepComplete(db, withMusician({}))).toBe(false);
    expect(
      speciesStepComplete(db, withMusician({
        'Musician|XPHB': { 'tool-0': { kind: 'tool', picks: ['Bagpipes', 'Drum', 'Lute'] } },
      })),
    ).toBe(true);
  });

  it('raça com linhagens exige a linhagem', () => {
    const elf = (lineage, choices = {}) => ({ species: { id: 'elf', source: 'XPHB', lineage, choices } });
    const picks = { 'skill-0': { kind: 'skill', picks: ['prc'] } };
    expect(speciesStepComplete(db, elf(null, picks))).toBe(false); // falta a linhagem
    expect(speciesStepComplete(db, elf('Elf; Drow Lineage', picks))).toBe(true);
    // tamanho fixo (M) não gera escolha - só a perícia pende
    expect(speciesStepComplete(db, elf('Elf; Drow Lineage', {}))).toBe(false);
  });

  it('raça fora do compêndio: nada a preencher → completo', () => {
    expect(speciesStepComplete(db, { species: { id: 'homebrew', source: 'X', choices: {} } })).toBe(true);
  });
});

describe('originFeatStepComplete (feat de origem + sub-escolhas dele)', () => {
  it('sem feat → incompleto; feat sem sub-escolhas → completo', () => {
    expect(originFeatStepComplete(db, {})).toBe(false);
    expect(
      originFeatStepComplete(db, { origin: { originFeat: { id: 'Alert', source: 'XPHB', choices: {} } } }),
    ).toBe(true);
  });

  it('feat com sub-escolhas pende até o sub-bag encher', () => {
    const withMusician = (choices) => ({ origin: { originFeat: { id: 'Musician', source: 'XPHB', choices } } });
    expect(originFeatStepComplete(db, withMusician({}))).toBe(false);
    expect(
      originFeatStepComplete(db, withMusician({
        'tool-0': { kind: 'tool', picks: ['Bagpipes', 'Drum', 'Lute'] },
      })),
    ).toBe(true);
  });
});

describe('choicesComplete (pool ability: o alvo é o count da alternativa)', () => {
  const athleteChoices = [
    { id: 'feat-0', kind: 'feat', count: 1, pool: { type: 'feat' } },
  ];

  it('feat com ASI embutido pende até o atributo ser escolhido', () => {
    const bag = { 'feat-0': { kind: 'feat', picks: ['Athlete|XPHB'], sub: {} } };
    expect(choicesComplete(athleteChoices, bag, db)).toBe(false);
    bag['feat-0'].sub = {
      'Athlete|XPHB': { 'ability-0': { kind: 'ability', picks: [{ ability: 'str', amount: 1 }] } },
    };
    expect(choicesComplete(athleteChoices, bag, db)).toBe(true);
  });

  it('alternativas múltiplas sem modo escolhido nunca completam', () => {
    const choices = [{
      id: 'ability-0', kind: 'ability', count: 1,
      pool: { type: 'ability', alternatives: [{ count: 1, amount: 2 }, { count: 2, amount: 1 }] },
    }];
    expect(choicesComplete(choices, { 'ability-0': { kind: 'ability', picks: [{ ability: 'str', amount: 2 }] } }, db)).toBe(false);
    expect(choicesComplete(choices, { 'ability-0': { kind: 'ability', alt: 0, picks: [{ ability: 'str', amount: 2 }] } }, db)).toBe(true);
    // modo "+1 em dois" com um só pick ainda pende
    expect(choicesComplete(choices, { 'ability-0': { kind: 'ability', alt: 1, picks: [{ ability: 'str', amount: 1 }] } }, db)).toBe(false);
  });
});
