import { describe, it, expect } from 'vitest';
import { spellcastingFeature, namedSubEntries, cantripEntries, spellSlotEntries } from './spellcastingText';

// db mínimo: a estrutura real aninha os sub-blocos dentro de um wrapper
// `{type:'entries'}` sem nome (como no 5etools). Warlock tem "Pact Magic" +
// bloco Cantrips; Ranger tem "Spellcasting" SEM Cantrips.
const warlockFeature = {
  name: 'Pact Magic',
  entries: [
    'Through occult ceremony…',
    {
      type: 'entries',
      entries: [
        { type: 'entries', name: 'Cantrips', entries: ['You know two Warlock cantrips…'] },
        {
          type: 'entries',
          name: 'Spell Slots',
          entries: ['…You regain all expended Pact Magic spell slots when you finish a Short Rest or Long Rest.'],
        },
        { type: 'entries', name: 'Prepared Spells of Level 1+', entries: ['To start, choose two…'] },
      ],
    },
    {
      type: 'entries',
      entries: [
        { type: 'entries', name: 'Changing Your Prepared Spells', entries: ['Whenever you gain a Warlock level…'] },
        { type: 'entries', name: 'Spellcasting Ability', entries: ['Charisma…'] },
      ],
    },
  ],
};

const rangerFeature = {
  name: 'Spellcasting',
  entries: [
    'You have learned to channel…',
    {
      type: 'entries',
      entries: [
        { type: 'entries', name: 'Spell Slots', entries: ['…when you finish a Long Rest.'] },
        { type: 'entries', name: 'Prepared Spells of Level 1+', entries: ['choose two…'] },
        { type: 'entries', name: 'Changing Your Prepared Spells', entries: ['…'] },
      ],
    },
  ],
};

const db = {
  'class-warlock': { classFeature: [{ ...warlockFeature, className: 'Warlock', classSource: 'XPHB', level: 1 }] },
  'class-ranger': { classFeature: [{ ...rangerFeature, className: 'Ranger', classSource: 'XPHB', level: 1 }] },
};

const warlockObj = { name: 'Warlock', source: 'XPHB', classFeatures: ['Pact Magic|Warlock|XPHB|1'] };
const rangerObj = { name: 'Ranger', source: 'XPHB', classFeatures: ['Spellcasting|Ranger|XPHB|1'] };
const fighterObj = { name: 'Fighter', source: 'XPHB', classFeatures: [] };

describe('spellcastingFeature', () => {
  it('acha "Pact Magic" do Warlock', () => {
    const f = spellcastingFeature(db, 'warlock', warlockObj);
    expect(f?.name).toBe('Pact Magic');
  });

  it('acha "Spellcasting" do Ranger', () => {
    expect(spellcastingFeature(db, 'ranger', rangerObj)?.name).toBe('Spellcasting');
  });

  it('classe não-conjuradora → null', () => {
    expect(spellcastingFeature({ 'class-fighter': { classFeature: [] } }, 'fighter', fighterObj)).toBe(null);
    expect(spellcastingFeature(db, 'warlock', null)).toBe(null);
  });
});

describe('namedSubEntries', () => {
  it('casa por palavra-chave, sem descer no bloco casado, na ordem', () => {
    const hits = namedSubEntries(warlockFeature.entries, ['prepared spells']);
    // "Prepared Spells of Level 1+" E "Changing Your Prepared Spells".
    expect(hits.map((h) => h.name)).toEqual(['Prepared Spells of Level 1+', 'Changing Your Prepared Spells']);
  });

  it('sem casar → array vazio', () => {
    expect(namedSubEntries(rangerFeature.entries, ['cantrip'])).toEqual([]);
  });
});

describe('cantripEntries', () => {
  it('Warlock tem o bloco Cantrips', () => {
    expect(cantripEntries(warlockFeature).map((e) => e.name)).toEqual(['Cantrips']);
  });

  it('Ranger NÃO tem Cantrips (tela some para ele)', () => {
    expect(cantripEntries(rangerFeature)).toEqual([]);
  });

  it('feature nula → vazio', () => {
    expect(cantripEntries(null)).toEqual([]);
  });
});

describe('spellSlotEntries', () => {
  it('reúne Spell Slots + Prepared + Changing (a explicação de slots e preparação)', () => {
    expect(spellSlotEntries(warlockFeature).map((e) => e.name)).toEqual([
      'Spell Slots',
      'Prepared Spells of Level 1+',
      'Changing Your Prepared Spells',
    ]);
  });

  it('o texto de slots do Warlock cita Short Rest (recuperação difere)', () => {
    const slots = spellSlotEntries(warlockFeature).find((e) => e.name === 'Spell Slots');
    expect(JSON.stringify(slots.entries)).toMatch(/Short Rest/);
  });
});
