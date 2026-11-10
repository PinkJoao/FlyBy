// =============================================================================
// playForms.test: Wild Shape, Polymorph e o catálogo na forma
// =============================================================================
// O QUE FAZ
//   Prova os limites do Wild Shape pela tabela do texto, quem serve de forma, os PV
//   temporários (o maior fica; os que somem saem ao reverter), o catálogo na forma
//   (físico trocado, mental mantido, o maior entre o bloco e o personagem) e o fim
//   do Polymorph sem PV temporários.
//
// FUNÇÕES
//   (só testes)
//
// DECISÕES E ARMADILHAS
//   - A tabela é a "Beast Shapes" do XPHB e o lobo é o Wolf do XMM, reduzidos ao que
//     o código lê.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { emptyPlayState, applyEvent, makeEvent } from './playState';
import { transformRuleOf, wildShapeLimits, formEligible, formTempHp, transformOps, revertOps, formCatalog, formStats, crNumber } from './playForms';
import { endConcentrationOps } from './playEffects';
import { damageOutcome } from './playHealth';

const table = [{ type: 'entries', entries: [{ type: 'table', caption: 'Beast Shapes', rows: [['2', '4', '{@filter 1/4|bestiary|challenge rating=[&0;&1/4]|type=beast}', 'No'], ['4', '6', '1/2', 'No'], ['8', '8', '1', 'Yes']] }] }];
const wolf = {
  name: 'Wolf', source: 'XMM', type: 'beast', cr: '1/4', size: ['M'], ac: [12], hp: { average: 11, formula: '2d8 + 2' },
  speed: { walk: 40 }, str: 14, dex: 15, con: 12, int: 3, wis: 12, cha: 6, skill: { perception: '+5', stealth: '+4' },
  action: [{ name: 'Bite', entries: ['{@atkr m} {@hit 4}, reach 5 ft. {@h}{@damage 1d6 + 2} Piercing damage.'] }],
};
const eagle = { name: 'Giant Eagle', type: 'beast', cr: '1', speed: { walk: 10, fly: 80 }, size: ['L'] };
const zombie = { name: 'Zombie', type: 'undead', cr: '1/4', size: ['M'] };
const catalog = {
  stats: { ac: 14, profBonus: 2, speed: 30, speeds: { walk: { feet: 30 } }, initiative: 1, hpMax: 20, level: 4 },
  rollData: { abilities: { str: { mod: 0 }, dex: { mod: 1 }, con: { mod: 1 }, wis: { mod: 3 } } },
  checks: {
    abilities: [
      { ability: 'str', score: 10, mod: 0, save: 0, saveProf: false, checkParts: [], saveParts: [] },
      { ability: 'dex', score: 12, mod: 1, save: 1, saveProf: false, checkParts: [], saveParts: [] },
      { ability: 'wis', score: 16, mod: 3, save: 5, saveProf: true, checkParts: [], saveParts: [] },
    ],
    skills: [
      { skill: 'perception', ability: 'wis', bonus: 3, prof: 0, parts: [{ kind: 'ability', ability: 'wis', value: 3 }] },
      { skill: 'athletics', ability: 'str', bonus: 2, prof: 1, parts: [{ kind: 'ability', ability: 'str', value: 0 }, { kind: 'proficiency', level: 1, value: 2 }] },
    ],
    initiative: { bonus: 1 },
    concentration: { bonus: 1 },
  },
  attacks: [{ key: 'unarmed' }],
};

