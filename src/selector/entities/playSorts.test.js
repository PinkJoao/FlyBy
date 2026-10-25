// =============================================================================
// playSorts.test: as ordens dos seletores de condição e de efeito do play mode
// =============================================================================
// O QUE FAZ
//   A ordem padrão das condições (status, condições, doenças, cada tipo pelo
//   nome) e a dos causadores de efeito (o curado primeiro, o resto por tipo),
//   mais o tipo e o círculo da magia, pelo mesmo sortList do SelectorPanel.
//
// FUNÇÕES
//   names(list): os nomes da lista, na ordem.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import conditionEntity from './condition';
import effectSourceEntity, { isAutomatic } from './effectSource';
import { sortList } from '../../sorting';

const names = (list) => list.map((x) => x.name);

describe('conditionEntity.naturalSort', () => {
  const db = {
    conditionsdiseases: {
      condition: [{ name: 'Prone', source: 'XPHB' }, { name: 'Blinded', source: 'XPHB' }],
      status: [{ name: 'Surprised', source: 'XPHB' }, { name: 'Concentration', source: 'XPHB' }],
      disease: [{ name: 'Cackle Fever', source: 'XDMG' }],
    },
  };

  it('status, then conditions, then diseases, each by name', () => {
    const sorted = sortList(conditionEntity.list(db), { option: conditionEntity.naturalSort, dir: 'asc' });
    expect(names(sorted)).toEqual(['Concentration', 'Surprised', 'Blinded', 'Prone', 'Cackle Fever']);
  });

  it('reversed puts the diseases first', () => {
    const sorted = sortList(conditionEntity.list(db), { option: conditionEntity.naturalSort, dir: 'desc' });
    expect(sorted[0].name).toBe('Cackle Fever');
  });
});

describe('effectSourceEntity sorts', () => {
  const list = [
    { name: 'Aid', categoryLabel: 'Spell', raw: { level: 2 } },
    { name: 'Rage', categoryLabel: 'Class Feature' },
    { name: 'Bless', categoryLabel: 'Spell', raw: { level: 1 } },
    { name: 'Alert', categoryLabel: 'Feat' },
    { name: 'Hex', categoryLabel: 'Spell', raw: { level: 1 } },
  ];
  const byValue = (v) => effectSourceEntity.sorts.find((o) => o.value === v);

  it('the curated effects come first, then the rest by type and name', () => {
    const sorted = sortList(list, { option: effectSourceEntity.naturalSort, dir: 'asc' });
    expect(names(sorted)).toEqual(['Bless', 'Hex', 'Aid', 'Rage', 'Alert']);
    expect(isAutomatic(list[2])).toBe(true);
    expect(isAutomatic(list[1])).toBe(false);
  });

  it('Type puts spells first; Spell level leaves the rest at the end', () => {
    expect(names(sortList(list, { option: byValue('type'), dir: 'asc' })).slice(0, 3)).toEqual(['Aid', 'Bless', 'Hex']);
    expect(names(sortList(list, { option: byValue('level'), dir: 'asc' }))).toEqual(['Bless', 'Hex', 'Aid', 'Alert', 'Rage']);
  });
});
