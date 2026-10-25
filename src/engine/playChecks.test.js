// =============================================================================
// playChecks.test: testes do bônus de um teste separado em fixo, rolado e condicional
// =============================================================================
// FUNÇÕES
//   st(patch): um estado de jogo com o patch por cima do descansado.
//
// DECISÕES E ARMADILHAS
//   - O catálogo é feito à mão, só com o que o playChecks lê (checks e o mínimo do
//     rollEffects): o teste mede a separação, não a derivação da ficha.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { emptyPlayState } from './playState';
import { partLabel, rollOf, testBreakdown, isDice } from './playChecks';
import { testParts } from './playActions';

const st = (patch = {}) => ({ ...emptyPlayState(), ...patch });
const catalog = {
  features: ['reliable talent'],
  checks: {
    abilities: [{
      ability: 'dex', mod: 3, save: 6, saveProf: true,
      checkParts: [{ kind: 'ability', ability: 'dex', value: 3 }],
      saveParts: [{ kind: 'ability', ability: 'dex', value: 3 }, { kind: 'proficiency', level: 1, value: 2 }, { kind: 'item', label: 'Cloak of Protection', value: 1 }],
    }],
    skills: [
      { skill: 'ste', ability: 'dex', bonus: 7, prof: 2, parts: [{ kind: 'ability', ability: 'dex', value: 3 }, { kind: 'proficiency', level: 2, value: 4 }] },
      { skill: 'acr', ability: 'dex', bonus: 3, prof: 0, parts: [{ kind: 'ability', ability: 'dex', value: 3 }] },
    ],
  },
};
const guidance = { id: 'g', label: 'Guidance', effects: [{ targets: ['check'], formula: '1d4' }] };

describe('playChecks', () => {
  it('rotula as partes e descreve o teste', () => {
    expect(partLabel({ kind: 'ability', ability: 'dex' })).toBe('Dexterity');
    expect(partLabel({ kind: 'proficiency', level: 2 })).toBe('Expertise');
    expect(partLabel({ kind: 'proficiency', level: 0.5 })).toBe('Half proficiency');
    expect(rollOf(catalog, { type: 'skill', id: 'ste' })).toEqual({ kind: 'check', ability: 'dex', skill: 'ste', proficient: true });
    expect(isDice('1d4')).toBe(true);
    expect(isDice(-2)).toBe(false);
  });

  it('a rolagem leva uma linha por peça', () => {
    expect(testParts(catalog, { type: 'skill', id: 'ste' })).toEqual([{ label: 'Dexterity', formula: 3 }, { label: 'Expertise', formula: 4 }]);
  });

  it('separa fixo, rolado e condicional numa perícia com expertise', () => {
    const b = testBreakdown(catalog, st({ modifiers: [guidance], conditions: { exhaustion: 1, poisoned: 1 } }), { type: 'skill', id: 'ste' });
    expect(b.fixed).toEqual([{ label: 'Dexterity', value: 3 }, { label: 'Expertise', value: 4 }]);
    expect(b.rolled).toEqual([{ label: 'Guidance', formula: '1d4', on: true }]);
    expect(b.conditional.map((c) => c.label)).toEqual(expect.arrayContaining(['Exhaustion 1', 'Poisoned']));
    expect(b.conditional.find((c) => c.label === 'Poisoned').text).toBe('disadvantage');
    expect(b.conditional.some((c) => c.text?.startsWith('d20 minimum'))).toBe(true);
    expect(b.total).toBe(5);
  });

  it('a Reliable Talent só vale com proficiência; o item do save é condicional', () => {
    expect(testBreakdown(catalog, st(), { type: 'skill', id: 'acr' }).conditional).toEqual([]);
    const save = testBreakdown(catalog, st(), { type: 'save', id: 'dex' });
    expect(save.fixed).toEqual([{ label: 'Dexterity', value: 3 }, { label: 'Proficiency', value: 2 }]);
    expect(save.conditional).toEqual([{ label: 'Cloak of Protection', value: 1, on: true }]);
    expect(save.total).toBe(6);
  });
});

describe('teste de ferramenta', () => {
  it('soma o atributo escolhido e a proficiência inteira', () => {
    const c = { ...catalog, stats: { profBonus: 2 } };
    const test = { type: 'tool', id: "Thieves' Tools", ability: 'dex' };
    expect(testParts(c, test)).toEqual([{ label: 'Dexterity', formula: 3 }, { label: 'Proficiency', formula: 2 }]);
    expect(rollOf(c, test)).toEqual({ kind: 'check', ability: 'dex', tool: "Thieves' Tools", proficient: true });
    expect(testBreakdown(c, st(), test).total).toBe(5);
  });
});
