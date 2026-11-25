// =============================================================================
// pdfOptions.test: testes das opções da ficha PDF
// =============================================================================
// O QUE FAZ
//   O padrão, a normalização campo a campo de um valor gravado, os atalhos
//   (mantendo tema e papel) e a detecção do "Custom".
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { normalizePdfOptions, applyPreset, presetOf, DEFAULT_PDF_OPTIONS } from './pdfOptions';

describe('pdfOptions', () => {
  it('nada gravado vira o padrão', () => {
    expect(normalizePdfOptions(undefined)).toEqual(DEFAULT_PDF_OPTIONS);
  });

  it('valor inválido cai no padrão campo a campo, sem perder os válidos', () => {
    const o = normalizePdfOptions({
      theme: 'neon',
      pageSize: 'LETTER',
      sections: { spells: false, bogus: true },
      detail: { classFeatures: 'titles', spells: 'everything' },
      flavor: { items: 'yes' },
    });
    expect(o.theme).toBe(DEFAULT_PDF_OPTIONS.theme);
    expect(o.pageSize).toBe('LETTER');
    expect(o.sections.spells).toBe(false);
    expect(o.sections).not.toHaveProperty('bogus');
    expect(o.detail.classFeatures).toBe('titles');
    expect(o.detail.spells).toBe(DEFAULT_PDF_OPTIONS.detail.spells);
    expect(o.flavor.items).toBe(DEFAULT_PDF_OPTIONS.flavor.items);
  });

  it('o atalho troca o conteúdo e mantém o tema e o papel', () => {
    const o = applyPreset({ theme: 'white', pageSize: 'LETTER' }, 'compact');
    expect(o.theme).toBe('white');
    expect(o.pageSize).toBe('LETTER');
    expect(o.detail.classFeatures).toBe('titles');
    expect(presetOf(o)).toBe('compact');
    expect(presetOf(applyPreset(o, 'complete'))).toBe('complete');
  });

  it('mexer num campo depois do atalho vira personalizado', () => {
    const o = applyPreset({}, 'compact');
    o.flavor.species = true;
    expect(presetOf(o)).toBe('custom');
  });
});
