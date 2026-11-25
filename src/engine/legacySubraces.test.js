// =============================================================================
// legacySubraces.test: testes das sub-raças legadas curadas
// =============================================================================
// O QUE FAZ
//   O registro (bases 2024 de destino, os descartes, só o Elf como linhagem e o
//   Keldon como espécie) e o recorte real do Elf XPHB com o Pallid: o Elven
//   Lineage sai, a prosa 2014 cai, o `ability` sai dos dois lados, e uma base
//   legada resolvida à força segue o caminho normal.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { LEGACY_SUBRACES, LEGACY_PROSE_SECTIONS, legacySubracesFor, legacyStandaloneRefs } from './legacySubraces';
import { subraceVersions, raceLineages, requiresLineage, legacyStandaloneSpecies, speciesCatalog } from './speciesData';

describe('LEGACY_SUBRACES (registro curado, DDL-0058/0059/0060)', () => {
  it('só anexa a bases ATUAIS e não repete uma sub-raça', () => {
    const seen = new Set();
    for (const e of LEGACY_SUBRACES) {
      expect(e.race).toMatch(/\|XPHB$/);
      expect(e.of).not.toBe(e.race);
      const key = `${e.race}::${e.subrace}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('as sub-raças DESCARTADAS pela curadoria ficam de fora', () => {
    const ids = LEGACY_SUBRACES.map((e) => e.subrace);
    expect(ids).not.toContain('Eladrin|DMG');
    expect(ids).not.toContain('Asmodeus|MTF');
    expect(ids).not.toContain('Variant; Infernal Legacy|SCAG');
    expect(ids).not.toContain('Draconblood|EGW');
    expect(ids).not.toContain('Ravenite|EGW');
    expect(ids).not.toContain('Variant; Drow Descent|SCAG');
  });

  it('as legacies do Tiefling saíram daqui: elas são REESCRITAS (DDL-0061)', () => {
    expect(LEGACY_SUBRACES.some((e) => e.of === 'Tiefling|PHB')).toBe(false);
    expect(legacySubracesFor({ name: 'Tiefling', source: 'XPHB' })).toEqual([]);
  });

  it("`'species'` é a regra; `'lineage'` é a exceção (hoje só o Elf)", () => {
    const lineages = LEGACY_SUBRACES.filter((e) => e.as !== 'species');
    expect(lineages.map((e) => e.subrace)).toEqual(['Pallid|EGW']);
    expect(lineages[0].supersedes).toEqual(['Elven Lineage']);
    expect(LEGACY_SUBRACES.filter((e) => e.as === 'species').map((e) => e.subrace)).toEqual(['Keldon|PSD']);
  });

  it('as sub-raças do Halfling saíram daqui: elas viraram um `swap` (DDL-0063)', () => {
    expect(LEGACY_SUBRACES.some((e) => e.of === 'Halfling|PHB')).toBe(false);
    expect(legacySubracesFor({ name: 'Halfling', source: 'XPHB' })).toEqual([]);
  });

  it('as marcadas `as: species` saem do índice de LINHAGENS', () => {
    for (const race of ['Halfling', 'Human']) {
      expect(legacySubracesFor({ name: race, source: 'XPHB' })).toEqual([]);
    }
    const bases = new Set(legacyStandaloneRefs().map((r) => `${r.raceName}|${r.raceSource}`));
    expect([...bases].sort()).toEqual(['Human|PHB']);
  });

  it('legacySubracesFor indexa pela raça ATUAL', () => {
    const refs = legacySubracesFor({ name: 'Elf', source: 'XPHB' });
    expect(refs.map((r) => r.name)).toEqual(['Pallid']);
    expect(refs[0]).toMatchObject({ source: 'EGW', raceName: 'Elf', raceSource: 'PHB' });

    expect(legacySubracesFor({ name: 'Elf', source: 'PHB' })).toEqual([]);
    expect(legacySubracesFor({ name: 'Dwarf', source: 'XPHB' })).toEqual([]);
    expect(legacySubracesFor(null)).toEqual([]);
  });
});

describe('sub-raça legada como LINHAGEM da base atual', () => {
  const elf = {
    name: 'Elf',
    source: 'XPHB',
    entries: [
      { type: 'entries', name: 'Darkvision', entries: ['x'] },
      { type: 'entries', name: 'Elven Lineage', entries: ['escolha Drow/High/Wood'] },
      { type: 'entries', name: 'Trance', entries: ['y'] },
    ],
    _versions: [{ name: 'Elf; Drow Lineage', source: 'XPHB' }],
  };
  const db = {
    races: {
      race: [elf],
      subrace: [
        {
          name: 'Pallid',
          source: 'EGW',
          raceName: 'Elf',
          raceSource: 'PHB',
          ability: [{ wis: 1 }],
          additionalSpells: [{ ability: 'wis', known: { 1: ['light#c'] } }],
          entries: [
            { type: 'entries', name: 'Age', entries: ['prosa 2014'] },
            { type: 'entries', name: 'Incisive Sense', entries: ['z'] },
          ],
        },
      ],
    },
  };

  it('é fundida na base ATUAL, ao lado das próprias', () => {
    const names = raceLineages(db, elf).map((v) => v.name);
    expect(names).toEqual(['Elf; Drow Lineage', 'Elf (Pallid)']);
    const [pallid] = subraceVersions(db, elf);
    expect(pallid._baseName).toBe('Elf');
    expect(pallid.source).toBe('EGW');
    expect(pallid.additionalSpells).toEqual([{ ability: 'wis', known: { 1: ['light#c'] } }]);
  });

  it('o `ability` legado (+2/+1) é IGNORADO - os boosts vêm sempre da origem', () => {
    const [pallid] = subraceVersions(db, elf);
    expect(pallid.ability).toBeUndefined();
    expect(pallid.overwrite?.ability).toBeUndefined();
  });

  it('`supersedes` remove o traço 2024 que a linhagem ocupa', () => {
    const [pallid] = subraceVersions(db, elf);
    expect(pallid.entries.map((e) => e.name)).toEqual(['Darkvision', 'Trance', 'Incisive Sense']);
    for (const name of LEGACY_PROSE_SECTIONS) {
      expect(pallid.entries.some((e) => e.name === name)).toBe(false);
    }
  });

  it('uma linhagem legada NÃO passa a obrigar a escolha de linhagem', () => {
    expect(requiresLineage(db, elf)).toBe(true);
    const bare = { ...elf, _versions: undefined };
    expect(raceLineages(db, bare).map((v) => v.name)).toEqual(['Elf (Pallid)']);
    expect(requiresLineage(db, bare)).toBe(false);
    expect(subraceVersions(db, bare)[0]._legacy).toBe(true);
    expect(raceLineages(db, elf)[0]._legacy).toBeUndefined();
  });

  it('o tratamento curado vale só p/ a base ATUAL (a legada segue o merge cru)', () => {
    const [pallid] = subraceVersions(db, { name: 'Elf', source: 'PHB', entries: [] });
    expect(pallid.ability).toEqual([{ wis: 1 }]);
  });
});

describe('sub-raça legada como ESPÉCIE à parte', () => {
  const db = {
    races: {
      race: [
        { name: 'Human', source: 'PHB', speed: 30, ability: [{ str: 1 }], reprintedAs: ['Human|XPHB'],
          entries: [
            { type: 'entries', name: 'Age', entries: ['prosa 2014'] },
            { type: 'entries', name: 'Languages', entries: ['prosa 2014'] },
          ] },
        { name: 'Human', source: 'XPHB', speed: 30,
          entries: [{ type: 'entries', name: 'Versatile', entries: ['talento de origem'] }] },
      ],
      subrace: [
        { name: 'Keldon', source: 'PSD', raceName: 'Human', raceSource: 'PHB', ability: [{ str: 2 }],
          entries: [
            { type: 'entries', name: 'Size', entries: ['prosa 2014'] },
            { type: 'entries', name: 'Natural Athlete', entries: ['c'] },
          ] },
      ],
    },
  };

  it('é montada sobre a base LEGADA, não a 2024', () => {
    const [keldon] = legacyStandaloneSpecies(db);
    expect(keldon.name).toBe('Human (Keldon)');
    expect(keldon.entries.map((e) => e.name)).toEqual(['Natural Athlete']);
    expect(keldon.ability).toBeUndefined();
    expect(keldon.reprintedAs).toBeUndefined();
  });

  it('entra no catálogo de espécies e NÃO nas linhagens da base 2024', () => {
    expect(speciesCatalog(db).map((r) => `${r.name}|${r.source}`)).toContain('Human (Keldon)|PSD');
    const modern = db.races.race.find((r) => r.source === 'XPHB');
    expect(raceLineages(db, modern)).toEqual([]);
    expect(requiresLineage(db, modern)).toBe(false);
  });
});
