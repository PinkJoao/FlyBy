import { describe, it, expect } from 'vitest';
import { buildGlossary, glossaryFor, glossaryEntries, glossaryTables, lookupRule, parseTagContent, ruleCategoryLabel, ruleFilterCategories } from './glossary';

// db mínimo com os formatos reais dos arquivos do 5etools (fixtures reduzidas).
const db = {
  conditionsdiseases: {
    condition: [
      { name: 'Prone', source: 'PHB', reprintedAs: ['Prone|XPHB'], entries: ['legacy prone'] },
      { name: 'Prone', source: 'XPHB', entries: ['While you have the Prone condition…'] },
      { name: 'Exhaustion', source: 'XPHB', entries: ['Levels of exhaustion…'] },
    ],
    disease: [
      { name: 'Cackle Fever', source: 'DMG', reprintedAs: ['Cackle Fever|XDMG'], entries: ['gnomes are immune…'] },
      { name: 'Cackle Fever', source: 'XDMG', entries: ['This disease targets Humanoids…'] },
    ],
    status: [
      { name: 'Concentration', source: 'PHB', entries: ['legacy concentration'] },
      { name: 'Concentration', source: 'XPHB', entries: ['Some spells require concentration…'] },
    ],
  },
  variantrules: {
    variantrule: [
      { name: 'Proficiency', source: 'XPHB', ruleType: 'C', entries: ['Your Proficiency Bonus…'] },
      { name: 'Difficult Terrain', source: 'XPHB', ruleType: 'C', entries: ['Every foot costs 1 extra…'] },
      { name: 'Flanking', source: 'DMG', ruleType: 'V', entries: ['Optional flanking…'] },
    ],
  },
  // Regras extraídas dos livros pelo gendata (é por aqui que o XDMG entra).
  'gendata-variantrules': {
    variantrule: [{ name: 'Firearms', source: 'XDMG', ruleType: 'O', entries: ['The Firearms table…'] }],
  },
  actions: {
    action: [
      { name: 'Dash', source: 'XPHB', entries: ['When you take the Dash action…'] },
      // Reprint RENOMEADO: a versão antiga não pode aparecer no glossário navegável.
      { name: 'Use an Object', source: 'PHB', reprintedAs: ['Utilize|XPHB'], entries: ['legacy use an object'] },
      { name: 'Utilize', source: 'XPHB', entries: ['You normally interact with an object…'] },
    ],
  },
  senses: {
    sense: [
      { name: 'Darkvision', source: 'PHB', entries: ['legacy darkvision'] },
      { name: 'Darkvision', source: 'XPHB', entries: ['You can see in Dim Light…'] },
    ],
  },
  skills: { skill: [{ name: 'Athletics', source: 'XPHB', entries: ['Strength (Athletics)…'] }] },
  'items-base': {
    itemMastery: [{ name: 'Topple', source: 'XPHB', entries: ['…the creature has the Prone condition.'] }],
    itemProperty: [
      {
        abbreviation: '2H',
        source: 'XPHB',
        entries: [{ type: 'entries', name: 'Two-Handed', entries: ['This weapon requires two hands…'] }],
      },
    ],
  },
};

describe('parseTagContent', () => {
  it('lê os 3 formatos de pipe', () => {
    expect(parseTagContent('Athletics')).toEqual({ name: 'Athletics', source: '', display: 'Athletics' });
    expect(parseTagContent('Prone|XPHB')).toEqual({ name: 'Prone', source: 'XPHB', display: 'Prone' });
    expect(parseTagContent('Proficiency|XPHB|Proficiency Bonus')).toEqual({
      name: 'Proficiency',
      source: 'XPHB',
      display: 'Proficiency Bonus',
    });
  });

  it('pipe de fonte vazio ({@itemProperty L||light}) mantém o display', () => {
    expect(parseTagContent('L||light')).toEqual({ name: 'L', source: '', display: 'light' });
  });
});

