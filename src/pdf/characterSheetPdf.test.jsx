// =============================================================================
// characterSheetPdf.test: testes do PDF da ficha
// =============================================================================
// O QUE FAZ
//   O pipeline produz um PDF válido sem o download do navegador, com as fontes
//   da ficha embutidas: o personagem vazio cabe na página de combate mais a
//   história, desligar seções tira as páginas delas, e o retrato entra (e sai
//   com o campo Portrait).
//
// FUNÇÕES
//   toBytes(el): os bytes do PDF.
//   pageCount(bytes): as páginas (dicts "/Type /Page").
//   render(options): o PDF de um personagem novo com as opções.
// -----------------------------------------------------------------------------

import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { pdf } from '@react-pdf/renderer';
import CharacterSheet from './CharacterSheetDoc';
import { buildSheetModel } from './sheetModel';
import { registerPdfFonts } from './fonts';
import { createCharacter } from '../schema/character';

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

const derived = {
  level: 1, proficiencyBonus: 2,
  scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  modifiers: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
  saves: {}, skills: {}, inventory: [], spellcasting: { origins: [] },
};

/** O PDF de um personagem novo com as opções. */
function render(options) {
  const model = buildSheetModel(createCharacter({ name: 'Test Hero' }), derived, {}, options);
  return toBytes(<CharacterSheet model={model} />);
}

describe('character sheet PDF', () => {
  beforeAll(() => registerPdfFonts((url) => join(process.cwd(), url)));

  it('gera um PDF válido com as fontes da ficha embutidas', async () => {
    const bytes = await render({ theme: 'parchment' });
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
    let text = '';
    for (const b of bytes) text += String.fromCharCode(b);
    expect(text).toContain('Cinzel-Bold');
    expect(text).toContain('Alegreya-Regular');
    expect(pageCount(bytes)).toBe(2);
  }, 30000);

  it('o retrato entra no cabeçalho e na história, e o campo Portrait o tira', async () => {
    const png = `data:image/png;base64,${readFileSync(join(process.cwd(), 'public/icons/icon-192.png')).toString('base64')}`;
    const images = async (options) => {
      const ch = createCharacter({ name: 'Test Hero' });
      ch.meta.portrait = png;
      const bytes = await toBytes(<CharacterSheet model={buildSheetModel(ch, derived, {}, options)} />);
      let text = '';
      for (const b of bytes) text += String.fromCharCode(b);
      return (text.match(/\/Subtype \/Image/g) ?? []).length;
    };
    expect(await images({})).toBeGreaterThan(0);
    expect(await images({ fields: { portrait: false } })).toBe(0);
  }, 30000);

  it('desligar seções tira as páginas delas', async () => {
    const bytes = await render({ sections: { combat: true, features: false, spells: false, inventory: false, biography: false } });
    expect(pageCount(bytes)).toBe(1);
  }, 30000);
});
