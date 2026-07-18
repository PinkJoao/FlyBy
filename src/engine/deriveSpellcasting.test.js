import { describe, it, expect } from 'vitest';
import { createCharacter, createClassEntry } from '../schema/character';
import { deriveSpellcasting } from './resolve';

// Objetos de classe mínimos no formato 5etools, com os campos de conjuração.
const wizardClass = {
  name: 'Wizard', source: 'XPHB', casterProgression: 'full', spellcastingAbility: 'int',
  cantripProgression: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5],
  preparedSpellsProgression: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15],
  hd: { faces: 6 },
};
const fighterClass = { name: 'Fighter', source: 'XPHB', hd: { faces: 10 } };
const eldritchKnight = {
  name: 'Eldritch Knight', shortName: 'Eldritch Knight', className: 'Fighter', source: 'XPHB',
  casterProgression: '1/3', spellcastingAbility: 'int',
  cantripProgression: [0, 0, 2, 2, 2, 2, 2, 2, 2, 3],
  preparedSpellsProgression: [0, 0, 3, 4, 4, 4, 5, 6, 6, 7],
  additionalSpells: [{ expanded: { 3: [{ all: 'level=0|class=Wizard' }] } }],
};
const warlockClass = {
  name: 'Warlock', source: 'XPHB', casterProgression: 'pact', spellcastingAbility: 'cha',
  cantripProgression: [2, 2, 2, 3, 3], preparedSpellsProgression: [2, 3, 4, 5, 6],
  hd: { faces: 8 },
};

const fireBolt = { name: 'Fire Bolt', source: 'XPHB', level: 0, school: 'V' };
const fireball = { name: 'Fireball', source: 'XPHB', level: 3, school: 'V' };
const mageArmor = { name: 'Mage Armor', source: 'XPHB', level: 1, school: 'A' };

const db = {
  'class-wizard': { class: [wizardClass], subclass: [] },
  'class-fighter': { class: [fighterClass], subclass: [eldritchKnight] },
  'class-warlock': { class: [warlockClass], subclass: [] },
  'spells-xphb': { spell: [fireBolt, fireball, mageArmor] },
  'spell-sources': {
    XPHB: {
      Fireball: { class: [{ name: 'Wizard' }, { name: 'Sorcerer' }] },
      'Fire Bolt': { class: [{ name: 'Wizard' }] },
    },
  },
};

const derivedCtx = { profBonus: 3, modifiers: { int: 4, cha: 3, str: 0, dex: 2, con: 1, wis: 0 } };

function wizardChar(level, spells = []) {
  const ch = createCharacter();
  ch.classes = [{ ...createClassEntry(true), classId: 'wizard', source: 'XPHB', level, spells }];
  return ch;
}

describe('deriveSpellcasting - Wizard puro', () => {
  const ch = wizardChar(5, [
    { id: 'Fire Bolt', source: 'XPHB' },
    { id: 'Fireball', source: 'XPHB' },
  ]);
  const sc = deriveSpellcasting(ch, db, derivedCtx);
  const wiz = sc.origins[0];

  it('uma origem de classe, Wizard', () => {
    expect(sc.origins).toHaveLength(1);
    expect(wiz).toMatchObject({ key: 'class:wizard', kind: 'class', label: 'Wizard', ability: 'int' });
  });
  it('DC e ataque de magia', () => {
    expect(wiz.saveDc).toBe(15); // 8+3+4
    expect(wiz.attackBonus).toBe(7); // 3+4
  });
  it('limites lêem a progressão no nível 5', () => {
    expect(wiz.cantripLimit).toBe(4);
    expect(wiz.prepareLimit).toBe(9);
  });
  it('slots leveled (nível de conjurador 5)', () => {
    expect(sc.casterLevel).toBe(5);
    expect(sc.slots).toEqual({ 1: 4, 2: 3, 3: 2 });
    expect(wiz.slots).toEqual({ 1: 4, 2: 3, 3: 2 });
    expect(wiz.pactSlots).toBeNull();
  });
  it('separa cantrips (nv0) das magias de círculo, resolvidas', () => {
    expect(wiz.cantrips.map((s) => s.raw.name)).toEqual(['Fire Bolt']);
    expect(wiz.prepared.map((s) => s.raw.name)).toEqual(['Fireball']);
  });
  it('lista padrão do filtro = Wizard', () => {
    expect(wiz.spellListClass).toBe('Wizard');
  });
});

