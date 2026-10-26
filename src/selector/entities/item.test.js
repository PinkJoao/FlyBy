// =============================================================================
// item.test: testes da entity de item
// =============================================================================
// O QUE FAZ
//   A raridade (o badge só nos tiers, o rótulo que casa com a opção do filtro,
//   os valores não-tier, DDL-0078), o filtro de categoria de armadura (Light,
//   Medium, Heavy, Shield) e a ordenação padrão (naturalSort por raridade, com
//   itens mundanos antes dos comuns e ordem alfabética dentro de cada raridade).
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import itemEntity, { formatPrice } from './item';
import { sortList } from '../../sorting';

describe('formatPrice', () => {
  it('>= 100 cp -> gp', () => {
    expect(formatPrice({ value: 200 })).toBe('2gp');
    expect(formatPrice({ value: 5000 })).toBe('50gp');
  });

  it('10-99 cp -> sp', () => {
    expect(formatPrice({ value: 50 })).toBe('5sp');
  });

  it('< 10 cp -> cp', () => {
    expect(formatPrice({ value: 5 })).toBe('5cp');
  });

  it('sem value -> null (sem preço listado)', () => {
    expect(formatPrice({})).toBeNull();
    expect(formatPrice(null)).toBeNull();
  });
});

describe('itemEntity', () => {
  const longsword = { name: 'Longsword', source: 'XPHB', type: 'M|XPHB', weaponCategory: 'martial', weight: 3, value: 1500 };
  const cloak = { name: 'Cloak of Protection', source: 'XDMG', wondrous: true, rarity: 'uncommon', reqAttune: true };
  const modernGun = { name: 'Automatic Rifle', source: 'DMG', type: 'R|DMG', age: 'modern' };

  it('list: junta items-base + items.item, excluindo itens de outra era (age)', () => {
    const db = {
      'items-base': { baseitem: [longsword, modernGun] },
      items: { item: [cloak] },
    };
    const list = itemEntity.list(db);
    expect(list.map((i) => i.name)).toEqual(['Longsword', 'Cloak of Protection']);
  });

  it('idOf: "Nome|Fonte"', () => {
    expect(itemEntity.idOf(longsword)).toBe('Longsword|XPHB');
  });

  it('precompute: filterValues cobre tipo, raridade e atunement', () => {
    const p = itemEntity.precompute(cloak);
    expect(p.filterValues.rarity).toEqual(['Uncommon']);
    expect(p.filterValues.attunement).toEqual(['Requires Attunement']);
    expect(p.filterValues.type).toEqual(['Wondrous Items']);
    expect(p.filterValues.armorCategory).toEqual([]);
  });

  it('filtro de Armor Category: emite Light, Medium, Heavy e Shield, casando com as opções', () => {
    const armorFilter = itemEntity.filters.find((f) => f.id === 'armorCategory');
    expect(armorFilter.options).toEqual(['Light', 'Medium', 'Heavy', 'Shield']);
    const cases = [
      [{ name: 'Leather Armor', source: 'XPHB', type: 'LA|XPHB' }, 'Light'],
      [{ name: 'Breastplate', source: 'XPHB', type: 'MA|XPHB' }, 'Medium'],
      [{ name: 'Plate Armor', source: 'XPHB', type: 'HA|XPHB' }, 'Heavy'],
      [{ name: 'Shield', source: 'XPHB', type: 'S|XPHB' }, 'Shield'],
    ];
    for (const [raw, expected] of cases) {
      expect(itemEntity.precompute(raw).filterValues.armorCategory).toEqual([expected]);
      expect(armorFilter.options).toContain(expected);
    }
  });

  it('card: tipo em texto simples + preço (sem peso/source/badge de tipo)', () => {
    const c = itemEntity.card(longsword);
    expect(c.title).toBe('Longsword');
    expect(c.meta).toBe('Martial Weapon · 15gp');
    expect(c.badges).toBeUndefined();
    expect(c.rarity).toBeNull();
  });

  it('card: raridade vira badge pequeno colorido pela raridade', () => {
    const c = itemEntity.card(cloak);
    expect(c.rarity).toEqual({ label: 'Uncommon', color: 'var(--rarity-uncommon)' });
  });

  it('raridade de DUAS palavras casa a opção do filtro (era "Very rare")', () => {
    const staff = { name: 'Staff of Power', source: 'XDMG', rarity: 'very rare' };
    const option = itemEntity.filters.find((f) => f.id === 'rarity').options;
    expect(itemEntity.precompute(staff).filterValues.rarity).toEqual(['Very Rare']);
    expect(option).toContain('Very Rare');
    expect(itemEntity.card(staff).rarity.label).toBe('Very Rare');
  });

  it('toda opção de raridade é um valor que o precompute realmente emite', () => {
    for (const label of itemEntity.filters.find((f) => f.id === 'rarity').options) {
      const raw = label === 'None' ? {} : { rarity: label.toLowerCase() };
      expect(itemEntity.precompute({ name: 'x', source: 'X', ...raw }).filterValues.rarity).toEqual([label]);
    }
  });
});

