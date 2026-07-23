import { describe, it, expect } from 'vitest';
import { MERGED_LINEAGES, isFoldedSpecies, mergedLineageVersions } from './mergedLineages';
import { raceLineages, requiresLineage, speciesCatalog } from './speciesData';

// Recorte real: a base mainstream (Elf|XPHB com "Elven Lineage"; Fairy|MPMM sem
// linhagem) + a reimpressão LFL em `_copy` que traz as linhagens de cenário.
const elfLFLVersions = [
  {
    name: 'Elf; Lorwyn Lineage',
    source: 'LFL',
    _mod: { entries: { mode: 'replaceArr', replace: 'Elven Lineage', items: { type: 'entries', name: 'Elven Lineage (Lorwyn)', entries: ['lorwyn'] } } },
  },
  {
    name: 'Elf; Shadowmoor Lineage',
    source: 'LFL',
    darkvision: 120,
    _mod: { entries: { mode: 'replaceArr', replace: 'Elven Lineage', items: { type: 'entries', name: 'Elven Lineage (Shadowmoor)', entries: ['shadowmoor'] } } },
  },
];

const faerieLFLVersions = [
  { name: 'Faerie; Lorwyn', source: 'LFL', _mod: { entries: [{ mode: 'removeArr', names: 'Faerie Lineage' }] } },
  { name: 'Faerie; Shadowmoor', source: 'LFL', darkvision: 120, _mod: { entries: [{ mode: 'removeArr', names: 'Faerie Lineage' }] } },
];

const db = {
  races: {
    race: [
      {
        name: 'Elf',
        source: 'XPHB',
        speed: 30,
        size: ['M'],
        _versions: [
          { name: 'Elf; Drow Lineage', source: 'XPHB', _mod: { entries: { mode: 'replaceArr', replace: 'Elven Lineage', items: { type: 'entries', name: 'Elven Lineage (Drow)', entries: ['drow'] } } } },
        ],
        entries: [
          { type: 'entries', name: 'Darkvision', entries: ['60'] },
          { type: 'entries', name: 'Elven Lineage', entries: ['escolha'] },
        ],
      },
      // Reimpressão que SUBSTITUI o "Elven Lineage" - herda speed/size por _copy.
      { name: 'Elf', source: 'LFL', _copy: { name: 'Elf', source: 'XPHB' }, _versions: elfLFLVersions },
      {
        name: 'Fairy',
        source: 'MPMM',
        speed: { walk: 30, fly: true },
        size: ['S'],
        entries: [{ type: 'entries', name: 'Fairy Magic', entries: ['magia'] }],
      },
      // Reimpressão que ACRESCENTA linhagens - herda tudo por _copy.
      { name: 'Faerie', source: 'LFL', _copy: { name: 'Fairy', source: 'MPMM' }, _versions: faerieLFLVersions },
    ],
    subrace: [],
  },
};

const elf = db.races.race[0];
const fairy = db.races.race[2];

describe('mergedLineages', () => {
  it('marca as reimpressões LFL como fundidas (saem do seletor)', () => {
    expect(isFoldedSpecies(db.races.race[1])).toBe(true); // Elf|LFL
    expect(isFoldedSpecies(db.races.race[3])).toBe(true); // Faerie|LFL
    expect(isFoldedSpecies(elf)).toBe(false);
    expect(isFoldedSpecies(fairy)).toBe(false);
  });

  it('devolve os `_versions` da reimpressão para a base mainstream', () => {
    expect(mergedLineageVersions(db, elf).map((v) => v.name)).toEqual([
      'Elf; Lorwyn Lineage',
      'Elf; Shadowmoor Lineage',
    ]);
    expect(mergedLineageVersions(db, fairy).map((v) => v.name)).toEqual([
      'Faerie; Lorwyn',
      'Faerie; Shadowmoor',
    ]);
    expect(mergedLineageVersions(db, { name: 'Human', source: 'XPHB' })).toEqual([]);
  });

  it('funde as linhagens LFL na base, preservando a fonte LFL (lore/arte)', () => {
    const names = raceLineages(db, elf).map((v) => v.name);
    expect(names).toContain('Elf; Drow Lineage');
    expect(names).toContain('Elf; Lorwyn Lineage');
    expect(names).toContain('Elf; Shadowmoor Lineage');
    const lorwyn = raceLineages(db, elf).find((v) => v.name === 'Elf; Lorwyn Lineage');
    expect(lorwyn.source).toBe('LFL'); // fluff/arte resolvem pela fonte LFL
    expect(lorwyn._baseName).toBe('Elf');
    // o `_mod` replaceArr aplicou sobre o "Elven Lineage" da base XPHB
    expect(lorwyn.entries.some((e) => e.name === 'Elven Lineage (Lorwyn)')).toBe(true);
    // override próprio da versão (Shadowmoor = darkvision 120) sobrevive
    expect(raceLineages(db, elf).find((v) => v.name === 'Elf; Shadowmoor Lineage').darkvision).toBe(120);
  });

  it('Elf CONTINUA exigindo linhagem (as fundidas são opções obrigatórias)', () => {
    expect(requiresLineage(db, elf)).toBe(true);
    for (const v of raceLineages(db, elf)) expect(v._legacy).toBeFalsy();
  });

  it('Fairy NÃO passa a exigir linhagem (as fundidas são acréscimos opcionais)', () => {
    expect(requiresLineage(db, fairy)).toBe(false);
    const merged = raceLineages(db, fairy);
    expect(merged.map((v) => v.name)).toEqual(['Faerie; Lorwyn', 'Faerie; Shadowmoor']);
    for (const v of merged) expect(v._legacy).toBe(true);
    // removeArr sem alvo no Fairy cru é no-op: nada quebra
    expect(merged[0].entries.some((e) => e.name === 'Fairy Magic')).toBe(true);
  });

  it('speciesCatalog resolve `_copy`: a reimpressão herda speed/size da base', () => {
    const cat = speciesCatalog(db);
    const elfLFL = cat.find((r) => r.name === 'Elf' && r.source === 'LFL');
    expect(elfLFL.speed).toBe(30); // herdado de Elf|XPHB (era undefined → 0)
    expect(elfLFL.size).toEqual(['M']);
    const faerie = cat.find((r) => r.name === 'Faerie' && r.source === 'LFL');
    expect(faerie.speed).toEqual({ walk: 30, fly: true });
  });

  it('o registro é fechado e bem formado', () => {
    expect(MERGED_LINEAGES.length).toBeGreaterThan(0);
    for (const e of MERGED_LINEAGES) {
      expect(e.base).toMatch(/\|/);
      expect(e.from).toMatch(/\|/);
    }
  });
});
