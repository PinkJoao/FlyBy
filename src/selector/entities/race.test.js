// =============================================================================
// race.test: testes da entity de espécie
// =============================================================================
// O QUE FAZ
//   Os filtros (o de voo), as variantes de cenário por colisão de nome, as
//   espécies removidas, o fluff dos stubs `_copy`, a ordem das imagens (própria
//   e doada) e o fallback de fluff da linhagem curada (TC-0052).
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import raceEntity from './race';
import { applyFilters } from '../filterModel';
import { elfSpecies } from '../../engine/fixtures/speciesData';

const aarakocra = {
  name: 'Aarakocra',
  source: 'XPHB',
  size: ['M'],
  speed: { walk: 30, fly: 50 },
};

describe('raceEntity.precompute', () => {
  it('Elf (XPHB): size, speed and traits as stable keys', () => {
    const p = raceEntity.precompute(elfSpecies);
    expect(p.searchText).toContain('elf');
    expect(p.filterValues.size).toEqual(['M']);
    expect(p.filterValues.speed).toEqual(['walk']);
    expect(p.filterValues.trait).toContain('darkvision');
    expect(p.filterValues.trait).toContain('skill-proficiency');
  });

  it('flying race marks fly under speed (not duplicated in traits)', () => {
    const p = raceEntity.precompute(aarakocra);
    expect(p.filterValues.speed).toContain('fly');
    expect(p.filterValues.trait).not.toContain('fly');
  });
});

describe('species selector - end to end (precompute → filter)', () => {
  const raw = [elfSpecies, aarakocra];
  const items = raw.map((r) => ({ id: raceEntity.idOf(r), raw: r, ...raceEntity.precompute(r) }));

  it('including "fly" returns only the Aarakocra', () => {
    const out = applyFilters(items, { filterState: { speed: { fly: 'include' } } });
    expect(out.map((i) => i.id)).toEqual(['Aarakocra|XPHB']);
  });

  it('excluding "fly" returns only the Elf', () => {
    const out = applyFilters(items, { filterState: { speed: { fly: 'exclude' } } });
    expect(out.map((i) => i.id)).toEqual(['Elf|XPHB']);
  });
});

describe('variantes de CENÁRIO (engine/settingSpecies)', () => {
  const zendikarElf = { name: 'Elf (Zendikar)', source: 'PSZ', size: ['M'], speed: 30 };
  const lorwynElf = { name: 'Elf', source: 'LFL', size: ['M'], speed: 30 };
  const siren = { name: 'Siren', source: 'PSX', size: ['M'], speed: { walk: 25, fly: 30 } };
  const raw = [elfSpecies, zendikarElf, lorwynElf, siren];
  const items = raw.map((r) => ({ id: raceEntity.idOf(r), raw: r, ...raceEntity.precompute(r) }));

  it('marca a que COLIDE de nome, não a fonte inteira', () => {
    expect(raceEntity.precompute(zendikarElf).filterValues.variant).toEqual(['setting']);
    expect(raceEntity.precompute(siren).filterValues.variant).toEqual([]);
    expect(raceEntity.precompute(lorwynElf).filterValues.variant).toEqual([]);
    expect(raceEntity.precompute(elfSpecies).filterValues.variant).toEqual([]);
  });

  it('o padrão da entity esconde a variante e preserva o resto', () => {
    const out = applyFilters(items, { filterState: raceEntity.initialFilterState });
    expect(out.map((i) => i.id)).toEqual(['Elf|XPHB', 'Elf|LFL', 'Siren|PSX']);
  });

  it('sem o filtro (o usuário o removeu) todas voltam', () => {
    expect(applyFilters(items, { filterState: {} })).toHaveLength(4);
  });

  it('Variant vem logo acima de Source na ordem dos filtros', () => {
    const ids = raceEntity.filters.map((f) => f.id);
    expect(ids.indexOf('variant')).toBe(ids.indexOf('source') - 1);
  });

  it('a lista não oferece as removidas (vazias e redundantes)', () => {
    const db = {
      races: {
        race: [
          { name: 'Human', source: 'XPHB' },
          { name: 'Human (Ixalan)', source: 'PSX' },
          { name: 'Human (Kaladesh)', source: 'PSK' },
          { name: 'Human (Zendikar)', source: 'PSZ' },
          { name: 'Human (Innistrad)', source: 'PSI' },
          { name: 'Aven', source: 'PSA' },
          { name: 'Aven', source: 'PSD' },
        ],
      },
    };
    expect(raceEntity.list(db).map(raceEntity.idOf)).toEqual([
      'Human|XPHB',
      'Human (Innistrad)|PSI',
      'Aven|PSA',
    ]);
  });
});

