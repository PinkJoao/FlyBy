import { describe, it, expect } from 'vitest';
import { grantedSpells, parseSpellRef, castTypeLabel, parseUsesKey, resolveGrantedUses } from './grantedSpells';

// Formas reais do 5etools (levantadas do dataset em 2026-07-09).
const drowLineage = [
  {
    innate: { 3: { daily: { 1: ['faerie fire|xphb'] } }, 5: { daily: { 1: ['darkness|xphb'] } } },
    ability: { choose: ['int', 'wis', 'cha'] },
    known: { 1: ['dancing lights|xphb#c'] },
  },
];
const highElfLineage = [
  {
    innate: { 3: { daily: { 1: ['detect magic|xphb'] } } },
    ability: { choose: ['int', 'wis', 'cha'] },
    known: { 1: { _: [{ choose: 'level=0|class=Wizard' }] } },
  },
];
const lifeDomain = [
  {
    prepared: {
      3: ['aid|xphb', 'bless|xphb', 'cure wounds|xphb', 'lesser restoration|xphb'],
      5: ['mass healing word|xphb', 'revivify|xphb'],
      7: ['aura of life|xphb', 'death ward|xphb'],
    },
  },
];
const aberrantDragonmark = [
  {
    ability: 'con',
    prepared: { _: { rest: { 1: [{ choose: 'level=1|class=Sorcerer' }] } } },
    known: { _: [{ choose: 'level=0|class=Sorcerer' }] },
  },
];
const eldritchKnight = [{ expanded: { 3: [{ all: 'level=0|class=Wizard' }] } }];

describe('parseSpellRef', () => {
  it('separa nome e fonte, normalizando a fonte', () => {
    expect(parseSpellRef('faerie fire|xphb')).toEqual({ name: 'faerie fire', source: 'XPHB', castLevel: null });
  });

  it('lê o marcador #c como "conjurada como cantrip"', () => {
    expect(parseSpellRef('dancing lights|xphb#c').castLevel).toBe(0);
  });

  it('lê o marcador numérico como o círculo de conjuração', () => {
    expect(parseSpellRef('hex|xphb#2').castLevel).toBe(2);
  });

  it('aceita nome sem fonte e rejeita lixo', () => {
    expect(parseSpellRef('light')).toEqual({ name: 'light', source: null, castLevel: null });
    expect(parseSpellRef('')).toBeNull();
    expect(parseSpellRef(null)).toBeNull();
  });
});

describe('grantedSpells - linhagem Drow (innate diário + cantrip known)', () => {
  it('no nível 1 concede só o cantrip', () => {
    const { spells } = grantedSpells(drowLineage, 1);
    expect(spells).toHaveLength(1);
    expect(spells[0]).toMatchObject({ name: 'dancing lights', castMode: 'known', castLevel: 0 });
  });

  it('no nível 3 soma Faerie Fire 1/dia', () => {
    const { spells } = grantedSpells(drowLineage, 3);
    expect(spells.map((s) => s.name)).toEqual(['dancing lights', 'faerie fire']);
    const ff = spells.find((s) => s.name === 'faerie fire');
    expect(ff).toMatchObject({ castMode: 'innate', castType: 'daily', count: 1, scale: null });
  });

  it('no nível 5 soma Darkness', () => {
    expect(grantedSpells(drowLineage, 5).spells).toHaveLength(3);
  });

  it('expõe as opções de atributo quando o dado manda escolher', () => {
    const { ability, abilityChoices } = grantedSpells(drowLineage, 5);
    expect(ability).toBeNull();
    expect(abilityChoices).toEqual(['int', 'wis', 'cha']);
  });
});

describe('grantedSpells - escolhas e expansões não concedem magia', () => {
  it('conta `{choose}` como pendência, sem conceder', () => {
    const { spells, pendingChoices } = grantedSpells(highElfLineage, 1);
    expect(spells).toHaveLength(0);
    expect(pendingChoices).toBe(1);
  });

  it('ignora o bucket `expanded` (só amplia a lista da classe)', () => {
    const { spells, pendingChoices } = grantedSpells(eldritchKnight, 20);
    expect(spells).toHaveLength(0);
    expect(pendingChoices).toBe(0);
  });

  it('lê o atributo fixo e ambas as pendências do Aberrant Dragonmark', () => {
    const { spells, ability, pendingChoices } = grantedSpells(aberrantDragonmark, 4);
    expect(spells).toHaveLength(0);
    expect(ability).toBe('con');
    expect(pendingChoices).toBe(2);
  });
});

