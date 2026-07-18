import { describe, it, expect } from 'vitest';
import { createCharacter, createClassEntry } from '../schema/character';
import { deriveSpellcasting } from './resolve';
import {
  buildSpellItem,
  buildSpellItems,
  buildSpellSlots,
  foundryActivation,
  foundryDuration,
  foundryRange,
  foundryProperties,
  foundryMaterials,
  foundryUses,
  foundryPreparation,
} from './foundrySpells';
import { spellPreparation, isPlayerChosenSpell, importSpellsByClass, spellSourceClass, foundryToCharacter } from './foundryImport';
import { assembleFoundryActor } from './foundryActor';

// --- fixtures no formato 5etools -------------------------------------------

const fireball = {
  name: 'Fireball', source: 'XPHB', level: 3, school: 'V',
  time: [{ number: 1, unit: 'action' }],
  range: { type: 'point', distance: { type: 'feet', amount: 150 } },
  components: { v: true, s: true, m: 'a ball of bat guano and sulfur' },
  duration: [{ type: 'instant' }],
  entries: ['A bright streak flashes…'],
  entriesHigherLevel: [{ type: 'entries', name: 'Using a Higher-Level Spell Slot', entries: ['+1d6.'] }],
};
const mistyStep = {
  name: 'Misty Step', source: 'XPHB', level: 2, school: 'C',
  time: [{ number: 1, unit: 'bonus' }],
  range: { type: 'point', distance: { type: 'self' } },
  components: { v: true },
  duration: [{ type: 'instant' }],
};
const bless = {
  name: 'Bless', source: 'XPHB', level: 1, school: 'E',
  time: [{ number: 1, unit: 'action' }],
  range: { type: 'point', distance: { type: 'feet', amount: 30 } },
  components: { v: true, s: true, m: { text: 'a Holy Symbol worth 5+ GP', cost: 500 } },
  duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }],
};
const trueSeeing = { name: 'True Seeing', source: 'XPHB', level: 6, school: 'D', time: [{ number: 1, unit: 'action' }], range: { type: 'point', distance: { type: 'touch' } }, components: { v: true }, duration: [{ type: 'instant' }] };
const detectMagic = { name: 'Detect Magic', source: 'XPHB', level: 1, school: 'D', time: [{ number: 1, unit: 'action' }], range: { type: 'point', distance: { type: 'self' } }, components: { v: true }, duration: [{ type: 'instant' }], meta: { ritual: true } };
const eldritchBlast = { name: 'Eldritch Blast', source: 'XPHB', level: 0, school: 'V', time: [{ number: 1, unit: 'action' }], range: { type: 'point', distance: { type: 'feet', amount: 120 } }, components: { v: true, s: true }, duration: [{ type: 'instant' }] };

const classOrigin = { kind: 'class', classId: 'wizard', isPact: false, ability: 'int' };
const pactOrigin = { kind: 'class', classId: 'warlock', isPact: true, ability: 'cha' };
const raceOrigin = { kind: 'race', isPact: false, ability: 'cha' };

// --- campos do system -------------------------------------------------------

describe('foundrySpells - tradução dos campos do 5etools', () => {
  it('activation: ação simples não carrega valor; múltiplos, sim', () => {
    expect(foundryActivation(fireball)).toEqual({ type: 'action', condition: '', value: null });
    expect(foundryActivation(mistyStep).type).toBe('bonus');
    expect(foundryActivation({ time: [{ number: 10, unit: 'minute' }] })).toEqual({ type: 'minute', condition: '', value: 10 });
  });

  it('duration: instantânea, temporizada e permanente', () => {
    expect(foundryDuration(fireball)).toEqual({ value: '', units: 'inst' });
    expect(foundryDuration(bless)).toEqual({ value: '1', units: 'minute' });
    expect(foundryDuration({ duration: [{ type: 'permanent' }] })).toEqual({ value: '', units: 'perm' });
  });

  it('range: pés, self e touch', () => {
    expect(foundryRange(fireball)).toEqual({ units: 'ft', special: '', value: '150' });
    expect(foundryRange(mistyStep)).toEqual({ units: 'self', special: '', value: '' });
    expect(foundryRange(trueSeeing).units).toBe('touch');
  });

  it('properties: componentes + concentração + ritual', () => {
    expect(foundryProperties(fireball)).toEqual(['vocal', 'somatic', 'material']);
    expect(foundryProperties(bless)).toContain('concentration');
    expect(foundryProperties(detectMagic)).toContain('ritual');
  });

  it('materials: string simples e objeto com custo', () => {
    expect(foundryMaterials(fireball)).toMatchObject({ value: 'a ball of bat guano and sulfur', cost: 0 });
    expect(foundryMaterials(bless)).toMatchObject({ value: 'a Holy Symbol worth 5+ GP', cost: 500 });
    expect(foundryMaterials(mistyStep)).toEqual({ value: '', consumed: false, cost: 0, supply: 0 });
  });
});

