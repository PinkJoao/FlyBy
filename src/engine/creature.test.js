// =============================================================================
// creature.test: o núcleo da criatura com os números do livro
// =============================================================================
// O QUE FAZ
//   Prova o creatureStats e o templateValue com blocos reais do bestiário local e
//   valores conferidos à mão: os moldes dos summons por círculo e por variante, o
//   ataque e a CD do invocador, o PB pelo ND, o dano com `summonSpellLevel`.
//
// FUNÇÕES
//   get(name, source): o bloco do bestiário local resolvido.
//
// DECISÕES E ARMADILHAS
//   - Lê o bestiário do material local; sem ele (outra máquina), o bloco pula.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { creatureStats, templateValue, crPb, damageFormula } from './creature';
import { resolveCopies } from '../selector/copy';

const DIR = join(import.meta.dirname, '..', '..', 'DnD Source Material', '5etools Source Code', 'data', 'bestiary');
const all = existsSync(DIR)
  ? resolveCopies(readdirSync(DIR).filter((f) => f.startsWith('bestiary-')).flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')).monster ?? []))
  : [];
const get = (n, s) => all.find((m) => m.name === n && m.source === s);
const caster = { pb: 3, spellAttack: 7, spellDc: 15, spellMod: 4, mods: { int: 3, wis: 2 } };

describe('templateValue (DDL-0191)', () => {
  it('lê os moldes dos summons', () => {
    expect(templateValue("11 + the spell's level", { spellLevel: 3 }).value).toBe(14);
    expect(templateValue('40 + 10 for each spell level above 4th', { spellLevel: 6 }).value).toBe(60);
    expect(templateValue('5 + five times your Artificer level (the defender has a number of Hit Dice [d8s] equal to your Artificer level)', { classLevel: 5 }).value).toBe(30);
    expect(templateValue('13 plus your Wisdom modifier', { mods: { wis: 2 } }).value).toBe(15);
    expect(templateValue('14 + PB (natural armor)', { pb: 3 }).value).toBe(17);
  });
  it('variante por forma e por condição', () => {
    const t = '20 (Air only) or 30 (Land and Water only) + 5 for each spell level above 2';
    expect(templateValue(t, { spellLevel: 3, variant: 'Air' }).value).toBe(25);
    expect(templateValue(t, { spellLevel: 3, variant: 'Land' }).value).toBe(35);
    expect(templateValue(t, { spellLevel: 3 }).variants).toEqual(['Air', 'Land', 'Water']);
    expect(templateValue("11 + the spell's level + 2 (Defender only)", { spellLevel: 5, variant: 'Defender' }).value).toBe(18);
    expect(templateValue("11 + the spell's level + 2 (Defender only)", { spellLevel: 5, variant: 'Avenger' }).value).toBe(16);
  });
  it('o que não entende volta sem número', () => {
    expect(templateValue('equal to half your druid level', {})).toMatchObject({ value: null, unknown: true });
  });
  it('PB pelo ND e o dano com o círculo', () => {
    expect([crPb('1/4'), crPb(4), crPb(5), crPb(13), crPb(30)]).toEqual([2, 2, 3, 5, 9]);
    expect(damageFormula('(summonSpellLevel - 3)d6 + 3|2d6 + 3', ' + your spellcasting ability modifier (Large)', { spellLevel: 5, spellMod: 4 })).toBe('2d6 + 3 + 4');
  });
});

describe.skipIf(!all.length)('creatureStats com blocos reais (DDL-0191)', () => {
  it('Bestial Spirit no 3º círculo, Air', () => {
    const s = creatureStats(get('Bestial Spirit', 'XPHB'), { ...caster, spellLevel: 3, variant: 'Air' });
    expect(s.ac.value).toBe(14);
    expect(s.hp.value).toBe(25);
    const rend = s.actions.find((a) => a.name === 'Rend');
    expect(rend.attack.bonus).toBe(7);
    expect(rend.damage[0]).toEqual({ formula: '1d8 + 4 + 3', type: 'piercing' });
  });
  it('Steel Defender do artífice 5 com Int +3', () => {
    const s = creatureStats(get('Steel Defender', 'EFA'), { ...caster, classLevel: 5 });
    expect(s.hp.value).toBe(30);
    expect(s.ac.value).toBe(15);
  });
  it('o lobo: CA, PV, PB 2 e a mordida', () => {
    const s = creatureStats(get('Wolf', 'XMM'));
    expect(s.pb).toBe(2);
    expect(s.hp.formula).toMatch(/d8/);
    const bite = s.actions.find((a) => a.name === 'Bite');
    expect(bite.attack.bonus).toBe(4);
    expect(bite.damage[0].type).toBe('piercing');
  });
  it('o tipo do dano pela forma (Otherworldly Steed Fey: psychic) e antes do dado (Animated Object: force)', () => {
    const steed = creatureStats(get('Otherworldly Steed', 'XPHB'), { ...caster, spellLevel: 2, variant: 'Fey' });
    expect(steed.variants).toEqual(expect.arrayContaining(['Celestial', 'Fey', 'Fiend']));
    expect(steed.actions.find((x) => /Slam/.test(x.name)).damage[0].type).toBe('psychic');
    const obj = creatureStats(get('Animated Object', 'XPHB'), { ...caster, spellLevel: 5, variant: 'Large' });
    expect(obj.actions[0].damage.map((d) => d.type)).toEqual(['force', 'force', 'force']);
  });
  it('a cópia resolvida (Hound of Ill Omen, do Dire Wolf) tem CA e PV', () => {
    const s = creatureStats(get('Hound of Ill Omen', 'XGE'));
    expect(s.ac.value).toBeGreaterThan(10);
    expect(s.hp.value).toBeGreaterThan(10);
  });
});
