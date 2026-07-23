import { describe, it, expect } from 'vitest';
import {
  HALFLING_LINEAGES,
  UMBRELLA_TRAIT,
  halflingVersionName,
  halflingLineageVersions,
  withLineageUmbrella,
  lineageUmbrellaName,
  migrateHalflingSpecies,
} from './legacyHalflingLineages';
import { raceLineages, requiresLineage, lineageSelectorLabel, lineageDeferredKinds } from './speciesData';

/** Recorte real: o Halfling XPHB (que absorveu o Naturally Stealthy do Lightfoot)
 *  + as três sub-raças 2014 presas ao Halfling PHB reprintado. */
const db = {
  races: {
    race: [
      { name: 'Halfling', source: 'PHB', speed: 25, reprintedAs: ['Halfling|XPHB'], entries: [] },
      {
        name: 'Halfling',
        source: 'XPHB',
        speed: 30,
        size: ['S'],
        entries: [
          { type: 'entries', name: 'Brave', entries: ['b'] },
          { type: 'entries', name: 'Luck', entries: ['l'] },
          { type: 'entries', name: 'Naturally Stealthy', entries: ['redação 2024'] },
        ],
      },
    ],
    subrace: [
      { name: 'Stout', source: 'PHB', raceName: 'Halfling', raceSource: 'PHB', ability: [{ con: 1 }],
        resist: ['poison'],
        entries: [{ type: 'entries', name: 'Stout Resilience', entries: ['veneno'] }] },
      { name: 'Ghostwise', source: 'SCAG', raceName: 'Halfling', raceSource: 'PHB',
        entries: [
          { type: 'entries', name: 'Size', entries: ['prosa 2014'] },
          { type: 'entries', name: 'Silent Speech', entries: ['telepatia'] },
        ] },
      { name: 'Lotusden', source: 'EGW', raceName: 'Halfling', raceSource: 'PHB',
        additionalSpells: [{ ability: 'wis', known: { 1: ['druidcraft#c'] } }],
        entries: [
          { type: 'entries', name: 'Child of the Wood', entries: ['a'] },
          { type: 'entries', name: 'Timberwalk', entries: ['b'] },
        ] },
    ],
  },
};

const base = db.races.race[1];
const other = { name: 'Elf', source: 'XPHB', entries: [] };

describe('guarda-chuva "Halfling Lineage" (DDL-0063)', () => {
  it('SUBSTITUI na base o traço que ela absorveu do Lightfoot', () => {
    const race = withLineageUmbrella(db, base);
    expect(race.entries.map((e) => e.name)).toEqual(['Brave', 'Luck', UMBRELLA_TRAIT]);
    // …no MESMO lugar, e sem tocar no objeto original
    expect(base.entries.map((e) => e.name)).toContain('Naturally Stealthy');
  });

  it('lista as quatro opções, e o Lightfoot carrega a redação da BASE 2024', () => {
    const umbrella = withLineageUmbrella(db, base).entries[2];
    const list = umbrella.entries.find((e) => e?.type === 'list');
    expect(list.items.map((i) => i.name)).toEqual(['Lightfoot', 'Stout', 'Ghostwise', 'Lotusden']);
    // O Lightfoot tem de reproduzir a base EXATAMENTE: o texto é o dela.
    expect(list.items[0].entries[0]).toMatchObject({ name: 'Naturally Stealthy', entries: ['redação 2024'] });
  });

  it('é idempotente e devolve a MESMA referência quando não há o que mudar', () => {
    const once = withLineageUmbrella(db, base);
    expect(withLineageUmbrella(db, once)).toBe(once); // já aplicado
    expect(withLineageUmbrella(db, other)).toBe(other); // outra espécie
    expect(withLineageUmbrella(null, base)).toBe(base); // sem db
  });

  it('dá o rótulo do seletor de linhagem (o dado não tem o que ler aqui)', () => {
    expect(lineageUmbrellaName(base)).toBe(UMBRELLA_TRAIT);
    expect(lineageUmbrellaName(other)).toBeNull();
    expect(lineageSelectorLabel(withLineageUmbrella(db, base))).toBe(UMBRELLA_TRAIT);
  });
});

