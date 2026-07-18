import { describe, it, expect } from 'vitest';
import {
  schoolName,
  allSpells,
  resolveSpellObj,
  ordinalLevel,
  spellLevelLabel,
  castingTimeLabel,
  castingTimeRank,
  rangeLabel,
  rangeRank,
  componentsText,
  materialText,
  saveOrAttack,
  isRitual,
  isConcentration,
  classSpellList,
  spellClassIndex,
  classDisplayName,
} from './spells';

// Fixtures reproduzindo as formas reais do 5etools (XPHB).
const fireball = {
  name: 'Fireball', source: 'XPHB', level: 3, school: 'V',
  time: [{ number: 1, unit: 'action' }],
  range: { type: 'point', distance: { type: 'feet', amount: 150 } },
  duration: [{ type: 'instant' }],
  components: { v: true, s: true, m: 'a ball of bat guano and sulfur' },
  savingThrow: ['dexterity'], damageInflict: ['fire'],
};
const cureWounds = {
  name: 'Cure Wounds', source: 'XPHB', level: 1, school: 'A',
  time: [{ number: 1, unit: 'action' }],
  range: { type: 'point', distance: { type: 'touch' } },
  duration: [{ type: 'instant' }],
  components: { v: true, s: true },
};
const fireBolt = {
  name: 'Fire Bolt', source: 'XPHB', level: 0, school: 'V',
  time: [{ number: 1, unit: 'action' }],
  range: { type: 'point', distance: { type: 'feet', amount: 120 } },
  duration: [{ type: 'instant' }],
  components: { v: true, s: true },
  spellAttack: ['R'],
};
const alarm = {
  name: 'Alarm', source: 'XPHB', level: 1, school: 'A',
  time: [{ number: 1, unit: 'minute' }],
  range: { type: 'point', distance: { type: 'feet', amount: 30 } },
  duration: [{ type: 'timed', duration: { type: 'hour', amount: 8 } }],
  components: { v: true, s: true, m: 'a bell and silver wire' },
  meta: { ritual: true },
};
const bless = {
  name: 'Bless', source: 'XPHB', level: 1, school: 'A',
  time: [{ number: 1, unit: 'action' }],
  range: { type: 'point', distance: { type: 'feet', amount: 30 } },
  duration: [{ type: 'timed', concentration: true, duration: { type: 'minute', amount: 1 } }],
  components: { v: true, s: true, m: 'a sprinkling of holy water' },
  savingThrow: null,
};
const burningHands = {
  name: 'Burning Hands', source: 'XPHB', level: 1, school: 'V',
  time: [{ number: 1, unit: 'action' }],
  range: { type: 'cone', distance: { type: 'feet', amount: 15 } },
  duration: [{ type: 'instant' }],
  components: { v: true, s: true },
  savingThrow: ['dexterity'],
};
// Reprint: PHB Fireball marcado como republicado em XPHB → escondido por latestOnly.
const fireballPhb = { name: 'Fireball', source: 'PHB', level: 3, school: 'V', reprintedAs: ['Fireball|XPHB'] };

const db = {
  'spells-xphb': { spell: [fireball, cureWounds, fireBolt, alarm, bless, burningHands] },
  'spells-phb': { spell: [fireballPhb] },
  'spell-sources': {
    XPHB: {
      Fireball: { class: [{ name: 'Sorcerer', source: 'XPHB' }, { name: 'Wizard', source: 'XPHB' }] },
      'Cure Wounds': { class: [{ name: 'Cleric', source: 'XPHB' }, { name: 'Druid', source: 'XPHB' }] },
      'Fire Bolt': { class: [{ name: 'Sorcerer', source: 'XPHB' }, { name: 'Wizard', source: 'XPHB' }] },
    },
    PHB: {
      Fireball: { class: [{ name: 'Wizard', source: 'PHB' }] },
    },
  },
};

describe('schoolName', () => {
  it('mapeia códigos de escola', () => {
    expect(schoolName('V')).toBe('Evocation');
    expect(schoolName('A')).toBe('Abjuration');
  });
  it('código desconhecido volta como está, sem quebrar', () => {
    expect(schoolName('Z')).toBe('Z');
    expect(schoolName(undefined)).toBe('');
  });
});

describe('allSpells + dedup de reprint', () => {
  it('concatena todos os arquivos e esconde reprints (só 1 Fireball, o XPHB)', () => {
    const list = allSpells(db);
    const fbs = list.filter((s) => s.name === 'Fireball');
    expect(fbs).toHaveLength(1);
    expect(fbs[0].source).toBe('XPHB');
    expect(list).toHaveLength(6); // os 6 do XPHB; o PHB é reprint
  });
  it('db vazio → lista vazia', () => {
    expect(allSpells(null)).toEqual([]);
    expect(allSpells({})).toEqual([]);
  });
});

describe('resolveSpellObj', () => {
  it('resolve por nome+fonte', () => {
    expect(resolveSpellObj(db, 'Fireball', 'XPHB')).toBe(fireball);
  });
  it('resolve por nome quando a fonte não bate (cai na versão atual)', () => {
    expect(resolveSpellObj(db, 'Fireball', 'PHB')).toBe(fireball);
  });
  it('inexistente → null', () => {
    expect(resolveSpellObj(db, 'Wish', 'XPHB')).toBeNull();
  });
});

