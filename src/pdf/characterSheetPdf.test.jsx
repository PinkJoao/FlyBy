// =============================================================================
// characterSheetPdf.test: testes do PDF da ficha
// =============================================================================
// O QUE FAZ
//   O pipeline produz um PDF válido sem o download do navegador: o template VAZIO
//   (2 páginas) e a paginação de magias (36 magias dão 1 página de rosto e 2 de
//   magias).
//
// FUNÇÕES
//   toBytes(el): os bytes do PDF.
//   pageCount(bytes): as páginas (dicts "/Type /Page").
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { pdf } from '@react-pdf/renderer';
import CharacterSheet, { SPELL_ROWS_PER_PAGE } from './CharacterSheetDoc';

async function toBytes(el) {
  const blob = await pdf(el).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

/** Conta as páginas nos bytes do PDF. */
function pageCount(bytes) {
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  return (text.match(/\/Type \/Page\b/g) ?? []).length;
}

describe('character sheet PDF', () => {
  it('renders a valid, non-trivial PDF (blank = 2 pages)', async () => {
    const bytes = await toBytes(<CharacterSheet />);
    expect(bytes.length).toBeGreaterThan(2000);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
    expect(pageCount(bytes)).toBe(2);
  }, 20000);

  it('magias além da página 2 geram páginas EXTRAS de spells (página 1 não repete)', async () => {
    const spellRows = Array.from({ length: SPELL_ROWS_PER_PAGE + 5 }, (_, i) => ({
      level: '1', name: `Spell ${i + 1}`, time: 'A', range: '30 ft',
      c: false, r: false, m: false, notes: '', _rank: 1,
    }));
    const model = { sheets: [{ spellRows }] };
    const bytes = await toBytes(<CharacterSheet model={model} />);
    expect(pageCount(bytes)).toBe(3);
  }, 20000);
});
