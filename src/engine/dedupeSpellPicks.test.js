import { describe, it, expect } from 'vitest';
import { dedupeSpellPicks, dedupeCharacterSpellPicks } from './dedupeSpellPicks';

describe('dedupeSpellPicks', () => {
  it('remove a cópia repetida, preservando a ordem', () => {
    const out = dedupeSpellPicks([
      { id: 'Hex', source: 'XPHB' },
      { id: 'Fireball', source: 'XPHB' },
      { id: 'Hex', source: 'XPHB' },
    ]);
    expect(out.map((s) => s.id)).toEqual(['Hex', 'Fireball']);
  });

  it('a identidade é nome + LIVRO: mesma grafia em fontes diferentes não colapsa', () => {
    const out = dedupeSpellPicks([
      { id: 'Hex', source: 'XPHB' },
      { id: 'Hex', source: 'PHB' },
    ]);
    expect(out).toHaveLength(2);
  });

  it('ignora caixa (o ator externo escreve como quiser)', () => {
    const out = dedupeSpellPicks([
      { id: 'hideous laughter', source: 'xphb' },
      { id: 'Hideous Laughter', source: 'XPHB' },
    ]);
    expect(out).toHaveLength(1);
  });

  // Uma cópia guardada no grimório e outra preparada: a sobrevivente tem de
  // ficar PREPARADA, senão a dedup tira uma capacidade do jogador.
  it('unifica `prepared` pelo mais capaz', () => {
    expect(dedupeSpellPicks([
      { id: 'Fly', source: 'XPHB', prepared: false },
      { id: 'Fly', source: 'XPHB' },
    ])[0].prepared).toBeUndefined();

    expect(dedupeSpellPicks([
      { id: 'Fly', source: 'XPHB' },
      { id: 'Fly', source: 'XPHB', prepared: false },
    ])[0].prepared).toBeUndefined();
  });

  it('duas cópias guardadas continuam guardadas', () => {
    const out = dedupeSpellPicks([
      { id: 'Fly', source: 'XPHB', prepared: false },
      { id: 'Fly', source: 'XPHB', prepared: false },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].prepared).toBe(false);
  });

  it('sem repetição, devolve a MESMA lista (não cria lixo)', () => {
    const list = [{ id: 'Hex', source: 'XPHB' }, { id: 'Bane', source: 'XPHB' }];
    expect(dedupeSpellPicks(list)).toBe(list);
  });

  it('aguenta lista vazia, nula e de um item', () => {
    expect(dedupeSpellPicks(undefined)).toEqual([]);
    expect(dedupeSpellPicks([])).toEqual([]);
    const one = [{ id: 'Hex', source: 'XPHB' }];
    expect(dedupeSpellPicks(one)).toBe(one);
  });

  it('aceita a forma `name` além de `id`', () => {
    expect(dedupeSpellPicks([
      { name: 'Hex', source: 'XPHB' },
      { id: 'Hex', source: 'XPHB' },
    ])).toHaveLength(1);
  });
});

describe('dedupeCharacterSpellPicks', () => {
  it('dedupa cada classe, sem misturar entre elas', () => {
    const c = dedupeCharacterSpellPicks({
      classes: [
        { uid: 'a', spells: [{ id: 'Hex', source: 'XPHB' }, { id: 'Hex', source: 'XPHB' }] },
        { uid: 'b', spells: [{ id: 'Hex', source: 'XPHB' }] },
      ],
    });
    expect(c.classes[0].spells).toHaveLength(1);
    expect(c.classes[1].spells).toHaveLength(1); // a mesma magia noutra classe FICA
  });

  it('sem mudança, devolve o mesmo personagem', () => {
    const ch = { classes: [{ uid: 'a', spells: [{ id: 'Hex', source: 'XPHB' }] }] };
    expect(dedupeCharacterSpellPicks(ch)).toBe(ch);
  });
});

// -----------------------------------------------------------------------------
// A OUTRA METADE DO PAR: o que a dedup NÃO pode alcançar.
// -----------------------------------------------------------------------------
// Concessão com pool de usos próprio não mora em `ClassEntry.spells` - a
// derivação a recria de `additionalSpells` + registros curados. Estes casos vêm
// do levantamento (`scripts/survey-granted-spells.js`) e existem para travar o
// escopo: se alguém um dia passar magias CONCEDIDAS por esta função, quebram.
describe('escopo: concessões com uso próprio ficam fora (gabarito do levantamento)', () => {
  it('Ranger: Hunter\'s Mark escolhida e a concedida são coisas diferentes', () => {
    // Só a escolha entra aqui. A concessão do Favored Enemy (uso grátis por
    // descanso longo) é derivada, então nem aparece nesta lista.
    const picks = [{ id: "Hunter's Mark", source: 'XPHB' }];
    expect(dedupeSpellPicks(picks)).toBe(picks);
  });

  it('Archfey Warlock: Misty Step aparece 4x no dado, mas só a escolha é pick', () => {
    // Patrono sempre-preparada @3, patrono `daily:cha`, Steps of the Fey @3 e
    // Bewitching Magic @14 - nenhuma delas é uma escolha do jogador.
    const picks = [{ id: 'Misty Step', source: 'XPHB' }];
    expect(dedupeSpellPicks(picks)).toBe(picks);
  });
});