describe('foundryUses - a fórmula, não o número cozido (DDL-0011)', () => {
  it('contagem fixa vira a própria string', () => {
    expect(foundryUses({ castType: 'daily', count: 2 })).toEqual({
      max: '2', spent: 0, recovery: [{ period: 'day', type: 'recoverAll' }],
    });
  });

  it('uso escalado por atributo exporta a FÓRMULA do Foundry', () => {
    expect(foundryUses({ castType: 'daily', scale: 'cha' }).max).toBe('@abilities.cha.mod');
  });

  it('uso escalado por proficiência exporta @prof', () => {
    expect(foundryUses({ castType: 'daily', scale: 'pb' }).max).toBe('@prof');
  });

  it('descanso longo e curto viram lr / sr', () => {
    expect(foundryUses({ castType: 'restLong', count: 1 }).recovery[0].period).toBe('lr');
    expect(foundryUses({ castType: 'rest', count: 1 }).recovery[0].period).toBe('sr');
  });

  it('sem limite (magia normal, à vontade, inata sem frequência) → uses vazio', () => {
    expect(foundryUses({ castType: null }).max).toBe('');
    expect(foundryUses({ castType: 'will' }).max).toBe('');
    expect(foundryUses({ castType: 'innate' }).max).toBe('');
  });
});

describe('foundryPreparation - method + prepared', () => {
  it('escolha do jogador: spell/pact preparada (1)', () => {
    expect(foundryPreparation({ granted: false }, classOrigin, false)).toEqual({ method: 'spell', prepared: 1 });
    expect(foundryPreparation({ granted: false }, pactOrigin, false)).toEqual({ method: 'pact', prepared: 1 });
  });

  it('Mystic Arcanum: atwill + não preparada (como o premade oficial)', () => {
    expect(foundryPreparation({ granted: false }, pactOrigin, true)).toEqual({ method: 'atwill', prepared: 0 });
  });

  it('concedida que gasta espaço: sempre preparada (2)', () => {
    expect(foundryPreparation({ granted: true, castType: null }, classOrigin, false)).toEqual({ method: 'spell', prepared: 2 });
  });

  it('concedida inata/à vontade/ritual: método próprio, não preparada', () => {
    expect(foundryPreparation({ granted: true, castType: 'daily' }, raceOrigin, false).method).toBe('innate');
    expect(foundryPreparation({ granted: true, castType: 'restLong' }, raceOrigin, false).method).toBe('innate');
    expect(foundryPreparation({ granted: true, castType: 'innate' }, raceOrigin, false).method).toBe('innate');
    expect(foundryPreparation({ granted: true, castType: 'will' }, raceOrigin, false).method).toBe('atwill');
    expect(foundryPreparation({ granted: true, castType: 'ritual' }, raceOrigin, false).method).toBe('ritual');
  });
});

describe('buildSpellItem - o Item completo', () => {
  const item = buildSpellItem({ raw: fireball, granted: false }, classOrigin, {});

  it('é um Item `spell` com identificador e origem de classe', () => {
    expect(item.type).toBe('spell');
    expect(item.name).toBe('Fireball');
    expect(item.system.identifier).toBe('fireball');
    expect(item.system.sourceItem).toBe('class:wizard');
    expect(item._id).toHaveLength(16);
  });

  it('a descrição inclui o bloco de círculo superior', () => {
    expect(item.system.description.value).toContain('bright streak');
    expect(item.system.description.value).toContain('Higher-Level Spell Slot');
  });

  it('nível e escola em código do dnd5e', () => {
    expect(item.system.level).toBe(3);
    expect(item.system.school).toBe('evo');
  });

  it('origem de CLASSE não fixa a habilidade (o Foundry lê da classe)', () => {
    expect(item.system.ability).toBe('');
  });

  it('origem racial carrega a própria habilidade e nenhuma classe dona', () => {
    const racial = buildSpellItem({ raw: mistyStep, granted: true, castType: 'daily', scale: 'cha' }, raceOrigin, {});
    expect(racial.system.ability).toBe('cha');
    expect(racial.system.sourceItem).toBeUndefined();
    expect(racial.system.uses.max).toBe('@abilities.cha.mod');
  });

  it('arcanum ganha 1 uso por descanso longo', () => {
    const arc = buildSpellItem({ raw: trueSeeing, granted: false }, pactOrigin, { isArcanum: true });
    expect(arc.system.method).toBe('atwill');
    expect(arc.system.uses).toEqual({ max: '1', spent: 0, recovery: [{ period: 'lr', type: 'recoverAll' }] });
  });
});

