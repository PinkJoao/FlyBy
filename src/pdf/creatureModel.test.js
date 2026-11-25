// =============================================================================
// creatureModel.test: os cartões da seção Summons & forms do PDF
// =============================================================================
// O QUE FAZ
//   Prova o cartão de uma forma do Wild Shape (CA, PV, atributos, ações) e que o
//   texto sai com os números do invocador no lugar das marcas do 5etools.
//
// FUNÇÕES
//   (só testes)
//
// DECISÕES E ARMADILHAS
//   - Um db vazio basta: a forma conhecida não precisa de classe; o lobo é o Wolf do
//     XMM reduzido ao que o cartão lê.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { createCharacter } from '../schema/character';
import { deriveFromDb } from '../engine/resolve';
import { creatureCards } from './creatureModel';

const wolf = {
  name: 'Wolf', source: 'XMM', type: 'beast', cr: '1/4', ac: [12], hp: { average: 11 }, speed: { walk: 40 },
  str: 14, dex: 15, con: 12, int: 3, wis: 12, cha: 6,
  trait: [{ name: 'Pack Tactics', entries: ['The wolf has Advantage.'] }],
  action: [{ name: 'Bite', entries: ['{@atkr m} {@hit 4}, reach 5 ft. {@h}{@damage 1d6 + 2} Piercing damage.'] }],
};

describe('creatureCards (DDL-0196)', () => {
  it('uma forma conhecida do Wild Shape vira cartão', () => {
    const c = createCharacter({ name: 'Fern' });
    c.wildShapeForms = [{ name: 'Wolf', source: 'XMM' }];
    const [card] = creatureCards(c, deriveFromDb(c, {}), {}, [wolf]);
    expect(card).toMatchObject({ name: 'Wolf', origin: 'Wild Shape form', ac: 12, hp: 11, speed: '40 ft.' });
    expect(card.stats).toBe('STR 14 (+2)  DEX 15 (+2)  CON 12 (+1)  INT 3 (-4)  WIS 12 (+1)  CHA 6 (-2)');
    expect(card.traits[0].lead).toBe('Pack Tactics');
    expect(card.actions[0].lead).toBe('Bite');
  });
  it('sem bestiário, nenhuma carta', () => {
    const c = createCharacter({ name: 'Fern' });
    c.wildShapeForms = [{ name: 'Wolf', source: 'XMM' }];
    expect(creatureCards(c, deriveFromDb(c, {}), {}, [])).toEqual([]);
  });
});
