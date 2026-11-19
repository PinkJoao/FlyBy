// =============================================================================
// itemEffects.test: o que um item mágico ativo muda na ficha
// =============================================================================
// O QUE FAZ
//   Prova os dois lados de cada família (DDL-0256): o item ativo muda o atributo, o ataque e a CD
//   de magia, o teste e o deslocamento; o inativo (sem atunar) e o de ativação (Boots of Speed,
//   Winged Boots) não; o bônus restrito por classe só vale nela; o "fixa em N" é um piso.
//
// FUNÇÕES
//   active(raw, extra): a entrada de inventário equipada e atunada.
// -----------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { itemAbilityEffects, itemSpellBonuses, itemCheckBonus, itemSpeeds, spellClassOf, isActiveItem } from './itemEffects';
import { finalScores } from './abilities';

const active = (raw, extra = {}) => ({ raw, equipped: true, attuned: true, ...extra });
const amulet = { name: 'Amulet of Health', reqAttune: true, ability: { static: { con: 19 } }, entries: ['Your Constitution score is 19 while you wear this amulet.'] };
const ioun = { name: 'Ioun Stone, Fortitude', reqAttune: true, ability: { con: 2 }, entries: ['Your Constitution score increases by 2, to a maximum of 20.'] };
const book = { name: 'Book of Exalted Deeds', reqAttune: true, ability: { wis: 2 }, entries: ['your Wisdom score increases by 2, to a maximum of 24.'] };
const rod = { name: '+1 Rod of the Pact Keeper', reqAttune: true, bonusSpellAttack: '+1', bonusSpellSaveDc: '+1', entries: ['you gain a bonus to spell attack rolls and to the saving throw DCs of your {@filter warlock spells|spells|class=warlock}.'] };
const robe = { name: 'Robe of the Archmagi', reqAttune: true, bonusSpellAttack: '+2', bonusSpellSaveDc: '+2', entries: ['Your spell save DC and spell attack bonus each increase by 2.'] };

describe('itemEffects (DDL-0256)', () => {
  it('o atributo: o piso do Amulet e o +2 com o teto do texto', () => {
    const fx = itemAbilityEffects([active(amulet), active(ioun), active(book)]);
    expect(fx).toEqual([
      { ability: 'con', set: 19, source: 'Amulet of Health' },
      { ability: 'con', amount: 2, max: 20, source: 'Ioun Stone, Fortitude' },
      { ability: 'wis', amount: 2, max: 24, source: 'Book of Exalted Deeds' },
    ]);
    const c = { scores: { str: 10, dex: 10, con: 12, int: 10, wis: 22, cha: 10 } };
    const s = finalScores(c, fx);
    expect(s.con).toBe(19);
    expect(s.wis).toBe(24);
    expect(finalScores({ scores: { ...c.scores, con: 20 } }, fx.slice(0, 1)).con).toBe(20);
  });

  it('sem atunar o item que pede atunamento não vale', () => {
    expect(isActiveItem({ raw: amulet, equipped: true, attuned: false })).toBe(false);
    expect(itemAbilityEffects([{ raw: amulet, equipped: true, attuned: false }])).toEqual([]);
  });

  it('o bônus de magia: por classe quando o texto restringe', () => {
    expect(spellClassOf(rod)).toBe('warlock');
    expect(spellClassOf(robe)).toBeNull();
    expect(itemSpellBonuses([active(rod), active(robe)])).toEqual([
      { source: '+1 Rod of the Pact Keeper', attack: 1, dc: 1, cls: 'warlock' },
      { source: 'Robe of the Archmagi', attack: 2, dc: 2, cls: null },
    ]);
  });

  it('o teste e o deslocamento sempre ligado; o de ativação fica fora', () => {
    expect(itemCheckBonus([active({ name: 'Stone of Good Luck', reqAttune: true, bonusAbilityCheck: '+1' })]).bonus).toBe(1);
    const speeds = itemSpeeds([
      active({ name: 'Slippers of Spider Climbing', reqAttune: true, modifySpeed: { equal: { climb: 'walk' } } }),
      active({ name: 'Ring of Swimming', modifySpeed: { static: { swim: 40 } } }),
      active({ name: 'Boots of Speed', reqAttune: true, modifySpeed: { multiply: { walk: 2 } } }),
      active({ name: 'Winged Boots', reqAttune: true, charges: 4, modifySpeed: { static: { fly: 30 } } }),
    ], 30);
    expect(speeds).toEqual({ climb: { feet: 30, note: 'Slippers of Spider Climbing' }, swim: { feet: 40, note: 'Ring of Swimming' } });
  });
});
