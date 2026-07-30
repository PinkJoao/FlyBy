import { describe, it, expect } from 'vitest';
import {
  isContainerName, containerProps, isWeightless, weightContext, contentsOf,
  wouldCycle, orphanContents,
} from './containers';

const nameOf = (e) => e.itemId;
const it_ = (uid, itemId, container = null) => ({ uid, itemId, container });

describe('o que é contêiner sai do SRD, não de curadoria', () => {
  it('reconhece os contêineres publicados, sem depender de caixa', () => {
    expect(isContainerName('Backpack')).toBe(true);
    expect(isContainerName('bag of holding')).toBe(true);
    expect(isContainerName('Pouch')).toBe(true);
    expect(isContainerName('Longsword')).toBe(false);
  });

  it('um item CUSTOM importado se declara contêiner pelo próprio tipo Foundry', () => {
    expect(isContainerName('Bolsa Caseira', { fType: 'container' })).toBe(true);
    expect(isContainerName('Bolsa Caseira', { fType: 'loot' })).toBe(false);
  });

  it('capacidade e weightless vêm do SRD', () => {
    expect(containerProps('Backpack')).toEqual({ weightless: false, capacity: { type: 'weight', value: 30 } });
    expect(isWeightless('Bag of Holding')).toBe(true);
    expect(isWeightless('Backpack')).toBe(false);
    // Item que não é contêiner nenhum.
    expect(containerProps('Longsword')).toBeNull();
    expect(isWeightless('Longsword')).toBe(false);
  });
});

describe('regra de peso (RAW): só o conteúdo de um contêiner weightless não conta', () => {
  const counts = (entries) => {
    const { counts: fn } = weightContext(entries, nameOf);
    return Object.fromEntries(entries.map((e) => [e.uid, fn(e)]));
  };

  it('num contêiner MUNDANO tudo conta, inclusive o contêiner', () => {
    expect(counts([it_('bp', 'Backpack'), it_('r', 'Rope', 'bp')])).toEqual({ bp: true, r: true });
  });

  it('num WEIGHTLESS o conteúdo não conta, mas a própria bolsa sim', () => {
    expect(counts([it_('b', 'Bag of Holding'), it_('r', 'Rope', 'b')])).toEqual({ b: true, r: false });
  });

  it('a regra vale para a CADEIA: qualquer ancestral weightless zera o item', () => {
    const entries = [it_('b', 'Bag of Holding'), it_('bp', 'Backpack', 'b'), it_('r', 'Rope', 'bp')];
    expect(counts(entries)).toEqual({ b: true, bp: false, r: false });
  });

  it('o inverso: um weightless DENTRO de um mundano ainda pesa', () => {
    const entries = [it_('bp', 'Backpack'), it_('b', 'Bag of Holding', 'bp'), it_('r', 'Rope', 'b')];
    expect(counts(entries)).toEqual({ bp: true, b: true, r: false });
  });

  it('pai inexistente degrada para item solto (nunca some)', () => {
    expect(counts([it_('r', 'Rope', 'sumiu')])).toEqual({ r: true });
  });

  it('um ciclo em dado corrompido não trava a derivação', () => {
    const entries = [it_('a', 'Backpack', 'b'), it_('b', 'Sack', 'a')];
    expect(() => counts(entries)).not.toThrow();
  });
});

describe('mover itens entre contêineres', () => {
  const entries = [it_('bp', 'Backpack'), it_('sack', 'Sack', 'bp'), it_('r', 'Rope', 'sack')];

  it('contentsOf lista só os filhos DIRETOS', () => {
    expect(contentsOf(entries, 'bp').map((e) => e.uid)).toEqual(['sack']);
    expect(contentsOf(entries, 'sack').map((e) => e.uid)).toEqual(['r']);
  });

  it('wouldCycle barra pôr um contêiner dentro de si mesmo ou de um descendente', () => {
    expect(wouldCycle(entries, 'bp', 'bp')).toBe(true);
    expect(wouldCycle(entries, 'bp', 'sack')).toBe(true); // sack está DENTRO de bp
    expect(wouldCycle(entries, 'sack', 'bp')).toBe(false); // já está lá, é legítimo
    expect(wouldCycle(entries, 'bp', null)).toBe(false); // tirar nunca cicla
  });

  it('remover um contêiner SOLTA o conteúdo, não o apaga', () => {
    const out = orphanContents(entries, ['bp']);
    expect(out.find((e) => e.uid === 'sack').container).toBeNull();
    // Só os filhos DIRETOS do removido mudam - o resto da cadeia fica intacto.
    expect(out.find((e) => e.uid === 'r').container).toBe('sack');
  });
});
