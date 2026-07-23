import { describe, it, expect } from 'vitest';
import raceEntity from './race';
import { applyFilters } from '../filterModel';
import { elfSpecies } from '../../engine/fixtures/speciesData';

// Minimal flying race (real shape) to test the Fly filter.
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
    expect(p.filterValues.speed).toEqual(['walk']); // speed 30, no fly
    expect(p.filterValues.trait).toContain('darkvision'); // darkvision 60
    expect(p.filterValues.trait).toContain('skill-proficiency'); // skillProficiencies
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
  // Plane Shift, mas espécie ÚNICA: não colide com nada, então NÃO é variante.
  const siren = { name: 'Siren', source: 'PSX', size: ['M'], speed: { walk: 25, fly: 30 } };
  const raw = [elfSpecies, zendikarElf, lorwynElf, siren];
  const items = raw.map((r) => ({ id: raceEntity.idOf(r), raw: r, ...raceEntity.precompute(r) }));

  it('marca a que COLIDE de nome, não a fonte inteira', () => {
    expect(raceEntity.precompute(zendikarElf).filterValues.variant).toEqual(['setting']);
    // Siren é Plane Shift também, mas é espécie única: fica visível.
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
          { name: 'Human (Ixalan)', source: 'PSX' }, // vazia
          { name: 'Human (Kaladesh)', source: 'PSK' }, // vazia
          { name: 'Human (Zendikar)', source: 'PSZ' }, // vazia
          { name: 'Human (Innistrad)', source: 'PSI' },
          { name: 'Aven', source: 'PSA' },
          { name: 'Aven', source: 'PSD' }, // redundante
        ],
      },
    };
    expect(raceEntity.list(db).map(raceEntity.idOf)).toEqual([
      'Human|XPHB',
      'Human (Innistrad)|PSI', // vazia na base, mas tem linhagens com conteúdo
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
        // stub `_copy`: sem entries e sem images próprias (o caso das linhagens)
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

  it('resolve `_copy`: a linhagem herda lore e arte da base', () => {
    const f = raceEntity.fluff({ name: 'Aven (Ibis-Headed)', source: 'PSA', _baseName: 'Aven' }, db);
    expect(f.entries).toEqual(['lore do PSA']); // antes vinha vazio
    expect(f.images.map((i) => i.href.path)).toEqual([
      'races/PSA/Aven.webp',
      'races/PSA/Aven (Ibis-Headed).webp',
    ]);
  });

  it('Hawk-Headed herda a arte do Aven|PSD removido, e ela vem PRIMEIRO', () => {
    const f = raceEntity.fluff({ name: 'Aven (Hawk-Headed)', source: 'PSA', _baseName: 'Aven' }, db);
    expect(f.entries).toEqual(['lore do PSA']);
    // O DetailView mostra a primeira imagem: é a doada que representa a linhagem.
    expect(f.images.map((i) => i.href.path)).toEqual([
      'races/PSD/Aven.webp',
      'races/PSA/Aven.webp',
    ]);
  });

  it('espécie sem doação nem `_copy` segue como antes', () => {
    const f = raceEntity.fluff({ name: 'Aven', source: 'PSA' }, db);
    expect(f.images.map((i) => i.href.path)).toEqual(['races/PSA/Aven.webp']);
  });
});

describe('raceEntity.card', () => {
  it('badges show human-readable labels, not keys', () => {
    const badges = raceEntity.card(elfSpecies).badges;
    expect(badges).toContain('Darkvision'); // not 'darkvision'
  });
});