// --- integração com a derivação ---------------------------------------------

const warlockClass = {
  name: 'Warlock', source: 'XPHB', casterProgression: 'pact', spellcastingAbility: 'cha',
  cantripProgression: Array(20).fill(3), preparedSpellsProgression: Array(20).fill(12), hd: { faces: 8 },
};
const archfey = {
  name: 'Archfey Patron', shortName: 'Archfey', className: 'Warlock', source: 'XPHB',
  additionalSpells: [{ prepared: { 3: ['misty step|xphb'] }, innate: { _: { daily: { cha: ['misty step|xphb'] } } } }],
};
const dbW = {
  'class-warlock': { class: [warlockClass], subclass: [archfey] },
  'spells-xphb': { spell: [fireball, mistyStep, bless, trueSeeing, eldritchBlast] },
  'spell-sources': {},
};

function warlock13() {
  const ch = createCharacter();
  ch.classes = [{
    ...createClassEntry(true), classId: 'warlock', source: 'XPHB', level: 13,
    subclassId: 'Archfey', subclassSource: 'XPHB',
    spells: [
      { id: 'Eldritch Blast', source: 'XPHB' },
      { id: 'Bless', source: 'XPHB' },
      { id: 'True Seeing', source: 'XPHB' }, // 6º círculo → arcanum
    ],
  }];
  return ch;
}

describe('buildSpellItems - a partir da derivação (Warlock 13 Archfey)', () => {
  const ch = warlock13();
  const derived = { spellcasting: deriveSpellcasting(ch, dbW, { profBonus: 5, modifiers: { cha: 4 }, level: 13 }) };
  const items = buildSpellItems(derived);
  const byName = Object.fromEntries(items.map((i) => [i.name, i.system]));

  it('exporta cantrip, preparada, arcanum e a concedida', () => {
    expect(Object.keys(byName).sort()).toEqual(['Bless', 'Eldritch Blast', 'Misty Step', 'True Seeing']);
  });

  it('as escolhas do jogador são Pact Magic preparadas', () => {
    expect(byName.Bless).toMatchObject({ method: 'pact', prepared: 1, sourceItem: 'class:warlock' });
    expect(byName['Eldritch Blast']).toMatchObject({ method: 'pact', prepared: 1, level: 0 });
  });

  it('a magia de 6º círculo vira Mystic Arcanum, fora dos espaços', () => {
    expect(byName['True Seeing']).toMatchObject({ method: 'atwill', prepared: 0 });
    expect(byName['True Seeing'].uses.recovery[0].period).toBe('lr');
  });

  it('Misty Step (concedida + inata CHA/dia) exporta a fórmula, não o 4', () => {
    expect(byName['Misty Step'].method).toBe('innate');
    expect(byName['Misty Step'].uses.max).toBe('@abilities.cha.mod');
  });
});

describe('buildSpellSlots - bloco system.spells', () => {
  it('Warlock: só os espaços de pacto', () => {
    const ch = warlock13();
    const derived = { spellcasting: deriveSpellcasting(ch, dbW, { profBonus: 5, modifiers: { cha: 4 }, level: 13 }) };
    const slots = buildSpellSlots(derived);
    expect(slots.pact).toEqual({ value: 3, override: null });
    expect(slots.spell1).toEqual({ value: 0, override: null });
    expect(Object.keys(slots)).toHaveLength(10);
  });

  it('sem conjuração: tudo zerado', () => {
    const slots = buildSpellSlots({ spellcasting: { origins: [], slots: {}, pactSlots: null } });
    expect(slots.pact.value).toBe(0);
    expect(slots.spell9.value).toBe(0);
  });
});

// --- caminho de volta --------------------------------------------------------

