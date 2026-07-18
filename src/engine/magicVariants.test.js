import { describe, it, expect } from 'vitest';
import {
  variantApplies,
  createSpecificVariant,
  evaluateExpression,
  specificVariants,
  resolveVariantObj,
} from './magicVariants';
import { resolveItemObj } from './items';

// Fixtures modeladas nas formas REAIS de magicvariants.json / items-base.json
// (verificadas no snapshot local do 5etools em 2026-07-16).
const longsword = {
  name: 'Longsword', source: 'XPHB', edition: 'one', type: 'M|XPHB',
  weaponCategory: 'martial', weapon: true, sword: true, dmg1: '1d8', dmgType: 'S',
  property: ['V|XPHB'], mastery: ['Sap|XPHB'], weight: 3, value: 1500,
  entries: [{ type: 'entries', name: 'Mastery: Sap', entries: ['…'] }],
};
const net = {
  name: 'Net', source: 'XPHB', edition: 'one', type: 'R|XPHB',
  weaponCategory: 'martial', weapon: true, net: true, weight: 3,
};
const chainMail = {
  name: 'Chain Mail', source: 'XPHB', edition: 'one', type: 'HA|XPHB',
  armor: true, ac: 16, weight: 55, value: 7500,
};
const oldGlaive = {
  // item base ANTIGO sem reprint (edition classic) - não recebe variante atual
  name: 'Old Glaive', source: 'OLD', edition: 'classic', type: 'M',
  weaponCategory: 'martial', weapon: true, weight: 6,
};
const arrows = {
  name: 'Arrows (20)', source: 'XPHB', edition: 'one', type: 'A|XPHB',
  packContents: [{ item: 'arrow|xphb', quantity: 20 }],
};

const plusOneWeapon = {
  name: '+1 Weapon',
  type: 'GV|XDMG',
  requires: [{ weaponCategory: 'simple' }, { weaponCategory: 'martial' }],
  excludes: { net: true },
  inherits: {
    namePrefix: '+1 ',
    source: 'XDMG',
    page: 317,
    rarity: 'uncommon',
    bonusWeapon: '+1',
    entries: ['You have a {=bonusWeapon} bonus to attack and damage rolls made with this magic weapon.'],
  },
};
const classicPlusOne = {
  name: '+1 Weapon',
  edition: 'classic',
  requires: [{ weapon: true }],
  inherits: { namePrefix: '+1 ', source: 'DMG', rarity: 'uncommon', reprintedAs: ['+1 Weapon|XDMG'] },
};
const armorOfAcid = {
  name: 'Armor of Acid Resistance',
  requires: [{ armor: true }],
  inherits: {
    nameSuffix: ' of Acid Resistance',
    source: 'XDMG',
    rarity: 'rare',
    reqAttune: true,
    resist: ['acid'],
    hasRefs: true,
    entries: ['{#itemEntry Armor of Resistance|XDMG}'],
  },
};
const adamantine = {
  name: 'Adamantine Weapon',
  requires: [{ weaponCategory: 'simple' }, { weaponCategory: 'martial' }],
  excludes: { type: ['A|XPHB'] },
  inherits: {
    namePrefix: 'Adamantine ',
    source: 'XDMG',
    rarity: 'uncommon',
    valueExpression: '[[baseItem.value]] + 50000',
    entries: ['An {=baseName/l} made of adamantine deals {=dmgType} damage as usual.'],
  },
};

const db = {
  'items-base': {
    baseitem: [longsword, net, chainMail, oldGlaive, arrows],
    itemEntry: [
      { name: 'Armor of Resistance', source: 'DMG', entriesTemplate: ['Old template {{item.resist}}.'] },
      { name: 'Armor of Resistance', source: 'XDMG', entriesTemplate: ['You have Resistance to {{getFullImmRes item.resist}} damage while wearing this armor.'] },
    ],
  },
  items: { item: [{ name: '+1 Chain Mail', source: 'XDMG', type: 'HA|XPHB', rarity: 'rare' }] },
  magicvariants: { magicvariant: [plusOneWeapon, classicPlusOne, armorOfAcid, adamantine] },
};

describe('variantApplies', () => {
  it('requires é OR entre alternativas, AND dentro de cada uma', () => {
    expect(variantApplies(longsword, plusOneWeapon)).toBe(true);
    expect(variantApplies(chainMail, plusOneWeapon)).toBe(false);
    expect(variantApplies(chainMail, armorOfAcid)).toBe(true);
  });

  it('excludes veta (Net não vira +1 Net)', () => {
    expect(variantApplies(net, plusOneWeapon)).toBe(false);
  });

  it('excludes com valor-array casa contra o campo escalar (type)', () => {
    expect(variantApplies({ ...longsword, type: 'A|XPHB' }, adamantine)).toBe(false);
  });

  it('item base "classic" não recebe variante de outra edição', () => {
    expect(variantApplies(oldGlaive, plusOneWeapon)).toBe(false);
    expect(variantApplies(oldGlaive, classicPlusOne)).toBe(true);
  });
});

