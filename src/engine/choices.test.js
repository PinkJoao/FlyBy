import { describe, it, expect } from 'vitest';
import { parseChoices, collectChoicePicks, spellAbilityPick, weaponFilterAllows } from './choices';

// Formas reais (confirmadas no compêndio ao vivo).
const elf = { skillProficiencies: [{ choose: { from: ['insight', 'perception', 'survival'] } }] };
const human = {
  skillProficiencies: [{ any: 1 }],
  feats: [{ anyFromCategory: { category: ['O'], count: 1 } }],
};
const crafter = {
  toolProficiencies: [{ choose: { from: ["smith's tools", "mason's tools", "tinker's tools"], count: 3 } }],
};

describe('parseChoices', () => {
  it('Elf: escolha de perícia em lista (códigos + rótulos)', () => {
    const [c] = parseChoices(elf);
    expect(c.id).toBe('skill-0');
    expect(c.kind).toBe('skill');
    expect(c.count).toBe(1);
    expect(c.pool.type).toBe('list');
    expect(c.pool.options).toEqual([
      { value: 'ins', label: 'Insight' },
      { value: 'prc', label: 'Perception' },
      { value: 'sur', label: 'Survival' },
    ]);
  });

  it('Human: "any 1 skill" + escolha de talento de origem (recursivo)', () => {
    const out = parseChoices(human);
    const skill = out.find((c) => c.kind === 'skill');
    const feat = out.find((c) => c.kind === 'feat');
    expect(skill.pool).toEqual({ type: 'any', of: 'skill' });
    expect(feat.count).toBe(1);
    expect(feat.pool).toEqual({ type: 'feat', category: ['O'] });
  });

  it('Crafter: escolher 3 ferramentas de uma lista', () => {
    const [c] = parseChoices(crafter);
    expect(c.kind).toBe('tool');
    expect(c.count).toBe(3);
    expect(c.pool.options).toHaveLength(3);
    expect(c.pool.options[0]).toEqual({ value: "smith's tools", label: "Smith's Tools" });
  });

  it('Musician: token contável {anyMusicalInstrument: 3} vira choice com categoria INS (TC-0023)', () => {
    const musician = { toolProficiencies: [{ anyMusicalInstrument: 3 }] };
    const [c] = parseChoices(musician);
    expect(c.kind).toBe('tool');
    expect(c.count).toBe(3);
    expect(c.label).toBe('Choose 3 Musical Instruments');
    expect(c.pool).toEqual({ type: 'any', of: 'tool', category: 'INS' });
  });

  it('Custom Lineage: {anyStandard: 1} vira escolha de idioma (TC-0023)', () => {
    const lineage = { languageProficiencies: [{ anyStandard: 1 }] };
    const [c] = parseChoices(lineage);
    expect(c.kind).toBe('language');
    expect(c.count).toBe(1);
    expect(c.pool).toEqual({ type: 'any', of: 'language', category: null });
  });

  it('entries múltiplas são ALTERNATIVAS: só a primeira vira choice (Human (Ixalan))', () => {
    const ixalan = {
      languageProficiencies: [
        { common: true, anyStandard: 1 },
        { common: true, other: true, anyStandard: 1 },
      ],
    };
    const out = parseChoices(ixalan);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('language');
    expect(out[0].count).toBe(1);
  });

  it('entrada fixa {x: true} segue sendo grant, não choice', () => {
    const fixed = { toolProficiencies: [{ "smith's tools": true }] };
    expect(parseChoices(fixed)).toEqual([]);
  });

  it('Skilled: pool MISTO de skill+tool via skillToolLanguageProficiencies', () => {
    const skilled = {
      skillToolLanguageProficiencies: [{ choose: [{ from: ['anySkill', 'anyTool'], count: 3 }] }],
    };
    const [c] = parseChoices(skilled);
    expect(c.id).toBe('mixed-0');
    expect(c.kind).toBe('mixed');
    expect(c.count).toBe(3);
    expect(c.pool).toEqual({ type: 'any', of: ['skill', 'tool'] });
    expect(c.label).toBe('Choose 3 skill or tool');
  });
});

describe('collectChoicePicks - recursivo', () => {
  it('junta perícias do nível raso', () => {
    const bag = { 'skill-0': { kind: 'skill', picks: ['prc'] } };
    expect(collectChoicePicks(bag, 'skill')).toEqual(['prc']);
  });

  it('desce em sub-escolhas (talento escolhido com sua própria perícia)', () => {
    // Human escolheu a perícia Athletics (any) e o talento "Skilled" que deu Stealth.
    const bag = {
      'skill-0': { kind: 'skill', picks: ['ath'] },
      'feat-0': {
        kind: 'feat',
        picks: ['Skilled|XPHB'],
        sub: {
          'Skilled|XPHB': { 'skill-0': { kind: 'skill', picks: ['ste'] } },
        },
      },
    };
    expect(collectChoicePicks(bag, 'skill').sort()).toEqual(['ath', 'ste']);
    expect(collectChoicePicks(bag, 'feat')).toEqual(['Skilled|XPHB']);
  });

  it('picks heterogêneos {kind,value} de um pool misto', () => {
    const bag = {
      'mixed-0': {
        kind: 'mixed',
        picks: [
          { kind: 'skill', value: 'ath' },
          { kind: 'tool', value: "smith's tools" },
        ],
      },
    };
    expect(collectChoicePicks(bag, 'skill')).toEqual(['ath']);
    expect(collectChoicePicks(bag, 'tool')).toEqual(["smith's tools"]);
  });
});

