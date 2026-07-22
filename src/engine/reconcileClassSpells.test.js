import { describe, it, expect } from 'vitest';
import { reconcileClassSpells } from './resolve';

// Wizard (full caster) para os testes de círculo/contagem no level-down.
const wizardClass = {
  name: 'Wizard', source: 'XPHB', casterProgression: 'full', spellcastingAbility: 'int',
  cantripProgression: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5],
  preparedSpellsProgression: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15],
  hd: { faces: 6 },
};
// Subclasse que concede "Mage Armor" como SEMPRE preparada (nível ≥ 3) - o análogo
// do Devotion concedendo "Protection from Evil and Good".
const grantorSub = {
  name: 'Grantor School', shortName: 'Grantor', className: 'Wizard', source: 'XPHB',
  additionalSpells: [{ prepared: { 3: ['Mage Armor|XPHB'] } }],
};

const SPELLS = [
  { name: 'Fire Bolt', source: 'XPHB', level: 0, school: 'V' },
  { name: 'Light', source: 'XPHB', level: 0, school: 'V' },
  { name: 'Ray of Frost', source: 'XPHB', level: 0, school: 'V' },
  { name: 'Prestidigitation', source: 'XPHB', level: 0, school: 'T' },
  { name: 'Mage Armor', source: 'XPHB', level: 1, school: 'A' },
  { name: 'Magic Missile', source: 'XPHB', level: 1, school: 'V' },
  { name: 'Shield', source: 'XPHB', level: 1, school: 'A' },
  { name: 'Thunderwave', source: 'XPHB', level: 1, school: 'V' },
  { name: 'Sleep', source: 'XPHB', level: 1, school: 'E' },
  { name: 'Fireball', source: 'XPHB', level: 3, school: 'V' },
  { name: 'Lightning Bolt', source: 'XPHB', level: 3, school: 'V' },
];

const db = {
  'class-wizard': { class: [wizardClass], subclass: [grantorSub] },
  'spells-xphb': { spell: SPELLS },
};

const ref = (name) => ({ id: name, source: 'XPHB' });
const ids = (arr) => arr.map((s) => s.id);
const cls = (over = {}) => ({
  uid: 'c1', classId: 'wizard', source: 'XPHB', level: 5, isOriginalClass: true,
  subclassId: null, subclassSource: null, choices: {}, spells: [], ...over,
});

describe('reconcileClassSpells', () => {
  it('sem mudança de nível nem subclasse: devolve o MESMO array (sem escrita)', () => {
    const c = cls({ spells: [ref('Fireball')] });
    expect(reconcileClassSpells(c, c, db)).toBe(c.spells);
  });

  it('array vazio ou sem classe: intocado', () => {
    const noClass = cls({ classId: '', spells: [ref('Fireball')] });
    expect(reconcileClassSpells(noClass, noClass, db)).toBe(noClass.spells);
    const empty = cls({ spells: [] });
    expect(reconcileClassSpells(empty, empty, db)).toBe(empty.spells);
  });

  it('remover a subclasse derruba as magias que ela concedia (mantém o substituto)', () => {
    // Cenário do Paladin/Devotion: "Mage Armor" colapsou na concessão e o jogador
    // preparou "Magic Missile" no lugar - ambos ficam em `spells`.
    const old = cls({ level: 5, subclassId: 'Grantor', spells: [ref('Mage Armor'), ref('Magic Missile')] });
    const next = cls({ level: 5, subclassId: null, spells: [ref('Mage Armor'), ref('Magic Missile')] });
    expect(ids(reconcileClassSpells(old, next, db))).toEqual(['Magic Missile']);
  });

  it('level-down abaixo do círculo: perde as magias que o novo nível não alcança', () => {
    // Wizard 5 (até 3º círculo) → 4 (até 2º): perde Fireball/Lightning Bolt.
    const spells = [ref('Magic Missile'), ref('Fireball'), ref('Lightning Bolt')];
    const old = cls({ level: 5, spells });
    const next = cls({ level: 4, spells });
    expect(ids(reconcileClassSpells(old, next, db))).toEqual(['Magic Missile']);
  });

  it('level-down: poda as PREPARADAS mais recentes até caber no limite', () => {
    // Limite de preparadas: nível 2 = 5, nível 1 = 4. Cinco magias de 1º círculo
    // (a ordem = ordem de aprendizado) → a MAIS RECENTE (Sleep, no fim) sai.
    const spells = [ref('Mage Armor'), ref('Magic Missile'), ref('Shield'), ref('Thunderwave'), ref('Sleep')];
    const old = cls({ level: 2, spells });
    const next = cls({ level: 1, spells });
    expect(ids(reconcileClassSpells(old, next, db))).toEqual(['Mage Armor', 'Magic Missile', 'Shield', 'Thunderwave']);
  });

  it('level-down: cantrips excedentes saem pelos mais recentes', () => {
    // 4 cantrips no nível 4, 3 no nível 3: 4→3 perde o cantrip mais recente.
    const spells = [ref('Fire Bolt'), ref('Light'), ref('Ray of Frost'), ref('Prestidigitation')];
    const old = cls({ level: 4, spells });
    const next = cls({ level: 3, spells });
    expect(ids(reconcileClassSpells(old, next, db))).toEqual(['Fire Bolt', 'Light', 'Ray of Frost']);
  });

  it('concessões da subclasse ATUAL colapsam mas não contam nem são podadas', () => {
    // Mage Armor concedida pela subclasse Grantor: fica em `spells` e não conta.
    const spells = [ref('Mage Armor'), ref('Fireball')];
    const old = cls({ level: 5, subclassId: 'Grantor', spells });
    const next = cls({ level: 4, subclassId: 'Grantor', spells });
    // Fireball (3º) some no 4; Mage Armor (concedida) permanece.
    expect(ids(reconcileClassSpells(old, next, db))).toEqual(['Mage Armor']);
  });
});
