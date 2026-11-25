// =============================================================================
// imagePaste.test: achar a imagem numa colagem
// =============================================================================
// O QUE FAZ
//   imageFromTransfer: a imagem em `files`, só em `items` (Firefox), e nada quando
//   a colagem é só texto.
// -----------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { imageFromTransfer } from './imagePaste';

const png = new File([new Uint8Array([137, 80, 78, 71])], 'shot.png', { type: 'image/png' });

describe('imageFromTransfer', () => {
  it('takes the image from files', () => {
    expect(imageFromTransfer({ files: [png], items: [] })).toBe(png);
  });

  it('falls back to items when files is empty', () => {
    const items = [{ kind: 'string', type: 'text/plain' }, { kind: 'file', type: 'image/png', getAsFile: () => png }];
    expect(imageFromTransfer({ files: [], items })).toBe(png);
  });

  it('ignores a text paste and a missing transfer', () => {
    expect(imageFromTransfer({ files: [], items: [{ kind: 'string', type: 'text/plain' }] })).toBe(null);
    expect(imageFromTransfer(null)).toBe(null);
  });
});