describe('grantedSpells - subclasse (Life Domain, nível de CLASSE)', () => {
  it('acumula por faixa de nível', () => {
    expect(grantedSpells(lifeDomain, 2).spells).toHaveLength(0);
    expect(grantedSpells(lifeDomain, 3).spells).toHaveLength(4);
    expect(grantedSpells(lifeDomain, 5).spells).toHaveLength(6);
    expect(grantedSpells(lifeDomain, 7).spells).toHaveLength(8);
  });

  it('marca todas como `prepared` sem tipo de conjuração (usam slots)', () => {
    const { spells } = grantedSpells(lifeDomain, 3);
    expect(spells.every((s) => s.castMode === 'prepared' && s.castType === null && s.count === null)).toBe(true);
  });
});

describe('grantedSpells - robustez', () => {
  it('sem dado nenhum devolve vazio', () => {
    expect(grantedSpells(null, 5)).toEqual({ spells: [], ability: null, abilityChoices: [], pendingChoices: 0, choices: [] });
    expect(grantedSpells([], 5).spells).toEqual([]);
  });

  it('a chave `_` vale em qualquer nível', () => {
    const { spells } = grantedSpells([{ known: { _: ['light|xphb'] } }], 1);
    expect(spells).toHaveLength(1);
  });

  it('dedup por nome+modo (a mesma magia repetida em vários níveis)', () => {
    const dupes = [{ prepared: { 1: ['bless|xphb'], 3: ['bless|xphb'] } }];
    expect(grantedSpells(dupes, 3).spells).toHaveLength(1);
  });

  it('a mesma magia em dois buckets vira UMA entrada, fundindo modo e usos', () => {
    // Forma do Archfey Patron: prepared (gasta espaço) + innate diário grátis.
    const both = [{ prepared: { 1: ['misty step|xphb'] }, innate: { 1: { daily: { 2: ['misty step|xphb'] } } } }];
    const { spells } = grantedSpells(both, 1);
    expect(spells).toHaveLength(1);
    // `prepared` manda no modo; o tipo/usos vêm da concessão inata.
    expect(spells[0]).toMatchObject({ castMode: 'prepared', castType: 'daily', count: 2 });
  });

  it('lê `will` e `ritual` como listas diretas', () => {
    const { spells } = grantedSpells([{ innate: { 1: { will: ['mage hand|xphb'], ritual: ['detect magic|xphb'] } } }], 1);
    expect(spells.find((s) => s.name === 'mage hand')).toMatchObject({ castType: 'will', count: null });
    expect(spells.find((s) => s.name === 'detect magic')).toMatchObject({ castType: 'ritual', count: null });
  });
});

// ---------------------------------------------------------------------------
// TC-0011: escolhas de magia ({choose}) e grupos múltiplos (alternativas)
// ---------------------------------------------------------------------------

// Magic Initiate XPHB (recorte): 2 grupos nomeados, cada um com 2 cantrips
// `known` + 1 magia de nível 1 `innate` 1/dia, ambos por escolha.
const magicInitiate = [
  {
    name: 'Cleric Spells',
    ability: { choose: ['int', 'wis', 'cha'] },
    innate: { _: { daily: { 1: [{ choose: 'level=1|class=Cleric' }] } } },
    known: { _: [{ choose: 'level=0|class=Cleric', count: 2 }] },
  },
  {
    name: 'Wizard Spells',
    ability: { choose: ['int', 'wis', 'cha'] },
    innate: { _: { daily: { 1: [{ choose: 'level=1|class=Wizard' }] } } },
    known: { _: [{ choose: 'level=0|class=Wizard', count: 2 }] },
  },
];
// Path of the Giant: 2 grupos SEM nome = druidcraft OU thaumaturgy.
const pathOfGiant = [
  { innate: { 3: ['druidcraft#c'] } },
  { innate: { 3: ['thaumaturgy#c'] } },
];
// Ritual Caster XPHB (recorte): chooses destravando por nível do personagem.
const ritualCaster = [
  { prepared: { 1: [{ choose: 'level=1|components & miscellaneous=ritual', count: 2 }], 5: [{ choose: 'level=1|components & miscellaneous=ritual' }] } },
];

