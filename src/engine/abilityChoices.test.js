import { describe, it, expect } from 'vitest';
import { parseChoices, collectAbilityPicks, fixedAbilityBoosts } from './choices';
import { collectAbilityBoosts, finalScores } from './abilities';
import { deriveFeatAbilityBoosts, withAbilityCaps } from './resolve';
import { createCharacter } from '../schema/character';

// Feat com ability score FIXO (Great Weapon Master XPHB: +1 Str - não é escolha).
const gwmFeat = { name: 'Great Weapon Master', source: 'XPHB', ability: [{ str: 1 }] };

// Feat "Ability Score Improvement" XPHB: duas alternativas (+2 em um OU +1 em dois).
const asiFeat = {
  name: 'Ability Score Improvement',
  ability: [
    { choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], amount: 2 }, hidden: true },
    { choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], count: 2 }, hidden: true },
  ],
};

// Feat General com ASI simples (Athlete: +1 em Str ou Dex).
const athleteFeat = { name: 'Athlete', ability: [{ choose: { from: ['str', 'dex'] } }] };

describe('parseChoices - ability field', () => {
  it('parses ASI feat alternatives (+2/one, +1/two)', () => {
    const [choice] = parseChoices(asiFeat);
    expect(choice.kind).toBe('ability');
    expect(choice.pool.alternatives).toEqual([
      { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], count: 1, amount: 2 },
      { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], count: 2, amount: 1 },
    ]);
  });

  it('parses single-alternative feats (Athlete)', () => {
    const [choice] = parseChoices(athleteFeat);
    expect(choice.pool.alternatives).toEqual([{ from: ['str', 'dex'], count: 1, amount: 1 }]);
  });

  it('ignores feats without ability chooses', () => {
    expect(parseChoices({ name: 'Alert' })).toEqual([]);
  });

  // O boost FIXO não é uma escolha (não vira Choice); é aplicado à parte.
  it('does not turn a fixed ability boost into a choice', () => {
    expect(parseChoices(gwmFeat)).toEqual([]);
  });
});

describe('fixedAbilityBoosts', () => {
  it('extracts fixed ability grants (GWM +1 Str)', () => {
    expect(fixedAbilityBoosts(gwmFeat.ability)).toEqual([{ ability: 'str', amount: 1 }]);
  });

  it('extracts multiple fixed grants and ignores choose entries', () => {
    const ability = [{ con: 1 }, { choose: { from: ['str', 'dex'] } }, { wis: 2 }];
    expect(fixedAbilityBoosts(ability)).toEqual([
      { ability: 'con', amount: 1 },
      { ability: 'wis', amount: 2 },
    ]);
  });

  it('handles missing/empty field', () => {
    expect(fixedAbilityBoosts(undefined)).toEqual([]);
    expect(fixedAbilityBoosts([])).toEqual([]);
  });
});

describe('deriveFeatAbilityBoosts - boost fixo de talento resolvido do db', () => {
  const db = { feats: { feat: [gwmFeat] } };

  it('coleta +1 Str do GWM escolhido num slot de ASI de classe', () => {
    const ch = createCharacter({ name: 'T' });
    ch.classes[0].choices = {
      'feat@4': { kind: 'feat', picks: ['Great Weapon Master|XPHB'] },
    };
    const extra = deriveFeatAbilityBoosts(ch, db);
    expect(extra).toEqual([{ ability: 'str', amount: 1 }]);
  });

  it('finalScores aplica o boost fixo via extra', () => {
    const ch = createCharacter({ name: 'T' });
    ch.scores.str = 17;
    const extra = [{ ability: 'str', amount: 1 }];
    expect(finalScores(ch, extra).str).toBe(18);
    expect(collectAbilityBoosts(ch, extra)).toContainEqual({ ability: 'str', amount: 1 });
  });

  it('sem talentos, nenhum boost extra', () => {
    expect(deriveFeatAbilityBoosts(createCharacter(), db)).toEqual([]);
  });
});

