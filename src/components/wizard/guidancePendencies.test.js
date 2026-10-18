// =============================================================================
// guidancePendencies.test: testes das pendências do botão do guia
// =============================================================================
// O QUE FAZ
//   Cada campo obrigatório preenchido derruba o total em 1; biografia,
//   alinhamento e nome não contam. O db mínimo usa espécie, talento e classe fora
//   do compêndio (nada a preencher), para isolar cada contribuição.
//
// FUNÇÕES
//   pend(c): as pendências de um personagem.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { guidancePendencies, guidanceActive } from './guidancePendencies';
import { createCharacter } from '../../schema/character';

const db = { races: { race: [] }, feats: { feat: [] } };
const derived = { spellcasting: { origins: [] } };

const pend = (c) => guidancePendencies(db, c, derived);

describe('guidancePendencies (todas as pendências obrigatórias)', () => {
  it('personagem em branco: 6 pendências básicas (classe, espécie, talento, proficiências, atributos, boosts)', () => {
    const p = pend(createCharacter());
    expect(p.basic).toBe(6);
    expect(p.fixup).toBe(0);
    expect(p.total).toBe(6);
  });

  it('cada campo obrigatório preenchido derruba o total em 1', () => {
    const c = createCharacter();
    c.species = { id: 'homebrew', source: 'X', lineage: null, choices: {} };
    expect(pend(c).basic).toBe(5);

    c.origin.originFeat = { id: 'homebrew', source: 'X', choices: {} };
    expect(pend(c).basic).toBe(4);

    c.scoreMethod = { type: 'standard-array' };
    expect(pend(c).basic).toBe(3);

    c.origin.abilityBoosts = [{ ability: 'str', amount: 2 }];
    expect(pend(c).basic).toBe(2);

    c.origin.choices = {
      skill: { kind: 'skill', picks: ['ath', 'acr'] },
      tool: { kind: 'tool', picks: ["Smith's Tools"] },
      language: { kind: 'language', picks: ['Elvish'] },
    };
    expect(pend(c).basic).toBe(1);

    c.classes = [{ ...c.classes[0], classId: 'fighter', source: 'XPHB' }];
    const p = pend(c);
    expect(p.basic).toBe(0);
    expect(p.total).toBe(0);
  });

  it('apagar os boosts de background reabre a pendência (o caso do usuário)', () => {
    const c = createCharacter();
    c.origin.abilityBoosts = [{ ability: 'dex', amount: 2 }];
    const before = pend(c).total;
    c.origin.abilityBoosts = [];
    expect(pend(c).total).toBe(before + 1);
  });
});

describe('guidanceActive (flag por-personagem meta.guided)', () => {
  it('ausente (legado/guiado) = ativa; false = desligada', () => {
    expect(guidanceActive(createCharacter())).toBe(true);
    expect(guidanceActive(createCharacter({ guided: false }))).toBe(false);
    expect(guidanceActive({ meta: {} })).toBe(true);
  });
});