describe('deriveSpellcasting - Eldritch Knight (conjura pela subclasse)', () => {
  const ch = createCharacter();
  ch.classes = [{
    ...createClassEntry(true), classId: 'fighter', source: 'XPHB', level: 7,
    subclassId: 'Eldritch Knight', subclassSource: 'XPHB', spells: [],
  }];
  const sc = deriveSpellcasting(ch, db, derivedCtx);

  it('vira origem conjuradora com nível de conjurador single (ceil 7/3 = 3)', () => {
    expect(sc.origins).toHaveLength(1);
    expect(sc.casterLevel).toBe(3);
    expect(sc.slots).toEqual({ 1: 4, 2: 2 });
  });
  it('usa a lista de magias do Wizard (additionalSpells class=Wizard)', () => {
    expect(sc.origins[0].spellListClass).toBe('Wizard');
    expect(sc.origins[0].casterCode).toBe('1/3');
  });
});

describe('deriveSpellcasting - Fighter sem subclasse conjuradora', () => {
  it('não gera origem nem slots', () => {
    const ch = createCharacter();
    ch.classes = [{ ...createClassEntry(true), classId: 'fighter', source: 'XPHB', level: 5 }];
    const sc = deriveSpellcasting(ch, db, derivedCtx);
    expect(sc.origins).toHaveLength(0);
    expect(sc.slots).toEqual({});
  });
});