describe('finalScores - teto de atributo (TC-0022)', () => {
  const boost = (ability, amount, max) => ({ ability, amount, max });

  it('talentos comuns (sem max) param em 20', () => {
    const ch = createCharacter({ name: 'T' });
    ch.scores.str = 19;
    // GWM +1 (→20) e Sentinel +1 (desperdiçado, já em 20).
    const extra = [boost('str', 1), boost('str', 1)];
    expect(finalScores(ch, extra).str).toBe(20);
  });

  it('um Epic Boon (max 30) sobe de 20 p/ 21 depois dos comuns', () => {
    const ch = createCharacter({ name: 'T' });
    ch.scores.str = 19;
    // GWM +1, Sentinel +1 (teto 20) e Epic Boon +1 (teto 30) → 21, não 22.
    const extra = [boost('str', 1), boost('str', 1), boost('str', 1, 30)];
    expect(finalScores(ch, extra).str).toBe(21);
  });

  it('ASI +2 num atributo em 19 satura em 20 (desperdiça 1)', () => {
    const ch = createCharacter({ name: 'T' });
    ch.scores.str = 19;
    expect(finalScores(ch, [boost('str', 2)]).str).toBe(20);
  });

  it('Epic Boon empilha até 30', () => {
    const ch = createCharacter({ name: 'T' });
    ch.scores.con = 29;
    expect(finalScores(ch, [boost('con', 1, 30)]).con).toBe(30);
    ch.scores.con = 30;
    expect(finalScores(ch, [boost('con', 1, 30)]).con).toBe(30);
  });

  it('não rebaixa uma base já acima do teto (ajuste manual)', () => {
    const ch = createCharacter({ name: 'T' });
    ch.scores.str = 22; // definido à mão
    expect(finalScores(ch, [boost('str', 1)]).str).toBe(22); // comum: sem efeito, sem rebaixar
    expect(finalScores(ch, [boost('str', 1, 30)]).str).toBe(23); // boon: sobe
  });

  it('a ordem dos boosts na lista não muda o resultado', () => {
    const ch = createCharacter({ name: 'T' });
    ch.scores.str = 19;
    const a = finalScores(ch, [boost('str', 1, 30), boost('str', 1), boost('str', 1)]).str;
    const b = finalScores(ch, [boost('str', 1), boost('str', 1, 30), boost('str', 1)]).str;
    expect(a).toBe(21);
    expect(b).toBe(21);
  });
});

describe('withAbilityCaps - injeta o teto do feat nos picks (TC-0022)', () => {
  const boon = { name: 'Boon of Combat Prowess', source: 'XPHB', ability: [{ choose: { from: ['str', 'dex'] }, max: 30 }] };
  const db = { feats: { feat: [boon] } };

  const charWithBoonStr = () => {
    const ch = createCharacter({ name: 'T' });
    ch.classes[0].choices = {
      'feat@19': {
        kind: 'feat',
        picks: ['Boon of Combat Prowess|XPHB'],
        sub: { 'Boon of Combat Prowess|XPHB': { 'ability-0': { kind: 'ability', picks: [{ ability: 'str', amount: 1 }] } } },
      },
    };
    return ch;
  };

  it('preenche max=30 num pick de Epic Boon salvo sem ele', () => {
    const patched = withAbilityCaps(charWithBoonStr(), db);
    const pick = patched.classes[0].choices['feat@19'].sub['Boon of Combat Prowess|XPHB']['ability-0'].picks[0];
    expect(pick).toEqual({ ability: 'str', amount: 1, max: 30 });
  });

  it('não muta o personagem original (clona quando corrige)', () => {
    const ch = charWithBoonStr();
    const patched = withAbilityCaps(ch, db);
    expect(patched).not.toBe(ch);
    expect(ch.classes[0].choices['feat@19'].sub['Boon of Combat Prowess|XPHB']['ability-0'].picks[0].max).toBeUndefined();
  });

  it('devolve o mesmo objeto quando não há feat com teto (sem clone à toa)', () => {
    const ch = createCharacter({ name: 'T' });
    ch.classes[0].choices = { 'feat@4': { kind: 'feat', picks: ['Great Weapon Master|XPHB'] } };
    expect(withAbilityCaps(ch, { feats: { feat: [] } })).toBe(ch);
  });

  it('com o teto injetado, o Boon leva Str de 20 p/ 21 (feats comuns param em 20)', () => {
    const ch = charWithBoonStr();
    ch.scores.str = 20; // já no teto comum
    const patched = withAbilityCaps(ch, db);
    expect(finalScores(patched).str).toBe(21);
    // sem o backfill (pick sem max), o mesmo Boon capa em 20.
    expect(finalScores(ch).str).toBe(20);
  });
});

describe('collectAbilityPicks', () => {
  it('collects picks from nested sub-bags (feat dentro de slot de ASI)', () => {
    const bag = {
      'feat@4': {
        kind: 'feat',
        picks: ['Ability Score Improvement|XPHB'],
        sub: {
          'Ability Score Improvement|XPHB': {
            'ability-0': { kind: 'ability', alt: 0, picks: [{ ability: 'str', amount: 2 }] },
          },
        },
      },
    };
    expect(collectAbilityPicks(bag)).toEqual([{ ability: 'str', amount: 2 }]);
  });

  it('ignores malformed picks', () => {
    const bag = { x: { kind: 'ability', picks: ['str', { ability: '', amount: 1 }, null] } };
    expect(collectAbilityPicks(bag)).toEqual([]);
  });
});

describe('collectAbilityBoosts + finalScores com ASI de classe', () => {
  it('applies class choice-bag boosts to final scores', () => {
    const ch = createCharacter({ name: 'T' });
    ch.scores.str = 15;
    ch.classes[0].choices = {
      'feat@4': {
        kind: 'feat',
        picks: ['Ability Score Improvement|XPHB'],
        sub: {
          'Ability Score Improvement|XPHB': {
            'ability-0': { kind: 'ability', alt: 0, picks: [{ ability: 'str', amount: 2 }] },
          },
        },
      },
    };
    expect(collectAbilityBoosts(ch)).toContainEqual({ ability: 'str', amount: 2 });
    expect(finalScores(ch).str).toBe(17);
  });
});
