import { describe, it, expect } from 'vitest';
import {
  LEGACY_FIENDISH_LEGACIES,
  legacyLegacyVersions,
  legacyVersionName,
  withLegacyTable,
  migrateLegacyTiefling,
} from './legacyFiendishLegacies';
import { raceLineages } from './speciesData';

// --- Recorte real do dado ----------------------------------------------------
// Tiefling XPHB com a versão oficial "Infernal Legacy" (o TEMPLATE de texto) e o
// traço guarda-chuva com a tabela; mais duas sub-raças 2014 em db.races.subrace.
const TEMPLATE_P1 =
  'You are the recipient of a legacy that grants you supernatural abilities. You have {@variantrule Resistance|XPHB} to Fire damage. You also know the {@spell Fire Bolt|XPHB} cantrip.';
const TEMPLATE_P2 =
  "When you reach character level 3, you learn the {@spell Hellish Rebuke|XPHB} spell. When you reach character level 5, you also learn the {@spell Darkness|XPHB} spell. You always have these spells prepared, and you can cast each spell once without a spell slot. Once you cast either of these spells with this trait, you can't cast that spell with it again until you finish a {@variantrule Long Rest|XPHB}. You can also cast the spell using any spell slots you have of the appropriate level.";
const TEMPLATE_P3 =
  'Intelligence, Wisdom, or Charisma is your spellcasting ability for the spells you cast with this trait (choose the ability when you select the legacy).';

function makeDb() {
  const tiefling = {
    name: 'Tiefling',
    source: 'XPHB',
    size: ['S', 'M'],
    speed: 30,
    darkvision: 60,
    resist: [{ choose: { from: ['poison', 'necrotic', 'fire'] } }],
    additionalSpells: [{ name: 'Infernal', ability: { choose: ['int', 'wis', 'cha'] }, known: { 1: ['thaumaturgy|xphb#c', 'fire bolt|xphb#c'] } }],
    entries: [
      { type: 'entries', name: 'Darkvision', entries: ['60 ft'] },
      {
        type: 'entries',
        name: 'Fiendish Legacy',
        entries: [
          'Choose a legacy from the Fiendish Legacies table.',
          {
            type: 'table',
            caption: 'Fiendish Legacies',
            colLabels: ['Legacy', 'Level 1', 'Level 3', 'Level 5'],
            rows: [
              ['Abyssal', 'poison…', '{@spell Ray of Sickness|XPHB}', '{@spell Hold Person|XPHB}'],
              ['Chthonic', 'necrotic…', '{@spell False Life|XPHB}', '{@spell Ray of Enfeeblement|XPHB}'],
              ['Infernal', 'fire…', '{@spell Hellish Rebuke|XPHB}', '{@spell Darkness|XPHB}'],
            ],
          },
        ],
      },
      { type: 'entries', name: 'Otherworldly Presence', entries: ['You know the Thaumaturgy cantrip.'] },
    ],
    _versions: [
      {
        name: 'Tiefling; Infernal Legacy',
        source: 'XPHB',
        resist: ['fire'],
        _mod: {
          entries: {
            mode: 'replaceArr',
            replace: 'Fiendish Legacy',
            items: { name: 'Fiendish Legacy (Infernal)', type: 'entries', entries: [TEMPLATE_P1, TEMPLATE_P2, TEMPLATE_P3] },
          },
        },
      },
    ],
  };
  const sub = (name, source, entries) => ({ name, source, raceName: 'Tiefling', raceSource: 'PHB', ability: [{ cha: 2 }], entries });
  return {
    races: {
      race: [tiefling],
      subrace: [
        sub('Zariel', 'MTF', [{ type: 'entries', name: 'Legacy of Avernus', entries: ['prosa 2014'], data: { overwrite: 'Infernal Legacy' } }]),
        sub('Variant; Winged', 'SCAG', [
          { type: 'entries', name: 'Appearance', entries: ['Your tiefling might not look like other tieflings…'] },
          { type: 'entries', name: 'Winged', entries: ['You have bat-like wings. You have a flying speed of 30 feet.'], data: { overwrite: 'Infernal Legacy' } },
        ]),
        sub('Levistus', 'MTF', [{ type: 'entries', name: 'Legacy of Stygia', entries: ['prosa 2014'], data: { overwrite: 'Infernal Legacy' } }]),
      ],
    },
  };
}

const versionsOf = (db) => {
  const race = db.races.race[0];
  return new Map(legacyLegacyVersions(db, race).map((v) => [v.name, v]));
};

