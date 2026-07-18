import { describe, it, expect } from 'vitest';
import { createCharacter, createClassEntry } from '../schema/character';
import {
  expand,
  expandSpeciesTraits,
  expandSubclassFeatures,
  expandFeats,
} from './expander';
import { parseSpecies } from './speciesData';
import { fighterClassData } from './fixtures/classData';
import { elfSpecies, archfeySubclass } from './fixtures/speciesData';

describe('parseSpecies (Elfo XPHB)', () => {
  const p = parseSpecies(elfSpecies);
  it('extrai tamanho, deslocamento e visão no escuro', () => {
    expect(p.size).toBe('M');
    expect(p.speed).toEqual({ walk: 30 });
    expect(p.darkvision).toBe(60);
  });
  it('perícia é uma ESCOLHA (não fixa)', () => {
    expect(p.skills.fixed).toEqual([]);
    expect(p.skills.choose.from).toEqual(['ins', 'prc', 'sur']);
  });
  it('lista os traços nomeados', () => {
    expect(p.traits.map((t) => t.name)).toEqual([
      'Darkvision',
      'Fey Ancestry',
      'Keen Senses',
      'Trance',
    ]);
  });
});

describe('expandSpeciesTraits', () => {
  it('vira grants de species-trait', () => {
    const c = createCharacter();
    c.species = { id: 'elf', source: 'XPHB', choices: {} };
    const grants = expandSpeciesTraits(c, elfSpecies);
    expect(grants).toHaveLength(4);
    expect(grants[0]).toMatchObject({ kind: 'species-trait', name: 'Darkvision' });
  });

  it('sem espécie, sem grants', () => {
    expect(expandSpeciesTraits(createCharacter(), null)).toEqual([]);
  });
});

describe('expandSubclassFeatures (Warlock 10 / Archfey)', () => {
  function warlock10() {
    const c = createCharacter();
    const w = createClassEntry(true);
    w.classId = 'warlock';
    w.level = 10;
    w.subclassId = 'archfey';
    w.subclassSource = 'PHB';
    c.classes = [w];
    return c;
  }

  it('inclui features de subclasse até o nível da classe', () => {
    const grants = expandSubclassFeatures(warlock10(), { archfey: archfeySubclass });
    const names = grants.map((g) => g.name);
    expect(names).toContain('The Archfey'); // lv1
    expect(names).toContain('Misty Escape'); // lv6
    expect(names).toContain('Beguiling Defenses'); // lv10
    expect(names).not.toContain('Dark Delirium'); // lv14
  });
});

describe('expandFeats', () => {
  it('inclui o talento de origem e talentos de nível de classe', () => {
    const c = createCharacter();
    c.origin.originFeat = { id: 'savage-attacker', source: 'XPHB', subtype: 'origin', choices: {} };
    const f = createClassEntry(true);
    f.classId = 'fighter';
    f.level = 4;
    f.choices = {
      1: [{ type: 'fighting-style', featId: 'dueling', source: 'XPHB' }],
      4: [{ type: 'feat', feat: { id: 'alert', source: 'XPHB', subtype: 'general', choices: {} } }],
    };
    c.classes = [f];

    const grants = expandFeats(c);
    const byName = Object.fromEntries(grants.map((g) => [g.name, g]));
    expect(byName['savage-attacker']).toMatchObject({ kind: 'feat', subtype: 'origin' });
    expect(byName['dueling']).toMatchObject({ subtype: 'fightingStyle' });
    expect(byName['alert']).toMatchObject({ subtype: 'general' });
  });
});

describe('expand - composição completa', () => {
  it('reúne espécie + classe + subclasse + talentos numa lista só', () => {
    const c = createCharacter();
    c.species = { id: 'elf', source: 'XPHB', choices: {} };
    c.origin.originFeat = { id: 'tough', source: 'XPHB', subtype: 'origin', choices: {} };
    const f = createClassEntry(true);
    f.classId = 'fighter';
    f.level = 3;
    f.subclassId = 'champion';
    c.classes = [f];

    const grants = expand(c, {
      classDataById: { fighter: fighterClassData },
      subclassDataById: {},
      speciesData: elfSpecies,
    });
    const kinds = new Set(grants.map((g) => g.kind));
    expect(kinds.has('species-trait')).toBe(true);
    expect(kinds.has('class-feature')).toBe(true);
    expect(kinds.has('feat')).toBe(true);
  });
});
