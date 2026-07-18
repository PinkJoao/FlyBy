// Valida o engine contra os números-verdade da ficha real do Étienne (Fighter 6).
import { describe, it, expect } from 'vitest';
import { etienneFixture, etienneContext } from './fixtures/etienne';
import { deriveCharacter } from './index';
import { finalScores, abilityModifiers } from './abilities';
import { maxHp } from './hitpoints';
import { proficiencyBonus } from './math';
import { buildContext } from './context';
import { fighterClassData } from './fixtures/classData';
import { totalLevel } from '../schema/character';

describe('Étienne Corbeau (Fighter 6) - gabarito Foundry', () => {
  const c = etienneFixture();

  it('nível total e bônus de proficiência', () => {
    expect(totalLevel(c)).toBe(6);
    expect(proficiencyBonus(totalLevel(c))).toBe(3);
  });

  it('scores finais batem com o Foundry', () => {
    expect(finalScores(c)).toEqual({
      str: 15,
      dex: 20,
      con: 14,
      int: 13,
      wis: 10,
      cha: 8,
    });
  });

  it('modificadores finais', () => {
    expect(abilityModifiers(c)).toEqual({
      str: 2,
      dex: 5,
      con: 2,
      int: 1,
      wis: 0,
      cha: -1,
    });
  });

  it('HP máximo = 59', () => {
    expect(maxHp(c, etienneContext.hitDieMax)).toBe(59);
  });

  it('deriveCharacter: saves proficientes (STR/CON) usam o bônus de proficiência', () => {
    const d = deriveCharacter(c, etienneContext);
    // STR: mod +2, proficiente → +5
    expect(d.saves.str).toBe(5);
    // CON: mod +2, proficiente → +5
    expect(d.saves.con).toBe(5);
    // DEX: mod +5, NÃO proficiente → +5 (só o mod)
    expect(d.saves.dex).toBe(5);
    // WIS: mod 0, não proficiente → 0
    expect(d.saves.wis).toBe(0);
  });

  it('deriveCharacter: perícias proficientes das decisões', () => {
    const d = deriveCharacter(c, etienneContext);
    // Athletics (STR +2, proficiente +3) = +5
    expect(d.skills.ath.proficiency).toBe(1);
    expect(d.skills.ath.bonus).toBe(5);
    // Intimidation (CHA -1, proficiente +3) = +2
    expect(d.skills.itm.bonus).toBe(2);
    // Acrobatics (DEX +5, proficiente +3) = +8
    expect(d.skills.acr.bonus).toBe(8);
    // Stealth (DEX +5, não proficiente) = +5
    expect(d.skills.ste.proficiency).toBe(0);
    expect(d.skills.ste.bonus).toBe(5);
  });

  it('deriveCharacter: resumo completo', () => {
    const d = deriveCharacter(c, etienneContext);
    expect(d.level).toBe(6);
    expect(d.proficiencyBonus).toBe(3);
    expect(d.maxHp).toBe(59);
  });

  it('conjunto COMPLETO de perícias proficientes bate com o Foundry', () => {
    const d = deriveCharacter(c, etienneContext);
    const proficient = Object.keys(d.skills)
      .filter((s) => d.skills[s].proficiency >= 1)
      .sort();
    // Foundry: acr, ath, his, itm, prc
    // (ath+itm da origem, acr+his do Fighter, prc da escolha de espécie)
    expect(proficient).toEqual(['acr', 'ath', 'his', 'itm', 'prc']);
  });

  it('loop fechado: contexto DERIVADO do compêndio (não injetado à mão)', () => {
    // buildContext substitui o etienneContext escrito manualmente.
    const ctx = buildContext(c, { fighter: fighterClassData });
    expect(ctx.hitDieMax).toEqual({ fighter: 10 });
    expect(ctx.proficientSaves).toEqual(['str', 'con']);

    const d = deriveCharacter(c, ctx);
    expect(d.maxHp).toBe(59);
    expect(d.saves.str).toBe(5);
    expect(d.saves.con).toBe(5);
  });
});