describe('parseChoices - atributo de conjuração de `additionalSpells` (B2.4)', () => {
  it('gera um Choice spellAbility quando o dado manda escolher', () => {
    const elf = { additionalSpells: [{ known: { 1: ['dancing lights|xphb'] }, ability: { choose: ['int', 'wis', 'cha'] } }] };
    const [c] = parseChoices(elf);
    expect(c).toMatchObject({ id: 'spellAbility-0', kind: 'spellAbility', count: 1, label: 'Spellcasting Ability' });
    expect(c.pool.options.map((o) => o.value)).toEqual(['int', 'wis', 'cha']);
    expect(c.pool.options[0].label).toBe('Intelligence');
  });

  it('atributo FIXO não vira escolha', () => {
    expect(parseChoices({ additionalSpells: [{ ability: 'con', prepared: { _: ['bless|xphb'] } }] })).toEqual([]);
  });

  it('sem additionalSpells, nada', () => {
    expect(parseChoices({})).toEqual([]);
  });
});

describe('spellAbilityPick', () => {
  it('lê o pick do topo da bag', () => {
    expect(spellAbilityPick({ 'spellAbility-0': { kind: 'spellAbility', picks: ['wis'] } })).toBe('wis');
  });

  it('não vaza o pick de uma sub-bag (talento dentro da espécie)', () => {
    const bag = { 'feat-0': { kind: 'feat', picks: ['X|Y'], sub: { 'X|Y': { 'spellAbility-0': { kind: 'spellAbility', picks: ['cha'] } } } } };
    expect(spellAbilityPick(bag)).toBeNull();
  });

  it('bag vazia', () => {
    expect(spellAbilityPick(null)).toBeNull();
  });
});

describe('weaponFilterAllows (Kensei)', () => {
  const longsword = { name: 'Longsword', type: 'M|XPHB', weaponCategory: 'martial', property: ['V|XPHB'] };
  const greatsword = { name: 'Greatsword', type: 'M|XPHB', weaponCategory: 'martial', property: ['H|XPHB', '2H|XPHB'] };
  const shortbow = { name: 'Shortbow', type: 'R|XPHB', weaponCategory: 'simple', property: ['A|XPHB', '2H|XPHB'] };
  const longbow = { name: 'Longbow', type: 'R|XPHB', weaponCategory: 'martial', property: ['A|XPHB', 'H|XPHB', '2H|XPHB'] };
  const net = { name: 'Net', type: 'R|XPHB', weaponCategory: 'martial', property: ['S|XPHB', 'T|XPHB'] };
  const torch = { name: 'Torch', type: 'G|XPHB' };

  it('sem filtro, tudo passa', () => {
    expect(weaponFilterAllows(null, greatsword)).toBe(true);
  });

  it('melee sem Heavy/Special: Longsword sim, Greatsword (H) não, Shortbow (ranged) não', () => {
    const f = { kind: 'melee', noProps: ['H', 'S'] };
    expect(weaponFilterAllows(f, longsword)).toBe(true);
    expect(weaponFilterAllows(f, greatsword)).toBe(false);
    expect(weaponFilterAllows(f, shortbow)).toBe(false);
  });

  it('ranged: Shortbow sim, Net (Special) não, Longbow (Heavy) só pela exceção allow', () => {
    const f = { kind: 'ranged', noProps: ['H', 'S'], allow: ['Longbow'] };
    expect(weaponFilterAllows(f, shortbow)).toBe(true);
    expect(weaponFilterAllows(f, net)).toBe(false);
    expect(weaponFilterAllows(f, longbow)).toBe(true);
    expect(weaponFilterAllows({ kind: 'ranged', noProps: ['H', 'S'] }, longbow)).toBe(false);
  });

  it('item sem weaponCategory (não-arma) nunca passa', () => {
    expect(weaponFilterAllows({ noProps: [] }, torch)).toBe(false);
  });

  it('Rogue (martialRequiresAnyProp F/L): simples passam; marciais só com Finesse ou Light', () => {
    const f = { martialRequiresAnyProp: ['F', 'L'] };
    const dagger = { name: 'Dagger', type: 'M|XPHB', weaponCategory: 'simple', property: ['F|XPHB', 'L|XPHB', 'T|XPHB'] };
    const club = { name: 'Club', type: 'M|XPHB', weaponCategory: 'simple', property: ['L|XPHB'] };
    const rapier = { name: 'Rapier', type: 'M|XPHB', weaponCategory: 'martial', property: ['F|XPHB'] };
    const scimitar = { name: 'Scimitar', type: 'M|XPHB', weaponCategory: 'martial', property: ['F|XPHB', 'L|XPHB'] };
    const shortbow = { name: 'Shortbow', type: 'R|XPHB', weaponCategory: 'simple', property: ['A|XPHB', '2H|XPHB'] };
    // simples sempre passam (mesmo sem F/L: Shortbow)
    expect(weaponFilterAllows(f, dagger)).toBe(true);
    expect(weaponFilterAllows(f, club)).toBe(true);
    expect(weaponFilterAllows(f, shortbow)).toBe(true);
    // marciais só com Finesse ou Light
    expect(weaponFilterAllows(f, rapier)).toBe(true);
    expect(weaponFilterAllows(f, scimitar)).toBe(true);
    expect(weaponFilterAllows(f, longsword)).toBe(false); // martial, só Versatile
    expect(weaponFilterAllows(f, greatsword)).toBe(false); // martial, Heavy/2H
    expect(weaponFilterAllows(f, longbow)).toBe(false); // martial ranged, sem F/L
  });
});
