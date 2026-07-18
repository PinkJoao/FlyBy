import { describe, it, expect } from 'vitest';
import { createCharacter } from '../schema/character';
import { textToHtml } from './foundryExport';
import { htmlToText, alignmentCode, foundryToCharacter } from './foundryImport';
import { assembleFoundryActor } from './foundryActor';

const db = {
  races: { race: [] },
  feats: { feat: [] },
  'items-base': { baseitem: [] },
  languages: { language: [] },
  'spell-sources': {},
};

function biographedCharacter() {
  const ch = createCharacter({ name: 'Etienne' });
  ch.identity = {
    ...ch.identity,
    alignment: 'NG',
    backstory: 'Raised by wolves.\n\nThen by worse.',
    personality: 'Speaks too little.',
    ideals: 'Freedom.',
    bonds: 'My pack.',
    flaws: 'I bite.',
    appearance: 'Scarred.',
    age: '27',
    height: "6'1\"",
    weight: '190 lb',
    eyes: 'Amber',
    hair: 'Black',
    skin: 'Tan',
    gender: 'Male',
    faith: 'The Wild',
  };
  return ch;
}

describe('textToHtml / htmlToText', () => {
  it('parágrafos separados por linha em branco', () => {
    expect(textToHtml('a\n\nb')).toBe('<p>a</p><p>b</p>');
  });

  it('quebra simples vira <br>', () => {
    expect(textToHtml('a\nb')).toBe('<p>a<br>b</p>');
  });

  it('texto vazio não gera HTML', () => {
    expect(textToHtml('')).toBe('');
    expect(textToHtml('   ')).toBe('');
    expect(textToHtml(null)).toBe('');
  });

  it('a volta desfaz a ida', () => {
    const text = 'Raised by wolves.\n\nThen by worse.';
    expect(htmlToText(textToHtml(text))).toBe(text);
  });

  it('desescapa entidades e ignora tags desconhecidas', () => {
    expect(htmlToText('<p><strong>Bell &amp; Co</strong></p>')).toBe('Bell & Co');
    expect(htmlToText(null)).toBe('');
  });
});

describe('alignmentCode', () => {
  it('reverte o texto do Foundry no código do builder', () => {
    expect(alignmentCode('Neutral good')).toBe('NG');
    expect(alignmentCode('chaotic evil')).toBe('CE');
    expect(alignmentCode('True neutral')).toBe('N');
  });

  it('aceita "Neutral" (forma curta dos exports antigos)', () => {
    expect(alignmentCode('Neutral')).toBe('N');
  });

  it('desconhecido ou vazio → sem alinhamento', () => {
    expect(alignmentCode('')).toBe('');
    expect(alignmentCode('Lawful something')).toBe('');
  });
});

describe('export dos campos biográficos', () => {
  const actor = assembleFoundryActor(biographedCharacter(), db);
  const det = actor.system.details;

  it('o alinhamento sai por extenso (antes saía sempre vazio)', () => {
    expect(det.alignment).toBe('Neutral good');
  });

  it('a história vira `biography.value` em HTML', () => {
    expect(det.biography.value).toBe('<p>Raised by wolves.</p><p>Then by worse.</p>');
  });

  it('a MESMA história é a descrição do item de background', () => {
    const bg = actor.items.find((i) => i.type === 'background');
    expect(bg.system.description.value).toBe(det.biography.value);
  });

  it('os traços usam os nomes do Foundry (singular; personality = `trait`)', () => {
    expect(det.trait).toBe('Speaks too little.');
    expect(det.ideal).toBe('Freedom.');
    expect(det.bond).toBe('My pack.');
    expect(det.flaw).toBe('I bite.');
  });

  it('os descritores físicos saem 1:1', () => {
    expect(det).toMatchObject({
      appearance: 'Scarred.', age: '27', height: "6'1\"", weight: '190 lb',
      eyes: 'Amber', hair: 'Black', skin: 'Tan', gender: 'Male', faith: 'The Wild',
    });
  });
});

describe('round-trip biográfico', () => {
  const original = biographedCharacter();
  const back = foundryToCharacter(assembleFoundryActor(original, db), db);

  it('todo campo de identidade volta igual', () => {
    for (const key of Object.keys(original.identity)) {
      expect([key, back.identity[key]]).toEqual([key, original.identity[key]]);
    }
  });

  it('um ator sem `details` não quebra o import', () => {
    const bare = { type: 'character', system: {}, items: [] };
    expect(foundryToCharacter(bare, db).identity.alignment).toBe('');
  });
});