describe('foundryImport - magias de volta ao builder', () => {
  it('lê o schema atual (method + prepared)', () => {
    expect(spellPreparation({ system: { method: 'pact', prepared: 1 } })).toEqual({ method: 'pact', prepared: 1 });
  });

  it('lê o schema DEPRECIADO dos exports antigos do Plutonium', () => {
    expect(spellPreparation({ system: { preparation: { mode: 'always', prepared: true } } })).toEqual({ method: 'spell', prepared: 2 });
    expect(spellPreparation({ system: { preparation: { mode: 'prepared', prepared: true } } })).toEqual({ method: 'spell', prepared: 1 });
    expect(spellPreparation({ system: { preparation: { mode: 'atwill', prepared: false } } })).toEqual({ method: 'atwill', prepared: 0 });
  });

  it('sourceItem "class:warlock" → "warlock"', () => {
    expect(spellSourceClass({ system: { sourceItem: 'class:warlock' } })).toBe('warlock');
    expect(spellSourceClass({ system: { sourceClass: 'Wizard' } })).toBe('wizard');
    expect(spellSourceClass({ system: {} })).toBeNull();
  });

  it('só as ESCOLHAS do jogador voltam (as concedidas a derivação recria)', () => {
    const pick = { system: { method: 'spell', prepared: 1, level: 1 } };
    const granted = { system: { method: 'spell', prepared: 2 } };
    const innate = { system: { method: 'innate', prepared: 0, uses: { max: '1' } } };
    const racialAtWill = { system: { method: 'atwill', prepared: 0, uses: { max: '' } } };
    const arcanum = { system: { method: 'atwill', prepared: 0, uses: { max: '1' } } };
    // Magia de círculo conhecida mas NÃO preparada (prepared:0) - não conta.
    const unprepared = { system: { method: 'spell', prepared: 0, level: 2 } };
    // Cantrip (level 0) fica, mesmo com prepared:0.
    const cantrip = { system: { method: 'spell', prepared: 0, level: 0 } };
    expect(isPlayerChosenSpell(pick)).toBe(true);
    expect(isPlayerChosenSpell(granted)).toBe(false);
    expect(isPlayerChosenSpell(innate)).toBe(false);
    expect(isPlayerChosenSpell(racialAtWill)).toBe(false);
    expect(isPlayerChosenSpell(arcanum)).toBe(true); // arcanum É uma escolha
    expect(isPlayerChosenSpell(unprepared)).toBe(false);
    expect(isPlayerChosenSpell(cantrip)).toBe(true);
  });

  it('agrupa por classe; magias sem dono ficam na chave null', () => {
    const items = [
      { type: 'spell', name: 'Bless', system: { method: 'pact', prepared: 1, sourceItem: 'class:warlock', source: { book: 'XPHB' } } },
      { type: 'spell', name: 'Fireball', system: { method: 'spell', prepared: 1, source: { book: 'XPHB' } } },
      { type: 'spell', name: 'Aid', system: { method: 'spell', prepared: 2, sourceItem: 'class:cleric' } },
      { type: 'feat', name: 'Alert', system: {} },
    ];
    const map = importSpellsByClass(items);
    expect(map.get('warlock')).toEqual([{ id: 'Bless', source: 'XPHB' }]);
    expect(map.get(null)).toEqual([{ id: 'Fireball', source: 'XPHB' }]);
    expect(map.has('cleric')).toBe(false); // concedida
  });
});

// --- round-trip completo -----------------------------------------------------

describe('round-trip: personagem → actor Foundry → personagem', () => {
  const dbRT = {
    ...dbW,
    races: { race: [] },
    feats: { feat: [] },
    'items-base': { baseitem: [] },
    languages: { language: [] },
    skills: { skill: [] },
  };

  const ch = warlock13();
  const actor = assembleFoundryActor(ch, dbRT);
  const back = foundryToCharacter(actor, dbRT);
  const spells = back.classes[0].spells.map((s) => s.id).sort();

  it('o ator carrega os Items de magia e o bloco de espaços', () => {
    expect(actor.items.filter((i) => i.type === 'spell')).toHaveLength(4);
    expect(actor.system.spells.pact.value).toBe(3);
  });

  it('as escolhas do jogador voltam intactas', () => {
    expect(spells).toEqual(['Bless', 'Eldritch Blast', 'True Seeing']);
  });

  it('a magia CONCEDIDA pela subclasse não é reimportada (a derivação a recria)', () => {
    expect(spells).not.toContain('Misty Step');
  });

  it('rederivar o personagem importado reproduz o arcanum', () => {
    const sc = deriveSpellcasting(back, dbW, { profBonus: 5, modifiers: { cha: 4 }, level: 13 });
    expect(sc.origins[0].arcanumSpells.map((s) => s.raw.name)).toEqual(['True Seeing']);
    expect(sc.origins[0].prepared.map((s) => s.raw.name)).toEqual(['Bless']);
  });
});