describe('grantedSpells - TC-0011 (chooses e grupos múltiplos)', () => {
  it('grupos múltiplos são ALTERNATIVAS: sem pick, nada é concedido', () => {
    const { spells, pendingChoices, choices } = grantedSpells(pathOfGiant, 3);
    expect(spells).toHaveLength(0);
    expect(pendingChoices).toBe(1);
    const set = choices.find((c) => c.kind === 'spellSet');
    expect(set).toBeTruthy();
    expect(set.pool.options.map((o) => o.label)).toEqual(['Druidcraft', 'Thaumaturgy']);
  });

  it('com o grupo escolhido, o grant fixo dele (e SÓ dele) vale', () => {
    const bag = { 'spellSet-0': { kind: 'spellSet', picks: ['#1'] } };
    const { spells, pendingChoices } = grantedSpells(pathOfGiant, 3, { bag });
    expect(spells.map((s) => s.name)).toEqual(['thaumaturgy']);
    expect(pendingChoices).toBe(0);
  });

  it('Magic Initiate: escolher a lista gera as escolhas de cantrip + nível 1', () => {
    const bag = { 'spellSet-0': { kind: 'spellSet', picks: ['Wizard Spells'] } };
    const { choices, pendingChoices } = grantedSpells(magicInitiate, 1, { bag });
    const spellChoices = choices.filter((c) => c.kind === 'spell');
    expect(spellChoices).toHaveLength(2);
    const cantrips = spellChoices.find((c) => c.count === 2);
    expect(cantrips.pool.filter).toBe('level=0|class=Wizard');
    expect(cantrips.label).toBe('Choose 2 Wizard cantrips');
    expect(pendingChoices).toBe(3); // 2 cantrips + 1 magia de nível 1
  });

  it('os picks entram como concedidas com o modo/frequência da folha', () => {
    // Ordem de geração: buckets `known` → `prepared` → `innate` (spell-0 são
    // os cantrips known; spell-1 é a magia de nível 1 innate 1/dia).
    const bag = {
      'spellSet-0': { kind: 'spellSet', picks: ['Wizard Spells'] },
      'spell-0': { kind: 'spell', picks: ['Fire Bolt|XPHB', 'Light|XPHB'] }, // known
      'spell-1': { kind: 'spell', picks: ['Cure Wounds|XPHB'] }, // innate daily 1
    };
    const { spells, pendingChoices } = grantedSpells(magicInitiate, 1, { bag });
    expect(pendingChoices).toBe(0);
    const cure = spells.find((s) => s.name === 'Cure Wounds');
    expect(cure).toMatchObject({ castMode: 'innate', castType: 'daily', count: 1 });
    expect(spells.find((s) => s.name === 'Fire Bolt')).toMatchObject({ castMode: 'known', castType: null });
  });

  it('chooses destravam pelo nível (Ritual Caster XPHB)', () => {
    expect(grantedSpells(ritualCaster, 1).choices.filter((c) => c.kind === 'spell')).toHaveLength(1);
    expect(grantedSpells(ritualCaster, 1).pendingChoices).toBe(2);
    expect(grantedSpells(ritualCaster, 5).choices.filter((c) => c.kind === 'spell')).toHaveLength(2);
    expect(grantedSpells(ritualCaster, 5).pendingChoices).toBe(3);
  });

  it('choose em OBJETO ({from}) vira pool de lista fechada', () => {
    const initiate = [{ innate: { _: { daily: { '1e': [{ choose: { from: ['hex', 'ray of sickness|xphb'] } }] } } } }];
    const [ch] = grantedSpells(initiate, 1).choices;
    expect(ch.kind).toBe('spell');
    expect(ch.pool.from).toEqual(['hex', 'ray of sickness']);
  });
});