describe('raceEntity.fluff', () => {
  const db = {
    'fluff-races': {
      raceFluff: [
        { name: 'Aven', source: 'PSA', entries: ['lore do PSA'], images: [{ href: { path: 'races/PSA/Aven.webp' } }] },
        { name: 'Aven', source: 'PSD', entries: ['lore do PSD'], images: [{ href: { path: 'races/PSD/Aven.webp' } }] },
        { name: 'Aven (Hawk-Headed)', source: 'PSA', _copy: { name: 'Aven', source: 'PSA' } },
        {
          name: 'Aven (Ibis-Headed)',
          source: 'PSA',
          _copy: {
            name: 'Aven',
            source: 'PSA',
            _mod: { images: { mode: 'appendArr', items: [{ href: { path: 'races/PSA/Aven (Ibis-Headed).webp' } }] } },
          },
        },
      ],
    },
  };

  it('resolve `_copy`: a linhagem herda lore da base', () => {
    const f = raceEntity.fluff({ name: 'Aven (Ibis-Headed)', source: 'PSA', _baseName: 'Aven' }, db);
    expect(f.entries).toEqual(['lore do PSA']);
  });

  it('a arte PRÓPRIA da linhagem vem PRIMEIRO (Ibis-Headed representa a si mesma)', () => {
    const f = raceEntity.fluff({ name: 'Aven (Ibis-Headed)', source: 'PSA', _baseName: 'Aven' }, db);
    expect(f.images.map((i) => i.href.path)).toEqual([
      'races/PSA/Aven (Ibis-Headed).webp',
      'races/PSA/Aven.webp',
    ]);
  });

  it('Hawk-Headed herda a arte do Aven|PSD removido, e ela vem PRIMEIRO', () => {
    const f = raceEntity.fluff({ name: 'Aven (Hawk-Headed)', source: 'PSA', _baseName: 'Aven' }, db);
    expect(f.entries).toEqual(['lore do PSA']);
    expect(f.images.map((i) => i.href.path)).toEqual([
      'races/PSD/Aven.webp',
      'races/PSA/Aven.webp',
    ]);
  });

  it('espécie sem doação nem `_copy` segue como antes', () => {
    const f = raceEntity.fluff({ name: 'Aven', source: 'PSA' }, db);
    expect(f.images.map((i) => i.href.path)).toEqual(['races/PSA/Aven.webp']);
  });

  describe('fallback pela fonte da BASE (`_baseSource`)', () => {
    const twoEditions = {
      'fluff-races': {
        raceFluff: [
          { name: 'Tiefling', source: 'PHB', entries: ['lore 2014'] },
          { name: 'Tiefling', source: 'XPHB', entries: ['lore 2024'] },
        ],
      },
    };

    it('linhagem de fonte sem fluff cai na lore da BASE, não na primeira da lista', () => {
      const f = raceEntity.fluff(
        { name: 'Tiefling; Zariel Legacy', source: 'MTF', _baseName: 'Tiefling', _baseSource: 'XPHB' },
        twoEditions,
      );
      expect(f.entries).toEqual(['lore 2024']);
    });

    it('sem `_baseSource` mantém o comportamento antigo (primeira de mesmo nome)', () => {
      const f = raceEntity.fluff({ name: 'Tiefling; X', source: 'MTF', _baseName: 'Tiefling' }, twoEditions);
      expect(f.entries).toEqual(['lore 2014']);
    });

    it('a fonte da PRÓPRIA linhagem continua vencendo o fallback da base', () => {
      const f = raceEntity.fluff(
        { name: 'Tiefling; Y', source: 'PHB', _baseName: 'Tiefling', _baseSource: 'XPHB' },
        twoEditions,
      );
      expect(f.entries).toEqual(['lore 2014']);
    });
  });
});

describe('raceEntity.card', () => {
  it('badges show human-readable labels, not keys', () => {
    const badges = raceEntity.card(elfSpecies).badges;
    expect(badges).toContain('Darkvision');
  });
});
