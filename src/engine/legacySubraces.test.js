import { describe, it, expect } from 'vitest';
import { LEGACY_SUBRACES, LEGACY_PROSE_SECTIONS, legacySubracesFor, legacyStandaloneRefs } from './legacySubraces';
import { subraceVersions, raceLineages, requiresLineage, legacyStandaloneSpecies, speciesCatalog } from './speciesData';

describe('LEGACY_SUBRACES (registro curado, DDL-0058/0059/0060)', () => {
  it('só anexa a bases ATUAIS e não repete uma sub-raça', () => {
    const seen = new Set();
    for (const e of LEGACY_SUBRACES) {
      expect(e.race).toMatch(/\|XPHB$/); // toda base de destino é 2024
      expect(e.of).not.toBe(e.race); // a origem é a raça legada, não a atual
      const key = `${e.race}::${e.subrace}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('as sub-raças DESCARTADAS pela curadoria ficam de fora', () => {
    const ids = LEGACY_SUBRACES.map((e) => e.subrace);
    // Redundantes com uma versão moderna autônoma / com a própria base 2024.
    expect(ids).not.toContain('Eladrin|DMG'); // → Eladrin|MPMM
    expect(ids).not.toContain('Asmodeus|MTF'); // sem mecânica: é a Infernal Legacy
    expect(ids).not.toContain('Variant; Infernal Legacy|SCAG'); // idem
    expect(ids).not.toContain('Draconblood|EGW'); // sopro ficaria sem tipo de dano
    expect(ids).not.toContain('Ravenite|EGW'); // idem
    expect(ids).not.toContain('Variant; Drow Descent|SCAG'); // → Khoravar|EFA
  });

  it('as legacies do Tiefling saíram daqui: elas são REESCRITAS (DDL-0061)', () => {
    // Este registro é só para as que voltam SEM reescrita. As 11 do Tiefling
    // vivem em legacyFiendishLegacies.js, como linhagens no formato 2024.
    expect(LEGACY_SUBRACES.some((e) => e.of === 'Tiefling|PHB')).toBe(false);
    expect(legacySubracesFor({ name: 'Tiefling', source: 'XPHB' })).toEqual([]);
  });

  it("`'species'` é a regra; `'lineage'` é a exceção (hoje só o Elf)", () => {
    // Balanceamento (DDL-0060): pendurada num chassi 2024 que dá algo A MAIS
    // que o de 2014, a sub-raça soma as vantagens dos dois. Só o Elf 2024 é o
    // mesmo chassi de 2014 + o guarda-chuva "Elven Lineage".
    const lineages = LEGACY_SUBRACES.filter((e) => e.as !== 'species');
    expect(lineages.map((e) => e.subrace)).toEqual(['Pallid|EGW']);
    expect(lineages[0].supersedes).toEqual(['Elven Lineage']);
    // Só o Keldon: Ghostwise e Lotusden saíram daqui em 2026-07-23, para a forma
    // `swap` (DDL-0063) - ver legacyHalflingLineages.js.
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
    // …e cada uma aponta para a base LEGADA em que deve ser fundida
    const bases = new Set(legacyStandaloneRefs().map((r) => `${r.raceName}|${r.raceSource}`));
    expect([...bases].sort()).toEqual(['Human|PHB']);
  });

  it('legacySubracesFor indexa pela raça ATUAL', () => {
    const refs = legacySubracesFor({ name: 'Elf', source: 'XPHB' });
    expect(refs.map((r) => r.name)).toEqual(['Pallid']);
    // a referência aponta para a raça LEGADA no dado
    expect(refs[0]).toMatchObject({ source: 'EGW', raceName: 'Elf', raceSource: 'PHB' });

    expect(legacySubracesFor({ name: 'Elf', source: 'PHB' })).toEqual([]); // a base legada não recebe
    expect(legacySubracesFor({ name: 'Dwarf', source: 'XPHB' })).toEqual([]);
    expect(legacySubracesFor(null)).toEqual([]);
  });
});

describe('sub-raça legada como LINHAGEM da base atual', () => {
  // Recorte real: Elf XPHB (base 2024, com uma linhagem própria) + a entrada de
  // `db.races.subrace` presa ao Elf PHB reprintado.
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
    // "Elven Lineage" some (é o lugar que o Pallid ocupa); as prosas 2014 também
    expect(pallid.entries.map((e) => e.name)).toEqual(['Darkvision', 'Trance', 'Incisive Sense']);
    for (const name of LEGACY_PROSE_SECTIONS) {
      expect(pallid.entries.some((e) => e.name === name)).toBe(false);
    }
  });

  it('uma linhagem legada NÃO passa a obrigar a escolha de linhagem', () => {
    // Elf tem `_versions` nativas → linhagem obrigatória, como sempre.
    expect(requiresLineage(db, elf)).toBe(true);
    // Sem elas, o acréscimo legado sozinho não obriga (senão um halfling ou um
    // humano 2024 simples ficaria impossível de construir).
    const bare = { ...elf, _versions: undefined };
    expect(raceLineages(db, bare).map((v) => v.name)).toEqual(['Elf (Pallid)']);
    expect(requiresLineage(db, bare)).toBe(false);
    expect(subraceVersions(db, bare)[0]._legacy).toBe(true);
    expect(raceLineages(db, elf)[0]._legacy).toBeUndefined();
  });

  it('o tratamento curado vale só p/ a base ATUAL (a legada segue o merge cru)', () => {
    // A base legada é inalcançável na prática (latestOnly a esconde), mas se
    // alguém a resolver, ela cai no caminho NORMAL: sem `supersedes` e com o
    // `ability` 2014 intacto - a curadoria não vaza para fora do destino.
    const [pallid] = subraceVersions(db, { name: 'Elf', source: 'PHB', entries: [] });
    expect(pallid.ability).toEqual([{ wis: 1 }]);
  });
});

describe('sub-raça legada como ESPÉCIE à parte', () => {
  // O caso que resta (DDL-0060): o Keldon. Chassi 2014 do humano + os traços
  // próprios; nada do Resourceful/Skillful/Versatile do Human 2024, que somados
  // fariam dele um upgrade puro sobre o humano comum.
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
    // As seções de prosa 2014 caem dos DOIS lados; o Versatile de 2024 não entra.
    expect(keldon.entries.map((e) => e.name)).toEqual(['Natural Athlete']);
    expect(keldon.ability).toBeUndefined(); // o `ability` legado sai dos DOIS lados
    expect(keldon.reprintedAs).toBeUndefined(); // senão o latestOnly a esconderia
  });

  it('entra no catálogo de espécies e NÃO nas linhagens da base 2024', () => {
    expect(speciesCatalog(db).map((r) => `${r.name}|${r.source}`)).toContain('Human (Keldon)|PSD');
    const modern = db.races.race.find((r) => r.source === 'XPHB');
    expect(raceLineages(db, modern)).toEqual([]);
    expect(requiresLineage(db, modern)).toBe(false);
  });
});