describe('rótulos de nível', () => {
  it('ordinalLevel', () => {
    expect(ordinalLevel(1)).toBe('1st');
    expect(ordinalLevel(3)).toBe('3rd');
  });
  it('spellLevelLabel: cantrip vs nível', () => {
    expect(spellLevelLabel(0)).toBe('Cantrips');
    expect(spellLevelLabel(1)).toBe('1st Level');
    expect(spellLevelLabel(9)).toBe('9th Level');
  });
});

describe('tempo de conjuração', () => {
  it('castingTimeLabel', () => {
    expect(castingTimeLabel(fireball)).toBe('1 Action');
    expect(castingTimeLabel(alarm)).toBe('1 Minute');
    expect(castingTimeLabel({ time: [{ number: 10, unit: 'minute' }] })).toBe('10 Minutes');
    expect(castingTimeLabel({ time: [{ number: 1, unit: 'bonus' }] })).toBe('1 Bonus Action');
  });
  it('castingTimeRank ordena ação antes de minuto', () => {
    expect(castingTimeRank(fireball)).toBeLessThan(castingTimeRank(alarm));
  });
});

describe('alcance', () => {
  it('rangeLabel: pés, toque, cone a partir de si', () => {
    expect(rangeLabel(fireball)).toBe('150 feet');
    expect(rangeLabel(cureWounds)).toBe('Touch');
    expect(rangeLabel(burningHands)).toBe('Self (15-foot cone)');
  });
  it('rangeRank: touch antes de 30ft antes de 150ft', () => {
    expect(rangeRank(cureWounds)).toBeLessThan(rangeRank(bless));
    expect(rangeRank(bless)).toBeLessThan(rangeRank(fireball));
  });
});

describe('componentes e materiais', () => {
  it('componentsText', () => {
    expect(componentsText(fireball)).toBe('V, S, M');
    expect(componentsText(cureWounds)).toBe('V, S');
  });
  it('materialText', () => {
    expect(materialText(fireball)).toBe('a ball of bat guano and sulfur');
    expect(materialText(cureWounds)).toBeNull();
  });
});

describe('saveOrAttack', () => {
  it('ataque à distância', () => {
    expect(saveOrAttack(fireBolt)).toEqual({ kind: 'attack', detail: 'Ranged' });
  });
  it('save de destreza', () => {
    expect(saveOrAttack(fireball)).toEqual({ kind: 'save', detail: 'Dexterity' });
  });
  it('nenhum (Cure Wounds)', () => {
    expect(saveOrAttack(cureWounds)).toEqual({ kind: 'none', detail: null });
  });
});

describe('ritual e concentração', () => {
  it('isRitual', () => {
    expect(isRitual(alarm)).toBe(true);
    expect(isRitual(fireball)).toBe(false);
  });
  it('isConcentration', () => {
    expect(isConcentration(bless)).toBe(true);
    expect(isConcentration(fireball)).toBe(false);
  });
});

describe('classSpellList', () => {
  it('lista do Wizard (por nome, qualquer fonte) inclui Fireball e Fire Bolt, não Cure Wounds', () => {
    const wiz = classSpellList(db, 'Wizard');
    expect(wiz.has('fireball')).toBe(true);
    expect(wiz.has('fire bolt')).toBe(true);
    expect(wiz.has('cure wounds')).toBe(false);
  });
  it('lista do Cleric inclui Cure Wounds', () => {
    const cle = classSpellList(db, 'Cleric');
    expect(cle.has('cure wounds')).toBe(true);
    expect(cle.has('fireball')).toBe(false);
  });
  it('sem db/classe → conjunto vazio', () => {
    expect(classSpellList(null, 'Wizard').size).toBe(0);
    expect(classSpellList(db, '').size).toBe(0);
  });
});

describe('classDisplayName', () => {
  it('capitaliza o classId', () => {
    expect(classDisplayName('wizard')).toBe('Wizard');
    expect(classDisplayName('')).toBe('');
  });
});

describe('spellClassIndex', () => {
  const dbIdx = {
    'spell-sources': {
      XPHB: {
        Fireball: { class: [{ name: 'Wizard' }, { name: 'Sorcerer' }] },
        Hex: { class: [{ name: 'Warlock' }] },
      },
      PHB: {
        Fireball: { class: [{ name: 'Wizard' }] }, // reprint: mesma magia, outra fonte
      },
    },
  };

  it('mapeia nome (minúsculo) → classes, ordenadas e sem repetir', () => {
    const idx = spellClassIndex(dbIdx);
    expect(idx.get('fireball')).toEqual(['Sorcerer', 'Wizard']);
    expect(idx.get('hex')).toEqual(['Warlock']);
  });

  it('funde as classes de fontes diferentes da mesma magia', () => {
    const idx = spellClassIndex({
      'spell-sources': {
        XPHB: { Light: { class: [{ name: 'Cleric' }] } },
        PHB: { Light: { class: [{ name: 'Bard' }] } },
      },
    });
    expect(idx.get('light')).toEqual(['Bard', 'Cleric']);
  });

  it('sem o mapa, índice vazio', () => {
    expect(spellClassIndex({}).size).toBe(0);
  });
});
