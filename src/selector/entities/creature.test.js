// =============================================================================
// creature.test: a entity das criaturas sobre o pacote do SRD
// =============================================================================
// O QUE FAZ
//   Prova a entity no pacote embutido (as 335 criaturas do SRD 5.2): a lista, os
//   textos de ND, CA, PV e deslocamento, e os filtros derivados.
//
// FUNÇÕES
//   (só testes)
//
// DECISÕES E ARMADILHAS
//   - Lê o srdBundle.json commitado: o mesmo que o app carrega na fonte SRD.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import bundle from '../../data/srdBundle.json';
import creatureEntity, { crValue, acText, hpText, speedText, typeOf } from './creature';
import { bestiaryFromDb } from '../../data/bestiary';

describe('creature entity (DDL-0189)', () => {
  const list = creatureEntity.list(bundle);
  it('o pacote do SRD traz as 335 criaturas', () => {
    expect(bestiaryFromDb(bundle)).toHaveLength(335);
    expect(list.length).toBeGreaterThan(300);
  });
  it('lê ND, tipo, CA, PV e deslocamento do lobo', () => {
    const wolf = list.find((m) => m.name === 'Wolf');
    expect(crValue(wolf.cr)).toBe(0.25);
    expect(typeOf(wolf)).toBe('Beast');
    expect(acText(wolf)).toMatch(/^1[0-9]/);
    expect(hpText(wolf)).toMatch(/[(].*d.*[)]/);
    expect(speedText(wolf)).toMatch(/ft[.]/);
  });
  it('o molde em prosa dos summons vira texto, sem número inventado', () => {
    expect(acText({ ac: [{ special: "11 + the spell's level" }] })).toBe("11 + the spell's level");
    expect(hpText({ hp: { special: '5 + five times your Artificer level' } })).toBe('5 + five times your Artificer level');
  });
  it('os filtros derivam tipo, ND e tamanho', () => {
    const v = creatureEntity.precompute(list.find((m) => m.name === 'Wolf')).filterValues;
    expect(v.type).toEqual(['Beast']);
    expect(v.cr).toEqual(['1/4']);
    expect(v.size).toEqual(['Medium']);
  });
});