describe('as linhagens do Halfling', () => {
  it('são as quatro, cada uma com a procedência do livro que a nomeou', () => {
    const versions = halflingLineageVersions(db, base);
    expect(versions.map((v) => v.name)).toEqual([
      'Halfling; Lightfoot Lineage',
      'Halfling; Stout Lineage',
      'Halfling; Ghostwise Lineage',
      'Halfling; Lotusden Lineage',
    ]);
    expect(versions.map((v) => v.source)).toEqual(['PHB', 'PHB', 'SCAG', 'EGW']);
    expect(halflingLineageVersions(db, other)).toEqual([]);
  });

  it('cada uma TROCA o traço absorvido - nunca soma a ele', () => {
    const byName = Object.fromEntries(raceLineages(db, base).map((v) => [v.name, v]));
    for (const spec of HALFLING_LINEAGES) {
      const v = byName[halflingVersionName(spec.lineage)];
      const traits = v.entries.map((e) => e.name);
      // O guarda-chuva vira "Halfling Lineage (X)"; nenhuma delas acumula o
      // Naturally Stealthy, que é o traço de UMA das opções.
      expect(traits).toEqual(['Brave', 'Luck', `${UMBRELLA_TRAIT} (${spec.lineage})`]);
    }
  });

  it('o Lightfoot reproduz a base 2024 exatamente (nada muda além do nome)', () => {
    const v = raceLineages(db, base).find((x) => x.name === 'Halfling; Lightfoot Lineage');
    expect(v.speed).toBe(30);
    expect(v.resist).toBeUndefined();
    expect(v.additionalSpells).toBeUndefined();
    expect(v.entries[2].entries[0]).toMatchObject({ name: 'Naturally Stealthy' });
  });

  it('as demais levam os campos estruturados da sub-raça 2014', () => {
    const byName = Object.fromEntries(raceLineages(db, base).map((v) => [v.name, v]));
    expect(byName['Halfling; Stout Lineage'].resist).toEqual(['poison']);
    // Sem normalizar: o atributo de conjuração segue FIXO em Sabedoria (2014).
    expect(byName['Halfling; Lotusden Lineage'].additionalSpells).toEqual([
      { ability: 'wis', known: { 1: ['druidcraft#c'] } },
    ]);
    // Os dois traços do Lotusden entram no mesmo guarda-chuva…
    expect(byName['Halfling; Lotusden Lineage'].entries[2].entries.map((e) => e.name)).toEqual([
      'Child of the Wood', 'Timberwalk',
    ]);
    // …e a prosa 2014 do Ghostwise ("Size") cai, como em toda sub-raça legada.
    expect(byName['Halfling; Ghostwise Lineage'].entries[2].entries.map((e) => e.name)).toEqual(['Silent Speech']);
  });

  it('passam a OBRIGAR a escolha de linhagem (não são acréscimo opcional)', () => {
    expect(requiresLineage(db, base)).toBe(true);
    for (const v of halflingLineageVersions(db, base)) expect(v._legacy).toBeUndefined();
  });

  it('não adiam escolha nenhuma: a base do Halfling não gera as que a linhagem resolve', () => {
    // A regra do DDL-0062 só age sobre campo que a BASE tem; o Halfling não tem
    // resist/additionalSpells/perícia, então nada é escondido.
    expect([...lineageDeferredKinds(db, withLineageUmbrella(db, base))]).toEqual([]);
  });

  it('sem as sub-raças no compêndio, a espécie fica exatamente como está hoje', () => {
    const bare = { races: { race: db.races.race, subrace: [] } };
    // Só o Lightfoot seria montável (o traço dele vive na base), e uma opção só
    // não é escolha: nada de guarda-chuva, e o Naturally Stealthy fica no lugar.
    expect(halflingLineageVersions(bare, base)).toEqual([]);
    expect(withLineageUmbrella(bare, base)).toBe(base);
    expect(requiresLineage(bare, base)).toBe(false);
  });
});

describe('migração das formas antigas', () => {
  it('espécie à parte volta a ser Halfling XPHB + linhagem, zerando o bag', () => {
    expect(migrateHalflingSpecies({ id: 'halfling (ghostwise)', source: 'SCAG', choices: { a: 1 } })).toEqual({
      id: 'halfling', source: 'XPHB', lineage: 'Halfling; Ghostwise Lineage', choices: {},
    });
    expect(migrateHalflingSpecies({ id: 'halfling (lotusden)', source: 'EGW' })).toMatchObject({
      id: 'halfling', lineage: 'Halfling; Lotusden Lineage',
    });
  });

  it('Halfling XPHB sem linhagem recebe Lightfoot - sem perda e sem zerar o bag', () => {
    expect(migrateHalflingSpecies({ id: 'halfling', source: 'XPHB', lineage: null, choices: { a: 1 } })).toEqual({
      id: 'halfling', source: 'XPHB', lineage: 'Halfling; Lightfoot Lineage', choices: { a: 1 },
    });
  });

  it('não mexe em quem já tem linhagem nem em outra espécie', () => {
    const chosen = { id: 'halfling', source: 'XPHB', lineage: 'Halfling; Stout Lineage' };
    expect(migrateHalflingSpecies(chosen)).toBe(chosen);
    const elf = { id: 'elf', source: 'XPHB' };
    expect(migrateHalflingSpecies(elf)).toBe(elf);
    expect(migrateHalflingSpecies(null)).toBeNull();
  });
});
