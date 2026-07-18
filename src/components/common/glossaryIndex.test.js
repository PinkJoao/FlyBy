import { describe, it, expect } from 'vitest';
import { glossaryIndexFor } from './glossaryIndex';

// db sintético cobrindo uma regra, uma entidade e uma feature de classe.
const db = {
  conditionsdiseases: {
    condition: [{ name: 'Prone', source: 'XPHB', entries: ['A prone creature…'] }],
  },
  variantrules: {
    variantrule: [
      { name: 'Proficiency', source: 'XPHB', ruleType: 'C', entries: ['Your Proficiency Bonus…'] },
      { name: 'Flanking', source: 'DMG', ruleType: 'V', entries: ['Optional flanking…'] },
      { name: 'Hero Points', source: 'DMG', ruleType: 'VO', entries: ['A variant optional rule…'] },
      { name: 'Loyalty', source: 'AI', entries: ['No ruleType on this one…'] },
    ],
  },
  'gendata-variantrules': {
    variantrule: [{ name: 'Firearms', source: 'XDMG', ruleType: 'O', entries: ['The Firearms table…'] }],
  },
  'gendata-tables': {
    table: [
      { source: 'XPHB', srd52: true, name: 'Skill List; Skills', caption: 'Skills', colLabels: ['Skill'], rows: [['Athletics']] },
      // Não SRD 5.2 → não entra no glossário.
      { source: 'XGE', name: 'Trinkets', colLabels: ['d100'], rows: [['01']] },
    ],
  },
  'spells-xphb': {
    spell: [{ name: 'Fireball', source: 'XPHB', level: 3, school: 'V', entries: ['A bright streak…'] }],
  },
  'items-base': { baseitem: [{ name: 'Longsword', source: 'XPHB', type: 'M|XPHB', weaponCategory: 'martial', entries: [] }] },
  items: { item: [] },
  magicvariants: { magicvariant: [] },
  feats: { feat: [{ name: 'Alert', source: 'XPHB', category: 'O', entries: ['You gain…'] }] },
  optionalfeatures: { optionalfeature: [] },
  races: { race: [{ name: 'Gnome', source: 'XPHB', size: ['S'], speed: 30, entries: ['…'] }] },
  languages: { language: [{ name: 'Common', source: 'XPHB', type: 'standard', entries: ['…'] }] },
  backgrounds: { background: [{ name: 'Acolyte', source: 'XPHB', entries: ['You devoted…'] }] },
  'class-fighter': {
    class: [
      {
        name: 'Fighter',
        source: 'XPHB',
        classFeatures: ['Second Wind|Fighter|XPHB|1'],
      },
    ],
    subclass: [
      {
        name: 'Champion',
        shortName: 'Champion',
        source: 'XPHB',
        className: 'Fighter',
        classSource: 'XPHB',
        subclassFeatures: ['Improved Critical|Fighter|XPHB|Champion|XPHB|3'],
      },
    ],
    classFeature: [
      // Existe em PHB e XPHB (features não carregam reprintedAs) - deve colapsar
      // para a versão 2024 (XPHB).
      { name: 'Second Wind', className: 'Fighter', source: 'PHB', level: 1, entries: ['Old text…'] },
      { name: 'Second Wind', className: 'Fighter', source: 'XPHB', level: 1, entries: ['You have a limited well…'] },
    ],
    subclassFeature: [
      { name: 'Improved Critical', className: 'Fighter', subclassShortName: 'Champion', source: 'XPHB', level: 3, entries: ['Your weapon attacks…'] },
    ],
  },
};

