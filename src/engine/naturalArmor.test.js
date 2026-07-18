import { describe, it, expect } from 'vitest';
import { naturalArmorFor, naturalArmorChanges } from './naturalArmor';

describe('naturalArmorFor', () => {
  it('resolve os três padrões pelas versões atuais', () => {
    expect(naturalArmorFor({ name: 'Tortle', source: 'MPMM' })).toMatchObject({ type: 'flat', ac: 17 });
    expect(naturalArmorFor({ name: 'Autognome', source: 'AAG' })).toMatchObject({ type: 'unarmored', base: 13, ability: 'dex' });
    expect(naturalArmorFor({ name: 'Warforged', source: 'EFA' })).toMatchObject({ type: 'bonus', bonus: 1 });
  });

  it('edition-strict: versões antigas / outras raças = null', () => {
    expect(naturalArmorFor({ name: 'Tortle', source: 'TTP' })).toBeNull();
    expect(naturalArmorFor({ name: 'Warforged', source: 'ERLW' })).toBeNull();
    expect(naturalArmorFor({ name: 'Elf', source: 'XPHB' })).toBeNull();
    expect(naturalArmorFor(null)).toBeNull();
  });

  it('cai no _baseName quando presente (linhagem/versão)', () => {
    expect(naturalArmorFor({ name: 'Tortle (Small)', _baseName: 'Tortle', source: 'MPMM' })).toMatchObject({ type: 'flat' });
  });
});

describe('naturalArmorChanges - codificação Foundry (== overlay foundry-races)', () => {
  it('flat → ac.calc custom + ac.formula constante', () => {
    expect(naturalArmorChanges({ type: 'flat', ac: 17 })).toEqual([
      { key: 'system.attributes.ac.calc', mode: 5, value: 'custom' },
      { key: 'system.attributes.ac.formula', mode: 5, value: '17' },
    ]);
  });

  it('unarmored → fórmula base + @abilities.<ability>.mod', () => {
    expect(naturalArmorChanges({ type: 'unarmored', base: 13, ability: 'dex' })).toEqual([
      { key: 'system.attributes.ac.calc', mode: 5, value: 'custom' },
      { key: 'system.attributes.ac.formula', mode: 5, value: '13 + @abilities.dex.mod' },
    ]);
  });

  it('bonus → ac.bonus ADD', () => {
    expect(naturalArmorChanges({ type: 'bonus', bonus: 1 })).toEqual([
      { key: 'system.attributes.ac.bonus', mode: 2, value: '+ 1' },
    ]);
  });
});
