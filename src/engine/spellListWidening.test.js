import { describe, it, expect } from 'vitest';
import { expandedSpellNames, originExtraSpells } from './spellListWidening';

// db mínimo: o mapa reverso (nome → classes) + o catálogo (para o círculo).
const db = {
  'spell-sources': {
    XPHB: {
      Fireball: { class: [{ name: 'Sorcerer' }, { name: 'Wizard' }] },
      'Cure Wounds': { class: [{ name: 'Cleric' }, { name: 'Bard' }] },
      'Guiding Bolt': { class: [{ name: 'Cleric' }] },
      Shield: { class: [{ name: 'Wizard' }] },
    },
  },
  'spells-xphb': {
    spell: [
      { name: 'Fireball', source: 'XPHB', level: 3 },
      { name: 'Cure Wounds', source: 'XPHB', level: 1 },
      { name: 'Guiding Bolt', source: 'XPHB', level: 1 },
      { name: 'Shield', source: 'XPHB', level: 1 },
    ],
  },
};

describe('expandedSpellNames - nomes soltos (patronos de warlock)', () => {
  // Forma real: chaves `sN` = "quando você tiver espaços do círculo N".
  const hexblade = {
    name: 'Hexblade',
    additionalSpells: [{ expanded: { s1: ['shield', 'wrathful smite'], s3: ['blink'] } }],
  };

  it('libera pelo círculo de espaço, não pelo nível de classe', () => {
    const at1 = expandedSpellNames(hexblade, { db, classLevel: 1, maxSlotLevel: 1 });
    expect([...at1].sort()).toEqual(['shield', 'wrathful smite']);
    const at5 = expandedSpellNames(hexblade, { db, classLevel: 5, maxSlotLevel: 3 });
    expect(at5.has('blink')).toBe(true);
  });

  it('nada liberado quando o círculo ainda não chegou', () => {
    expect(expandedSpellNames(hexblade, { db, classLevel: 1, maxSlotLevel: 0 }).size).toBe(0);
  });
});

describe('expandedSpellNames - `{all}` por círculo (Divine Soul)', () => {
  // Forma real: a lista de clérigo entra um círculo por vez, por nível de classe.
  const divineSoul = {
    name: 'Divine Soul',
    additionalSpells: [
      {
        name: 'Good',
        known: { 1: ['cure wounds'] },
        expanded: { 1: [{ all: 'level=1|class=Cleric' }], 5: [{ all: 'level=3|class=Cleric' }] },
      },
      { name: 'Evil', expanded: { 1: [{ all: 'level=1|class=Cleric' }] } },
    ],
  };

  it('acrescenta só as magias de clérigo do círculo liberado', () => {
    const names = expandedSpellNames(divineSoul, { db, classLevel: 1, activeGroup: 'Good' });
    expect([...names].sort()).toEqual(['cure wounds', 'guiding bolt']); // ambas de 1º
    expect(names.has('fireball')).toBe(false); // 3º círculo, e nem é de clérigo
  });

  it('grupos são ALTERNATIVAS: sem a afinidade escolhida, nada alarga', () => {
    expect(expandedSpellNames(divineSoul, { db, classLevel: 5 }).size).toBe(0);
  });
});

describe('originExtraSpells - Magical Secrets do Bardo (vem do dado)', () => {
  // Forma real da CLASSE Bard XPHB: os dois campos do `{all}` são LISTAS.
  const bard = {
    name: 'Bard',
    source: 'XPHB',
    additionalSpells: [
      {
        expanded: {
          10: [{ all: 'level=1|class=Cleric;Druid;Wizard' }],
          s9: [{ all: 'level=3|class=Cleric;Druid;Wizard' }],
        },
      },
    ],
  };

  it('só vale a partir do nível da feature, com badge nomeando a feature', () => {
    expect(originExtraSpells({ db, classObj: bard, classLevel: 9 }).names.size).toBe(0);

    const at10 = originExtraSpells({ db, classObj: bard, classLevel: 10 });
    expect(at10.names.has('guiding bolt')).toBe(true); // Cleric, 1º círculo
    expect(at10.names.has('shield')).toBe(true); // Wizard, 1º círculo
    expect(at10.names.has('fireball')).toBe(false); // 3º círculo, ainda não
    expect(at10.sources.get('shield')).toBe('Magical Secrets');
  });

  it('as classes E os círculos do `{all}` são lidos por inteiro (não só o 1º)', () => {
    const at19 = originExtraSpells({ db, classObj: bard, classLevel: 19, maxSlotLevel: 9 });
    expect(at19.names.has('fireball')).toBe(true); // 3º círculo, via s9
  });

  it('classe sem alargamento nenhum devolve conjuntos vazios', () => {
    const out = originExtraSpells({ db, classObj: { name: 'Fighter', source: 'XPHB' }, classLevel: 20 });
    expect(out.names.size).toBe(0);
    expect(out.sources.size).toBe(0);
  });
});
