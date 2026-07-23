import { describe, it, expect } from 'vitest';
import { sourceName, hasSourceName } from './sourceNames';

describe('sourceName', () => {
  it('resolve fontes conhecidas para o nome por extenso', () => {
    expect(sourceName('XPHB')).toBe("Player's Handbook (2024)");
    expect(sourceName('PSK')).toBe('Plane Shift: Kaladesh');
    expect(sourceName('LFL')).toBe('Lorwyn: First Light');
    expect(sourceName('MPMM')).toBe('Mordenkainen Presents: Monsters of the Multiverse');
  });

  it('fonte desconhecida devolve a própria abreviação (nunca vazio)', () => {
    expect(sourceName('ZZZ')).toBe('ZZZ');
    expect(sourceName('')).toBe('');
    expect(sourceName(undefined)).toBe('');
  });
});

describe('hasSourceName', () => {
  it('true para fonte com nome mapeado, false para desconhecida', () => {
    expect(hasSourceName('XPHB')).toBe(true);
    expect(hasSourceName('ZZZ')).toBe(false);
    expect(hasSourceName('')).toBe(false);
  });
});
