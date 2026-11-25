// =============================================================================
// srdNames.test: a ficha feita num modo (completo ou SRD) abre no outro
// =============================================================================
// O QUE FAZ
//   O outro nome nos dois sentidos, e os resolvedores de magia e de item usando
//   ele: "Tasha's Hideous Laughter" acha "Hideous Laughter" num db só SRD, e
//   "Handy Haversack" acha "Heward's Handy Haversack" num db completo.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { alternateNames } from './srdNames';
import { resolveSpellObj } from './spells';
import { resolveItemObj } from './items';

describe('alternateNames', () => {
  it('vai do nome do 5etools ao do SRD e volta', () => {
    expect(alternateNames("Tasha's Hideous Laughter")).toEqual(['hideous laughter']);
    expect(alternateNames('Hideous Laughter')).toEqual(["tasha's hideous laughter"]);
    expect(alternateNames('Spider’s Sting')).toEqual(["lolth's sting"]);
  });

  it('nome sem troca não tem outro', () => {
    expect(alternateNames('Fire Bolt')).toEqual([]);
    expect(alternateNames('')).toEqual([]);
  });
});

describe('resolvedores com o outro nome', () => {
  const srdDb = {
    'spells-xphb': { spell: [{ name: 'Hideous Laughter', source: 'XPHB', level: 1 }] },
    items: { item: [{ name: 'Handy Haversack', source: 'XDMG', weight: 5 }] },
  };
  const fullDb = {
    'spells-xphb': { spell: [{ name: "Tasha's Hideous Laughter", source: 'XPHB', level: 1 }] },
    items: { item: [{ name: "Heward's Handy Haversack", source: 'XDMG', weight: 5 }] },
  };

  it('ficha do compêndio completo aberta no modo SRD', () => {
    expect(resolveSpellObj(srdDb, "Tasha's Hideous Laughter", 'XPHB')?.name).toBe('Hideous Laughter');
    expect(resolveItemObj(srdDb, "Heward's Handy Haversack", 'XDMG')?.name).toBe('Handy Haversack');
  });

  it('ficha do modo SRD aberta no compêndio completo', () => {
    expect(resolveSpellObj(fullDb, 'Hideous Laughter', 'XPHB')?.name).toBe("Tasha's Hideous Laughter");
    expect(resolveItemObj(fullDb, 'Handy Haversack', 'XDMG')?.name).toBe("Heward's Handy Haversack");
  });
});