describe('buildGlossary + lookupRule', () => {
  const g = buildGlossary(db);

  it('resolve condição com fonte exata', () => {
    const hit = lookupRule(g, 'condition', 'Prone|XPHB');
    expect(hit.entry.source).toBe('XPHB');
    expect(hit.entry.entries[0]).toMatch(/Prone condition/);
    expect(hit.display).toBe('Prone');
  });

  it('sem fonte prefere XPHB sobre PHB (reprint collapse)', () => {
    expect(lookupRule(g, 'status', 'concentration').entry.source).toBe('XPHB');
    expect(lookupRule(g, 'sense', 'darkvision').entry.source).toBe('XPHB');
  });

  it('fonte legada pedida explicitamente é respeitada', () => {
    expect(lookupRule(g, 'condition', 'Prone|PHB').entry.entries[0]).toBe('legacy prone');
  });

  it('fonte inexistente cai no default 2024', () => {
    expect(lookupRule(g, 'condition', 'Prone|HOMEBREW').entry.source).toBe('XPHB');
  });

  it('display do 3º pipe com alvo do 1º (Proficiency Bonus)', () => {
    const hit = lookupRule(g, 'variantrule', 'Proficiency|XPHB|Proficiency Bonus');
    expect(hit.display).toBe('Proficiency Bonus');
    expect(hit.entry.name).toBe('Proficiency');
  });

  it('lookup é case-insensitive ({@skill athletics})', () => {
    expect(lookupRule(g, 'skill', 'athletics').entry.name).toBe('Athletics');
  });

  it('itemMastery e action resolvem', () => {
    expect(lookupRule(g, 'itemMastery', 'Topple|XPHB').entry.name).toBe('Topple');
    expect(lookupRule(g, 'action', 'Dash').entry.name).toBe('Dash');
  });

  it('itemProperty resolve por abreviação (qualquer caixa) e por nome', () => {
    const byAbbr = lookupRule(g, 'itemProperty', '2h|XPHB|Two-Handed');
    expect(byAbbr.entry.name).toBe('Two-Handed');
    expect(byAbbr.display).toBe('Two-Handed');
    expect(lookupRule(g, 'itemProperty', 'Two-Handed').entry.name).toBe('Two-Handed');
  });

  it('termo desconhecido, tag fora do glossário e conteúdo vazio → null', () => {
    expect(lookupRule(g, 'condition', 'Homebrewed|HB')).toBeNull();
    expect(lookupRule(g, 'spell', 'Fireball|XPHB')).toBeNull();
    expect(lookupRule(g, 'quickref', 'difficult terrain||3')).toBeNull();
    expect(lookupRule(g, 'condition', '')).toBeNull();
    expect(lookupRule(null, 'condition', 'Prone')).toBeNull();
  });

  it('disease resolve; sem fonte prefere XDMG sobre DMG', () => {
    expect(lookupRule(g, 'disease', 'Cackle Fever|DMG').entry.source).toBe('DMG');
    expect(lookupRule(g, 'disease', 'Cackle Fever').entry.source).toBe('XDMG');
  });

  it('regras do gendata (XDMG) entram no índice, com ruleType', () => {
    const hit = lookupRule(g, 'variantrule', 'Firearms|XDMG');
    expect(hit.entry.source).toBe('XDMG');
    expect(hit.entry.ruleType).toBe('O');
  });

  it('prosa legada que cita a fonte antiga de um reprint ainda resolve', () => {
    expect(lookupRule(g, 'action', 'Use an Object|PHB').entry.entries[0]).toBe('legacy use an object');
  });
});

describe('glossaryEntries (lista navegável)', () => {
  const names = glossaryEntries(db).map((e) => `${e.type}:${e.name}`);

  it('esconde edições republicadas - inclusive reprints RENOMEADOS', () => {
    expect(names).toContain('action:Utilize');
    expect(names).not.toContain('action:Use an Object');
    // Reprint de mesmo nome: só a edição atual (XDMG) sobra.
    const cackle = glossaryEntries(db).find((e) => e.name === 'Cackle Fever');
    expect(cackle.source).toBe('XDMG');
  });

  it('mantém as regras do gendata', () => {
    expect(names).toContain('variantrule:Firearms');
  });
});