describe('glossaryIndexFor', () => {
  const { entries, categories } = glossaryIndexFor(db);
  const byName = (n) => entries.filter((e) => e.name === n);

  it('inclui regras, entidades e features numa lista única', () => {
    expect(byName('Prone')[0]).toMatchObject({ kind: 'rule', categoryLabel: 'Condition' });
    expect(byName('Fireball')[0]).toMatchObject({ kind: 'entity', categoryLabel: 'Spell' });
    expect(byName('Alert')[0]).toMatchObject({ kind: 'entity', categoryLabel: 'Feat' });
    expect(byName('Gnome')[0]).toMatchObject({ kind: 'entity', categoryLabel: 'Species' });
    expect(byName('Common')[0]).toMatchObject({ kind: 'entity', categoryLabel: 'Language' });
    expect(byName('Second Wind')[0]).toMatchObject({ kind: 'rule', categoryLabel: 'Class Feature' });
    expect(byName('Improved Critical')[0]).toMatchObject({ kind: 'rule', categoryLabel: 'Subclass Feature' });
  });

  it('background abre no popup de regra (sem entity de seletor)', () => {
    const bg = byName('Acolyte')[0];
    expect(bg.kind).toBe('rule');
    expect(bg.ruleEntry).toMatchObject({ type: 'background', name: 'Acolyte' });
  });

  it('entidade carrega entity + raw para o showDetailPopup', () => {
    const fb = byName('Fireball')[0];
    expect(fb.entity).toBeTruthy();
    expect(fb.raw.name).toBe('Fireball');
  });

  it('feature em PHB+XPHB colapsa para a edição 2024', () => {
    const sw = byName('Second Wind');
    expect(sw).toHaveLength(1);
    expect(sw[0].source).toBe('XPHB');
    expect(sw[0].ruleEntry.entries[0]).toBe('You have a limited well…');
  });

  it('feature de subclasse mostra a subclasse no subtítulo', () => {
    expect(byName('Improved Critical')[0].subtitle).toContain('Champion');
  });

  it('subclasses entram como entidades, com a classe no subtítulo', () => {
    const champ = byName('Champion')[0];
    expect(champ).toMatchObject({ kind: 'entity', categoryLabel: 'Subclass', subtitle: 'Fighter' });
    expect(champ.raw.shortName).toBe('Champion');
    // A entity é a MESMA do seletor de subclasse: o preview resolve as features.
    const entries = champ.entity.entries(champ.raw, db);
    expect(JSON.stringify(entries)).toContain('Improved Critical');
    expect(champ.searchText).toContain('fighter');
  });

  it('classe no glossário traz a progressão completa por nível', () => {
    const fighter = entries.find((e) => e.categoryLabel === 'Class' && e.name === 'Fighter');
    expect(fighter).toBeTruthy();
    const body = fighter.entity.entries(fighter.raw, db);
    expect(body.some((e) => e?.name === 'Level 1: Second Wind')).toBe(true);
  });

  it('searchText casa nome e fonte, minúsculo', () => {
    expect(byName('Fireball')[0].searchText).toContain('fireball');
    expect(byName('Fireball')[0].searchText).toContain('xphb');
  });

  it('variantrules se desdobram em categorias (rótulo) pelo ruleType (incl. gendata/XDMG)', () => {
    expect(byName('Proficiency')[0]).toMatchObject({ kind: 'rule', categoryLabel: 'Core Rule' });
    expect(byName('Flanking')[0]).toMatchObject({ kind: 'rule', categoryLabel: 'Variant Rule' });
    expect(byName('Hero Points')[0]).toMatchObject({ kind: 'rule', categoryLabel: 'Variant Optional Rule' });
    expect(byName('Loyalty')[0]).toMatchObject({ kind: 'rule', categoryLabel: 'Rule' });
    // Regra extraída de livro (gendata-variantrules) - é por aqui que o XDMG entra.
    expect(byName('Firearms')[0]).toMatchObject({ kind: 'rule', categoryLabel: 'Optional Rule', source: 'XDMG' });
  });

  it('filterCategories: toda regra em "Rule"; VO conta como Variant E Optional', () => {
    expect(byName('Proficiency')[0].filterCategories).toEqual(['Rule', 'Core Rule']);
    expect(byName('Firearms')[0].filterCategories).toEqual(['Rule', 'Optional Rule']);
    expect(byName('Hero Points')[0].filterCategories).toEqual(['Rule', 'Variant Rule', 'Optional Rule']);
    expect(byName('Prone')[0].filterCategories).toEqual(['Condition']);
  });

  it('os FILTROS de categoria são alfabéticos e sem "Variant Optional Rule"', () => {
    expect([...categories].sort((a, b) => a.localeCompare(b))).toEqual(categories);
    expect(categories).toContain('Rule');
    expect(categories).toContain('Core Rule');
    expect(categories).toContain('Variant Rule');
    expect(categories).toContain('Optional Rule');
    expect(categories).not.toContain('Variant Optional Rule');
  });

  it('tabelas SRD 5.2 entram como regras (abrem no popup), só as srd52', () => {
    expect(byName('Skills')[0]).toMatchObject({ kind: 'rule', categoryLabel: 'Table', source: 'XPHB' });
    expect(byName('Skills')[0].ruleEntry.entries[0]).toMatchObject({ type: 'table' });
    expect(categories).toContain('Table');
    // 'Trinkets' (XGE, sem srd52) não é uma tabela de regra gratuita → fora.
    expect(byName('Trinkets')).toHaveLength(0);
  });

  it('os ITENS do painel seguem a ordem customizada: core → glossário de jogo → tabelas → demais regras → resto', () => {
    const at = (n) => entries.findIndex((e) => e.name === n);
    // Core (Proficiency) < glossário de jogo (Prone) < tabelas (Skills) < demais
    // regras (Flanking) < resto (Fireball).
    expect(at('Proficiency')).toBeLessThan(at('Prone'));
    expect(at('Prone')).toBeLessThan(at('Skills'));
    expect(at('Skills')).toBeLessThan(at('Flanking'));
    expect(at('Flanking')).toBeLessThan(at('Fireball'));
  });

  it('memoiza por db', () => {
    expect(glossaryIndexFor(db).entries).toBe(entries);
  });

  it('db vazio → índice vazio, sem quebrar', () => {
    expect(glossaryIndexFor(null)).toEqual({ entries: [], categories: [] });
    expect(glossaryIndexFor({})).toEqual({ entries: [], categories: [] });
  });
});
