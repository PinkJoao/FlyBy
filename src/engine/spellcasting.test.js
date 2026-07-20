import { describe, it, expect } from 'vitest';
import {
  slotContribution,
  leveledCasterLevel,
  spellSlots,
  pactSlots,
  maxPrepareCircle,
  spellSaveDc,
  spellAttackBonus,
  casterInfo,
  cantripLimit,
  prepareLimit,
  isLeveledProgression,
  arcanumLevels,
  preparedElsewhere,
} from './spellcasting';

describe('slotContribution (regra do Foundry: floor/ceil + override single-class)', () => {
  it('full = nível cheio', () => {
    expect(slotContribution('full', 5, { single: true })).toBe(5);
    expect(slotContribution('full', 5, { single: false })).toBe(5);
  });
  it('artificer (Paladin/Ranger 2024) = ceil(nível/2) sempre', () => {
    expect(slotContribution('artificer', 5, { single: true })).toBe(3);
    expect(slotContribution('artificer', 5, { single: false })).toBe(3);
    expect(slotContribution('artificer', 1, { single: true })).toBe(1);
  });
  it('1/3 multiclasse arredonda p/ baixo; single-class p/ cima', () => {
    expect(slotContribution('1/3', 7, { single: false })).toBe(2); // floor(7/3)
    expect(slotContribution('1/3', 7, { single: true })).toBe(3); // ceil(7/3)
  });
  it('1/3 níveis 1-2 não dão slot (guard de truthiness: floor deu 0)', () => {
    expect(slotContribution('1/3', 1, { single: true })).toBe(0);
    expect(slotContribution('1/3', 2, { single: true })).toBe(0);
    expect(slotContribution('1/3', 3, { single: true })).toBe(1);
  });
  it('pact / não-caster não contribuem', () => {
    expect(slotContribution('pact', 5, { single: true })).toBe(0);
    expect(slotContribution(undefined, 5)).toBe(0);
  });
});

describe('leveledCasterLevel', () => {
  it('classe única full', () => {
    expect(leveledCasterLevel([{ code: 'full', level: 5 }])).toBe(5);
  });
  it('Paladin 5 sozinho → 3 (single, ceil)', () => {
    expect(leveledCasterLevel([{ code: 'artificer', level: 5 }])).toBe(3);
  });
  it('Eldritch Knight 7 sozinho → 3 (single override)', () => {
    expect(leveledCasterLevel([{ code: '1/3', level: 7 }])).toBe(3);
  });
  it('multiclasse full+full soma direto', () => {
    expect(leveledCasterLevel([{ code: 'full', level: 3 }, { code: 'full', level: 2 }])).toBe(5);
  });
  it('multiclasse Paladin 5 / Wizard 3 → 3 + 3 = 6', () => {
    expect(leveledCasterLevel([{ code: 'artificer', level: 5 }, { code: 'full', level: 3 }])).toBe(6);
  });
  it('multiclasse EK 6 / Wizard 2 → floor(6/3)=2 + 2 = 4 (não é single)', () => {
    expect(leveledCasterLevel([{ code: '1/3', level: 6 }, { code: 'full', level: 2 }])).toBe(4);
  });
  it('pact não entra na conta leveled', () => {
    expect(leveledCasterLevel([{ code: 'pact', level: 5 }, { code: 'full', level: 2 }])).toBe(2);
  });
});

describe('spellSlots (SPELL_SLOT_TABLE)', () => {
  it('Wizard 5 → 4/3/2', () => {
    expect(spellSlots(5)).toEqual({ 1: 4, 2: 3, 3: 2 });
  });
  it('Paladin 5 (nível de conjurador 3) → 4/2', () => {
    expect(spellSlots(3)).toEqual({ 1: 4, 2: 2 });
  });
  it('EK 3 (nível 1) → 2 slots de 1º', () => {
    expect(spellSlots(1)).toEqual({ 1: 2 });
  });
  it('nível 20 → tabela completa', () => {
    expect(spellSlots(20)).toEqual({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 });
  });
  it('nível 0/negativo → sem slots', () => {
    expect(spellSlots(0)).toEqual({});
    expect(spellSlots(-1)).toEqual({});
  });
  it('acima de 20 satura em 20', () => {
    expect(spellSlots(25)).toEqual(spellSlots(20));
  });
});

describe('maxPrepareCircle (teto pelo nível INDIVIDUAL da classe)', () => {
  it('full caster: o círculo da própria tabela', () => {
    expect(maxPrepareCircle('full', 1)).toBe(1);
    expect(maxPrepareCircle('full', 2)).toBe(1);
    expect(maxPrepareCircle('full', 5)).toBe(3);
    expect(maxPrepareCircle('full', 20)).toBe(9);
  });
  it('meio-caster arredonda p/ cima sozinho (Paladin/Ranger 1 já conjuram no XPHB)', () => {
    expect(maxPrepareCircle('1/2', 1)).toBe(1);
    expect(maxPrepareCircle('1/2', 5)).toBe(2);
  });
  it('1/3 (EK/AT) só a partir do nível 3', () => {
    expect(maxPrepareCircle('1/3', 2)).toBe(0);
    expect(maxPrepareCircle('1/3', 3)).toBe(1);
  });
  it('sem progressão / nível 0 → 0', () => {
    expect(maxPrepareCircle(null, 5)).toBe(0);
    expect(maxPrepareCircle('full', 0)).toBe(0);
  });
});