describe('deriveSpellcasting - multiclasse Wizard 3 / Warlock 2', () => {
  const ch = createCharacter();
  ch.classes = [
    { ...createClassEntry(true), classId: 'wizard', source: 'XPHB', level: 3, spells: [] },
    { ...createClassEntry(false), classId: 'warlock', source: 'XPHB', level: 2, spells: [] },
  ];
  const sc = deriveSpellcasting(ch, db, derivedCtx);

  it('duas origens: Wizard (leveled) e Warlock (pact)', () => {
    expect(sc.origins.map((o) => o.classId)).toEqual(['wizard', 'warlock']);
  });
  it('slots leveled só do Wizard (single, nível 3); Warlock não entra', () => {
    expect(sc.casterLevel).toBe(3);
    expect(sc.slots).toEqual({ 1: 4, 2: 2 });
  });
  it('Warlock carrega pactSlots e slots leveled vazios', () => {
    const wl = sc.origins.find((o) => o.classId === 'warlock');
    expect(wl.isPact).toBe(true);
    expect(wl.pactSlots).toEqual({ slots: 2, level: 1 });
    expect(wl.slots).toEqual({});
    expect(wl.ability).toBe('cha');
    expect(wl.saveDc).toBe(14); // 8+3+3(cha)
  });
  it('a origem do Wizard recebe os slots leveled compartilhados', () => {
    const wiz = sc.origins.find((o) => o.classId === 'wizard');
    expect(wiz.slots).toEqual({ 1: 4, 2: 2 });
    expect(wiz.pactSlots).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// B2.3 - magias CONCEDIDAS (sempre preparadas) e origens raça/talento
// ---------------------------------------------------------------------------

const lightDomain = {
  name: 'Life Domain', shortName: 'Life', className: 'Cleric', source: 'XPHB',
  prepared: undefined,
  additionalSpells: [{ prepared: { 3: ['bless|xphb'], 5: ['revivify|xphb'] } }],
};
const clericClass = {
  name: 'Cleric', source: 'XPHB', casterProgression: 'full', spellcastingAbility: 'wis',
  cantripProgression: [3, 3, 3, 4], preparedSpellsProgression: [4, 5, 6, 7, 9],
  hd: { faces: 8 },
};
const drowElf = {
  name: 'Elf', source: 'XPHB',
  additionalSpells: [{
    known: { 1: ['dancing lights|xphb#c'] },
    innate: { 3: { daily: { 1: ['faerie fire|xphb'] } } },
    ability: { choose: ['int', 'wis', 'cha'] },
  }],
};
const magicInitiate = {
  name: 'Magic Initiate', source: 'XPHB', ability: 'wis',
  additionalSpells: [{ ability: 'wis', prepared: { _: ['bless|xphb'] } }],
};

const bless = { name: 'Bless', source: 'XPHB', level: 1, school: 'E' };
const revivify = { name: 'Revivify', source: 'XPHB', level: 3, school: 'N' };
const dancingLights = { name: 'Dancing Lights', source: 'XPHB', level: 0, school: 'I' };
const faerieFire = { name: 'Faerie Fire', source: 'XPHB', level: 1, school: 'V' };

const dbG = {
  ...db,
  'class-cleric': { class: [clericClass], subclass: [lightDomain] },
  'spells-xphb': { spell: [fireBolt, fireball, mageArmor, bless, revivify, dancingLights, faerieFire] },
  races: { race: [drowElf] },
  feats: { feat: [magicInitiate] },
};
const ctxG = { ...derivedCtx, level: 5 };

describe('deriveSpellcasting - magias concedidas pela subclasse (R2/R12)', () => {
  const ch = createCharacter();
  ch.classes = [{
    ...createClassEntry(true), classId: 'cleric', source: 'XPHB', level: 5,
    subclassId: 'Life', subclassSource: 'XPHB', spells: [],
  }];
  const sc = deriveSpellcasting(ch, dbG, ctxG);

  it('ficam DENTRO da origem da classe, não numa aba própria', () => {
    expect(sc.origins).toHaveLength(1);
    expect(sc.origins[0].key).toBe('class:cleric');
  });
  it('resolvidas, marcadas como granted e fora das preparadas do jogador', () => {
    const granted = sc.origins[0].alwaysPrepared;
    expect(granted.map((s) => s.raw.name)).toEqual(['Bless', 'Revivify']);
    expect(granted.every((s) => s.granted && s.castMode === 'prepared')).toBe(true);
    expect(sc.origins[0].prepared).toHaveLength(0);
  });
  it('uma magia concedida que o jogador TAMBÉM preparou não duplica nem conta', () => {
    const ch2 = createCharacter();
    ch2.classes = [{
      ...createClassEntry(true), classId: 'cleric', source: 'XPHB', level: 5,
      subclassId: 'Life', subclassSource: 'XPHB',
      spells: [{ id: 'Bless', source: 'XPHB' }, { id: 'Fireball', source: 'XPHB' }],
    }];
    const o = deriveSpellcasting(ch2, dbG, ctxG).origins[0];
    expect(o.prepared.map((s) => s.raw.name)).toEqual(['Fireball']); // Bless veio da subclasse
    expect(o.alwaysPrepared.map((s) => s.raw.name)).toContain('Bless');
  });
  it('usam o nível da CLASSE (não o do personagem)', () => {
    const ch2 = createCharacter();
    ch2.classes = [{
      ...createClassEntry(true), classId: 'cleric', source: 'XPHB', level: 3,
      subclassId: 'Life', subclassSource: 'XPHB', spells: [],
    }];
    const only = deriveSpellcasting(ch2, dbG, ctxG).origins[0].alwaysPrepared;
    expect(only.map((s) => s.raw.name)).toEqual(['Bless']);
  });
});

describe('deriveSpellcasting - origem RACIAL (linhagem)', () => {
  const ch = createCharacter();
  ch.species = { id: 'elf', source: 'XPHB' };
  ch.classes = [{ ...createClassEntry(true), classId: 'fighter', source: 'XPHB', level: 5 }];
  const sc = deriveSpellcasting(ch, dbG, ctxG);

  it('gera uma origem `race` mesmo sem classe conjuradora', () => {
    expect(sc.origins.map((o) => o.key)).toEqual(['race']);
    expect(sc.origins[0]).toMatchObject({ kind: 'race', label: 'Elf' });
  });
  it('rotula a linhagem pela parte depois do ";" ("Elf; Drow Lineage" → "Drow Lineage")', () => {
    const lineageDb = { ...dbG, races: { race: [{ ...drowElf, name: 'Elf; Drow Lineage' }] } };
    const chL = createCharacter();
    chL.species = { id: 'elf', source: 'XPHB' };
    // resolveRaceObj casa por nome; aqui a própria entrada já é a variante.
    const sc2 = deriveSpellcasting({ ...chL, species: { id: 'Elf; Drow Lineage', source: 'XPHB' } }, lineageDb, ctxG);
    expect(sc2.origins[0].label).toBe('Drow Lineage');
  });
  it('só magias concedidas: sem slots, sem limites de preparação', () => {
    const race = sc.origins[0];
    expect(race.slots).toEqual({});
    expect(race.prepareLimit).toBe(0);
    expect(race.cantripLimit).toBe(0);
    expect(race.alwaysPrepared.map((s) => s.raw.name)).toEqual(['Dancing Lights', 'Faerie Fire']);
  });
  it('usa o nível do PERSONAGEM (Faerie Fire só a partir do 3)', () => {
    const low = deriveSpellcasting(ch, dbG, { ...ctxG, level: 1 });
    expect(low.origins[0].alwaysPrepared.map((s) => s.raw.name)).toEqual(['Dancing Lights']);
  });
  it('sem DC quando o atributo ainda é uma escolha (B2.4)', () => {
    const race = sc.origins[0];
    expect(race.ability).toBeNull();
    expect(race.saveDc).toBeNull();
    expect(race.abilityChoices).toEqual(['int', 'wis', 'cha']);
  });
});

describe('deriveSpellcasting - origem de TALENTO', () => {
  const ch = createCharacter();
  ch.origin = { originFeat: { id: 'Magic Initiate', source: 'XPHB' } };
  ch.classes = [{ ...createClassEntry(true), classId: 'fighter', source: 'XPHB', level: 5 }];
  const sc = deriveSpellcasting(ch, dbG, ctxG);

  it('uma origem por talento que concede magias, com DC do atributo fixo', () => {
    expect(sc.origins).toHaveLength(1);
    expect(sc.origins[0]).toMatchObject({
      key: 'feat:Magic Initiate|XPHB', kind: 'feat', label: 'Magic Initiate', ability: 'wis',
    });
    expect(sc.origins[0].saveDc).toBe(11); // 8 + 3 + 0 (wis)
    expect(sc.origins[0].alwaysPrepared.map((s) => s.raw.name)).toEqual(['Bless']);
  });
});

describe('deriveSpellcasting - nenhuma magia concedida, nenhuma origem', () => {
  it('Fighter sem espécie mágica nem talento', () => {
    const ch = createCharacter();
    ch.classes = [{ ...createClassEntry(true), classId: 'fighter', source: 'XPHB', level: 5 }];
    expect(deriveSpellcasting(ch, dbG, ctxG).origins).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// B2.4 - atributo de conjuração ESCOLHIDO + card de usos
// ---------------------------------------------------------------------------

describe('deriveSpellcasting - atributo de conjuração escolhido (choice-bag)', () => {
  const baseChar = () => {
    const ch = createCharacter();
    ch.species = { id: 'elf', source: 'XPHB', choices: {} };
    ch.classes = [{ ...createClassEntry(true), classId: 'fighter', source: 'XPHB', level: 5 }];
    return ch;
  };

  it('sem escolha: nenhum DC (não se chuta a decisão)', () => {
    const race = deriveSpellcasting(baseChar(), dbG, ctxG).origins[0];
    expect(race.ability).toBeNull();
    expect(race.saveDc).toBeNull();
    expect(race.attackBonus).toBeNull();
  });

  it('com a escolha feita: DC e ataque derivam do atributo escolhido', () => {
    const ch = baseChar();
    ch.species.choices = { 'spellAbility-0': { kind: 'spellAbility', picks: ['int'] } };
    const race = deriveSpellcasting(ch, dbG, ctxG).origins[0];
    expect(race.ability).toBe('int');
    expect(race.saveDc).toBe(15); // 8 + 3 + 4 (int)
    expect(race.attackBonus).toBe(7);
  });

  it('o atributo fixo do dado vence a escolha (talento com ability: "wis")', () => {
    const ch = createCharacter();
    ch.origin = { originFeat: { id: 'Magic Initiate', source: 'XPHB', choices: { 'spellAbility-0': { kind: 'spellAbility', picks: ['cha'] } } } };
    ch.classes = [{ ...createClassEntry(true), classId: 'fighter', source: 'XPHB', level: 5 }];
    expect(deriveSpellcasting(ch, dbG, ctxG).origins[0].ability).toBe('wis');
  });

  it('a escolha de um TALENTO não vaza para a origem racial', () => {
    const ch = baseChar();
    // Um feat escolhido DENTRO da espécie carrega sua própria sub-bag.
    ch.species.choices = {
      'feat-0': { kind: 'feat', picks: ['Magic Initiate|XPHB'], sub: { 'Magic Initiate|XPHB': { 'spellAbility-0': { kind: 'spellAbility', picks: ['cha'] } } } },
    };
    const race = deriveSpellcasting(ch, dbG, ctxG).origins.find((o) => o.kind === 'race');
    expect(race.ability).toBeNull();
  });
});

describe('deriveSpellcasting - usos por dia/descanso (card de Uses)', () => {
  it('a origem racial expõe os usos das magias inatas', () => {
    const ch = createCharacter();
    ch.species = { id: 'elf', source: 'XPHB', choices: {} };
    ch.classes = [{ ...createClassEntry(true), classId: 'fighter', source: 'XPHB', level: 5 }];
    const race = deriveSpellcasting(ch, dbG, ctxG).origins[0];
    expect(race.uses).toEqual([{ name: 'Faerie Fire', label: '1/Day', note: null }]);
  });

  it('magias concedidas que usam slots não geram usos', () => {
    const ch = createCharacter();
    ch.classes = [{
      ...createClassEntry(true), classId: 'cleric', source: 'XPHB', level: 5,
      subclassId: 'Life', subclassSource: 'XPHB', spells: [],
    }];
    expect(deriveSpellcasting(ch, dbG, ctxG).origins[0].uses).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Warlock: Pact Magic + Mystic Arcanum (edge case dos círculos 6-9)
// ---------------------------------------------------------------------------

const eldritchBlast = { name: 'Eldritch Blast', source: 'XPHB', level: 0, school: 'V' };
const hex = { name: 'Hex', source: 'XPHB', level: 1, school: 'E' };
const trueSeeing = { name: 'True Seeing', source: 'XPHB', level: 6, school: 'D' };
const forcecage = { name: 'Forcecage', source: 'XPHB', level: 7, school: 'V' };

const dbW = {
  ...db,
  'spells-xphb': { spell: [fireBolt, fireball, mageArmor, eldritchBlast, hex, trueSeeing, forcecage] },
};

function warlock(level, spells = []) {
  const ch = createCharacter();
  ch.classes = [{ ...createClassEntry(true), classId: 'warlock', source: 'XPHB', level, spells }];
  return ch;
}
const ctxW = { ...derivedCtx, level: 20 };

describe('deriveSpellcasting - Mystic Arcanum', () => {
  it('abaixo do nível 11 não há arcanum, e o teto de preparação é o do pacto', () => {
    const o = deriveSpellcasting(warlock(9), dbW, ctxW).origins[0];
    expect(o.arcanumLevels).toEqual([]);
    expect(o.arcana).toEqual([]);
    expect(o.maxPrepareLevel).toBe(5); // pacto trava no 5º círculo
  });

  it('nível 13: dois arcana (6º e 7º), vazios enquanto não se escolhe', () => {
    const o = deriveSpellcasting(warlock(13), dbW, ctxW).origins[0];
    expect(o.arcanumLevels).toEqual([6, 7]);
    expect(o.arcana.map((a) => [a.level, a.spell])).toEqual([[6, null], [7, null]]);
  });

  it('uma magia de 6º círculo preenche o arcanum e NÃO conta como preparada', () => {
    const o = deriveSpellcasting(
      warlock(13, [{ id: 'Hex', source: 'XPHB' }, { id: 'True Seeing', source: 'XPHB' }]),
      dbW,
      ctxW,
    ).origins[0];
    expect(o.prepared.map((s) => s.raw.name)).toEqual(['Hex']);
    expect(o.arcana.find((a) => a.level === 6).spell.raw.name).toBe('True Seeing');
    expect(o.arcana.find((a) => a.level === 7).spell).toBeNull();
  });

  it('a magia de arcanum continua LISTÁVEL (fora das preparadas, não sumida)', () => {
    const o = deriveSpellcasting(warlock(13, [{ id: 'True Seeing', source: 'XPHB' }]), dbW, ctxW).origins[0];
    expect(o.arcanumSpells.map((s) => s.raw.name)).toEqual(['True Seeing']);
    expect(o.prepared).toHaveLength(0);
  });

  it('cantrips seguem no seu próprio balde', () => {
    const o = deriveSpellcasting(warlock(13, [{ id: 'Eldritch Blast', source: 'XPHB' }]), dbW, ctxW).origins[0];
    expect(o.cantrips.map((s) => s.raw.name)).toEqual(['Eldritch Blast']);
    expect(o.prepared).toHaveLength(0);
  });

  it('um caster leveled não ganha arcanum e prepara até o maior círculo de slot', () => {
    const o = deriveSpellcasting(wizardChar(9), dbW, { ...derivedCtx, level: 9 }).origins[0];
    expect(o.arcana).toEqual([]);
    expect(o.maxPrepareLevel).toBe(5); // nível de conjurador 9 → slots até o 5º
  });
});

// ---------------------------------------------------------------------------
// Edge cases: usos escalados (Archfey) e innate sem frequência (Aarakocra)
// ---------------------------------------------------------------------------

const archfeyPatron = {
  name: 'Archfey Patron', shortName: 'Archfey', className: 'Warlock', source: 'XPHB',
  additionalSpells: [{
    prepared: { 3: ['misty step|xphb', 'calm emotions|xphb'] },
    innate: { _: { daily: { cha: ['misty step|xphb'] } } },
  }],
};
const aarakocraRace = {
  name: 'Aarakocra', source: 'MPMM',
  additionalSpells: [{ innate: { 3: ['gust of wind'] }, ability: { choose: ['int', 'wis', 'cha'] } }],
};
const mistyStep = { name: 'Misty Step', source: 'XPHB', level: 2, school: 'C' };
const calmEmotions = { name: 'Calm Emotions', source: 'XPHB', level: 2, school: 'E' };
const gustOfWind = { name: 'Gust of Wind', source: 'XPHB', level: 2, school: 'V' };

const dbE = {
  ...db,
  'class-warlock': { class: [warlockClass], subclass: [archfeyPatron] },
  races: { race: [aarakocraRace] },
  'spells-xphb': { spell: [fireBolt, mageArmor, mistyStep, calmEmotions, gustOfWind] },
};

describe('deriveSpellcasting - Archfey: Misty Step preparada + CHA×/dia', () => {
  const ch = createCharacter();
  ch.classes = [{
    ...createClassEntry(true), classId: 'warlock', source: 'XPHB', level: 3,
    subclassId: 'Archfey', subclassSource: 'XPHB', spells: [],
  }];
  const sc = deriveSpellcasting(ch, dbE, { profBonus: 2, modifiers: { cha: 4 }, level: 3 });
  const wl = sc.origins[0];

  it('uma única linha para Misty Step (não duplica entre buckets)', () => {
    expect(wl.alwaysPrepared.map((s) => s.raw.name)).toEqual(['Misty Step', 'Calm Emotions']);
  });

  it('o card de usos mostra 4/Day, com a nota do modificador', () => {
    expect(wl.uses).toEqual([{ name: 'Misty Step', label: '4/Day', note: 'Charisma modifier' }]);
  });

  it('Calm Emotions não gera uso (gasta espaço de magia)', () => {
    expect(wl.uses.find((u) => u.name === 'Calm Emotions')).toBeUndefined();
  });
});

describe('deriveSpellcasting - Aarakocra: frequência vem do overlay curado (DDL-0011)', () => {
  const ch = createCharacter();
  ch.species = { id: 'aarakocra', source: 'MPMM', choices: {} };
  ch.classes = [{ ...createClassEntry(true), classId: 'fighter', source: 'XPHB', level: 3 }];
  const race = deriveSpellcasting(ch, dbE, { profBonus: 2, modifiers: {}, level: 3 }).origins[0];

  it('o card de usos mostra 1/Long Rest (texto do traço Wind Caller)', () => {
    expect(race.uses).toEqual([{ name: 'Gust of Wind', label: '1/Long Rest', note: null }]);
  });

  it('a magia continua sempre preparada e fora dos contadores', () => {
    expect(race.alwaysPrepared[0].granted).toBe(true);
    expect(race.prepared).toHaveLength(0);
  });
});

describe('deriveSpellcasting - espécie SEM entrada no overlay', () => {
  it('cai no honesto "No Spell Slot" em vez de inventar frequência', () => {
    const homebrew = { name: 'Homebrewfolk', source: 'HB', additionalSpells: [{ innate: { 1: ['gust of wind'] } }] };
    const dbH = { ...dbE, races: { race: [homebrew] } };
    const ch = createCharacter();
    ch.species = { id: 'homebrewfolk', source: 'HB', choices: {} };
    ch.classes = [{ ...createClassEntry(true), classId: 'fighter', source: 'XPHB', level: 3 }];
    const race = deriveSpellcasting(ch, dbH, { profBonus: 2, modifiers: {}, level: 3 }).origins[0];
    expect(race.uses).toEqual([{ name: 'Gust of Wind', label: 'No Spell Slot', note: null }]);
  });
});
