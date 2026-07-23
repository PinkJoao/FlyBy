import { describe, it, expect } from 'vitest';
import { LEGACY_SUBRACES, LEGACY_PROSE_SECTIONS, legacySubracesFor } from './legacySubraces';
import { subraceVersions, raceLineages, requiresLineage } from './speciesData';

describe('LEGACY_SUBRACES (registro curado, DDL-0058)', () => {
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

  it('legacySubracesFor indexa pela raça ATUAL', () => {
    const names = legacySubracesFor({ name: 'Tiefling', source: 'XPHB' }).map((r) => r.name);
    expect(names).toContain('Zariel');
    expect(names).toContain("Variant; Winged");
    // a referência aponta para a raça LEGADA no dado
    const zariel = legacySubracesFor({ name: 'Tiefling', source: 'XPHB' }).find((r) => r.name === 'Zariel');
    expect(zariel).toMatchObject({ source: 'MTF', raceName: 'Tiefling', raceSource: 'PHB' });

    expect(legacySubracesFor({ name: 'Tiefling', source: 'PHB' })).toEqual([]); // a base legada não recebe
    expect(legacySubracesFor({ name: 'Dwarf', source: 'XPHB' })).toEqual([]);
    expect(legacySubracesFor(null)).toEqual([]);
  });
});

describe('sub-raças legadas como linhagens da base atual', () => {
  // Recorte real: Tiefling XPHB (base 2024, com uma linhagem própria) + duas
  // entradas de `db.races.subrace` presas ao Tiefling PHB reprintado.
  const tiefling = {
    name: 'Tiefling',
    source: 'XPHB',
    entries: [
      { type: 'entries', name: 'Darkvision', entries: ['x'] },
      { type: 'entries', name: 'Fiendish Legacy', entries: ['escolha Abyssal/Chthonic/Infernal'] },
      { type: 'entries', name: 'Otherworldly Presence', entries: ['y'] },
    ],
    _versions: [{ name: 'Tiefling; Abyssal Legacy', source: 'XPHB' }],
  };
  const human = { name: 'Human', source: 'XPHB', entries: [{ type: 'entries', name: 'Skillful', entries: ['x'] }] };
  const db = {
    races: {
      race: [tiefling, human],
      subrace: [
        {
          name: 'Zariel',
          source: 'MTF',
          raceName: 'Tiefling',
          raceSource: 'PHB',
          ability: [{ str: 1, cha: 2 }],
          overwrite: { ability: true },
          additionalSpells: [{ ability: 'cha', known: { 1: ['thaumaturgy#c'] } }],
          entries: [{ type: 'entries', name: 'Legacy of Avernus', entries: ['z'], data: { overwrite: 'Infernal Legacy' } }],
        },
        {
          name: 'Keldon',
          source: 'PSD',
          raceName: 'Human',
          raceSource: 'PHB',
          ability: [{ str: 2, con: 1 }],
          entries: [
            { type: 'entries', name: 'Age', entries: ['prosa 2014'] },
            { type: 'entries', name: 'Languages', entries: ['prosa 2014'] },
            { type: 'entries', name: 'Keldon Resilience', entries: ['real'] },
          ],
        },
      ],
    },
  };

  it('a linhagem legada é fundida na base ATUAL, ao lado das próprias', () => {
    const names = raceLineages(db, tiefling).map((v) => v.name);
    expect(names).toEqual(['Tiefling; Abyssal Legacy', 'Tiefling (Zariel)']);
    const zariel = subraceVersions(db, tiefling)[0];
    expect(zariel._baseName).toBe('Tiefling');
    expect(zariel.source).toBe('MTF');
    expect(zariel.additionalSpells).toEqual([{ ability: 'cha', known: { 1: ['thaumaturgy#c'] } }]);
  });

  it('o `ability` legado (+2/+1) é IGNORADO — os boosts vêm sempre da origem', () => {
    const [zariel] = subraceVersions(db, tiefling);
    expect(zariel.ability).toBeUndefined();
    expect(zariel.overwrite?.ability).toBeUndefined();
    const [keldon] = subraceVersions(db, human);
    expect(keldon.ability).toBeUndefined();
  });

  it('`supersedes` remove o traço 2024 que a linhagem ocupa', () => {
    const [zariel] = subraceVersions(db, tiefling);
    expect(zariel.entries.map((e) => e.name)).toEqual(['Darkvision', 'Otherworldly Presence', 'Legacy of Avernus']);
  });

  it('as seções de prosa 2014 (Age/Languages…) não viram traços', () => {
    const [keldon] = subraceVersions(db, human);
    expect(keldon.entries.map((e) => e.name)).toEqual(['Skillful', 'Keldon Resilience']);
    for (const name of LEGACY_PROSE_SECTIONS) {
      expect(keldon.entries.some((e) => e.name === name)).toBe(false);
    }
  });

  it('uma linhagem legada NÃO passa a obrigar a escolha de linhagem', () => {
    // Tiefling tem `_versions` nativas → linhagem obrigatória, como sempre.
    expect(requiresLineage(db, tiefling)).toBe(true);
    // Human 2024 não tem linhagem nenhuma; ganhar o Keldon é um acréscimo
    // OPCIONAL - obrigar seria impedir de construir um humano simples.
    expect(raceLineages(db, human).map((v) => v.name)).toEqual(['Human (Keldon)']);
    expect(requiresLineage(db, human)).toBe(false);
    // e as legadas ficam marcadas como tal
    expect(subraceVersions(db, human)[0]._legacy).toBe(true);
    expect(raceLineages(db, tiefling)[0]._legacy).toBeUndefined();
  });

  it('o tratamento curado vale só p/ a base ATUAL (a legada segue o merge cru)', () => {
    // A base legada é inalcançável na prática (latestOnly a esconde), mas se
    // alguém a resolver, ela cai no caminho NORMAL: sem `supersedes` e com o
    // `ability` 2014 intacto - a curadoria não vaza para fora do destino.
    const [zariel] = subraceVersions(db, { name: 'Tiefling', source: 'PHB', entries: [] });
    expect(zariel.ability).toEqual([{ str: 1, cha: 2 }]);
  });
});