describe('pactSlots', () => {
  it('Warlock 1 → 1 slot de 1º', () => {
    expect(pactSlots(1)).toEqual({ slots: 1, level: 1 });
  });
  it('Warlock 5 → 2 slots de 3º (maior chave ≤ 5)', () => {
    expect(pactSlots(5)).toEqual({ slots: 2, level: 3 });
  });
  it('Warlock 11 → 3 slots de 5º; 17 → 4 slots de 5º', () => {
    expect(pactSlots(11)).toEqual({ slots: 3, level: 5 });
    expect(pactSlots(17)).toEqual({ slots: 4, level: 5 });
  });
  it('nível 0 → null', () => {
    expect(pactSlots(0)).toBeNull();
  });
});

describe('DC e ataque', () => {
  it('spellSaveDc = 8 + prof + mod', () => {
    expect(spellSaveDc(3, 4)).toBe(15);
  });
  it('spellAttackBonus = prof + mod', () => {
    expect(spellAttackBonus(3, 4)).toBe(7);
  });
});

describe('casterInfo + limites', () => {
  const wizard = {
    name: 'Wizard', casterProgression: 'full', spellcastingAbility: 'int',
    cantripProgression: [3, 3, 3, 4, 4], preparedSpellsProgression: [4, 5, 6, 7, 9],
  };
  const fighter = { name: 'Fighter' };
  const eldritchKnight = {
    name: 'Eldritch Knight', casterProgression: '1/3', spellcastingAbility: 'int',
    cantripProgression: [0, 0, 2, 2, 2], preparedSpellsProgression: [0, 0, 3, 4, 4],
    additionalSpells: [{ expanded: { 3: [{ all: 'level=0|class=Wizard' }] } }],
  };

  it('classe conjuradora → lê da classe', () => {
    const info = casterInfo(wizard, null);
    expect(info).toMatchObject({ code: 'full', ability: 'int', source: 'class' });
  });
  it('subclasse conjuradora (EK) → lê da subclasse', () => {
    const info = casterInfo(fighter, eldritchKnight);
    expect(info).toMatchObject({ code: '1/3', ability: 'int', source: 'subclass' });
  });
  it('classe não-conjuradora sem subclasse conjuradora → null', () => {
    expect(casterInfo(fighter, null)).toBeNull();
  });
  it('cantripLimit e prepareLimit lêem a progressão no nível', () => {
    const info = casterInfo(wizard, null);
    expect(cantripLimit(info, 4)).toBe(4);
    expect(prepareLimit(info, 5)).toBe(9);
    // EK nível 3 (índice 2)
    const ek = casterInfo(fighter, eldritchKnight);
    expect(cantripLimit(ek, 3)).toBe(2);
    expect(prepareLimit(ek, 3)).toBe(3);
  });
});

describe('isLeveledProgression', () => {
  it('full/artificer/1-3 sim; pact/undefined não', () => {
    expect(isLeveledProgression('full')).toBe(true);
    expect(isLeveledProgression('artificer')).toBe(true);
    expect(isLeveledProgression('1/3')).toBe(true);
    expect(isLeveledProgression('pact')).toBe(false);
    expect(isLeveledProgression(undefined)).toBe(false);
  });
});

describe('arcanumLevels - Mystic Arcanum (Warlock)', () => {
  it('nada antes do nível 11', () => {
    expect(arcanumLevels('pact', 10)).toEqual([]);
  });
  it('destrava 6/7/8/9 nos níveis 11/13/15/17', () => {
    expect(arcanumLevels('pact', 11)).toEqual([6]);
    expect(arcanumLevels('pact', 12)).toEqual([6]);
    expect(arcanumLevels('pact', 13)).toEqual([6, 7]);
    expect(arcanumLevels('pact', 15)).toEqual([6, 7, 8]);
    expect(arcanumLevels('pact', 20)).toEqual([6, 7, 8, 9]);
  });
  it('só vale para conjuradores de pacto', () => {
    expect(arcanumLevels('full', 20)).toEqual([]);
    expect(arcanumLevels(null, 20)).toEqual([]);
  });
});

describe('preparedElsewhere (TC-0031) - magias de OUTRAS origens', () => {
  const origins = [
    {
      key: 'class:cleric',
      label: 'Cleric',
      cantrips: [{ raw: { name: 'Toll the Dead' } }],
      prepared: [{ raw: { name: 'Bane' } }],
      alwaysPrepared: [{ raw: { name: 'Bless' } }],
    },
    {
      key: 'feat:magic-initiate',
      label: 'Magic Initiate',
      alwaysPrepared: [{ raw: { name: 'Guidance' } }, { raw: { name: 'Bless' } }],
    },
    {
      key: 'class:warlock',
      label: 'Warlock',
      cantrips: [],
      prepared: [],
      arcanumSpells: [{ raw: { name: 'Foresight' } }],
    },
  ];

  it('mapeia nome (minúsculo) → rótulo da origem, excluindo a origem editada', () => {
    const map = preparedElsewhere(origins, 'class:warlock');
    expect(map.get('toll the dead')).toBe('Cleric');
    expect(map.get('guidance')).toBe('Magic Initiate');
    expect(map.has('foresight')).toBe(false); // a própria origem fica de fora
  });

  it('primeira origem encontrada dá o rótulo; inclui arcanum; vazio sem origens', () => {
    const map = preparedElsewhere(origins, 'feat:magic-initiate');
    expect(map.get('bless')).toBe('Cleric'); // Cleric vem antes do feat
    expect(map.get('foresight')).toBe('Warlock');
    expect(preparedElsewhere([], 'x').size).toBe(0);
    expect(preparedElsewhere(undefined, 'x').size).toBe(0);
  });
});
