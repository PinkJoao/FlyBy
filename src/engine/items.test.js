import { describe, it, expect } from 'vitest';
import { createCharacter, createInventoryItem } from '../schema/character';
import {
  itemTypeInfo,
  attunementInfo,
  resolveItemObj,
  deriveInventory,
  carryingCapacity,
} from './items';

// Fixtures cobrindo os tipos mencionados no plano: arma, armadura, item
// maravilhoso (sem `type`, via `wondrous`), engenho/comida (só em items.item).
const longsword = { name: 'Longsword', source: 'XPHB', type: 'M|XPHB', weaponCategory: 'martial', weight: 3 };
const shortbow = { name: 'Shortbow', source: 'XPHB', type: 'R|XPHB', weaponCategory: 'simple', weight: 2 };
const plate = { name: 'Plate Armor', source: 'XPHB', type: 'HA|XPHB', ac: 18, weight: 65 };
const cloak = {
  name: 'Cloak of Protection', source: 'DMG', wondrous: true, rarity: 'uncommon', reqAttune: true, weight: 1,
};
const artisanTools = { name: "Smith's Tools", source: 'XPHB', type: 'AT|XPHB', weight: 8 };
const rations = { name: 'Rations', source: 'XPHB', type: 'G|XPHB', weight: 2 };
const ring = {
  name: 'Ring of Protection', source: 'DMG', type: 'RG|DMG', rarity: 'rare',
  reqAttune: 'by a Spellcaster', weight: 0,
};

const db = {
  'items-base': { baseitem: [longsword, shortbow, plate, artisanTools] },
  items: { item: [cloak, rations, ring] },
};

describe('itemTypeInfo', () => {
  it('arma corpo-a-corpo marcial → group weapon, kind melee, category martial', () => {
    expect(itemTypeInfo(longsword)).toMatchObject({ group: 'weapon', kind: 'melee', category: 'martial' });
  });

  it('arma à distância simples → kind ranged', () => {
    expect(itemTypeInfo(shortbow)).toMatchObject({ group: 'weapon', kind: 'ranged', category: 'simple' });
  });

  it('armadura pesada → group armor, armorSlot heavy', () => {
    expect(itemTypeInfo(plate)).toMatchObject({ group: 'armor', armorSlot: 'heavy' });
  });

  it('item maravilhoso (sem type, flag wondrous) → group wondrous', () => {
    expect(itemTypeInfo(cloak)).toMatchObject({ group: 'wondrous', groupLabel: 'Wondrous Items' });
  });

  it('ferramenta de artesão → group tool', () => {
    expect(itemTypeInfo(artisanTools)).toMatchObject({ group: 'tool' });
  });

  it('engenho de aventura (rations) → group gear', () => {
    expect(itemTypeInfo(rations)).toMatchObject({ group: 'gear', groupLabel: 'Adventuring Gear' });
  });

  it('anel → group ring', () => {
    expect(itemTypeInfo(ring)).toMatchObject({ group: 'ring' });
  });

  it('item nulo/desconhecido → other, sem quebrar', () => {
    expect(itemTypeInfo(null)).toMatchObject({ group: 'other' });
    expect(itemTypeInfo({ name: 'Mystery', type: 'ZZZ' })).toMatchObject({ group: 'other' });
  });
});

describe('attunementInfo', () => {
  it('reqAttune true → required, sem texto de pré-requisito', () => {
    expect(attunementInfo(cloak)).toEqual({ required: true, prereqText: null });
  });

  it('reqAttune string → required, com o texto (não verificável automaticamente)', () => {
    expect(attunementInfo(ring)).toEqual({ required: true, prereqText: 'by a Spellcaster' });
  });

  it('sem reqAttune → not required', () => {
    expect(attunementInfo(longsword)).toEqual({ required: false, prereqText: null });
  });
});

describe('resolveItemObj', () => {
  it('acha em items-base primeiro (arma)', () => {
    expect(resolveItemObj(db, 'Longsword', 'XPHB')).toBe(longsword);
  });

  it('cai pro catálogo geral (items.item) quando não está em items-base', () => {
    expect(resolveItemObj(db, 'Cloak of Protection', 'DMG')).toBe(cloak);
  });

  it('nome+fonte que não bate → null', () => {
    expect(resolveItemObj(db, 'Longsword', 'PHB')).toBeNull();
    expect(resolveItemObj(db, 'Nonexistent', 'XPHB')).toBeNull();
  });
});

describe('deriveInventory', () => {
  it('resolve cada entrada, soma peso (unitário × quantidade) e conta atunados', () => {
    const character = createCharacter();
    const sword = createInventoryItem('Longsword', 'XPHB');
    const cloakEntry = { ...createInventoryItem('Cloak of Protection', 'DMG'), attuned: true };
    const arrows = { ...createInventoryItem('Rations', 'XPHB'), quantity: 3 };
    character.inventory = [sword, cloakEntry, arrows];

    const { entries, totalWeight, attunedCount } = deriveInventory(character, db);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({ group: 'weapon', unitWeight: 3, lineWeight: 3 });
    expect(entries[2]).toMatchObject({ unitWeight: 2, lineWeight: 6 }); // 3 rations × 2lb
    expect(totalWeight).toBe(3 + 1 + 6);
    expect(attunedCount).toBe(1);
  });

  it('item não resolvido (fora do db) → raw null, peso 0, não quebra', () => {
    const character = createCharacter();
    character.inventory = [createInventoryItem('Ghost Item', 'XXX')];
    const { entries, totalWeight } = deriveInventory(character, db);
    expect(entries[0].raw).toBeNull();
    expect(totalWeight).toBe(0);
  });

  it('item CUSTOM (snapshot) → deriva grupo/peso/raridade do snapshot Foundry', () => {
    const character = createCharacter();
    character.inventory = [
      {
        ...createInventoryItem('Component: Diamond', ''),
        quantity: 5,
        custom: { fType: 'loot', typeValue: 'treasure', weight: 0, rarity: '', attunement: '', description: '<p>Worth 300gp.</p>' },
      },
      {
        ...createInventoryItem('Homebrew Cloak', ''),
        custom: { fType: 'equipment', typeValue: 'wondrous', weight: 1, rarity: 'veryRare', attunement: 'required', description: '' },
      },
    ];
    const { entries } = deriveInventory(character, db);
    expect(entries[0]).toMatchObject({ isCustom: true, group: 'treasure', unitWeight: 0, rarity: null, raw: null });
    expect(entries[1]).toMatchObject({ isCustom: true, group: 'wondrous', unitWeight: 1, rarity: 'very rare', required: true });
  });

  it('sem inventário → vazio', () => {
    expect(deriveInventory(createCharacter(), db)).toEqual({ entries: [], totalWeight: 0, attunedCount: 0 });
  });
});

describe('carryingCapacity', () => {
  it('Força × 15 lb (regra núcleo 2024)', () => {
    expect(carryingCapacity(10)).toBe(150);
    expect(carryingCapacity(16)).toBe(240);
  });

  it('sem score (undefined) → assume 10', () => {
    expect(carryingCapacity(undefined)).toBe(150);
  });
});