// --- confronto com o premade OFICIAL (dnd5e) ---------------------------------
// Recortes verbatim do Warlock 17 "Sefris" (Standard Premade Characters), que é
// a nossa verdade de schema (DDL-0001). Se o Foundry mudar a forma, isto quebra.

const SEFRIS_SPELLS = [
  { type: 'spell', name: 'Eldritch Blast', system: { level: 0, method: 'pact', prepared: 1, ability: '', sourceItem: 'class:warlock', uses: { max: '', spent: 0, recovery: [] } } },
  { type: 'spell', name: 'Hex', system: { level: 1, method: 'pact', prepared: 1, sourceItem: 'class:warlock', uses: { max: '', spent: 0, recovery: [] } } },
  { type: 'spell', name: 'Dancing Lights', system: { level: 0, method: 'spell', prepared: 2, ability: 'cha', uses: { max: '', spent: 0, recovery: [] } } },
  { type: 'spell', name: 'Contact Other Plane', system: { level: 5, method: 'spell', prepared: 2, uses: { max: '1', spent: 0, recovery: [{ period: 'lr', type: 'recoverAll' }] } } },
  { type: 'spell', name: 'Create Undead', system: { level: 6, method: 'atwill', prepared: 0, uses: { max: '1', spent: 0, recovery: [{ period: 'lr', type: 'recoverAll' }] } } },
  { type: 'spell', name: 'True Polymorph', system: { level: 9, method: 'atwill', prepared: 0, uses: { max: '1', spent: 0, recovery: [{ period: 'lr', type: 'recoverAll' }] } } },
];

describe('premade oficial (Sefris, Warlock 17) - o importador o classifica certo', () => {
  const map = importSpellsByClass(SEFRIS_SPELLS);
  const chosen = SEFRIS_SPELLS.filter(isPlayerChosenSpell).map((s) => s.name);

  it('as magias de pacto e os 4 Mystic Arcanum são escolhas do jogador', () => {
    expect(chosen).toEqual(['Eldritch Blast', 'Hex', 'Create Undead', 'True Polymorph']);
  });

  it('as sempre-preparadas (racial/feature) não voltam ao builder', () => {
    expect(chosen).not.toContain('Dancing Lights');
    expect(chosen).not.toContain('Contact Other Plane');
  });

  it('o que tem `sourceItem` cai na classe certa; o arcanum do premade não tem dono', () => {
    expect(map.get('warlock').map((s) => s.id)).toEqual(['Eldritch Blast', 'Hex']);
    expect(map.get(null).map((s) => s.id)).toEqual(['Create Undead', 'True Polymorph']);
  });

  it('a nossa forma de arcanum é idêntica à do premade', () => {
    const ours = buildSpellItem({ raw: trueSeeing, granted: false }, pactOrigin, { isArcanum: true }).system;
    const theirs = SEFRIS_SPELLS.find((s) => s.name === 'Create Undead').system;
    expect(ours.method).toBe(theirs.method);
    expect(ours.prepared).toBe(theirs.prepared);
    expect(ours.uses).toEqual(theirs.uses);
  });
});

describe('regressão: subclasse volta pelo shortName, não pelo nome do Item', () => {
  const dbSub = { ...dbW, races: { race: [] }, feats: { feat: [] }, 'items-base': { baseitem: [] }, languages: { language: [] } };
  const ch = warlock13();
  const actor = assembleFoundryActor(ch, dbSub);
  const back = foundryToCharacter(actor, dbSub);

  it('o Item exporta o nome completo, mas o builder guarda o shortName', () => {
    expect(actor.items.find((i) => i.type === 'subclass').name).toBe('Archfey Patron');
    expect(back.classes[0].subclassId).toBe('Archfey');
  });

  it('por isso as magias CONCEDIDAS pela subclasse reaparecem na derivação', () => {
    const sc = deriveSpellcasting(back, dbW, { profBonus: 5, modifiers: { cha: 4 }, level: 13 });
    expect(sc.origins[0].alwaysPrepared.map((s) => s.raw.name)).toEqual(['Misty Step']);
  });
});