describe('playForms (DDL-0195)', () => {
  it('limites do Wild Shape pela tabela, e o ND do Circle Forms', () => {
    expect(wildShapeLimits(table, 2)).toEqual({ known: 4, maxCr: 0.25, fly: false });
    expect(wildShapeLimits(table, 5)).toEqual({ known: 6, maxCr: 0.5, fly: false });
    expect(wildShapeLimits(table, 8)).toEqual({ known: 8, maxCr: 1, fly: true });
    expect(wildShapeLimits(table, 6, { circleForms: true }).maxCr).toBe(2);
    expect(wildShapeLimits([], 2)).toBeNull();
    expect(crNumber({ cr: '1/2' })).toBe(0.5);
  });
  it('quem serve de forma', () => {
    const ws = transformRuleOf('Wild Shape');
    expect(formEligible(wolf, ws, wildShapeLimits(table, 2))).toBe(true);
    expect(formEligible(eagle, ws, wildShapeLimits(table, 8))).toBe(true);
    expect(formEligible(eagle, ws, { maxCr: 1, fly: false })).toBe(false);
    expect(formEligible(zombie, transformRuleOf('Shapechange'), { level: 17 })).toBe(false);
    expect(formEligible(wolf, transformRuleOf('Polymorph'), { level: 0 })).toBe(false);
    expect(formEligible({ ...wolf, cr: '3', size: ['H'] }, transformRuleOf('Animal Shapes'), {})).toBe(false);
  });
  it('PV temporários: o maior fica; os do Polymorph somem ao reverter, os do Wild Shape não', () => {
    const ws = transformRuleOf('wild shape');
    expect(formTempHp(ws, { classLevel: 4 })).toBe(4);
    expect(formTempHp(ws, { classLevel: 4, circleForms: true })).toBe(12);
    expect(formTempHp(transformRuleOf('polymorph'), { stats: formStats(wolf) })).toBe(11);
    let state = { ...emptyPlayState(), tempHp: 6 };
    state = applyEvent(state, makeEvent('form', { label: 'x', ops: transformOps({ state, rule: ws, creature: wolf, tempHp: 4 }) }));
    expect(state.tempHp).toBe(6);
    expect(state.form.ref).toEqual({ name: 'Wolf', source: 'XMM' });
    state = applyEvent(state, makeEvent('form', { label: 'y', ops: revertOps(state) }));
    expect(state.form).toBeNull();
    expect(state.tempHp).toBe(6);
    let poly = emptyPlayState();
    poly = applyEvent(poly, makeEvent('form', { label: 'p', ops: transformOps({ state: poly, rule: transformRuleOf('polymorph'), creature: wolf, tempHp: 11 }) }));
    expect(poly.tempHp).toBe(11);
    poly = applyEvent(poly, makeEvent('form', { label: 'q', ops: revertOps(poly) }));
    expect(poly.tempHp).toBe(0);
  });
  it('o catálogo na forma do Wild Shape: físico da fera, mental e proficiência do druida', () => {
    const form = { keepsMental: true, keepsProficiencies: true, acFloor: 16 };
    const c = formCatalog(catalog, form, formStats(wolf));
    const dex = c.checks.abilities.find((a) => a.ability === 'dex');
    expect(dex.mod).toBe(2);
    expect(c.checks.abilities.find((a) => a.ability === 'wis').save).toBe(5);
    expect(c.checks.skills.find((s) => s.skill === 'athletics').bonus).toBe(4);
    expect(c.checks.skills.find((s) => s.skill === 'perception').bonus).toBe(5);
    expect(c.checks.initiative.bonus).toBe(2);
    expect(c.stats.ac).toBe(16);
    expect(c.stats.speed).toBe(40);
    expect(c.attacks).toHaveLength(1);
    expect(c.attacks[0].toHit.total).toBe(4);
    expect(c.attacks[0].damage).toEqual({ dice: '1d6 + 2', bonus: 0, types: ['piercing'] });
    expect(catalog.checks.abilities[1].mod).toBe(1);
  });
  it('Polymorph troca também o mental e tira a proficiência do personagem', () => {
    const c = formCatalog(catalog, { keepsMental: false, keepsProficiencies: false }, formStats(wolf));
    expect(c.checks.abilities.find((a) => a.ability === 'wis').save).toBe(1);
    expect(c.checks.skills.find((s) => s.skill === 'athletics').bonus).toBe(2);
    expect(c.stats.ac).toBe(12);
  });
  it('o Polymorph acaba quando os PV temporários zeram, e a concentração junto', () => {
    let state = { ...emptyPlayState(), concentration: { name: 'Polymorph' } };
    state = applyEvent(state, makeEvent('form', { label: 'p', ops: transformOps({ state, rule: transformRuleOf('polymorph'), creature: wolf, tempHp: 11 }) }));
    const hpCatalog = { stats: { hpMax: 20 }, defenses: {} };
    const hit = damageOutcome(state, hpCatalog, { amount: 13 });
    expect(hit.ops.some((o) => o.op === 'form' && o.clear)).toBe(true);
    expect(hit.ops.some((o) => o.op === 'concentration' && o.value === null)).toBe(true);
    expect(hit.summary.concentrationDc).toBeNull();
    const after = applyEvent(state, makeEvent('damage', { label: 'd', ops: hit.ops }));
    expect(after.form).toBeNull();
    expect(after.damage).toBe(2);
    expect(damageOutcome(state, hpCatalog, { amount: 5 }).ops.some((o) => o.op === 'form')).toBe(false);
  });
  it('a concentração que acaba tira a forma da magia, não a do Wild Shape', () => {
    const poly = { ...emptyPlayState(), concentration: { name: 'Polymorph' }, tempHp: 7, form: { concentration: true, tempVanish: true } };
    expect(endConcentrationOps(poly).filter((o) => o.op === 'form' || o.op === 'hp')).toEqual([{ op: 'form', clear: true }, { op: 'hp', temp: -7 }]);
    const ws = { ...poly, form: { concentration: false } };
    expect(endConcentrationOps(ws).some((o) => o.op === 'form')).toBe(false);
  });
});