describe('castTypeLabel', () => {
  it('rotula os tipos de conjuração', () => {
    expect(castTypeLabel({ castType: 'daily', uses: 1 })).toBe('1/Day');
    expect(castTypeLabel({ castType: 'rest', uses: 2 })).toBe('2/Rest');
    expect(castTypeLabel({ castType: 'will' })).toBe('At Will');
    expect(castTypeLabel({ castType: 'ritual' })).toBe('Ritual');
    expect(castTypeLabel({ castType: 'resource', uses: 3 })).toBe('3 Charges');
  });

  it('sem tipo (conjurada com slots) não tem rótulo', () => {
    expect(castTypeLabel({ castType: null })).toBeNull();
    expect(castTypeLabel(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Edge cases levantados do dataset real (2026-07-10)
// ---------------------------------------------------------------------------

// Aarakocra MPMM: lista CRUA sob `innate` - o dado não diz a frequência.
const aarakocra = [{ innate: { 3: ['gust of wind'] }, ability: { choose: ['int', 'wis', 'cha'] } }];
// Archfey Patron XPHB: Misty Step é concedida preparada E como inata CHA×/dia.
const archfey = [{
  prepared: { 3: ['calm emotions|xphb', 'misty step|xphb'] },
  innate: { _: { daily: { cha: ['misty step|xphb'] } } },
}];

describe('parseUsesKey', () => {
  it('chave numérica', () => {
    expect(parseUsesKey('2')).toEqual({ count: 2, scale: null, each: false });
  });
  it('sufixo "e" = um CADA', () => {
    expect(parseUsesKey('1e')).toEqual({ count: 1, scale: null, each: true });
  });
  it('"pb" = bônus de proficiência', () => {
    expect(parseUsesKey('pb')).toEqual({ count: null, scale: 'pb', each: false });
  });
  it('abreviação de atributo', () => {
    expect(parseUsesKey('cha')).toEqual({ count: null, scale: 'cha', each: false });
    expect(parseUsesKey('int').scale).toBe('int');
  });
  it('chave desconhecida não vira número', () => {
    expect(parseUsesKey('zzz')).toEqual({ count: null, scale: null, each: false });
  });
});

describe('resolveGrantedUses', () => {
  const ctx = { profBonus: 3, modifiers: { cha: 4, wis: -1 } };

  it('contagem fixa passa direto, sem nota', () => {
    expect(resolveGrantedUses({ count: 2, scale: null }, ctx)).toEqual({ uses: 2, usesNote: null });
  });
  it('"pb" vira o bônus de proficiência', () => {
    expect(resolveGrantedUses({ count: null, scale: 'pb' }, ctx)).toEqual({ uses: 3, usesNote: 'Proficiency Bonus' });
  });
  it('atributo vira o modificador, com a nota de origem', () => {
    expect(resolveGrantedUses({ count: null, scale: 'cha' }, ctx)).toEqual({ uses: 4, usesNote: 'Charisma modifier' });
  });
  it('modificador negativo ou zero ainda dá 1 uso (mínimo da regra)', () => {
    expect(resolveGrantedUses({ count: null, scale: 'wis' }, ctx).uses).toBe(1);
    expect(resolveGrantedUses({ count: null, scale: 'cha' }, { profBonus: 2, modifiers: {} }).uses).toBe(1);
  });
  it('sem contexto não explode', () => {
    expect(resolveGrantedUses({ count: 1, scale: null })).toEqual({ uses: 1, usesNote: null });
  });
});

describe('grantedSpells - Aarakocra (innate sem tipo de recarga)', () => {
  it('nada antes do nível 3', () => {
    expect(grantedSpells(aarakocra, 2).spells).toHaveLength(0);
  });

  it('no nível 3 concede Gust of Wind marcada como inata, SEM inventar frequência', () => {
    const [gust] = grantedSpells(aarakocra, 3).spells;
    expect(gust).toMatchObject({ name: 'gust of wind', castMode: 'innate', castType: 'innate', count: null, scale: null });
    expect(castTypeLabel({ ...gust, uses: null })).toBe('No Spell Slot');
  });
});

describe('grantedSpells - Archfey Patron (Misty Step preparada + inata CHA/dia)', () => {
  const { spells } = grantedSpells(archfey, 3);

  it('Misty Step é UMA linha, não duas', () => {
    expect(spells.map((s) => s.name)).toEqual(['calm emotions', 'misty step']);
  });

  it('a linha guarda o modo preparado E a conjuração inata escalada por CHA', () => {
    const misty = spells.find((s) => s.name === 'misty step');
    expect(misty).toMatchObject({ castMode: 'prepared', castType: 'daily', count: null, scale: 'cha' });
  });

  it('com CHA +4 vira "4/Day"', () => {
    const misty = spells.find((s) => s.name === 'misty step');
    const resolved = { ...misty, ...resolveGrantedUses(misty, { profBonus: 3, modifiers: { cha: 4 } }) };
    expect(castTypeLabel(resolved)).toBe('4/Day');
    expect(resolved.usesNote).toBe('Charisma modifier');
  });

  it('as demais concedidas seguem usando espaços de magia', () => {
    expect(castTypeLabel(spells.find((s) => s.name === 'calm emotions'))).toBeNull();
  });
});
