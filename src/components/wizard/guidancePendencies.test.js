// Testes de guidancePendencies: o botão ✦ deve contar TODAS as pendências
// obrigatórias (não-biográficas), não só as decisões de classe. Cada campo
// preenchido derruba o total em 1; biografia/alinhamento/nome não contam.
import { describe, it, expect } from 'vitest';
import { guidancePendencies, guidanceActive } from './guidancePendencies';
import { createCharacter } from '../../schema/character';

// db mínimo estruturalmente válido: espécie/feat/classe homebrew (fora do
// compêndio) resolvem como "nada a preencher" → completos, o que deixa isolar
// cada contribuição de pendência sem montar dados reais de classe.
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
    // espécie fora do compêndio → nada a preencher → completa
    c.species = { id: 'homebrew', source: 'X', lineage: null, choices: {} };
    expect(pend(c).basic).toBe(5);

    // talento de origem fora do compêndio → sem sub-escolhas → completo
    c.origin.originFeat = { id: 'homebrew', source: 'X', choices: {} };
    expect(pend(c).basic).toBe(4);

    // atributos: método != manual conta como escolhido
    c.scoreMethod = { type: 'standard-array' };
    expect(pend(c).basic).toBe(3);

    // boosts de background atribuídos
    c.origin.abilityBoosts = [{ ability: 'str', amount: 2 }];
    expect(pend(c).basic).toBe(2);

    // proficiências da origem (2 perícias, 1 ferramenta, 1 idioma)
    c.origin.choices = {
      skill: { kind: 'skill', picks: ['ath', 'acr'] },
      tool: { kind: 'tool', picks: ["Smith's Tools"] },
      language: { kind: 'language', picks: ['Elvish'] },
    };
    expect(pend(c).basic).toBe(1); // só falta a classe

    // classe definida (mesmo fora do compêndio → sem escolhas a cobrar)
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