describe('createSpecificVariant', () => {
  const sv = createSpecificVariant(longsword, plusOneWeapon, db);

  it('nome com prefixo, fonte/raridade herdadas, base preservado', () => {
    expect(sv.name).toBe('+1 Longsword');
    expect(sv.source).toBe('XDMG');
    expect(sv.rarity).toBe('uncommon');
    expect(sv.baseItem).toBe('Longsword|XPHB');
    expect(sv.type).toBe('M|XPHB');
    expect(sv.dmg1).toBe('1d8');
    expect(sv.mastery).toEqual(['Sap|XPHB']);
  });

  it('não herda o preço do item mundano (o derivado usa a raridade)', () => {
    expect(sv.value).toBeUndefined();
  });

  it('entries herdadas vêm ANTES das do base, com o template {=bonusWeapon} aplicado', () => {
    expect(sv.entries[0]).toBe('You have a +1 bonus to attack and damage rolls made with this magic weapon.');
    expect(sv.entries[1]).toMatchObject({ name: 'Mastery: Sap' });
  });

  it('não vaza campos de publicação (reprintedAs esconderia o item do latestOnly)', () => {
    expect(sv.reprintedAs).toBeUndefined();
    expect(sv.page).toBeUndefined();
  });

  it('templates {=baseName/l} e {=dmgType} (nome completo minúsculo)', () => {
    const ad = createSpecificVariant(longsword, adamantine, db);
    expect(ad.name).toBe('Adamantine Longsword');
    expect(ad.entries[0]).toBe('An longsword made of adamantine deals slashing damage as usual.');
  });

  it('valueExpression avalia sobre o valor do item base', () => {
    const ad = createSpecificVariant(longsword, adamantine, db);
    expect(ad.value).toBe(1500 + 50000);
  });

  it('{#itemEntry} resolve o molde (fonte preferida) e aplica {{getFullImmRes item.resist}}', () => {
    const armor = createSpecificVariant(chainMail, armorOfAcid, db);
    expect(armor.name).toBe('Chain Mail of Acid Resistance');
    expect(armor.resist).toEqual(['acid']);
    expect(armor.reqAttune).toBe(true);
    expect(armor.entries[0]).toBe('You have Resistance to Acid damage while wearing this armor.');
  });
});

describe('evaluateExpression', () => {
  it('aritmética com precedência', () => {
    expect(evaluateExpression('[[baseItem.value]] * 2 + 10', { baseItem: { value: 100 }, item: {} })).toBe(210);
  });

  it('caminho sem número → null (propriedade não é definida)', () => {
    expect(evaluateExpression('[[baseItem.value]] + 1', { baseItem: {}, item: {} })).toBeNull();
  });
});

describe('specificVariants (expansão completa)', () => {
  const list = specificVariants(db);

  it('gera as combinações válidas e só elas', () => {
    const names = list.map((i) => i.name).sort();
    // Net excluída do +1 (mas casa Adamantine - só exclui munição); pack
    // (Arrows) pulado; oldGlaive só casa a variante classic (descartada por ter
    // reprint); "+1 Chain Mail" já existe em items.json e NÃO é regerado.
    expect(names).toEqual([
      '+1 Longsword',
      'Adamantine Longsword',
      'Adamantine Net',
      'Chain Mail of Acid Resistance',
    ]);
  });

  it('variantes classic (reimpressas) são descartadas - nada de fonte DMG duplicada', () => {
    expect(list.every((i) => i.source === 'XDMG')).toBe(true);
  });

  it('memoiza por db (mesma referência em chamadas repetidas)', () => {
    expect(specificVariants(db)).toBe(list);
  });

  it('resolveVariantObj acha por nome+fonte, case-insensitive', () => {
    expect(resolveVariantObj(db, '+1 Longsword', 'XDMG')?.baseItem).toBe('Longsword|XPHB');
    expect(resolveVariantObj(db, '+1 longsword', 'xdmg')).toBeTruthy();
    expect(resolveVariantObj(db, '+1 Net', 'XDMG')).toBeNull();
  });

  it('resolveItemObj cai nas variantes geradas depois do catálogo', () => {
    expect(resolveItemObj(db, '+1 Longsword', 'XDMG')?.name).toBe('+1 Longsword');
    expect(resolveItemObj(db, 'Longsword', 'XPHB')).toBe(longsword);
  });

  it('db vazio → lista vazia, sem quebrar', () => {
    expect(specificVariants({})).toEqual([]);
    expect(specificVariants(null)).toEqual([]);
  });
});