describe('LEGACY_FIENDISH_LEGACIES (registro curado, DDL-0061)', () => {
  it('são 11: as 12 sub-raças menos as duas redundantes, e sem repetição', () => {
    expect(LEGACY_FIENDISH_LEGACIES).toHaveLength(11);
    const froms = LEGACY_FIENDISH_LEGACIES.map((s) => s.from);
    expect(new Set(froms).size).toBe(froms.length);
    expect(froms).not.toContain('Asmodeus|MTF'); // sem mecânica no dado
    expect(froms).not.toContain('Variant; Infernal Legacy|SCAG'); // = Infernal 2024
  });

  it('as 4 cujo cantrip era Thaumaturgy ficam SEM cantrip próprio', () => {
    // Thaumaturgy já vem do Otherworldly Presence; concedê-lo de novo seria o
    // ganho de graça que esta reescrita existe para evitar.
    const semCantrip = LEGACY_FIENDISH_LEGACIES.filter((s) => !s.cantrip).map((s) => s.legacy);
    expect(semCantrip).toEqual(['Baalzebul', 'Dispater', 'Zariel', 'Hellfire', 'Winged']);
  });

  it('toda magia é remapeada para XPHB', () => {
    for (const spec of LEGACY_FIENDISH_LEGACIES) {
      for (const ref of [spec.cantrip, spec.level3, spec.level5].filter(Boolean)) {
        expect(ref).toMatch(/\|xphb(#|$)/);
      }
    }
    // "Branding Smite" não existe em 2024 - foi reimpressa como "Shining Smite".
    const zariel = LEGACY_FIENDISH_LEGACIES.find((s) => s.legacy === 'Zariel');
    expect(zariel.level5).toBe('shining smite|xphb');
  });
});

describe('geração das variantes', () => {
  const db = makeDb();
  const versions = versionsOf(db);

  it('gera uma variante por legacy, com a procedência como fonte', () => {
    expect(versions.size).toBe(3); // só as 3 sub-raças presentes neste db de teste
    const zariel = versions.get('Tiefling; Zariel Legacy');
    expect(zariel.source).toBe('MTF');
    expect(zariel._legacy).toBe(true);
  });

  it('trava a resistência em fogo e o atributo em Int/Wis/Cha', () => {
    const zariel = versions.get('Tiefling; Zariel Legacy');
    expect(zariel.resist).toEqual(['fire']); // nunca a escolha livre da base 2024
    expect(zariel.additionalSpells[0].ability).toEqual({ choose: ['int', 'wis', 'cha'] });
  });

  it('concede Thaumaturgy + as magias de 3/5, e só o cantrip próprio quando há', () => {
    const zariel = versions.get('Tiefling; Zariel Legacy').additionalSpells[0];
    expect(zariel.known).toEqual({ 1: ['thaumaturgy|xphb#c'] }); // sem cantrip próprio
    expect(zariel.innate).toEqual({
      3: { daily: { 1: ['searing smite|xphb#2'] } },
      5: { daily: { 1: ['shining smite|xphb'] } },
    });

    const levistus = versions.get('Tiefling; Levistus Legacy').additionalSpells[0];
    expect(levistus.known).toEqual({ 1: ['thaumaturgy|xphb#c', 'ray of frost|xphb#c'] });
  });

  it('o TEXTO é montado sobre o template oficial, sem prosa nossa', () => {
    const entry = versions.get('Tiefling; Levistus Legacy')._mod.entries[0].items;
    expect(entry.name).toBe('Fiendish Legacy (Levistus)');
    const [p1, p2, p3] = entry.entries;
    // p1: mesma frase de resistência a fogo do template, com o cantrip trocado
    expect(p1).toContain('{@variantrule Resistance|XPHB} to Fire damage');
    expect(p1).toContain('{@spell Ray of Frost|XPHB} cantrip');
    expect(p1).not.toContain('Fire Bolt');
    // p2: as duas magias trocadas + a nota de conjuração no 2º círculo (#2)
    expect(p2).toContain('{@spell Armor of Agathys|XPHB}');
    expect(p2).toContain('{@spell Darkness|XPHB}');
    expect(p2).not.toContain('Hellish Rebuke');
    expect(p2).toContain('as a level 2 spell');
    // p3: a frase do atributo, intacta
    expect(p3).toBe(TEMPLATE_P3);
  });

  it('sem cantrip próprio, a frase do cantrip é REMOVIDA (não fica a do template)', () => {
    const [p1] = versions.get('Tiefling; Zariel Legacy')._mod.entries[0].items.entries;
    expect(p1).toContain('to Fire damage.');
    expect(p1).not.toContain('cantrip');
    expect(p1).not.toContain('{@spell');
  });

  it('Winged: voo, sem magias, e o texto do benefício vem da sub-raça', () => {
    const winged = versions.get('Tiefling; Winged Legacy');
    expect(winged.speed).toEqual({ walk: 30, fly: 30 });
    // Thaumaturgy continua (é o Otherworldly Presence da base), sem 3/5.
    expect(winged.additionalSpells[0].known).toEqual({ 1: ['thaumaturgy|xphb#c'] });
    expect(winged.additionalSpells[0].innate).toBeUndefined();
    const paragraphs = winged._mod.entries[0].items.entries;
    expect(paragraphs.some((p) => p.includes('bat-like wings'))).toBe(true);
    expect(paragraphs.some((p) => p.includes('character level 3'))).toBe(false);
  });

  it('os traços extras da variante SCAG seguem junto (Appearance)', () => {
    const winged = versions.get('Tiefling; Winged Legacy');
    const append = winged._mod.entries.find((op) => op.mode === 'appendArr');
    expect(append.items.map((e) => e.name)).toEqual(['Appearance']);
    expect(append.items[0].data).toBeUndefined(); // sem o overwrite da origem
  });

  it('entra em raceLineages como variante concreta, ao lado das nativas', () => {
    const race = db.races.race[0];
    const lineages = raceLineages(db, race);
    const names = lineages.map((v) => v.name);
    expect(names[0]).toBe('Tiefling; Infernal Legacy'); // as nativas primeiro
    expect(names).toContain('Tiefling; Zariel Legacy');

    const zariel = lineages.find((v) => v.name === 'Tiefling; Zariel Legacy');
    // O `_mod` foi APLICADO: o traço guarda-chuva (com a tabela) sumiu.
    const traits = zariel.entries.map((e) => e.name);
    expect(traits).toEqual(['Darkvision', 'Fiendish Legacy (Zariel)', 'Otherworldly Presence']);
    expect(zariel.darkvision).toBe(60); // herda o chassi 2024
    expect(zariel._baseName).toBe('Tiefling');
  });

  it('não vaza para outra espécie nem para a base legada', () => {
    expect(legacyLegacyVersions(db, { name: 'Elf', source: 'XPHB' })).toEqual([]);
    expect(legacyLegacyVersions(db, { name: 'Tiefling', source: 'PHB' })).toEqual([]);
    expect(legacyLegacyVersions(null, db.races.race[0])).toEqual([]);
  });

  it('sem o template oficial no dado, não inventa texto: não gera nada', () => {
    const race = { ...db.races.race[0], _versions: [] };
    expect(legacyLegacyVersions({ races: db.races }, race)).toEqual([]);
  });
});

describe('tabela de Fiendish Legacies no preview', () => {
  const db = makeDb();
  const race = db.races.race[0];

  it('anexa uma linha por legacy legada, sem tocar nas oficiais', () => {
    const entries = withLegacyTable(db, race);
    const table = entries.find((e) => e.name === 'Fiendish Legacy').entries.find((e) => e.type === 'table');
    expect(table.rows).toHaveLength(3 + 3);
    expect(table.rows.slice(0, 3).map((r) => r[0])).toEqual(['Abyssal', 'Chthonic', 'Infernal']);

    const [label, level1, l3, l5] = table.rows.find((r) => r[0] === 'Levistus');
    expect(label).toBe('Levistus');
    // A abertura genérica ("You are the recipient…") não vai para a célula.
    expect(level1).not.toContain('recipient');
    expect(level1).toContain('to Fire damage');
    expect(l3).toBe('{@spell Armor of Agathys|XPHB}');
    expect(l5).toBe('{@spell Darkness|XPHB}');
  });

  it('a legacy sem magias mostra "—" nas colunas de nível', () => {
    const entries = withLegacyTable(db, race);
    const table = entries.find((e) => e.name === 'Fiendish Legacy').entries.find((e) => e.type === 'table');
    expect(table.rows.find((r) => r[0] === 'Winged').slice(2)).toEqual(['—', '—']);
  });

  it('não muda o objeto original e é idempotente', () => {
    const before = race.entries.find((e) => e.name === 'Fiendish Legacy').entries.find((e) => e.type === 'table').rows.length;
    const once = withLegacyTable(db, race);
    expect(before).toBe(3); // o dado cru continua com as 3 oficiais
    // Rodar de novo sobre o resultado não duplica (dedup pelo rótulo).
    const twice = withLegacyTable(db, { ...race, entries: once });
    const table = twice.find((e) => e.name === 'Fiendish Legacy').entries.find((e) => e.type === 'table');
    expect(table.rows).toHaveLength(6);
  });

  it('outra espécie passa intacta (mesma referência)', () => {
    const elf = { name: 'Elf', source: 'XPHB', entries: [{ name: 'Trance' }] };
    expect(withLegacyTable(db, elf)).toBe(elf.entries);
  });
});

describe('migração das espécies legadas do DDL-0060', () => {
  it('"Tiefling (Zariel)" vira Tiefling XPHB + linhagem', () => {
    const migrated = migrateLegacyTiefling({ id: 'tiefling (zariel)', source: 'MTF', lineage: null, choices: { 'size-0': {} } });
    expect(migrated).toEqual({ id: 'tiefling', source: 'XPHB', lineage: legacyVersionName('Zariel'), choices: {} });
  });

  it('cobre as variantes SCAG, cujo nome de espécie trazia o prefixo "Variant;"', () => {
    const migrated = migrateLegacyTiefling({ id: 'tiefling (variant; winged)', source: 'SCAG' });
    expect(migrated.lineage).toBe('Tiefling; Winged Legacy');
  });

  it('qualquer outra espécie passa intacta (mesma referência)', () => {
    const species = { id: 'elf', source: 'XPHB', lineage: 'Elf; Drow Lineage' };
    expect(migrateLegacyTiefling(species)).toBe(species);
    expect(migrateLegacyTiefling(null)).toBeNull();
  });
});