describe('ordenação por raridade (naturalSort)', () => {
  const items = [
    { name: 'Vorpal Sword', rarity: 'legendary' },
    { name: 'Chain Mail' },
    { name: '+1 Breastplate', rarity: 'rare' },
    { name: 'Mystery Relic', rarity: 'unknown' },
    { name: 'Breastplate', rarity: 'none' },
    { name: 'Armor of Gleaming', rarity: 'common' },
    { name: 'Cloak of Protection', rarity: 'uncommon' },
    { name: 'Armor of Acid Resistance', rarity: 'rare' },
    { name: 'Staff of Power', rarity: 'very rare' },
    { name: 'Book of Vile Darkness', rarity: 'artifact' },
  ];

  it('padrão (asc): mundanos primeiro (sem rarity ou none), depois common -> artifact, alfabético em cada tier, e unknown no fim', () => {
    const sorted = sortList(items, { option: itemEntity.naturalSort, dir: 'asc' });
    expect(sorted.map((i) => i.name)).toEqual([
      'Breastplate',
      'Chain Mail',
      'Armor of Gleaming',
      'Cloak of Protection',
      'Armor of Acid Resistance',
      '+1 Breastplate',
      'Staff of Power',
      'Vorpal Sword',
      'Book of Vile Darkness',
      'Mystery Relic',
    ]);
  });

  it('invertida (desc): do artefato ao mundano, alfabético em cada tier, e unknown no fim', () => {
    const sorted = sortList(items, { option: itemEntity.naturalSort, dir: 'desc' });
    expect(sorted.map((i) => i.name)).toEqual([
      'Book of Vile Darkness',
      'Vorpal Sword',
      'Staff of Power',
      'Armor of Acid Resistance',
      '+1 Breastplate',
      'Cloak of Protection',
      'Armor of Gleaming',
      'Breastplate',
      'Chain Mail',
      'Mystery Relic',
    ]);
  });
});

describe('filtro de Raridade - os valores não-tier do dado (A3)', () => {
  const rarityFilter = itemEntity.filters.find((f) => f.id === 'rarity');

  it('as três raridades não-tier têm chip, com o valor IDÊNTICO ao emitido', () => {
    for (const raw of ['unknown', 'unknown (magic)', 'varies']) {
      const emitted = itemEntity.precompute({ name: 'X', rarity: raw }).filterValues.rarity[0];
      expect(rarityFilter.options).toContain(emitted);
    }
  });

  it('o rótulo sai legível, não a grafia crua do dado', () => {
    expect(itemEntity.precompute({ name: 'X', rarity: 'unknown (magic)' }).filterValues.rarity)
      .toEqual(['Unknown (Magic)']);
  });

  it('não vira badge de raridade no card (só os tiers reais recebem)', () => {
    expect(itemEntity.card({ name: 'X', rarity: 'varies' }).rarity).toBeNull();
  });
});
