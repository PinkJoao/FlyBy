import { describe, it, expect } from 'vitest';
import itemEntity, { formatPrice } from './item';

describe('formatPrice', () => {
  it('>= 100 cp → gp', () => {
    expect(formatPrice({ value: 200 })).toBe('2gp');
    expect(formatPrice({ value: 5000 })).toBe('50gp');
  });

  it('10-99 cp → sp', () => {
    expect(formatPrice({ value: 50 })).toBe('5sp');
  });

  it('< 10 cp → cp', () => {
    expect(formatPrice({ value: 5 })).toBe('5cp');
  });

  it('sem value → null (sem preço listado)', () => {
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
  });

  it('card: tipo em texto simples + preço (sem peso/source/badge de tipo)', () => {
    const c = itemEntity.card(longsword);
    expect(c.title).toBe('Longsword');
    expect(c.meta).toBe('Martial Weapon · 15gp');
    expect(c.badges).toBeUndefined();
    expect(c.rarity).toBeNull(); // arma mundana → sem badge de raridade
  });

  it('card: raridade vira badge pequeno colorido pela raridade', () => {
    const c = itemEntity.card(cloak);
    expect(c.rarity).toEqual({ label: 'Uncommon', color: '#3fa14b' });
  });

  it('raridade de DUAS palavras casa a opção do filtro (era "Very rare")', () => {
    // O `cap` genérico só sobe a 1a letra, então "very rare" não casava com a
    // opção "Very Rare" e o chip nunca achava nenhum dos 732 itens.
    const staff = { name: 'Staff of Power', source: 'XDMG', rarity: 'very rare' };
    const option = itemEntity.filters.find((f) => f.id === 'rarity').options;
    expect(itemEntity.precompute(staff).filterValues.rarity).toEqual(['Very Rare']);
    expect(option).toContain('Very Rare');
    expect(itemEntity.card(staff).rarity.label).toBe('Very Rare');
  });

  it('toda opção de raridade é um valor que o precompute realmente emite', () => {
    // Guarda contra a divergência acima voltar por outra raridade.
    for (const label of itemEntity.filters.find((f) => f.id === 'rarity').options) {
      const raw = label === 'None' ? {} : { rarity: label.toLowerCase() };
      expect(itemEntity.precompute({ name: 'x', source: 'X', ...raw }).filterValues.rarity).toEqual([label]);
    }
  });
});

describe('filtro de Raridade - os valores não-tier do dado (A3)', () => {
  const rarityFilter = itemEntity.filters.find((f) => f.id === 'rarity');

  it('as três raridades não-tier têm chip, com o valor IDÊNTICO ao emitido', () => {
    // A regra do DDL-0078: o que casa é o VALOR, não o rótulo. Sem estas opções,
    // 301 itens ficavam inalcançáveis pelo filtro.
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
