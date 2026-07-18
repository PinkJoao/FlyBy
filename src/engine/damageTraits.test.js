import { describe, it, expect } from 'vitest';
import { deriveDamageTraits } from './damageTraits';
import { parseChoices } from './choices';

// db mínimo: uma raça com resist fixo, uma raça com choose, e um feat com choose.
const db = {
  races: {
    race: [
      { name: 'Aasimar', source: 'XPHB', resist: ['necrotic', 'radiant'] },
      {
        name: 'Reborn',
        source: 'RHW',
        resist: [{ choose: { from: ['cold', 'necrotic', 'poison'] } }],
      },
    ],
  },
  feats: {
    feat: [
      {
        name: 'Boon of Energy Resistance',
        source: 'XPHB',
        category: 'EB',
        resist: [
          { choose: { from: ['acid', 'cold', 'fire', 'lightning', 'necrotic', 'poison', 'psychic', 'radiant', 'thunder'], count: 2 } },
        ],
      },
      { name: 'Dragon Hide', source: 'TEST', resist: ['fire'] },
    ],
  },
};

const baseChar = () => ({ classes: [], origin: {}, species: null });

describe('parseChoices - campo resist (TC-0014)', () => {
  it('resist com choose vira um Choice kind resist com as opções e o count', () => {
    const feat = db.feats.feat[0];
    const choices = parseChoices(feat);
    const resist = choices.find((c) => c.kind === 'resist');
    expect(resist).toBeTruthy();
    expect(resist.count).toBe(2);
    expect(resist.pool.type).toBe('list');
    expect(resist.pool.options).toHaveLength(9);
    expect(resist.pool.options[0]).toEqual({ value: 'acid', label: 'Acid' });
  });

  it('resist fixo (strings) NÃO gera escolha', () => {
    expect(parseChoices({ resist: ['fire', 'cold'] })).toEqual([]);
  });
});

describe('deriveDamageTraits', () => {
  it('resist fixo da raça deriva', () => {
    const c = { ...baseChar(), species: { id: 'aasimar', source: 'XPHB', choices: {} } };
    expect(deriveDamageTraits(c, db).resist).toEqual(['necrotic', 'radiant']);
  });

  it('picks escolhidos no sub-bag de um feat de classe derivam', () => {
    const c = {
      ...baseChar(),
      classes: [
        {
          classId: 'fighter',
          level: 19,
          choices: {
            'feat@19': {
              kind: 'feat',
              picks: ['Boon of Energy Resistance|XPHB'],
              sub: {
                'Boon of Energy Resistance|XPHB': {
                  'resist-0': { kind: 'resist', picks: ['fire', 'psychic'] },
                },
              },
            },
          },
        },
      ],
    };
    expect(deriveDamageTraits(c, db).resist).toEqual(['fire', 'psychic']);
  });

  it('resist fixo de um feat tomado deriva; escolha da espécie também; dedup', () => {
    const c = {
      ...baseChar(),
      species: { id: 'reborn', source: 'RHW', choices: { 'resist-0': { kind: 'resist', picks: ['cold'] } } },
      origin: { originFeat: { id: 'Dragon Hide', source: 'TEST', choices: {} } },
    };
    const out = deriveDamageTraits(c, db);
    expect(out.resist).toEqual(expect.arrayContaining(['fire', 'cold']));
    expect(out.resist).toHaveLength(2);
  });

  it('itens equipados contam à parte (fromItems), dedupados contra o personagem', () => {
    const c = { ...baseChar(), species: { id: 'aasimar', source: 'XPHB', choices: {} } };
    const entries = [
      { raw: { name: 'Armor of Acid Resistance', resist: ['acid'] }, equipped: true, attuned: true, required: true },
      { raw: { name: 'Armor of Fire Resistance', resist: ['fire'] }, equipped: false, attuned: false, required: true },
      { raw: { name: 'Cloak of Necrotic', resist: ['necrotic'] }, equipped: true, attuned: false, required: false },
    ];
    const out = deriveDamageTraits(c, db, entries);
    expect(out.resist).toEqual(['necrotic', 'radiant']);
    // acid entra (equipado+sintonizado); fire não (desequipado); necrotic já é do personagem.
    expect(out.fromItems.resist).toEqual(['acid']);
  });

  it('item que exige sintonização mas não está sintonizado NÃO conta', () => {
    const entries = [
      { raw: { name: 'Ring', resist: ['thunder'] }, equipped: true, attuned: false, required: true },
    ];
    expect(deriveDamageTraits(baseChar(), db, entries).fromItems.resist).toEqual([]);
  });
});
