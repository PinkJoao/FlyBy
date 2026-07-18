// Verifica que o pipeline de export de PDF (Fase E) produz um PDF válido, sem
// depender do download no navegador: o TEMPLATE VAZIO (2 páginas) e a
// PAGINAÇÃO de magias (linhas além da página 2 geram páginas extras de spells).
import { describe, it, expect } from 'vitest';
import { pdf } from '@react-pdf/renderer';
import CharacterSheet, { SPELL_ROWS_PER_PAGE } from './CharacterSheetDoc';

async function toBytes(el) {
  const blob = await pdf(el).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

/** Conta as páginas nos bytes do PDF (dicts "/Type /Page"; "/Pages" não casa). */
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
    // 1 página de rosto + 2 páginas de magias (31 + 5).
    expect(pageCount(bytes)).toBe(3);
  }, 20000);
});