describe('glossaryTables (tabelas SRD 5.2)', () => {
  const tablesDb = {
    'gendata-tables': {
      table: [
        { source: 'XPHB', srd52: true, name: 'Skill List; Skills', caption: 'Skills', colLabels: ['Skill', 'Ability'], rows: [['Athletics', 'Strength']] },
        { source: 'XDMG', srd52: true, name: 'Difficulty Class; Typical DCs', caption: 'Typical DCs', colLabels: ['Difficulty', 'DC'], rows: [['Easy', '10']] },
        // Sem caption: cai no name composto.
        { source: 'XPHB', srd52: true, name: 'Weapons', colLabels: ['Name'], rows: [['Club']] },
        // NÃO é SRD 5.2 → fora.
        { source: 'XGE', name: 'Trinkets', colLabels: ['d100', 'Trinket'], rows: [['01', 'A mummified goblin hand']] },
        // srd52 mas sem linhas → fora (nada para renderizar).
        { source: 'XPHB', srd52: true, name: 'Empty', caption: 'Empty', rows: [] },
      ],
    },
  };

  it('só as marcadas srd52 com linhas, usando o caption como nome', () => {
    const tabs = glossaryTables(tablesDb);
    const names = tabs.map((t) => t.name);
    expect(names).toEqual(['Skills', 'Typical DCs', 'Weapons']);
    expect(names).not.toContain('Trinkets');
    expect(names).not.toContain('Empty');
  });

  it('cada entrada tem o shape de regra com a própria tabela no corpo (type:table)', () => {
    const skills = glossaryTables(tablesDb).find((t) => t.name === 'Skills');
    expect(skills).toMatchObject({ type: 'table', source: 'XPHB' });
    expect(skills.entries[0]).toMatchObject({ type: 'table', rows: [['Athletics', 'Strength']] });
  });

  it('db sem gendata-tables → lista vazia', () => {
    expect(glossaryTables({})).toEqual([]);
    expect(glossaryTables(null)).toEqual([]);
  });
});

describe('ruleCategoryLabel', () => {
  it('desdobra variantrule pelo ruleType e mantém os demais tipos', () => {
    expect(ruleCategoryLabel({ type: 'variantrule', ruleType: 'C' })).toBe('Core Rule');
    expect(ruleCategoryLabel({ type: 'variantrule', ruleType: 'O' })).toBe('Optional Rule');
    expect(ruleCategoryLabel({ type: 'variantrule', ruleType: 'V' })).toBe('Variant Rule');
    expect(ruleCategoryLabel({ type: 'variantrule', ruleType: 'VO' })).toBe('Variant Optional Rule');
    expect(ruleCategoryLabel({ type: 'variantrule' })).toBe('Rule');
    expect(ruleCategoryLabel({ type: 'condition' })).toBe('Condition');
    expect(ruleCategoryLabel({ type: 'table' })).toBe('Table');
  });
});

describe('ruleFilterCategories', () => {
  it('toda regra cai em "Rule"; core/variant/optional acrescentam o específico', () => {
    expect(ruleFilterCategories({ type: 'variantrule', ruleType: 'C' })).toEqual(['Rule', 'Core Rule']);
    expect(ruleFilterCategories({ type: 'variantrule', ruleType: 'V' })).toEqual(['Rule', 'Variant Rule']);
    expect(ruleFilterCategories({ type: 'variantrule', ruleType: 'O' })).toEqual(['Rule', 'Optional Rule']);
    expect(ruleFilterCategories({ type: 'variantrule' })).toEqual(['Rule']);
  });

  it('"Variant Optional" conta como Variant E Optional (sem categoria própria)', () => {
    const cats = ruleFilterCategories({ type: 'variantrule', ruleType: 'VO' });
    expect(cats).toEqual(['Rule', 'Variant Rule', 'Optional Rule']);
    expect(cats).not.toContain('Variant Optional Rule');
  });

  it('tipos que não são regra usam o rótulo fixo', () => {
    expect(ruleFilterCategories({ type: 'condition' })).toEqual(['Condition']);
    expect(ruleFilterCategories({ type: 'skill' })).toEqual(['Skill']);
  });
});

describe('glossaryFor', () => {
  it('memoiza por db e tolera db ausente', () => {
    const a = glossaryFor(db);
    expect(glossaryFor(db)).toBe(a);
    expect(glossaryFor(null)).toBeNull();
  });
});
